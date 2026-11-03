import type { ChoiceDefinition, SelectDefinition, ToggleDefinition } from "./option-definition.js";
import type { OptionAsker } from "./option-resolver.js";

import { IncompatibleOptionsError, InvalidOptionValueError } from "../errors/generator-errors.js";
import { resolveOptions } from "./option-resolver.js";

/** Records what would be asked and answers with the default (or a scripted answer). */
class RecordingAsker implements OptionAsker {
  readonly asked: string[] = [];
  readonly offered = new Map<string, string[]>();

  constructor(private readonly answers: Readonly<Record<string, boolean | string>> = {}) {}

  select(
    definition: SelectDefinition,
    choices: readonly ChoiceDefinition[],
    fallback: string,
  ): Promise<string> {
    this.asked.push(definition.key);
    this.offered.set(
      definition.key,
      choices.map((choice) => choice.value),
    );
    return Promise.resolve(String(this.answers[definition.key] ?? fallback));
  }

  toggle(definition: ToggleDefinition, fallback: boolean): Promise<boolean> {
    this.asked.push(definition.key);
    const answer = this.answers[definition.key];
    return Promise.resolve(typeof answer === "boolean" ? answer : fallback);
  }
}

describe("resolveOptions", () => {
  describe("defaults (based on the template-nest-rest-api stack)", () => {
    it("produces the reference stack when nothing is given", async () => {
      const options = await resolveOptions({});

      expect(options).toMatchObject({
        app: "api",
        cache: "dragonfly",
        container: "podman",
        db: "pg",
        hashing: "argon2",
        httpAdapter: "fastify",
        orm: "drizzle",
        owasp: true,
        rp: "caddy",
        users: true,
        validator: "arktype",
      });
    });
  });

  describe("conditional options", () => {
    it("without an ORM there is no database and no users module", async () => {
      const options = await resolveOptions({ orm: "none" });

      expect(options).toMatchObject({ auth2: false, db: "none", users: false });
    });

    it("the mongodb ORM forces the MongoDB engine", async () => {
      await expect(resolveOptions({ orm: "mongodb" })).resolves.toMatchObject({ db: "mongo" });
    });

    it("turning OWASP off switches every security option off", async () => {
      const options = await resolveOptions({ owasp: "false" });

      expect(options).toMatchObject({ cors: false, csrf: false, safeHeaders: false });
    });

    it("CSRF is never enabled on adapters without CSRF middleware", async () => {
      await expect(resolveOptions({ httpAdapter: "node" })).resolves.toMatchObject({ csrf: false });
    });

    it("non-HTTP apps drop HTTP-only features", async () => {
      const options = await resolveOptions({ app: "microservice" });

      expect(options).toMatchObject({
        doc: "none",
        health: false,
        httpAdapter: "none",
        owasp: false,
        rp: "none",
        throttler: false,
        users: false,
        ws: false,
      });
    });

    it("CLI apps are not containerized", async () => {
      await expect(resolveOptions({ app: "cli" })).resolves.toMatchObject({
        container: "none",
        rp: "none",
      });
    });

    it("a reverse proxy needs containerization", async () => {
      await expect(resolveOptions({ container: "none" })).resolves.toMatchObject({ rp: "none" });
    });

    it("GraphQL keeps its own playground instead of OpenAPI docs", async () => {
      await expect(resolveOptions({ app: "graphql" })).resolves.toMatchObject({ doc: "none" });
    });
  });

  describe("explicit flags", () => {
    it("rejects a flag value that is not a choice", async () => {
      await expect(resolveOptions({ orm: "hibernate" })).rejects.toBeInstanceOf(
        InvalidOptionValueError,
      );
    });

    it("rejects a database the ORM cannot drive", async () => {
      await expect(resolveOptions({ db: "mongo", orm: "drizzle" })).rejects.toBeInstanceOf(
        IncompatibleOptionsError,
      );
    });

    it("rejects an adapter GraphQL is not wired for", async () => {
      await expect(resolveOptions({ app: "graphql", httpAdapter: "bun" })).rejects.toBeInstanceOf(
        IncompatibleOptionsError,
      );
    });

    it("rejects enabling an option whose prerequisite is off", async () => {
      await expect(resolveOptions({ cors: "true", owasp: "false" })).rejects.toThrow(/--has-cors/u);
    });

    it("rejects a users module without password hashing", async () => {
      await expect(resolveOptions({ hashing: "none", users: "true" })).rejects.toBeInstanceOf(
        IncompatibleOptionsError,
      );
    });

    it("accepts explicitly disabling an option that does not apply", async () => {
      await expect(resolveOptions({ csrf: "false", owasp: "false" })).resolves.toMatchObject({
        csrf: false,
      });
    });

    it.each([
      [{ cache: "false" }, { cache: "none" }],
      [{ rp: "candy" }, { rp: "caddy" }],
      [{ doc: "true" }, { doc: "scalar" }],
      [{ doc: true }, { doc: "scalar" }],
      [{ health: "terminus" }, { health: true }],
      [{ auth2: "@nestjs/authentication" }, { auth2: true }],
      [{ db: "postgresql" }, { db: "pg" }],
      [{ validator: "class-validator" }, { validator: "class" }],
    ] as const)("understands the spellings in %j", async (raw, expected) => {
      await expect(resolveOptions(raw)).resolves.toMatchObject(expected);
    });
  });

  describe("interactive mode", () => {
    it("asks every applicable option that was not given as a flag", async () => {
      const asker = new RecordingAsker();

      await resolveOptions({ orm: "drizzle" }, asker);

      expect(asker.asked).not.toContain("orm");
      expect(asker.asked).toEqual(
        expect.arrayContaining(["app", "httpAdapter", "db", "users", "cache"]),
      );
    });

    it("never asks options hidden by an earlier answer", async () => {
      const asker = new RecordingAsker({ orm: "none", owasp: false });

      await resolveOptions({}, asker);

      expect(asker.asked).not.toContain("db");
      expect(asker.asked).not.toContain("users");
      expect(asker.asked).not.toContain("cors");
      expect(asker.asked).not.toContain("csrf");
    });

    it("does not ask when only one choice is possible", async () => {
      const asker = new RecordingAsker({ orm: "mongodb" });

      const options = await resolveOptions({}, asker);

      expect(asker.asked).not.toContain("db");
      expect(options.db).toBe("mongo");
    });

    it("only offers choices compatible with earlier answers", async () => {
      const asker = new RecordingAsker({ orm: "prisma" });

      await resolveOptions({}, asker);

      expect(asker.offered.get("db")).toEqual(["pg", "mysql", "sqlite"]);
    });

    it("hides 'no hashing' once a users module was chosen", async () => {
      const asker = new RecordingAsker({ users: true });

      await resolveOptions({}, asker);

      expect(asker.offered.get("hashing")).toEqual(["argon2", "bcrypt"]);
    });
  });
});
