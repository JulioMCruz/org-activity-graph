import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { publishBranch } from "../src/publish.mjs";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "graph-publish-"));
  const remote = join(root, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", remote]);
  const dir = mkdtempSync(join(tmpdir(), "graph-dist-"));
  writeFileSync(join(dir, "activity.svg"), "<svg/>");
  return { dir, remote, read: (...args) => execFileSync("git", ["-C", remote, ...args]).toString().trim() };
}

test("the graph lands on its branch as one commit by the bot, run after run", () => {
  const { dir, remote, read } = setup();
  publishBranch({ dir, branch: "activity", token: "t", remote });
  writeFileSync(join(dir, "activity.svg"), "<svg id='new'/>");
  publishBranch({ dir, branch: "activity", token: "t", remote });
  assert.equal(read("rev-list", "--count", "activity"), "1");
  assert.equal(read("show", "activity:activity.svg"), "<svg id='new'/>");
  assert.equal(read("log", "-1", "--format=%an", "activity"), "github-actions[bot]");
});

test("a failed push explains the permission and never shows the token", () => {
  const { dir, remote } = setup();
  const token = "secret-token-value";
  assert.throws(
    () => publishBranch({ dir, branch: "activity", token, remote: `${remote}-missing` }),
    (error) => /permissions: contents: write/.test(error.message) && !error.message.includes(token) && !error.message.includes(Buffer.from(`x-access-token:${token}`).toString("base64")),
  );
});
