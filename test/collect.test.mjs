import assert from "node:assert/strict";
import { test } from "node:test";

import { collectActivity, isExcludedAuthor } from "../src/collect.mjs";

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
const commit = (login) => ({ committedDate: recent, author: { name: login, user: { login } } });
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
