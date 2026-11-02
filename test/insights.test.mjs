import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCalendar } from "../src/calendar.mjs";
import { breakdown, highlights, languageShares, streaks } from "../src/insights.mjs";

const days = (...counts) => counts.map((count, i) => ({ key: `2026-10-${String(i + 1).padStart(2, "0")}`, weekday: i % 7, count }));

test("a streak survives an empty today and ends on an empty yesterday", () => {
  assert.deepEqual(streaks(days(1, 1, 0, 1, 1, 1, 0)), { current: 3, longest: 3 });
  assert.deepEqual(streaks(days(1, 1, 0, 1, 1)), { current: 2, longest: 2 });
  assert.deepEqual(streaks(days(1, 1, 0, 0)), { current: 0, longest: 2 });
  assert.deepEqual(streaks(days(1, 1, 1)), { current: 3, longest: 3 });
  assert.deepEqual(streaks([]), { current: 0, longest: 0 });
});

test("highlights rank the busiest days and name the busiest weekday", () => {
  const calendar = buildCalendar(new Map([["2026-10-24", 9], ["2026-10-17", 9], ["2026-10-20", 4]]), "2026-10-25");
  const result = highlights(calendar.days);
  assert.deepEqual(result.busiestDays.map((day) => day.key), ["2026-10-24", "2026-10-17", "2026-10-20"]);
  assert.equal(result.busiestWeekday, "Saturday");
  assert.equal(result.activeDays, 3);
  assert.equal(result.total, 22);
  assert.equal(result.recent.length, 30);
  assert.equal(result.recent.at(-1).key, "2026-10-25");
});

test("an empty year has highlights too", () => {
  const result = highlights(buildCalendar(new Map(), "2026-10-25").days);
  assert.deepEqual(result.busiestDays, []);
  assert.equal(result.busiestWeekday, "None");
});

test("languages follow the commits, not the size of each repository", () => {
  const go = { totalSize: 1000000, edges: [{ size: 1000000, node: { name: "Go", color: "#00add8" } }] };
  const mixed = {
    totalSize: 100,
    edges: [
      { size: 50, node: { name: "TypeScript", color: "#3178c6" } },
      { size: 50, node: { name: "Go", color: "#00add8" } },
    ],
  };
  const shares = languageShares([
    { commits: 1, languages: go },
    { commits: 9, languages: mixed },
    { commits: 5, languages: { totalSize: 0, edges: [] } },
    { commits: 5 },
  ]);
  assert.deepEqual(shares.map((s) => s.name), ["Go", "TypeScript"]);
  assert.equal(shares[0].share, 0.55);
  assert.equal(shares[1].color, "#3178c6");
});

test("shares keep the part of the items that did not fit", () => {
  const repos = Array.from({ length: 8 }, (_, i) => ({
    commits: 1,
    languages: { totalSize: 1, edges: [{ size: 1, node: { name: `L${i}`, color: null } }] },
  }));
  const shares = languageShares(repos);
  assert.equal(shares.length, 6);
  assert.equal(shares[0].share, 1 / 8);
});

test("places add up by name and private work joins with no name", () => {
  const { places } = breakdown({
    repos: [
      { name: "acme", commits: 3 },
      { name: "octocat", commits: 2 },
      { name: "acme", commits: 3 },
    ],
    privateCommits: 2,
  });
  assert.deepEqual(places.map((p) => [p.name, p.value]), [["acme", 6], ["octocat", 2], ["Private repositories", 2]]);
  assert.equal(places[0].share, 0.6);
});
