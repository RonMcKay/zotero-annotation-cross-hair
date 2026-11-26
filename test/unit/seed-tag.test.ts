import { expect } from "chai";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve("scripts/seed-initial-tag.sh");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function repo(commits: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "seed-tag-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.invalid");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  for (const msg of commits)
    git(dir, "commit", "-q", "--allow-empty", "-m", msg);
  return dir;
}

function seed(cwd: string) {
  return spawnSync("bash", [SCRIPT], { cwd, encoding: "utf8" });
}

describe("seed-initial-tag.sh", function () {
  const dirs: string[] = [];

  afterEach(function () {
    dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
  });

  it("tags the root commit v0.0.0 when no version tag exists", function () {
    const dir = repo(["chore: initial commit", "feat: first feature"]);
    dirs.push(dir);
    expect(seed(dir).status).to.equal(0);
    expect(git(dir, "rev-list", "-n1", "v0.0.0")).to.equal(
      git(dir, "rev-list", "--max-parents=0", "HEAD"),
    );
  });

  it("does nothing when a version tag already exists", function () {
    const dir = repo(["chore: initial commit", "feat: first feature"]);
    dirs.push(dir);
    git(dir, "tag", "v0.1.0");
    expect(seed(dir).status).to.equal(0);
    expect(git(dir, "tag", "-l", "v0.0.0")).to.equal("");
  });

  it("refuses when the root commit is the only commit", function () {
    const dir = repo(["feat: everything in one commit"]);
    dirs.push(dir);
    const result = seed(dir);
    expect(result.status).to.not.equal(0);
    expect(result.stderr).to.contain("empty root commit");
    expect(git(dir, "tag", "-l")).to.equal("");
  });
});
