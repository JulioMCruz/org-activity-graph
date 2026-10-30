import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCalendar, dayKey, levelFor, levelThresholds, weeklyTotals } from "../src/calendar.mjs";

test("the grid starts on a Sunday and ends today", () => {
  const { weeks, days } = buildCalendar(new Map(), "2026-10-25");
  assert.equal(days[0].weekday, 0);
  assert.equal(days.at(-1).key, "2026-10-25");
  assert.ok(weeks.length === 53 || weeks.length === 54);
  assert.ok(weeks.slice(0, -1).every((w) => w.length === 7));
});

test("day counts land on their date", () => {
  const { days } = buildCalendar(new Map([["2026-10-20", 4]]), "2026-10-25");
  assert.equal(days.find((d) => d.key === "2026-10-20").count, 4);
  assert.equal(days.find((d) => d.key === "2026-10-21").count, 0);
});

test("dayKey groups by the given time zone", () => {
  const lateUtc = new Date("2026-10-25T02:30:00Z");
  assert.equal(dayKey(lateUtc, "UTC"), "2026-10-25");
  assert.equal(dayKey(lateUtc, "America/New_York"), "2026-10-24");
});

test("levels follow the quartiles of active days", () => {
  const thresholds = levelThresholds([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(levelFor(0, thresholds), 0);
  assert.equal(levelFor(1, thresholds), 1);
  assert.equal(levelFor(8, thresholds), 4);
  assert.deepEqual(levelThresholds([0, 0]), [1, 1, 1]);
});

test("weekly totals add up each grid week", () => {
  const counts = new Map([["2026-10-19", 2], ["2026-10-20", 3]]);
  const { weeks } = buildCalendar(counts, "2026-10-25");
  const totals = weeklyTotals(counts, weeks);
  assert.equal(totals.reduce((s, n) => s + n, 0), 5);
});
