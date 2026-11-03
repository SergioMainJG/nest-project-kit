import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ENTRY = resolve(ROOT, "src/main.ts");

interface RunResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

/**
 * Runs the real CLI in a child process (no TTY, so it never prompts). It runs from the repo root
 * because Bun reads decorator settings from the tsconfig of the working directory; projects land
 * in `cwd` through --directory.
 */
const cli = (cwd: string, ...args: string[]): RunResult => {
  const result = spawnSync("bun", [ENTRY, ...args, "--directory", cwd], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

describe("nest-project-kit CLI", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "nest-generator-cli-"));
  });

  afterEach(() => {
    rmSync(cwd, { force: true, recursive: true });
  });

  it("generates a complete project with `new <name>`", () => {
    const result = cli(cwd, "new", "orders-api", "--skip-install", "--skip-git");

    expect(result.status).toBe(0);
    const root = join(cwd, "orders-api");
    for (const path of [
      "package.json",
      "src/main.ts",
      "src/app.module.ts",
      ".env",
      "template.env",
      "scripts/secrets.ts",
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      name: string;
    };
    expect(manifest.name).toBe("orders-api");
    expect(statSync(join(root, ".env")).mode & 0o777).toBe(0o600);
  });

  it("applies the flags it is given", () => {
    const result = cli(
      cwd,
      "new",
      "shop",
      "--skip-install",
      "--skip-git",
      "--framework",
      "express",
      "--orm",
      "prisma",
      "--containerization",
      "docker",
    );

    expect(result.status).toBe(0);
    const pkg = JSON.parse(readFileSync(join(cwd, "shop/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@nestjs/platform-express"]).toBeDefined();
    expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    expect(existsSync(join(cwd, "shop/compose.yaml"))).toBe(true);
  });

  it("writes nothing on --dry-run", () => {
    const result = cli(cwd, "new", "preview", "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("src/main.ts");
    expect(existsSync(join(cwd, "preview"))).toBe(false);
  });

  it("explains an invalid flag value and exits with 64", () => {
    const result = cli(cwd, "new", "x-api", "--orm", "hibernate");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain(`Invalid value "hibernate" for --orm`);
    expect(result.stderr).toContain("Allowed values: drizzle, typeorm");
  });

  it("explains incompatible options and exits with 64", () => {
    const result = cli(cwd, "new", "x-api", "--orm", "drizzle", "--database-motor", "mongo");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("--database-motor mongo cannot be used here");
  });

  it("requires a name when there is no terminal to ask for it", () => {
    const result = cli(cwd, "new");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("Missing required project name");
  });

  it("rejects an invalid project name", () => {
    const result = cli(cwd, "new", "Not Valid");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("Invalid project name");
  });

  it("refuses to overwrite a non-empty directory", () => {
    cli(cwd, "new", "taken", "--skip-install", "--skip-git");
    writeFileSync(join(cwd, "taken/keep.txt"), "mine");

    const result = cli(cwd, "new", "taken", "--skip-install", "--skip-git");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("already exists and is not empty");
    expect(readFileSync(join(cwd, "taken/keep.txt"), "utf8")).toBe("mine");
  });

  it("rejects unknown flags", () => {
    const result = cli(cwd, "new", "x-api", "--nope");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unknown option");
  });

  it("documents every option in --help", () => {
    const result = cli(cwd, "new", "--help");

    expect(result.status).toBe(0);
    for (const flag of [
      "--framework",
      "--orm",
      "--has-owasp",
      "--reverse-proxy",
      "--type-app",
      "--ws",
    ]) {
      expect(result.stdout).toContain(flag);
    }
  });
});
