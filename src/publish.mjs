// Publishes the SVGs as the only commit of a branch, so the default branch stays
// free of daily commits.

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

/** The token travels in the environment, never in a command line or a remote URL. */
function gitEnv(token, serverUrl) {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: BOT_NAME,
    GIT_AUTHOR_EMAIL: BOT_EMAIL,
    GIT_COMMITTER_NAME: BOT_NAME,
    GIT_COMMITTER_EMAIL: BOT_EMAIL,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${serverUrl}/.extraheader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
  };
}

export function publishBranch({ dir, branch, token, repository, serverUrl = "https://github.com", remote = `${serverUrl}/${repository}.git` }) {
  const env = gitEnv(token, serverUrl);
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, stdio: "pipe" });
  rmSync(join(dir, ".git"), { recursive: true, force: true });
  git("init", "-q", "-b", branch);
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "Update activity graph");
  try {
    git("push", "-q", "-f", remote, `HEAD:refs/heads/${branch}`);
  } catch (error) {
    const detail = error.stderr?.toString().trim() ?? "";
    throw new Error(`Could not publish to the ${branch} branch. The workflow needs "permissions: contents: write". ${detail}`);
  }
}
