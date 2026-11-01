// Settings that are valid but do nothing. They fail silently otherwise: the run
// passes and the graph just lacks what was asked for.

import { hasEffect } from "./effects.mjs";

const ORG_ONLY = ["repos", "include-private", "private-strip", "include-forks", "include-archived", "exclude-authors", "exclude-repos"];

/**
 * @param isUser    the login is a person, not an organization
 * @param set       names of the inputs that have a value
 * @param stripRepos repositories asked for in `repos`
 * @param strips    names that made it into a strip
 * @param privateRepos how many private repositories the token could read
 */
export function settingWarnings({ isUser, set, stripRepos, strips, season, privateRepos }) {
  const warnings = [];
  if (set.has("effects") && !hasEffect(season)) {
    warnings.push(`effects needs a seasonal palette, and ${season} has no decoration. Try palette: seasonal.`);
  }
  if (isUser) {
    const ignored = ORG_ONLY.filter((name) => set.has(name));
    if (ignored.length) {
      warnings.push(`A personal graph comes from GitHub's own calendar, so these inputs do nothing: ${ignored.join(", ")}.`);
    }
    return warnings;
  }
  const missing = stripRepos.filter((name) => !strips.some((strip) => strip.toLowerCase() === name.toLowerCase()));
  if (missing.length) {
    warnings.push(`No strip for ${missing.join(", ")}: strips need a public repository with commits in the last year.`);
  }
  if (set.has("private-strip") && !set.has("include-private")) {
    warnings.push("private-strip needs include-private: true.");
  }
  if (set.has("include-private") && privateRepos === 0) {
    warnings.push("include-private found no private repositories. The default token only reads public ones, so pass a token that can read them.");
  }
  return warnings;
}
