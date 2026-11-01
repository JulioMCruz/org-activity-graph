// The run's summary page: what was drawn and, once it is published, the exact
// lines to paste into a README.

/** Where a README shows up as a profile: an organization keeps it in profile/. */
export function readmePath(repository) {
  return repository.split("/")[1] === ".github" ? "profile/README.md" : "README.md";
}

export function readmeSnippet({ repository, branch, fileName, org }) {
  const base = `https://raw.githubusercontent.com/${repository}/${branch}/${fileName}`;
  return [
    `<a href="${base}.svg">`,
    `<picture>`,
    `  <source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg">`,
    `  <img alt="Activity graph for ${org}" src="${base}-light.svg">`,
    `</picture>`,
    `</a>`,
  ].join("\n");
}

export function runSummary({ title, repository, branch, fileName, org }) {
  const lines = [`### ${title}`, ""];
  if (branch) {
    lines.push(
      `Paste this into \`${readmePath(repository)}\`:`,
      "",
      "```html",
      readmeSnippet({ repository, branch, fileName, org }),
      "```",
      "",
      `![Activity graph for ${org}](https://raw.githubusercontent.com/${repository}/${branch}/${fileName}.svg)`,
      "",
    );
  }
  return lines.join("\n");
}
