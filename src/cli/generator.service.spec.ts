import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PromptPort, SelectChoice } from "../prompts/prompt-port.js";
import type { GenerateRequest } from "./generator.service.js";

import {
  GeneratorError,
  MissingRequiredValueError,
  RetryLimitExceededError,
} from "../errors/generator-errors.js";
import { GeneratorService } from "./generator.service.js";

class FakePrompts implements PromptPort {
  readonly inputs: string[];

  constructor(inputs: readonly string[] = []) {
    this.inputs = [...inputs];
  }

  confirm(_message: string, defaultValue: boolean): Promise<boolean> {
    return Promise.resolve(defaultValue);
  }

  input(): Promise<string> {
    return Promise.resolve(this.inputs.shift() ?? "");
  }

  select(
    _message: string,
    _choices: readonly SelectChoice[],
    defaultValue: string,
  ): Promise<string> {
    return Promise.resolve(defaultValue);
  }
}

type Report = (message: string) => void;

const silentReporter = {
  error: vi.fn<(error: unknown) => void>(),
  info: vi.fn<Report>(),
  step: vi.fn<Report>(),
  success: vi.fn<Report>(),
  warn: vi.fn<Report>(),
};

describe("GeneratorService", () => {
  let cwd: string;
  const writer = {
    write: vi.fn<(directory: string, files: ReadonlyMap<string, string>) => Promise<void>>(() =>
      Promise.resolve(),
    ),
  };
  const postGenerate = {
    gitUserName: (): string => "Ada",
    initGit: vi.fn<(directory: string) => void>(),
    install: vi.fn<(directory: string) => boolean>(() => true),
  };

  const service = (prompts: PromptPort = new FakePrompts()): GeneratorService =>
    new GeneratorService(prompts, writer, postGenerate as never, silentReporter);

  const request = (overrides: Partial<GenerateRequest> = {}): GenerateRequest => ({
    cwd,
    dryRun: false,
    interactive: false,
    name: "orders-api",
    raw: {},
    skipGit: true,
    skipInstall: true,
    ...overrides,
  });

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nest-generator-"));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(cwd, { force: true, recursive: true });
  });

  it("writes the project into <cwd>/<name>", async () => {
    await service().generate(request());

    expect(writer.write).toHaveBeenCalledWith(join(cwd, "orders-api"), expect.any(Map));
  });

  it("uses the unscoped name as the directory", async () => {
    await service().generate(request({ name: "@acme/orders-api" }));

    expect(writer.write).toHaveBeenCalledWith(join(cwd, "orders-api"), expect.any(Map));
  });

  it("fails fast without a name when it cannot prompt", async () => {
    await expect(service().generate(request({ name: undefined }))).rejects.toBeInstanceOf(
      MissingRequiredValueError,
    );
  });

  it("fails fast on an invalid name when it cannot prompt", async () => {
    await expect(service().generate(request({ name: "Bad Name" }))).rejects.toBeInstanceOf(
      GeneratorError,
    );
    expect(writer.write).not.toHaveBeenCalled();
  });

  it("refuses a name whose directory already has files", async () => {
    await writeFile(join(cwd, "orders-api"), "occupied");

    await expect(service().generate(request())).rejects.toThrow(/exists/u);
  });

  it("asks again for an invalid name and accepts a later valid one", async () => {
    const prompts = new FakePrompts(["", "orders-api"]);

    const options = await service(prompts).generate(
      request({ interactive: true, name: "Bad Name" }),
    );

    expect(options.name).toBe("orders-api");
    expect(silentReporter.warn).toHaveBeenCalledTimes(2);
  });

  it("closes after three invalid names", async () => {
    const prompts = new FakePrompts(["", "Still Bad", "also bad"]);

    await expect(
      service(prompts).generate(request({ interactive: true, name: undefined })),
    ).rejects.toBeInstanceOf(RetryLimitExceededError);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it("only lists files on a dry run", async () => {
    await service().generate(request({ dryRun: true }));

    expect(writer.write).not.toHaveBeenCalled();
    expect(silentReporter.info).toHaveBeenCalledWith(expect.stringContaining("src/main.ts"));
  });

  it("installs and initializes git unless skipped", async () => {
    await service().generate(request({ skipGit: false, skipInstall: false }));

    expect(postGenerate.install).toHaveBeenCalledOnce();
    expect(postGenerate.initGit).toHaveBeenCalledOnce();
  });
});
