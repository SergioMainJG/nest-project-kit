import { join } from "node:path";

import { packageRoot, renderThirdPartyLicenses } from "./third-party-licenses.js";

const ROOT = join("/repo", "node_modules");

const info = (name: string, overrides: Partial<{ notice: string; text: string }> = {}) => ({
  directory: join(ROOT, name),
  license: "MIT",
  name,
  notice: overrides.notice,
  repository: undefined,
  text: overrides.text,
  version: "1.0.0",
});

describe("packageRoot", () => {
  it.each([
    [join(ROOT, "rxjs", "dist", "index.js"), join(ROOT, "rxjs")],
    [join(ROOT, "@nestjs", "core", "index.js"), join(ROOT, "@nestjs", "core")],
    [join(ROOT, "a", "node_modules", "b", "lib", "x.js"), join(ROOT, "a", "node_modules", "b")],
  ])("maps %s to its package directory", (file, expected) => {
    expect(packageRoot(file)).toBe(expected);
  });

  it("ignores files outside node_modules", () => {
    expect(packageRoot(join("/repo", "src", "main.ts"))).toBeUndefined();
  });
});

describe("renderThirdPartyLicenses", () => {
  it("lists packages by name with their license text", () => {
    const text = renderThirdPartyLicenses([
      info("zod", { text: "MIT License (zod)" }),
      info("arktype", { text: "MIT License (arktype)" }),
    ]);

    expect(text.indexOf("## arktype@1.0.0")).toBeLessThan(text.indexOf("## zod@1.0.0"));
    expect(text).toContain("MIT License (arktype)");
  });

  it("reproduces NOTICE files, as Apache-2.0 requires", () => {
    expect(
      renderThirdPartyLicenses([info("rxjs", { notice: "Copyright Google", text: "Apache" })]),
    ).toContain("NOTICE:\n\n```text\nCopyright Google");
  });

  it("says so when a package ships no license file", () => {
    expect(renderThirdPartyLicenses([info("tiny")])).toContain("ships no license file");
  });
});
