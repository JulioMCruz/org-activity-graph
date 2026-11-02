// Read an organization's repositories and the commits on each default branch,
// or a person's contribution calendar, through the GitHub GraphQL API. No
// dependencies: Node 20 ships fetch.

import { dayKey } from "./calendar.mjs";

const API = "https://api.github.com/graphql";

const REPOS_QUERY = `
query($org: String!, $after: String, $privacy: RepositoryPrivacy, $languages: Boolean = false) {
  organization(login: $org) {
    repositories(first: 50, after: $after, privacy: $privacy, orderBy: {field: PUSHED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name isPrivate isFork isArchived pushedAt defaultBranchRef { name }
        languages(first: 12, orderBy: {field: SIZE, direction: DESC}) @include(if: $languages) {
          totalSize
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const HISTORY_QUERY = `
query($owner: String!, $name: String!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { oid committedDate author { name user { login } } }
          }
        }
      }
    }
  }
}`;

const OWNER_QUERY = `
query($login: String!) {
  repositoryOwner(login: $login) { __typename }
}`;

const CALENDAR_QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

const WORK_QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      commitContributionsByRepository(maxRepositories: 100) {
        contributions(first: 1) { totalCount }
        repository {
          isPrivate
          owner { login }
          languages(first: 12, orderBy: {field: SIZE, direction: DESC}) {
            totalSize
            edges { size node { name color } }
          }
        }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        contributions(first: 1) { totalCount }
        repository { isPrivate }
      }
    }
  }
}`;

const CALENDAR_LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];

const RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_WAIT_MS = 60_000;

function retryDelay(attempt, res) {
  const seconds = Number(res?.headers?.get("retry-after"));
  return seconds > 0 ? Math.min(seconds * 1000, MAX_WAIT_MS) : 2000 * 2 ** attempt;
}

function isTemporary(res) {
  return RETRY_STATUS.has(res.status) || (res.status === 403 && Boolean(res.headers?.get("retry-after")));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function makeClient(token, fetchImpl = globalThis.fetch, wait = sleep) {
  return async function graphql(query, variables) {
    for (let attempt = 0; ; attempt += 1) {
      const canRetry = attempt < RETRIES;
      let res;
      try {
        res = await fetchImpl(API, {
          method: "POST",
          headers: {
            authorization: `bearer ${token}`,
            "content-type": "application/json",
            "user-agent": "org-activity-graph",
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch (error) {
        if (!canRetry) throw error;
        await wait(retryDelay(attempt));
        continue;
      }
      if (!res.ok) {
        if (canRetry && isTemporary(res)) {
          await wait(retryDelay(attempt, res));
          continue;
        }
        throw new Error(`GitHub GraphQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const body = await res.json();
      if (body.errors?.some((e) => e.type === "RATE_LIMITED")) {
        throw new Error("GitHub's rate limit was reached. Try again in an hour, or pass a personal access token as token.");
      }
      if (body.errors?.length) {
        // Long commit histories sometimes time out on GitHub's side.
        if (canRetry && body.errors.some((e) => /timeout|timed out/i.test(e.message))) {
          await wait(retryDelay(attempt));
          continue;
        }
        throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
      }
      return body.data;
    }
  };
}

/** "User" or "Organization": the action draws either from the same login input. */
export async function ownerKind(graphql, login) {
  const { repositoryOwner } = await graphql(OWNER_QUERY, { login });
  if (!repositoryOwner) throw new Error(`No user or organization named ${login} was found on GitHub.`);
  return repositoryOwner.__typename;
}

/** True for automation accounts and any login or name the caller listed. */
export function isExcludedAuthor(author, excluded) {
  const login = author?.user?.login ?? "";
  const name = author?.name ?? "";
  if (/\[bot\]$/i.test(login) || /\[bot\]$/i.test(name)) return true;
  return excluded.has(login.toLowerCase()) || excluded.has(name.toLowerCase());
}

export async function listRepositories(graphql, { org, includePrivate, includeForks, includeArchived, excludedRepos = new Set(), since, languages = false }) {
  const repos = [];
  let after = null;
  for (;;) {
    const data = await graphql(REPOS_QUERY, {
      org,
      after,
      privacy: includePrivate ? null : "PUBLIC",
      languages,
    });
    const page = data.organization?.repositories;
    if (!page) throw new Error(`Organization ${org} was not found or the token cannot read it.`);
    let reachedOld = false;
    for (const repo of page.nodes) {
      if (repo.pushedAt && new Date(repo.pushedAt) < since) {
        // Sorted by last push: every following repository is older too.
        reachedOld = true;
        break;
      }
      if (!repo.defaultBranchRef) continue;
      if (repo.isFork && !includeForks) continue;
      if (repo.isArchived && !includeArchived) continue;
      if (repo.isPrivate && !includePrivate) continue;
      if (excludedRepos.has(repo.name.toLowerCase())) continue;
      repos.push(repo);
    }
    if (reachedOld || !page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return repos;
}

/**
 * Map of YYYY-MM-DD to commit count for one repository's default branch.
 * Commits not in `seen` yet are also added to `total`, so a commit that several
 * repositories share (a mirror or a copy) counts once for the organization.
 */
export async function repositoryDailyCounts(graphql, { org, name, since, timeZone, excluded, seen = new Set(), total = new Map(), alsoInto = null }) {
  const counts = new Map();
  let after = null;
  for (;;) {
    const data = await graphql(HISTORY_QUERY, { owner: org, name, since: since.toISOString(), after });
    const history = data.repository?.defaultBranchRef?.target?.history;
    if (!history) break;
    for (const commit of history.nodes) {
      if (isExcludedAuthor(commit.author, excluded)) continue;
      const key = dayKey(new Date(commit.committedDate), timeZone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!seen.has(commit.oid)) {
        seen.add(commit.oid);
        total.set(key, (total.get(key) ?? 0) + 1);
        alsoInto?.set(key, (alsoInto.get(key) ?? 0) + 1);
      }
    }
    if (!history.pageInfo.hasNextPage) break;
    after = history.pageInfo.endCursor;
  }
  return counts;
}

/**
 * Collect daily totals for the whole organization plus per-repository maps for
 * the public repositories the caller wants as strips.
 */
export async function collectActivity(graphql, options) {
  const repos = await listRepositories(graphql, options);
  const total = new Map();
  // Unique commits from private repositories, for one combined unnamed strip.
  const privateTotal = new Map();
  const seen = new Set();
  const byRepo = new Map();
  // Commits per public repository, and the private ones as a single number.
  const work = [];
  let privateCommits = 0;
  let activeRepos = 0;
  const wanted = new Set(options.stripRepos.map((r) => r.toLowerCase()));
  for (const repo of repos) {
    const counts = await repositoryDailyCounts(graphql, {
      ...options,
      name: repo.name,
      seen,
      total,
      alsoInto: repo.isPrivate ? privateTotal : null,
    });
    if (counts.size === 0) continue;
    activeRepos += 1;
    const commits = [...counts.values()].reduce((sum, n) => sum + n, 0);
    if (repo.isPrivate) privateCommits += commits;
    else work.push({ name: repo.name, commits, languages: repo.languages });
    // Strips name the repository, so only public ones can have one.
    if (!repo.isPrivate && wanted.has(repo.name.toLowerCase())) byRepo.set(repo.name, counts);
  }
  const privateRepos = repos.filter((repo) => repo.isPrivate).length;
  return { total, byRepo, privateTotal, activeRepos, privateRepos, work, privateCommits };
}

/**
 * A person's year from GitHub's own contribution calendar, so the shades and
 * the total match their profile. One query, with no repositories to walk.
 */
export async function collectUserActivity(graphql, login) {
  const { user } = await graphql(CALENDAR_QUERY, { login });
  const { totalContributions, weeks } = user.contributionsCollection.contributionCalendar;
  const days = weeks.flatMap((week) => week.contributionDays);
  const total = new Map();
  const levels = new Map();
  for (const day of days) {
    if (day.contributionCount > 0) total.set(day.date, day.contributionCount);
    levels.set(day.date, Math.max(0, CALENDAR_LEVELS.indexOf(day.contributionLevel)));
  }
  return {
    total,
    levels,
    lastDay: days.at(-1)?.date,
    totalContributions,
    byRepo: new Map(),
    privateTotal: new Map(),
    activeRepos: 0,
  };
}

/**
 * A person's public work: commits per repository owner with the languages of
 * each repository, plus the public commit and pull request totals. Private work
 * stays out, whatever the token can read. GitHub lists up to 100 repositories.
 */
export async function collectUserWork(graphql, login) {
  const { user } = await graphql(WORK_QUERY, { login });
  const collection = user.contributionsCollection;
  const commitsByRepo = collection.commitContributionsByRepository;
  const privateCount = (entries) =>
    entries.filter((e) => e.repository.isPrivate).reduce((sum, e) => sum + e.contributions.totalCount, 0);
  return {
    commits: collection.totalCommitContributions - privateCount(commitsByRepo),
    pullRequests: collection.totalPullRequestContributions - privateCount(collection.pullRequestContributionsByRepository),
    repos: commitsByRepo
      .filter((e) => !e.repository.isPrivate)
      .map((e) => ({ name: e.repository.owner.login, commits: e.contributions.totalCount, languages: e.repository.languages })),
  };
}
