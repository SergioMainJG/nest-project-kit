import type { ProjectOptions, RawOptions } from "../options/option-types.js";

import { resolveOptions } from "../options/option-resolver.js";
import { buildProject } from "./build-project.js";

const CONTEXT = { author: "Ada Lovelace", random: () => "f".repeat(8), year: 2026 };

const build = async (raw: RawOptions = {}, name = "orders-api") => {
  const options: ProjectOptions = { ...(await resolveOptions(raw)), name };
  return { options, project: buildProject(options, CONTEXT) };
};

const file = (project: Awaited<ReturnType<typeof build>>["project"], path: string): string => {
  const content = project.files.get(path);
  if (content === undefined) {
    throw new Error(`${path} was not generated`);
  }
  return content;
};

interface PackageJson {
  scripts: Record<string, string>;
}

const packageJson = (project: Awaited<ReturnType<typeof build>>["project"]): PackageJson =>
  JSON.parse(file(project, "package.json")) as PackageJson;

describe("buildProject", () => {
  it("always ships env, template.env, validated env schema and the secrets script", async () => {
    const { project } = await build();

    for (const path of [
      ".env",
      "template.env",
      "src/config/envs.schema.ts",
      "scripts/secrets.ts",
      "test/test-env.ts",
    ]) {
      expect(project.files.has(path)).toBe(true);
    }
    expect(packageJson(project).scripts.secrets).toBe("bun scripts/secrets.ts");
  });

  it("never commits secrets: template.env leaves them empty, .env gets generated ones", async () => {
    const { project } = await build();

    expect(file(project, "template.env")).toMatch(/^JWT_SECRET=$/mu);
    expect(file(project, ".env")).toMatch(/^JWT_SECRET=f{8}$/mu);
    expect(file(project, ".env")).not.toContain("change-me");
    expect(file(project, ".gitignore")).toMatch(/^\.env$/mu);
  });

  it("validates every declared variable in the env schema", async () => {
    const { project } = await build();
    const keys = [...file(project, "template.env").matchAll(/^#?\s?([A-Z_]+)=/gmu)].map(
      (match) => match[1],
    );

    for (const key of keys) {
      expect(file(project, "src/config/envs.schema.ts")).toContain(key);
    }
  });

  it("uses Bun-native implementations when the Bun adapter is chosen", async () => {
    const { project } = await build({
      cache: "redis",
      db: "sqlite",
      httpAdapter: "bun",
      orm: "drizzle",
    });

    expect(project.dependencies.has("nestjs-platform-bun")).toBe(true);
    expect(project.dependencies.has("argon2")).toBe(false);
    expect(project.dependencies.has("@keyv/redis")).toBe(false);
    expect(project.dependencies.has("better-sqlite3")).toBe(false);
    expect(file(project, "src/common/hashing/bun-password-hasher.ts")).toContain("Bun.password");
    expect(file(project, "src/config/drizzle/database.ts")).toContain("drizzle-orm/bun-sqlite");
    expect(file(project, "src/config/cache/bun-redis.store.ts")).toContain("RedisClient");
    expect(file(project, "README.md")).toContain("not maintained by the NestJS team");
  });

  it("keeps official integrations on Node for the other adapters", async () => {
    const { project } = await build({ httpAdapter: "express", orm: "drizzle" });

    expect(project.dependencies.has("argon2")).toBe(true);
    expect(project.dependencies.has("pg")).toBe(true);
    expect(packageJson(project).scripts["start:prod"]).toBe("node dist/main.js");
  });

  it("binds the users repository to the chosen ORM adapter", async () => {
    const { project } = await build({ db: "mysql", orm: "typeorm" });

    expect(file(project, "src/users/users.module.ts")).toContain(
      "useClass: TypeOrmUsersRepository",
    );
    expect(file(project, "src/users/users.module.ts")).toContain(
      "TypeOrmModule.forFeature([UserEntity])",
    );
    expect(project.dependencies.has("mysql2")).toBe(true);
  });

  it("uses the official auth packages when auth2 is chosen", async () => {
    const { project } = await build({ auth2: "true" });

    expect(project.dependencies.has("@nestjs/authentication")).toBe(true);
    expect(project.dependencies.has("@nestjs/passport")).toBe(false);
    expect(file(project, "src/app.module.ts")).toContain("AuthenticationModule.forRootAsync");
  });

  it("writes request validation with the chosen library", async () => {
    const zod = await build({ validator: "zod" });
    const dto = await build({ validator: "class" });

    expect(file(zod.project, "src/auth/auth.schemas.ts")).toContain("z.object");
    expect(file(zod.project, "src/main.setup.ts")).toContain("StandardSchemaValidationPipe");
    expect(file(dto.project, "src/auth/auth.schemas.ts")).toContain("@IsEmail()");
    expect(file(dto.project, "src/main.setup.ts")).toContain("new ValidationPipe(");
  });

  it("adds the OWASP pieces only when they are enabled", async () => {
    const secured = await build({ csrf: "true", httpAdapter: "fastify" });
    const open = await build({ owasp: "false" });

    expect(file(secured.project, "src/main.setup.ts")).toContain("await setupCsrf(");
    expect(file(secured.project, "src/main.setup.ts")).toContain("helmet");
    expect(file(secured.project, "template.env")).toContain("CSRF_SECRET=");
    expect(file(open.project, "src/main.setup.ts")).not.toContain("helmet");
    expect(file(open.project, "src/main.setup.ts")).not.toContain("enableCors");
  });

  it("generates compose.yaml for docker and Quadlet units for podman", async () => {
    const docker = await build({ container: "docker", rp: "nginx" });
    const podman = await build({ container: "podman" });

    expect(file(docker.project, "compose.yaml")).toContain("image: docker.io/library/postgres");
    expect(docker.project.files.has("proxy/nginx.conf.template")).toBe(true);
    expect(podman.project.files.has("quadlets/app.kube")).toBe(true);
    expect(podman.project.files.has("compose.yaml")).toBe(false);
  });

  it("credits the git user in the MIT license", async () => {
    const { project } = await build({ license: "mit" });

    expect(file(project, "LICENSE")).toContain("Copyright (c) 2026 Ada Lovelace");
  });

  it("generates a nest-commander app for the cli type", async () => {
    const { project } = await build({ app: "cli", orm: "none" });

    expect(file(project, "src/main.ts")).toContain("CommandFactory.run");
    expect(project.files.has("src/main.setup.ts")).toBe(false);
    expect(project.files.has("Containerfile")).toBe(false);
  });
});
