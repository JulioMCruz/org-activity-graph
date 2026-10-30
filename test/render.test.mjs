import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCalendar } from "../src/calendar.mjs";
import { formatTitle, monthLabels, renderSvg } from "../src/render.mjs";
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
