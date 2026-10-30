// Renders docs/example-dark.svg and docs/example-light.svg from synthetic,
// deterministic data, so the README preview never depends on a live org.

import { mkdirSync, writeFileSync } from "node:fs";

import { buildCalendar } from "../src/calendar.mjs";
import { adaptiveSvg, formatTitle, renderSvg } from "../src/render.mjs";
import { resolveTheme } from "../src/themes.mjs";

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const todayKey = "2026-10-25";
const rand = seeded(42);
const repoNames = ["web-app", "api", "runtime-images"];
const byRepo = new Map(repoNames.map((n) => [n, new Map()]));
const total = new Map();
const end = Date.UTC(2026, 9, 25);
for (let i = 0; i < 371; i++) {
  const date = new Date(end - i * 86400000);
  const key = date.toISOString().slice(0, 10);
  const weekday = date.getUTCDay();
  const busy = weekday === 0 || weekday === 6 ? 0.35 : 0.85;
  repoNames.forEach((name, r) => {
    if (rand() < busy - r * 0.2) {
      const n = Math.floor(rand() * (12 - r * 3)) + 1;
      byRepo.get(name).set(key, n);
      total.set(key, (total.get(key) ?? 0) + n);
    }
  });
}

const calendar = buildCalendar(total, todayKey);
const commits = calendar.days.reduce((s, d) => s + d.count, 0);
const title = formatTitle("{commits} commits in the last year across {repos} repositories", commits, repoNames.length);
mkdirSync("docs", { recursive: true });
const rendered = {};
for (const mode of ["dark", "light"]) {
  const { svg } = renderSvg({
    calendar,
    strips: repoNames.map((name) => ({ name, countsByDay: byRepo.get(name) })),
    theme: resolveTheme(mode),
    meta: { title, org: "example-org", updatedKey: todayKey },
  });
  rendered[mode] = svg;
  writeFileSync(`docs/example-${mode}.svg`, svg);
  console.log(`Wrote docs/example-${mode}.svg`);
}
writeFileSync("docs/example.svg", adaptiveSvg(rendered.dark, resolveTheme("dark"), resolveTheme("light")));
console.log("Wrote docs/example.svg");
