import assert from "node:assert/strict";
import { test } from "node:test";

import { collectActivity, collectUserActivity, collectUserWork, isExcludedAuthor, makeClient, ownerKind } from "../src/collect.mjs";

test("bots and listed authors are left out", () => {
  const excluded = new Set(["ci-user"]);
  assert.equal(isExcludedAuthor({ user: { login: "dependabot[bot]" } }, excluded), true);
  assert.equal(isExcludedAuthor({ name: "github-actions[bot]", user: null }, excluded), true);
  assert.equal(isExcludedAuthor({ user: { login: "CI-User" } }, excluded), true);
  assert.equal(isExcludedAuthor({ user: { login: "octocat" } }, excluded), false);
});

function fakeGraphql({ repos, commits }) {
  const calls = [];
  const graphql = async (query, variables) => {
    calls.push(variables);
    if (query.includes("organization(")) {
      return {
        organization: {
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: repos.filter((r) => variables.privacy !== "PUBLIC" || !r.isPrivate),
          },
        },
      };
    }
    return {
      repository: {
        defaultBranchRef: {
          target: { history: { pageInfo: { hasNextPage: false }, nodes: commits[variables.name] ?? [] } },
        },
      },
    };
  };
  return { graphql, calls };
}

const recent = new Date().toISOString();
const repos = [
  { name: "web", isPrivate: false, isFork: false, isArchived: false, pushedAt: recent, defaultBranchRef: { name: "main" } },
  { name: "secret", isPrivate: true, isFork: false, isArchived: false, pushedAt: recent, defaultBranchRef: { name: "main" } },
  { name: "fork", isPrivate: false, isFork: true, isArchived: false, pushedAt: recent, defaultBranchRef: { name: "main" } },
];
let nextOid = 0;
const commit = (login, oid = `oid-${nextOid++}`) => ({ oid, committedDate: recent, author: { name: login, user: { login } } });
const commits = {
  web: [commit("ana"), commit("dependabot[bot]")],
  secret: [commit("ana"), commit("ana")],
  fork: [commit("ana")],
};
const base = {
  org: "example-org",
  since: new Date(Date.now() - 86400000),
  timeZone: "UTC",
  includeForks: false,
  includeArchived: false,
  excluded: new Set(),
  stripRepos: ["web", "secret"],
};

test("public only by default: private and forked repositories are skipped", async () => {
  const { graphql, calls } = fakeGraphql({ repos, commits });
  const { total, byRepo, activeRepos } = await collectActivity(graphql, { ...base, includePrivate: false });
  assert.equal(calls[0].privacy, "PUBLIC");
  assert.equal([...total.values()].reduce((s, n) => s + n, 0), 1);
  assert.equal(activeRepos, 1);
  assert.deepEqual([...byRepo.keys()], ["web"]);
});

test("private repositories add to totals but never get a named strip", async () => {
  const { graphql } = fakeGraphql({ repos, commits });
  const { total, byRepo, activeRepos } = await collectActivity(graphql, { ...base, includePrivate: true });
  assert.equal([...total.values()].reduce((s, n) => s + n, 0), 3);
  assert.equal(activeRepos, 2);
  assert.deepEqual([...byRepo.keys()], ["web"]);
});

test("a commit that two repositories share counts once in the totals", async () => {
  const shared = commit("ana", "shared-oid");
  const mirrored = {
    repos: [repos[0], { ...repos[0], name: "web-mirror" }],
    commits: { web: [shared, commit("ana")], "web-mirror": [shared] },
  };
  const { graphql } = fakeGraphql(mirrored);
  const { total, byRepo, activeRepos } = await collectActivity(graphql, {
    ...base,
    includePrivate: false,
    stripRepos: ["web", "web-mirror"],
  });
  assert.equal([...total.values()].reduce((s, n) => s + n, 0), 2);
  assert.equal(activeRepos, 2);
  // Each strip still shows every commit on its own repository.
  assert.equal([...byRepo.get("web-mirror").values()].reduce((s, n) => s + n, 0), 1);
});

test("excluded repositories are not read", async () => {
  const { graphql, calls } = fakeGraphql({ repos, commits });
  const { total, activeRepos } = await collectActivity(graphql, {
    ...base,
    includePrivate: true,
    excludedRepos: new Set(["secret"]),
  });
  assert.equal([...total.values()].reduce((s, n) => s + n, 0), 1);
  assert.equal(activeRepos, 1);
  assert.ok(!calls.some((c) => c.name === "secret"));
});

test("private work adds up in one unnamed total for the private strip", async () => {
  const shared = commit("ana", "private-shared");
  const twoPrivate = {
    repos: [repos[0], repos[1], { ...repos[1], name: "secret-copy" }],
    commits: { web: [commit("ana")], secret: [shared, commit("ana")], "secret-copy": [shared] },
  };
  const { graphql } = fakeGraphql(twoPrivate);
  const { total, privateTotal, byRepo } = await collectActivity(graphql, { ...base, includePrivate: true });
  const sum = (m) => [...m.values()].reduce((s, n) => s + n, 0);
  assert.equal(sum(total), 3);
  assert.equal(sum(privateTotal), 2);
  assert.deepEqual([...byRepo.keys()], ["web"]);
});

test("the owner's kind comes from its login, and an unknown login says so", async () => {
  const graphql = async (_query, { login }) => ({
    repositoryOwner: login === "missing" ? null : { __typename: login === "octocat" ? "User" : "Organization" },
  });
  assert.equal(await ownerKind(graphql, "octocat"), "User");
  assert.equal(await ownerKind(graphql, "github"), "Organization");
  await assert.rejects(ownerKind(graphql, "missing"), /No user or organization named missing/);
});

test("a person's year keeps GitHub's total and shades", async () => {
  const day = (date, contributionCount, contributionLevel) => ({ date, contributionCount, contributionLevel });
  const graphql = async () => ({
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 90,
          weeks: [
            { contributionDays: [day("2026-10-25", 0, "NONE"), day("2026-10-26", 3, "FOURTH_QUARTILE")] },
            { contributionDays: [day("2026-11-01", 7, "FIRST_QUARTILE")] },
          ],
        },
      },
    },
  });
  const activity = await collectUserActivity(graphql, "octocat");
  assert.equal(activity.totalContributions, 90);
  assert.equal(activity.lastDay, "2026-11-01");
  assert.deepEqual([...activity.total], [["2026-10-26", 3], ["2026-11-01", 7]]);
  assert.equal(activity.levels.get("2026-10-25"), 0);
  assert.equal(activity.levels.get("2026-10-26"), 4);
  assert.equal(activity.levels.get("2026-11-01"), 1);
});

function fakeResponses(...responses) {
  const waits = [];
  let calls = 0;
  const fetchImpl = async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    if (next instanceof Error) throw next;
    const { status = 200, retryAfter, json = {} } = next;
    return {
      ok: status < 400,
      status,
      headers: new Map(retryAfter ? [["retry-after", retryAfter]] : []),
      json: async () => json,
      text: async () => "body",
    };
  };
  const wait = async (ms) => waits.push(ms);
  return { fetchImpl, wait, waits, calls: () => calls };
}

test("temporary failures are retried with a growing wait", async () => {
  const api = fakeResponses({ status: 502 }, new Error("socket hang up"), { json: { errors: [{ message: "This may be the result of a timeout" }] } }, { json: { data: { ok: true } } });
  const graphql = makeClient("t", api.fetchImpl, api.wait);
  assert.deepEqual(await graphql("q"), { ok: true });
  assert.deepEqual(api.waits, [2000, 4000, 8000]);
});

test("a wait asked for by GitHub is honored, up to a minute", async () => {
  const api = fakeResponses({ status: 403, retryAfter: "7" }, { status: 429, retryAfter: "900" }, { json: { data: {} } });
  await makeClient("t", api.fetchImpl, api.wait)("q");
  assert.deepEqual(api.waits, [7000, 60000]);
});

test("errors that will not go away fail at once with a clear message", async () => {
  for (const [response, message] of [
    [{ status: 401 }, /GitHub GraphQL 401/],
    [{ status: 403 }, /GitHub GraphQL 403/],
    [{ json: { errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] } }, /rate limit was reached/],
    [{ json: { errors: [{ message: "Could not resolve" }] } }, /Could not resolve/],
  ]) {
    const api = fakeResponses(response);
    await assert.rejects(makeClient("t", api.fetchImpl, api.wait)("q"), message);
    assert.equal(api.calls(), 1);
  }
});

test("retries stop after three", async () => {
  const api = fakeResponses({ status: 503 });
  await assert.rejects(makeClient("t", api.fetchImpl, api.wait)("q"), /GitHub GraphQL 503/);
  assert.equal(api.calls(), 4);
});

test("an organization keeps commits per public repository and only a number for private ones", async () => {
  const languages = { totalSize: 10, edges: [{ size: 10, node: { name: "Go", color: "#00add8" } }] };
  const { graphql, calls } = fakeGraphql({
    repos: [{ ...repos[0], languages }, { ...repos[1], languages }],
    commits,
  });
  const { work, privateCommits } = await collectActivity(graphql, {
    org: "acme",
    since: new Date(0),
    timeZone: "UTC",
    includePrivate: true,
    excluded: new Set(),
    stripRepos: [],
    languages: true,
  });
  assert.deepEqual(work, [{ name: "web", commits: 1, languages }]);
  assert.equal(privateCommits, 2);
  assert.equal(calls[0].languages, true);
});

test("a person's work leaves private repositories out of every number", async () => {
  const languages = { totalSize: 4, edges: [{ size: 4, node: { name: "Rust", color: "#dea584" } }] };
  const entry = (owner, isPrivate, totalCount) => ({
    contributions: { totalCount },
    repository: { isPrivate, owner: { login: owner }, languages },
  });
  const graphql = async () => ({
    user: {
      contributionsCollection: {
        totalCommitContributions: 15,
        totalPullRequestContributions: 7,
        commitContributionsByRepository: [entry("acme", false, 10), entry("secret-org", true, 5)],
        pullRequestContributionsByRepository: [entry("acme", false, 4), entry("secret-org", true, 3)],
      },
    },
  });
  const work = await collectUserWork(graphql, "octocat");
  assert.equal(work.commits, 10);
  assert.equal(work.pullRequests, 4);
  assert.deepEqual(work.repos, [{ name: "acme", commits: 10, languages }]);
});
