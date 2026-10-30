// SVG rendering of the organization graph. Geometry mirrors GitHub's profile
// graph: 10px cells on a 13px step, rounded 2px, Mon/Wed/Fri labels, month
// labels on top, and a Less/More legend under the grid.

import { levelFor, levelThresholds, weeklyTotals } from "./calendar.mjs";

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
    .replace("{repos}", repos.toLocaleString("en-US"));
  if (commits === 1) text = text.replace(/\bcommits\b/, "commit");
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

/**
 * @param calendar  result of buildCalendar for the org totals
 * @param strips    [{ name, countsByDay }] in display order
 * @param theme     resolveTheme(...)
 * @param meta      { title, org, updatedKey }
 */
export function renderSvg({ calendar, strips = [], theme, meta }) {
  const { weeks, days } = calendar;
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
  const stroke = theme.background === "#ffffff" ? "rgba(31,35,40,0.06)" : "rgba(240,246,252,0.05)";

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">`,
    `<title id="t">${esc(meta.title)}</title>`,
    `<desc id="d">${esc(`Daily commits across the ${meta.org} organization from ${formatDay(calendar.startKey)} to ${formatDay(calendar.endKey)}.`)}</desc>`,
    `<style>text{font-family:${FONT};fill:${theme.muted};font-size:12px}.title{fill:${theme.text};font-size:16px}.repo{fill:${theme.text}}</style>`,
    `<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
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
      const fill = theme.levels[levelFor(day.count, thresholds)];
      out.push(
        `<rect x="${gridX + col * STEP}" y="${gridY + day.weekday * STEP}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}"/>`,
      );
    }
  });
  out.push(`</g>`);

  // Footer row: update date on the left, Less/More legend on the right.
  out.push(`<text x="${gridX}" y="${legendY + 10}">${esc(`Updated ${formatDay(meta.updatedKey)}`)}</text>`);
  const legendCellsW = 5 * STEP - (STEP - CELL);
  const moreW = 30;
  const legendX = gridX + gridW - moreW - legendCellsW - 6;
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
          `<rect x="${gridX + col * STEP}" y="${y + 16}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}"/>`,
        );
      });
      out.push(`</g>`);
    });
  }

  out.push(`</svg>`);
  return { svg: out.join("\n"), totalCommits };
}
