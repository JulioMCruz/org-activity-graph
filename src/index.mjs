// GitHub Action entry point. Reads inputs from the INPUT_* environment the
// runner provides, collects the organization's commits, and writes a dark and
// a light SVG.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCalendar, dayKey } from "./calendar.mjs";
import { collectActivity, makeClient } from "./collect.mjs";
import { adaptiveSvg, formatTitle, renderSvg } from "./render.mjs";
import { resolveTheme } from "./themes.mjs";

function input(name, fallback = "") {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  return value === undefined || value === "" ? fallback : value.trim();
}

function flag(name) {
  return /^(true|1|yes)$/i.test(input(name, "false"));
}

function list(name) {
  return input(name)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export async function run() {
  const org = input("org");
  if (!org) throw new Error("The org input is required.");
  const token = input("token");
  if (!token) throw new Error("A token is required to call the GitHub API.");
  const timeZone = input("timezone", "UTC");
  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  // A little over a year, so the first grid week is complete in any time zone.
  const since = new Date(now.getTime() - 372 * 24 * 60 * 60 * 1000);
  const stripRepos = list("repos");

  const graphql = makeClient(token);
  const { total, byRepo, privateTotal, activeRepos } = await collectActivity(graphql, {
    org,
    since,
    timeZone,
    includePrivate: flag("include-private"),
    includeForks: flag("include-forks"),
    includeArchived: flag("include-archived"),
    excluded: new Set(list("exclude-authors").map((v) => v.toLowerCase())),
    excludedRepos: new Set(list("exclude-repos").map((v) => v.toLowerCase())),
    stripRepos,
  });

  const calendar = buildCalendar(total, todayKey);
  const strips = stripRepos
    .map((name) => [...byRepo.entries()].find(([n]) => n.toLowerCase() === name.toLowerCase()))
    .filter(Boolean)
    .map(([name, countsByDay]) => ({ name, countsByDay }));
  if (flag("private-strip") && flag("include-private")) {
    strips.push({ name: "Private repositories", countsByDay: privateTotal });
  }
  const inWindow = calendar.days.reduce((s, d) => s + d.count, 0);
  const title = formatTitle(
    input("title", "{commits} commits in the last year across {repos} repositories"),
    inWindow,
    activeRepos,
  );

  const outputDir = input("output-dir", "dist");
  const fileName = input("file-name", "activity");
  mkdirSync(outputDir, { recursive: true });
  const themeOptions = {
    palette: input("palette", "github"),
    colorsDark: input("colors-dark"),
    colorsLight: input("colors-light"),
  };
  const rendered = {};
  for (const mode of ["dark", "light"]) {
    const { svg } = renderSvg({
      calendar,
      strips,
      theme: resolveTheme(mode, themeOptions),
      meta: { title, org, updatedKey: todayKey },
    });
    rendered[mode] = svg;
    const path = join(outputDir, `${fileName}-${mode}.svg`);
    writeFileSync(path, svg);
    console.log(`Wrote ${path}`);
  }
  const adaptivePath = join(outputDir, `${fileName}.svg`);
  writeFileSync(
    adaptivePath,
    adaptiveSvg(rendered.dark, resolveTheme("dark", themeOptions), resolveTheme("light", themeOptions)),
  );
  console.log(`Wrote ${adaptivePath}`);

  console.log(`${title}. Strips: ${strips.map((s) => s.name).join(", ") || "none"}.`);
  setOutput("total-commits", String(inWindow));
  setOutput("repositories", String(activeRepos));
}

if (process.env.GITHUB_ACTIONS === "true" || process.argv[1]?.endsWith("index.mjs")) {
  run().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
