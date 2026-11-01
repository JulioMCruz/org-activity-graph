import assert from "node:assert/strict";
import { test } from "node:test";

import { settingWarnings } from "../src/warnings.mjs";

const base = { isUser: false, set: new Set(), stripRepos: [], strips: [], season: "autumn", privateRepos: 0 };

test("a sound setup has nothing to warn about", () => {
  assert.deepEqual(settingWarnings({ ...base, set: new Set(["effects", "repos"]), stripRepos: ["API"], strips: ["api"] }), []);
  assert.deepEqual(settingWarnings({ ...base, set: new Set(["include-private", "private-strip"]), privateRepos: 3 }), []);
  assert.deepEqual(settingWarnings({ ...base, isUser: true, set: new Set(["effects"]) }), []);
});

test("effects without a season's decoration are flagged", () => {
  assert.match(settingWarnings({ ...base, set: new Set(["effects"]), season: "github" })[0], /needs a seasonal palette/);
});

test("a strip that did not make it is named", () => {
  const [warning] = settingWarnings({ ...base, stripRepos: ["web", "api"], strips: ["web"] });
  assert.match(warning, /No strip for api:/);
});

test("private settings that cannot work are flagged", () => {
  assert.match(settingWarnings({ ...base, set: new Set(["private-strip"]) })[0], /needs include-private/);
  assert.match(settingWarnings({ ...base, set: new Set(["include-private"]) })[0], /default token only reads public/);
});

test("organization inputs on a personal graph are listed once", () => {
  const warnings = settingWarnings({ ...base, isUser: true, set: new Set(["repos", "exclude-repos"]), stripRepos: ["web"] });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /do nothing: repos, exclude-repos/);
});
