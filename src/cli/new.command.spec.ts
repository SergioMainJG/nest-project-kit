import { OPTION_CATALOG } from "../options/catalog/index.js";
import { flagToAttribute, toRawOptions } from "./new.command.js";

describe("flagToAttribute", () => {
  it.each([
    ["--framework", "framework"],
    ["--has-auth-2", "hasAuth2"],
    ["--database-motor", "databaseMotor"],
  ])("maps %s to commander's %s", (flag, attribute) => {
    expect(flagToAttribute(flag)).toBe(attribute);
  });
});

describe("toRawOptions", () => {
  it("keeps catalog options and drops the command's own flags", () => {
    expect(
      toRawOptions({ dryRun: true, framework: "express", hasUsers: true, orm: "none" }),
    ).toEqual({
      httpAdapter: "express",
      orm: "none",
      users: true,
    });
  });

  it("exposes one unique flag per catalog option", () => {
    const flags = OPTION_CATALOG.map((definition) => definition.flag);

    expect(new Set(flags).size).toBe(flags.length);
    // Every option listed in .specs/requirements.md.
    expect(flags).toHaveLength(29);
  });
});
