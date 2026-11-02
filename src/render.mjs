// SVG rendering of the organization graph. Geometry mirrors GitHub's profile
// graph: 10px cells on a 13px step, rounded 2px, Mon/Wed/Fri labels, month
// labels on top, and a Less/More legend under the grid.

import { levelFor, levelThresholds, weeklyTotals } from "./calendar.mjs";
import { seasonEffect } from "./effects.mjs";
import { highlights } from "./insights.mjs";

const CELL = 10;
const STEP = 13;
const RADIUS = 2;
const PAD = 16;
const TITLE_H = 34;
const DAY_LABEL_W = 30;
const MONTH_H = 20;
const LEGEND_GAP = 12;
const LEGEND_H = 14;
const STRIP_HEAD_H = 30;
const STRIP_ROW_H = 34;
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The reveal: a new week lights up every WEEK_DELAY seconds, each square going
// from DIM_OPACITY to full strength over POP_SECONDS.
const WEEK_DELAY = 0.045;
const POP_SECONDS = 0.42;
const DIM_OPACITY = 0.35;
// The panel under the graph.
const PANEL_GAP = 12;
const PANEL_PAD = 17;
const BAR_W = 16;
const BAR_MAX_H = 58;
const COLUMN_GAP = 36;
// The reel: once the reveal is done, the busiest days take turns for REEL_STEP
// seconds each, marked on the calendar and named above it.
const REEL_START = 3;
const REEL_STEP = 3.5;
const CHAR_W = 6.4;
const CAPTION_BOTTOM = 24;

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function monthOf(key) {
  return Number(key.slice(5, 7)) - 1;
}

/** Column indexes where a month label starts, skipping labels that would collide. */
export function monthLabels(weeks) {
  const labels = [];
  weeks.forEach((week, i) => {
    const month = monthOf(week[0].key);
    if (i === 0 || month !== monthOf(weeks[i - 1][0].key)) labels.push({ col: i, month });
  });
  // A partial first month too close to the next label hides behind it.
  if (labels.length > 1 && labels[1].col - labels[0].col < 3) labels.shift();
  return labels.map((l) => ({ ...l, text: MONTHS[l.month] }));
}

export function formatTitle(template, commits, repos) {
  let text = template
    .replace("{commits}", commits.toLocaleString("en-US"))
    .replace("{contributions}", commits.toLocaleString("en-US"))
    .replace("{repos}", repos.toLocaleString("en-US"));
  if (commits === 1) text = text.replace(/\b(commit|contribution)s\b/, "$1");
  if (repos === 1) text = text.replace(/\brepositories\b/, "repository");
  return text;
}

function formatDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const shortDay = (key) => formatDay(key).replace(/,.*/, "");
const count = (n) => n.toLocaleString("en-US");
const percent = (share) => `${Math.max(0.1, Math.round(share * 1000) / 10)}%`;
const dayCount = (n) => `${count(n)} ${n === 1 ? "day" : "days"}`;

/** A number that fits on top of a bar. */
function compact(n) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/** Hover text for a square: "No commits", "1 commit", "12 commits". */
export function commitCount(n, unit = "commit") {
  if (n === 0) return `No ${unit}s`;
  return `${n.toLocaleString("en-US")} ${n === 1 ? unit : `${unit}s`}`;
}

/** Faint outline GitHub draws around each square. */
export function cellStroke(theme) {
  return theme.background === "#ffffff" ? "rgba(31,35,40,0.06)" : "rgba(240,246,252,0.05)";
}

/**
 * CSS that lights up the graph from the oldest week to the newest. A README
 * shows the SVG as an image, where CSS animation runs and scripts do not.
 * Squares wait dimmed and never hidden, so whenever a screenshot tool or a
 * paused page catches the graph, every square is still there.
 */
export function revealCss(weekCount) {
  const delays = Array.from({ length: weekCount }, (_, week) => `.w${week}{animation-delay:${(week * WEEK_DELAY).toFixed(2)}s}`);
  return [
    `.cell{animation:pop ${POP_SECONDS}s cubic-bezier(.2,.9,.3,1.3) both;transform-box:fill-box;transform-origin:center}`,
    `@keyframes pop{from{opacity:${DIM_OPACITY};transform:scale(.7)}to{opacity:1;transform:none}}`,
    `@media (prefers-reduced-motion:reduce){.cell{animation:none}}`,
    ...delays,
  ].join("");
}

/**
 * The busiest days, one at a time. The caption sits on the title row and only
 * where it clears both the title and the pieces resting on the frame, and the
 * ring is a filled shape so the adaptive file recolors it the way it does text.
 */
function reel({ days, cellAt, unit, titleEnd, captionEnd }) {
  if (days.length < 2) return { svg: "", css: "" };
  const share = 100 / days.length;
  const keyframes = `0%{opacity:0}1.2%{opacity:1}${(share - 1.5).toFixed(2)}%{opacity:1}${share.toFixed(2)}%,100%{opacity:0}`;
  const svg = days.map((day, i) => {
    const { x, y } = cellAt(day);
    const caption = `${formatDay(day.key)}: ${commitCount(day.count, unit)}`;
    const fits = captionEnd - caption.length * CHAR_W > titleEnd + 12;
    const label = fits ? `<text class="repo" x="${captionEnd}" y="20" text-anchor="end">${esc(caption)}</text>` : "";
    return `<g class="rr" style="animation-delay:${REEL_START + i * REEL_STEP}s"><path class="repo" d="M${x - 3} ${y - 3}h16v16h-16ZM${x - 1.5} ${y - 1.5}v13h13v-13Z"/>${label}</g>`;
  });
  const css = `.rr{opacity:0;animation:rr ${days.length * REEL_STEP}s linear infinite}@keyframes rr{${keyframes}}@media (prefers-reduced-motion:reduce){.rr{animation:none}}`;
  return { svg: svg.join("\n"), css };
}

/** A bar of shares on a track, so the part left out of the legend stays visible. */
function shareBar(items, x, y, width, id, track, colorOf) {
  let left = x;
  const segments = items.map((item, i) => {
    const w = Math.max(2, item.share * width - 2);
    const rect = `<rect x="${left.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="8" fill="${esc(colorOf(item, i))}"/>`;
    left += w + 2;
    return rect;
  });
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="8" rx="4"/></clipPath><g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${width}" height="8" fill="${track}"/>${segments.join("")}</g>`;
}

/**
 * The panel: the last 30 days with a number on every bar, the languages, where
 * the work went, and six facts about the year. Every number is on the picture,
 * since a README never shows the text of a hover.
 */
function insightsPanel({ top, width, theme, unit, days, data, animate }) {
  const day = highlights(days);
  const { languages = [], places = [], pullRequests, commits } = data;
  const right = width - PANEL_PAD;
  const base = top + 118;
  const stepX = (width - PANEL_PAD * 2) / day.recent.length;
  const peak = day.recent.reduce((best, d) => (d.count >= best.count ? d : best));
  const sum = day.recent.reduce((total, d) => total + d.count, 0);
  const summary = sum ? `${commitCount(sum, unit)}, best day ${shortDay(peak.key)} with ${count(peak.count)}` : commitCount(0, unit);

  const bars = day.recent.map((d, i) => {
    const h = Math.max(2, Math.round((d.count / Math.max(1, peak.count)) * BAR_MAX_H));
    const x = PANEL_PAD + i * stepX + (stepX - BAR_W) / 2;
    const mid = (x + BAR_W / 2).toFixed(1);
    const fill = d === peak && sum ? theme.levels[4] : theme.levels[d.count ? 3 : 0];
    const delay = animate ? ` style="animation-delay:${(0.5 + i * 0.03).toFixed(2)}s"` : "";
    const tick = (day.recent.length - 1 - i) % 7 === 0 ? `<text class="num" x="${mid}" y="${base + 15}" text-anchor="middle">${shortDay(d.key)}</text>` : "";
    return `<rect class="bar"${delay} x="${x.toFixed(1)}" y="${base - h}" width="${BAR_W}" height="${h}" rx="2" fill="${fill}"><title>${esc(`${commitCount(d.count, unit)} on ${formatDay(d.key)}`)}</title></rect><text class="${d === peak && sum ? "repo num" : "num"}" x="${mid}" y="${base - h - 4}" text-anchor="middle">${compact(d.count)}</text>${tick}`;
  });

  const columnW = (width - PANEL_PAD * 2 - COLUMN_GAP) / 2;
  const sectionY = base + 54;
  const rows = Math.ceil(Math.max(languages.length, places.length) / 2);
  const section = (title, items, x, id, colorOf) => {
    if (!items.length) return "";
    const legend = items.map((item, i) => {
      const lx = x + (i % 2) * (columnW / 2);
      const ly = sectionY + 38 + Math.floor(i / 2) * 20;
      return `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${esc(colorOf(item, i))}"/><text class="repo" x="${lx + 14}" y="${ly}">${esc(truncate(item.name, 20))}</text><text x="${lx + columnW / 2 - 12}" y="${ly}" text-anchor="end">${percent(item.share)}</text>`;
    });
    return `<text class="repo h" x="${x}" y="${sectionY}">${title}</text>${shareBar(items, x, sectionY + 10, columnW, id, theme.levels[0], colorOf)}${legend.join("")}`;
  };
  const ramp = [theme.levels[4], theme.levels[3], theme.levels[2], theme.levels[1], theme.border];
  const breakdown = rows
    ? [
        `<line x1="${PANEL_PAD}" x2="${right}" y1="${base + 28}" y2="${base + 28}" stroke="${theme.border}"/>`,
        section("Languages in public commits", languages, PANEL_PAD, "languages", (item) => item.color ?? theme.border),
        section(unit === "commit" ? "Where the commits went" : "Where public commits went", places, right - columnW, "places", (_, i) => ramp[i]),
      ]
    : [];

  const statY = rows ? sectionY + 38 + (rows - 1) * 20 + 46 : base + 54;
  const [best] = day.busiestDays;
  const facts = [
    ...(pullRequests === undefined
      ? [[count(day.activeDays), "Active days"], [count(Math.round(day.total / Math.max(1, day.activeDays))), "Per active day"]]
      : [[count(commits), "Public commits"], [count(pullRequests), "Public PRs"]]),
    [count(best?.count ?? 0), best ? `Best day, ${shortDay(best.key)}` : "Best day"],
    [day.busiestWeekday, "Busiest weekday"],
    [dayCount(day.current), "Current streak"],
    [dayCount(day.longest), "Longest streak"],
  ];
  const factW = (width - PANEL_PAD * 2) / facts.length;
  const tiles = facts.map(([value, label], i) => {
    const x = (PANEL_PAD + i * factW).toFixed(1);
    return `<text class="repo value" x="${x}" y="${statY}">${esc(value)}</text><text x="${x}" y="${statY + 19}">${esc(label)}</text>`;
  });

  const height = statY + 35 - top;
  const grow = animate
    ? `.bar{animation:grow ${POP_SECONDS}s ease-out both;transform-box:fill-box;transform-origin:center bottom}@keyframes grow{from{opacity:${DIM_OPACITY};transform:scaleY(.6)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.bar{animation:none}}`
    : "";
  const svg = [
    `<rect x="0.5" y="${top + 0.5}" width="${width - 1}" height="${height - 1}" rx="6" fill="none" stroke="${theme.border}"/>`,
    `<text class="repo h" x="${PANEL_PAD}" y="${top + 26}">Last ${day.recent.length} days</text>`,
    `<text x="${right}" y="${top + 26}" text-anchor="end">${esc(summary)}</text>`,
    ...bars,
    ...breakdown,
    `<line x1="${PANEL_PAD}" x2="${right}" y1="${statY - 26}" y2="${statY - 26}" stroke="${theme.border}"/>`,
    ...tiles,
  ].join("\n");
  const css = `.h{font-size:14px;font-weight:600}.num{font-size:10px}.value{font-size:17px;font-weight:600}${grow}`;
  return { svg, css, height, busiestDays: day.busiestDays };
}

/**
 * @param calendar  result of buildCalendar for the org totals
 * @param strips    [{ name, countsByDay }] in display order
 * @param theme     resolveTheme(...)
 * @param meta      { title, org, updatedKey, unit }, unit "commit" by default or "contribution" for a person
 * @param animate   light up the squares week by week when the graph loads
 * @param effects   add the season's decoration, for palettes that have one
 * @param insights  add the panel under the graph: { languages, places }, and
 *                  { commits, pullRequests } for a person. Null leaves it out.
 */
export function renderSvg({ calendar, strips = [], theme, meta, animate = false, effects = false, insights = null }) {
  const { weeks, days } = calendar;
  const unit = meta.unit ?? "commit";
  const subject = unit === "commit" ? `Daily commits across the ${meta.org} organization` : `Daily contributions by ${meta.org}`;
  const totalCommits = days.reduce((s, d) => s + d.count, 0);
  const thresholds = levelThresholds(days.map((d) => d.count));
  const gridW = weeks.length * STEP - (STEP - CELL);
  const gridH = 7 * STEP - (STEP - CELL);
  const boxW = PAD + DAY_LABEL_W + gridW + PAD;
  const width = boxW + 2;
  const gridX = 1 + PAD + DAY_LABEL_W;
  const gridY = TITLE_H + PAD + MONTH_H;
  const legendY = gridY + gridH + LEGEND_GAP;
  let boxBottom = legendY + LEGEND_H + PAD;
  const stripsTop = boxBottom;
  if (strips.length) boxBottom += STRIP_HEAD_H + strips.length * STRIP_ROW_H + PAD / 2;
  const height = boxBottom + 1;
  const stroke = cellStroke(theme);
  const cellClass = (col) => (animate ? ` class="cell w${col}"` : "");
  const legendCellsW = 5 * STEP - (STEP - CELL);
  const moreW = 30;
  const legendX = gridX + gridW - moreW - legendCellsW - 6;
  const titleEnd = 1 + meta.title.length * 7.8;
  const effect = effects
    ? seasonEffect(theme.season, theme.decor, {
        width,
        height,
        boxW,
        frameTop: TITLE_H,
        hasStrips: strips.length > 0,
        stripsTop,
        legendY,
        footerFrom: gridX + 150,
        footerTo: legendX - 44,
        titleEnd,
        delayAt: (x) => (Math.max(0, x - gridX) / STEP * WEEK_DELAY).toFixed(2),
      })
    : null;

  const panel = insights
    ? insightsPanel({ top: height + PANEL_GAP, width, theme, unit, days, data: insights, animate })
    : null;
  const fullHeight = panel ? height + PANEL_GAP + panel.height : height;
  const onTitleRow = (effect?.resting ?? []).map((piece) => piece.box).filter((box) => box.y < CAPTION_BOTTOM);
  const busiest = panel && animate
    ? reel({
        days: panel.busiestDays,
        cellAt: (day) => ({ x: gridX + weeks.findIndex((week) => week.includes(day)) * STEP, y: gridY + day.weekday * STEP }),
        unit,
        titleEnd,
        captionEnd: Math.min(boxW, ...onTitleRow.map((box) => box.x)) - 8,
      })
    : null;

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fullHeight}" viewBox="0 0 ${width} ${fullHeight}" role="img" aria-labelledby="t d">`,
    `<title id="t">${esc(meta.title)}</title>`,
    `<desc id="d">${esc(`${subject} from ${formatDay(calendar.startKey)} to ${formatDay(calendar.endKey)}.`)}</desc>`,
    `<style>text{font-family:${FONT};fill:${theme.muted};font-size:12px}.title{fill:${theme.text};font-size:16px}.repo{fill:${theme.text}}${animate ? revealCss(weeks.length) : ""}${effect?.css ?? ""}${panel?.css ?? ""}${busiest?.css ?? ""}</style>`,
    `<rect width="${width}" height="${fullHeight}" fill="${theme.background}"/>`,
    `<text class="title" x="1" y="20">${esc(meta.title)}</text>`,
    `<rect x="0.5" y="${TITLE_H + 0.5}" width="${boxW + 1}" height="${boxBottom - TITLE_H}" rx="6" fill="none" stroke="${theme.border}"/>`,
  );

  for (const label of monthLabels(weeks)) {
    out.push(`<text x="${gridX + label.col * STEP}" y="${gridY - 8}">${label.text}</text>`);
  }
  for (const [row, text] of [[1, "Mon"], [3, "Wed"], [5, "Fri"]]) {
    out.push(`<text x="${1 + PAD}" y="${gridY + row * STEP + 9}">${text}</text>`);
  }

  out.push(`<g stroke="${stroke}" stroke-width="1">`);
  weeks.forEach((week, col) => {
    for (const day of week) {
      const fill = theme.levels[day.level ?? levelFor(day.count, thresholds)];
      out.push(
        `<rect${cellClass(col)} x="${gridX + col * STEP}" y="${gridY + day.weekday * STEP}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}"><title>${esc(`${commitCount(day.count, unit)} on ${formatDay(day.key)}`)}</title></rect>`,
      );
    }
  });
  out.push(`</g>`);

  // Footer row: update date on the left, Less/More legend on the right.
  out.push(`<text x="${gridX}" y="${legendY + 10}">${esc(`Updated ${formatDay(meta.updatedKey)}`)}</text>`);
  out.push(`<text x="${legendX - 6}" y="${legendY + 10}" text-anchor="end">Less</text>`);
  theme.levels.forEach((fill, i) => {
    out.push(
      `<rect x="${legendX + i * STEP}" y="${legendY + 1}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}" stroke="${stroke}"/>`,
    );
  });
  out.push(`<text x="${legendX + legendCellsW + 6}" y="${legendY + 10}">More</text>`);

  if (strips.length) {
    out.push(`<line x1="1" x2="${boxW + 1}" y1="${stripsTop + 0.5}" y2="${stripsTop + 0.5}" stroke="${theme.border}"/>`);
    out.push(`<text x="${gridX}" y="${stripsTop + 20}">By repository, commits per week</text>`);
    strips.forEach((strip, i) => {
      const y = stripsTop + STRIP_HEAD_H + i * STRIP_ROW_H;
      const totals = weeklyTotals(strip.countsByDay, weeks);
      const repoThresholds = levelThresholds(totals);
      const sum = totals.reduce((s, n) => s + n, 0);
      out.push(`<text class="repo" x="${gridX}" y="${y + 10}">${esc(truncate(strip.name, 48))}</text>`);
      out.push(`<text x="${gridX + gridW}" y="${y + 10}" text-anchor="end">${sum.toLocaleString("en-US")}</text>`);
      out.push(`<g stroke="${stroke}" stroke-width="1">`);
      totals.forEach((n, col) => {
        const fill = theme.levels[levelFor(n, repoThresholds)];
        out.push(
          `<rect${cellClass(col)} x="${gridX + col * STEP}" y="${y + 16}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}"><title>${esc(`${strip.name}: ${commitCount(n)} the week of ${formatDay(weeks[col][0].key)}`)}</title></rect>`,
        );
      });
      out.push(`</g>`);
    });
  }

  if (panel) out.push(panel.svg);
  if (busiest) out.push(busiest.svg);
  if (effect) out.push(...effect.resting.map((piece) => piece.svg));
  // Falling pieces belong to the graph and stop at its edge, above the panel.
  if (effect) out.push(panel ? `<clipPath id="graph"><rect width="${width}" height="${height}"/></clipPath><g clip-path="url(#graph)">${effect.moving}</g>` : effect.moving);
  out.push(`</svg>`);
  return { svg: out.join("\n"), totalCommits, resting: effect?.resting.map((piece) => piece.box) ?? [] };
}

/**
 * One SVG that follows the viewer's color scheme: the dark rendering plus CSS
 * that swaps each dark color for its light counterpart. A README shows the
 * dark and light files through <picture>; this one is for opening the graph
 * on its own page, where hovering a square shows its count.
 */
export function adaptiveSvg(darkSvg, dark, light) {
  const pairs = [
    [dark.background, light.background],
    [dark.border, light.border],
    [cellStroke(dark), cellStroke(light)],
    ...dark.levels.map((color, i) => [color, light.levels[i]]),
    ...(dark.decor ?? []).map((color, i) => [color, light.decor[i]]),
  ];
  const swaps = pairs
    .filter(([from], i) => pairs.findIndex(([f]) => f === from) === i)
    .map(([from, to]) => `[fill="${from}"]{fill:${to}}[stroke="${from}"]{stroke:${to}}`)
    .join("");
  const text = `text{fill:${light.muted}}.title,.repo{fill:${light.text}}`;
  return darkSvg.replace("</style>", `@media (prefers-color-scheme: light){${swaps}${text}}</style>`);
}
