// GitHub Action entry point. Reads inputs from the INPUT_* environment the
// runner provides, collects the commits of an organization or the contributions
// of a person, and writes a dark and a light SVG.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCalendar, dayKey } from "./calendar.mjs";
import { collectActivity, collectUserActivity, makeClient, ownerKind } from "./collect.mjs";
import { adaptiveSvg, formatTitle, renderSvg } from "./render.mjs";
import { resolveTheme } from "./themes.mjs";
import { settingWarnings } from "./warnings.mjs";

const ORG_TITLE = "{commits} commits in the last year across {repos} repositories";
const USER_TITLE = "{contributions} contributions in the last year";

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

// Inputs a user can turn on, for the warnings about the ones that do nothing.
function inputsInUse() {
  const flags = ["effects", "include-private", "private-strip", "include-forks", "include-archived"].filter(flag);
  const lists = ["repos", "exclude-authors", "exclude-repos"].filter((name) => input(name));
  return new Set([...flags, ...lists]);
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export async function run() {
  const org = input("org", process.env.GITHUB_REPOSITORY_OWNER);
  if (!org) throw new Error("Set the org input to a user or organization login.");
  const token = input("token");
  if (!token) throw new Error("A token is required to call the GitHub API.");
  const timeZone = input("timezone", "UTC");
  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  // A little over a year, so the first grid week is complete in any time zone.
  const since = new Date(now.getTime() - 372 * 24 * 60 * 60 * 1000);
  const stripRepos = list("repos");

  const graphql = makeClient(token);
  const isUser = (await ownerKind(graphql, org)) === "User";
  const { total, levels, lastDay, totalContributions, byRepo, privateTotal, activeRepos, privateRepos } = isUser
    ? await collectUserActivity(graphql, org)
    : await collectActivity(graphql, {
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

  const calendar = buildCalendar(total, lastDay ?? todayKey, levels);
  const strips = stripRepos
    .map((name) => [...byRepo.entries()].find(([n]) => n.toLowerCase() === name.toLowerCase()))
    .filter(Boolean)
    .map(([name, countsByDay]) => ({ name, countsByDay }));
  if (flag("private-strip") && flag("include-private")) {
    strips.push({ name: "Private repositories", countsByDay: privateTotal });
  }
  const inWindow = totalContributions ?? calendar.days.reduce((s, d) => s + d.count, 0);
  const title = formatTitle(input("title", isUser ? USER_TITLE : ORG_TITLE), inWindow, activeRepos);

  const outputDir = input("output-dir", "dist");
  const fileName = input("file-name", "activity");
  mkdirSync(outputDir, { recursive: true });
  const themeOptions = {
    palette: input("palette", "github"),
    colorsDark: input("colors-dark"),
    colorsLight: input("colors-light"),
    todayKey,
  };
  const rendered = {};
  for (const mode of ["dark", "light"]) {
    const { svg } = renderSvg({
      calendar,
      strips,
      theme: resolveTheme(mode, themeOptions),
      meta: { title, org, updatedKey: todayKey, unit: isUser ? "contribution" : "commit" },
      animate: flag("animate"),
      effects: flag("effects"),
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
  const warnings = settingWarnings({
    isUser,
    set: inputsInUse(),
    stripRepos,
    strips: strips.map((s) => s.name),
    season: resolveTheme("dark", themeOptions).season,
    privateRepos,
  });
  for (const warning of warnings) console.log(`::warning::${warning}`);
  setOutput("total-commits", String(inWindow));
  setOutput("repositories", String(activeRepos));
}

if (process.env.GITHUB_ACTIONS === "true" || process.argv[1]?.endsWith("index.mjs")) {
  run().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
