// What the squares alone do not say: the busiest days, the streaks, and where
// the work went. A README shows the graph as a plain image, so these numbers
// are drawn on it and nothing depends on hovering.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RECENT_DAYS = 30;
const BUSIEST_DAYS = 6;
const LANGUAGE_ROWS = 6;
const PLACE_ROWS = 5;

/** The run of active days that reaches today, and the longest one of the year. */
export function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today can still be empty, so a run that reached yesterday is alive.
  const last = days.at(-1)?.count > 0 ? days.length - 1 : days.length - 2;
  let current = 0;
  while (last - current >= 0 && days[last - current].count > 0) current += 1;
  return { current, longest };
}

/** Highlights of a calendar's days. Ties go to the most recent day. */
export function highlights(days) {
  const active = days.filter((day) => day.count > 0);
  const weekdays = Array(WEEKDAYS.length).fill(0);
  for (const day of days) weekdays[day.weekday] += day.count;
  return {
    recent: days.slice(-RECENT_DAYS),
    busiestDays: [...active].sort((a, b) => b.count - a.count || b.key.localeCompare(a.key)).slice(0, BUSIEST_DAYS),
    activeDays: active.length,
    total: active.reduce((sum, day) => sum + day.count, 0),
    busiestWeekday: active.length ? WEEKDAYS[weekdays.indexOf(Math.max(...weekdays))] : "None",
    ...streaks(days),
  };
}

/** The largest items, each as a share of everything, not only of the ones kept. */
function topShares(items, rows) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return [...items]
    .sort((a, b) => b.value - a.value)
    .slice(0, rows)
    .map((item) => ({ ...item, share: item.value / total }));
}

/** Each repository's commits, split by the share of its code in each language. */
export function languageShares(repos) {
  const byName = new Map();
  for (const { commits, languages } of repos) {
    if (!languages?.totalSize) continue;
    for (const { size, node } of languages.edges) {
      const entry = byName.get(node.name) ?? { name: node.name, color: node.color, value: 0 };
      entry.value += (commits * size) / languages.totalSize;
      byName.set(node.name, entry);
    }
  }
  return topShares([...byName.values()], LANGUAGE_ROWS);
}

/**
 * Languages and places for the panel. `repos` is [{ name, commits, languages }],
 * with a repeated name adding up, so a person's repositories group by owner.
 * Private commits join as one row with no name.
 */
export function breakdown({ repos, privateCommits = 0 }) {
  const places = new Map();
  for (const { name, commits } of repos) places.set(name, (places.get(name) ?? 0) + commits);
  if (privateCommits > 0) places.set("Private repositories", privateCommits);
  return {
    languages: languageShares(repos),
    places: topShares([...places].map(([name, value]) => ({ name, value })), PLACE_ROWS),
  };
}
