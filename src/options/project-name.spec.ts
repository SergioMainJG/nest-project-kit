import { toDirectoryName, toPascalCase, validateProjectName } from "./project-name.js";

describe("validateProjectName", () => {
  it.each(["billing-api", "my.app", "a1", "@acme/billing-api", "orders_v2"])(
    "accepts %s",
    (name) => {
      expect(validateProjectName(name)).toBeUndefined();
    },
  );

  it.each([
    ["", "required"],
    ["   ", "required"],
    [undefined, "required"],
    ["My App", "lowercase"],
    ["UPPER", "lowercase"],
    [".hidden", "lowercase"],
    ["node_modules", "reserved"],
    ["a".repeat(215), "at most"],
  ])("rejects %j", (name, reason) => {
    expect(validateProjectName(name)).toContain(reason);
  });
});

describe("toDirectoryName", () => {
  it("drops the npm scope", () => {
    expect(toDirectoryName("@acme/billing-api")).toBe("billing-api");
    expect(toDirectoryName("billing-api")).toBe("billing-api");
  });
});

describe("toPascalCase", () => {
  it("builds a class-friendly name", () => {
    expect(toPascalCase("@acme/billing-api")).toBe("BillingApi");
  });
});
