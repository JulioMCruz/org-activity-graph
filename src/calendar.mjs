// Day buckets and activity levels for a contribution-style graph.
//
// The grid follows GitHub's profile graph: one column per week starting on
// Sunday, the last column is the current week up to today, and the first
// column is the week that contains the day 52 weeks before today.

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of a Date in the given IANA time zone. */
export function dayKey(date, timeZone = "UTC") {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function keyToUtcDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Build the week grid ending on `todayKey` (YYYY-MM-DD).
 * Returns { weeks: [[{ key, count }...7 or fewer]...], days: [...] } where each
 * week holds Sunday..Saturday and the last week stops at today.
 */
export function buildCalendar(countsByDay, todayKey) {
  const today = keyToUtcDate(todayKey);
  const firstDay = new Date(today.getTime() - 52 * 7 * DAY_MS);
  const start = new Date(firstDay.getTime() - firstDay.getUTCDay() * DAY_MS);

  const weeks = [];
  const days = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const date = new Date(t);
    const key = utcDateToKey(date);
    const day = { key, weekday: date.getUTCDay(), count: countsByDay.get(key) ?? 0 };
    if (day.weekday === 0 || weeks.length === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
    days.push(day);
  }
  return { weeks, days, startKey: utcDateToKey(start), endKey: todayKey };
}

/**
 * Thresholds for levels 1..4 from the quartiles of the non-zero counts, the
 * way GitHub shades its graph: a day with no commits is level 0, and the
 * busiest quarter of active days is level 4.
 */
export function levelThresholds(counts) {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return [1, 1, 1];
  const at = (q) => active[Math.min(active.length - 1, Math.floor(q * (active.length - 1)))];
  return [at(0.25), at(0.5), at(0.75)];
}

export function levelFor(count, thresholds) {
  if (count <= 0) return 0;
  const [q1, q2, q3] = thresholds;
  if (count <= q1) return 1;
  if (count <= q2) return 2;
  if (count <= q3) return 3;
  return 4;
}

/** Sum a per-day map into one total per grid week, aligned with `weeks`. */
export function weeklyTotals(countsByDay, weeks) {
  return weeks.map((week) => week.reduce((sum, d) => sum + (countsByDay.get(d.key) ?? 0), 0));
}
