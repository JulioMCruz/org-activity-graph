import assert from "node:assert/strict";
import { test } from "node:test";

import { readmePath, readmeSnippet, runSummary } from "../src/summary.mjs";

test("the snippet points at the published files", () => {
  const snippet = readmeSnippet({ repository: "octocat/octocat", branch: "activity", fileName: "activity", org: "octocat" });
  assert.match(snippet, /<a href="https:\/\/raw\.githubusercontent\.com\/octocat\/octocat\/activity\/activity\.svg">/);
  assert.match(snippet, /srcset="https:\/\/raw\.githubusercontent\.com\/octocat\/octocat\/activity\/activity-dark\.svg"/);
  assert.match(snippet, /src="https:\/\/raw\.githubusercontent\.com\/octocat\/octocat\/activity\/activity-light\.svg"/);
});

test("the summary names the right README for a person and an organization", () => {
  assert.equal(readmePath("octocat/octocat"), "README.md");
  assert.equal(readmePath("github/.github"), "profile/README.md");
  const summary = runSummary({ title: "90 contributions", repository: "github/.github", branch: "activity", fileName: "activity", org: "github" });
  assert.match(summary, /### 90 contributions/);
  assert.match(summary, /Paste this into `profile\/README\.md`/);
  assert.match(summary, /```html\n<a href=/);
});

test("without publishing there is nothing to paste yet", () => {
  const summary = runSummary({ title: "90 contributions", repository: "octocat/octocat", fileName: "activity", org: "octocat" });
  assert.match(summary, /### 90 contributions/);
  assert.doesNotMatch(summary, /Paste this/);
});
