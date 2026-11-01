import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCalendar } from "../src/calendar.mjs";
import { adaptiveSvg, formatTitle, monthLabels, renderSvg, revealCss } from "../src/render.mjs";
import { PALETTES, resolveTheme, seasonFor } from "../src/themes.mjs";

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

test("the seasonal palette follows the calendar", () => {
  const expected = {
    "2026-10-24": "autumn",
    "2026-10-25": "halloween",
    "2026-10-31": "halloween",
    "2026-11-01": "autumn",
    "2026-12-01": "winter",
    "2026-12-17": "winter",
    "2026-12-18": "christmas",
    "2026-12-26": "christmas",
    "2026-12-27": "newyear",
    "2027-01-02": "newyear",
    "2027-01-03": "winter",
    "2028-02-29": "winter",
    "2027-03-01": "spring",
    "2027-06-01": "summer",
    "2027-09-01": "autumn",
  };
  for (const [key, name] of Object.entries(expected)) assert.equal(seasonFor(key), name, key);
  assert.deepEqual(
    resolveTheme("dark", { palette: "seasonal", todayKey: "2026-12-25" }).levels,
    PALETTES.christmas.dark,
  );
});

test("every day of a leap year has a season", () => {
  for (let day = 0; day < 366; day++) {
    const key = new Date(Date.UTC(2028, 0, 1 + day)).toISOString().slice(0, 10);
    assert.ok(PALETTES[seasonFor(key)], key);
  }
});

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("seasonal ramps get stronger with activity", () => {
  for (const name of ["spring", "summer", "autumn", "halloween", "winter", "christmas", "newyear"]) {
    const dark = PALETTES[name].dark.map(luminance);
    const light = PALETTES[name].light.map(luminance);
    assert.ok(dark.every((v, i) => i === 0 || v > dark[i - 1]), `${name} dark`);
    assert.ok(light.every((v, i) => i === 0 || v < light[i - 1]), `${name} light`);
  }
});

test("animate lights up every square week by week and changes nothing else", () => {
  const options = {
    calendar,
    strips: [{ name: "web-app", countsByDay: new Map([["2026-10-20", 3]]) }],
    theme: resolveTheme("dark"),
    meta: { title: "t", org: "o", updatedKey: "2026-10-25" },
  };
  const plain = renderSvg(options).svg;
  const animated = renderSvg({ ...options, animate: true }).svg;
  const weekCount = calendar.weeks.length;
  assert.doesNotMatch(plain, /@keyframes|class="cell/);
  assert.equal((animated.match(/<rect class="cell w\d+"/g) ?? []).length, calendar.days.length + weekCount);
  assert.match(animated, /prefers-reduced-motion:reduce/);
  assert.match(animated, new RegExp(`\\.w${weekCount - 1}\\{animation-delay:`));
  const stripped = animated.replace(/ class="cell w\d+"/g, "").replace(revealCss(weekCount), "");
  assert.equal(stripped, plain);
});

test("squares wait dimmed and are never hidden", () => {
  const [, dim] = revealCss(53).match(/from\{opacity:([\d.]+)/);
  assert.ok(Number(dim) >= 0.25);
});

test("the adaptive file keeps the reveal", () => {
  const dark = resolveTheme("dark", { palette: "halloween" });
  const light = resolveTheme("light", { palette: "halloween" });
  const { svg } = renderSvg({ calendar, theme: dark, meta: { title: "t", org: "o", updatedKey: "2026-10-25" }, animate: true });
  const adaptive = adaptiveSvg(svg, dark, light);
  assert.match(adaptive, /@keyframes pop/);
  assert.match(adaptive, /@media \(prefers-color-scheme: light\)/);
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
