// Read an organization's repositories and the commits on each default branch
// through the GitHub GraphQL API. No dependencies: Node 20 ships fetch.

import { dayKey } from "./calendar.mjs";

const API = "https://api.github.com/graphql";

const REPOS_QUERY = `
query($org: String!, $after: String, $privacy: RepositoryPrivacy) {
  organization(login: $org) {
    repositories(first: 50, after: $after, privacy: $privacy, orderBy: {field: PUSHED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { name isPrivate isFork isArchived pushedAt defaultBranchRef { name } }
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

export function makeClient(token, fetchImpl = globalThis.fetch) {
  return async function graphql(query, variables) {
    const res = await fetchImpl(API, {
      method: "POST",
      headers: {
        authorization: `bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "org-activity-graph",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
    return body.data;
  };
}

/** True for automation accounts and any login or name the caller listed. */
export function isExcludedAuthor(author, excluded) {
  const login = author?.user?.login ?? "";
  const name = author?.name ?? "";
  if (/\[bot\]$/i.test(login) || /\[bot\]$/i.test(name)) return true;
  return excluded.has(login.toLowerCase()) || excluded.has(name.toLowerCase());
}

export async function listRepositories(graphql, { org, includePrivate, includeForks, includeArchived, since }) {
  const repos = [];
  let after = null;
  for (;;) {
    const data = await graphql(REPOS_QUERY, {
      org,
      after,
      privacy: includePrivate ? null : "PUBLIC",
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
export async function repositoryDailyCounts(graphql, { org, name, since, timeZone, excluded, seen = new Set(), total = new Map() }) {
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
  const seen = new Set();
  const byRepo = new Map();
  let activeRepos = 0;
  const wanted = new Set(options.stripRepos.map((r) => r.toLowerCase()));
  for (const repo of repos) {
    const counts = await repositoryDailyCounts(graphql, { ...options, name: repo.name, seen, total });
    if (counts.size === 0) continue;
    activeRepos += 1;
    // Strips name the repository, so only public ones can have one.
    if (!repo.isPrivate && wanted.has(repo.name.toLowerCase())) byRepo.set(repo.name, counts);
  }
  return { total, byRepo, activeRepos };
}
