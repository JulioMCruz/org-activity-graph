import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCalendar } from "../src/calendar.mjs";
import { adaptiveSvg, formatTitle, monthLabels, renderSvg } from "../src/render.mjs";
import { resolveTheme } from "../src/themes.mjs";

const calendar = buildCalendar(new Map([["2026-10-20", 3], ["2026-09-01", 1]]), "2026-10-25");

test("the title formats totals and singular words", () => {
  assert.equal(formatTitle("{commits} commits across {repos} repositories", 3850, 57), "3,850 commits across 57 repositories");
  assert.equal(formatTitle("{commits} commits across {repos} repositories", 1, 1), "1 commit across 1 repository");
});

test("one cell per day and five legend cells", () => {
  const { svg, totalCommits } = renderSvg({
    calendar,
    theme: resolveTheme("dark"),
    meta: { title: "4 commits", org: "example-org", updatedKey: "2026-10-25" },
  });
  const cells = svg.match(/<rect x="\d+" y="\d+" width="10" height="10"/g) ?? [];
  assert.equal(cells.length, calendar.days.length + 5);
  assert.equal(totalCommits, 4);
  assert.match(svg, /Updated Oct 25, 2026/);
  assert.match(svg, /<title id="t">4 commits<\/title>/);
});

test("strips add one weekly row per repository", () => {
  const { svg } = renderSvg({
    calendar,
    strips: [{ name: "web-app", countsByDay: new Map([["2026-10-20", 3]]) }],
    theme: resolveTheme("light"),
    meta: { title: "t", org: "o", updatedKey: "2026-10-25" },
  });
  assert.match(svg, />web-app</);
  assert.match(svg, /By repository, commits per week/);
});

test("text is escaped", () => {
  const { svg } = renderSvg({
    calendar,
    theme: resolveTheme("dark"),
    meta: { title: "<b>&", org: "o", updatedKey: "2026-10-25" },
  });
  assert.match(svg, /&lt;b&gt;&amp;/);
});

test("month labels skip a partial first month", () => {
  const labels = monthLabels(calendar.weeks);
  assert.ok(labels.length >= 11 && labels.length <= 13);
  assert.ok(labels.every((l, i) => i === 0 || l.col - labels[i - 1].col >= 3));
});

test("palettes and custom colors resolve", () => {
  assert.equal(resolveTheme("dark", { palette: "ember" }).levels.length, 5);
  const custom = resolveTheme("light", {
    colorsDark: "#000,#111,#222,#333,#444",
    colorsLight: "#fff,#eee,#ddd,#ccc,#bbb",
  });
  assert.deepEqual(custom.levels, ["#fff", "#eee", "#ddd", "#ccc", "#bbb"]);
  assert.throws(() => resolveTheme("dark", { palette: "nope" }));
  assert.throws(() => resolveTheme("dark", { colorsDark: "#000", colorsLight: "#fff" }));
});

test("each square carries its count for hovering", () => {
  const { svg } = renderSvg({
    calendar,
    strips: [{ name: "web-app", countsByDay: new Map([["2026-10-20", 3]]) }],
    theme: resolveTheme("dark"),
    meta: { title: "t", org: "o", updatedKey: "2026-10-25" },
  });
  assert.match(svg, /<title>3 commits on Oct 20, 2026<\/title><\/rect>/);
  assert.match(svg, /<title>1 commit on Sep 1, 2026<\/title>/);
  assert.match(svg, /<title>No commits on Oct 25, 2026<\/title>/);
  assert.match(svg, /<title>web-app: 3 commits the week of Oct 18, 2026<\/title>/);
});

test("the adaptive file swaps every dark color under a light scheme", () => {
  const dark = resolveTheme("dark");
  const light = resolveTheme("light");
  const { svg } = renderSvg({ calendar, theme: dark, meta: { title: "t", org: "o", updatedKey: "2026-10-25" } });
  const adaptive = adaptiveSvg(svg, dark, light);
  assert.match(adaptive, /@media \(prefers-color-scheme: light\)/);
  for (const [i, color] of dark.levels.entries()) {
    assert.ok(adaptive.includes(`[fill="${color}"]{fill:${light.levels[i]}}`));
  }
  assert.ok(adaptive.includes(`[fill="${dark.background}"]{fill:${light.background}}`));
  assert.ok(adaptive.includes(`[stroke="${dark.border}"]{stroke:${light.border}}`));
  assert.equal(adaptive.match(/<\/style>/g).length, 1);
});
