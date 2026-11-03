import { Injectable } from "@nestjs/common";
import { chmod, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { TargetDirectoryNotEmptyError } from "../errors/generator-errors.js";

const EXECUTABLES = new Set(["scripts/secrets.ts"]);

const errorCode = (error: unknown): unknown =>
  error instanceof Error && "code" in error ? error.code : undefined;

/** Returns why `directory` cannot receive a new project, or `undefined` when it can. */
export const checkTargetDirectory = async (directory: string): Promise<string | undefined> => {
  try {
    const entries = await readdir(directory);
    return entries.length > 0
      ? `directory "${directory}" already exists and is not empty`
      : undefined;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") {
      return undefined;
    }
    if (code === "ENOTDIR") {
      return `"${directory}" exists and is a file`;
    }
    throw error;
  }
};

/** Writes a generated file set to disk, refusing to touch a non-empty directory. */
@Injectable()
export class ProjectWriter {
  async write(directory: string, files: ReadonlyMap<string, string>): Promise<void> {
    if ((await checkTargetDirectory(directory)) !== undefined) {
      throw new TargetDirectoryNotEmptyError(directory);
    }
    const root = resolve(directory);
    for (const [path, content] of files) {
      const target = resolve(root, path);
      if (!target.startsWith(`${root}${sep}`)) {
        throw new Error(`Refusing to write outside the project: ${path}`);
      }
      // Files are written in order so a failure leaves a predictable partial tree.
      // oxlint-disable-next-line no-await-in-loop
      await mkdir(dirname(target), { recursive: true });
      // oxlint-disable-next-line no-await-in-loop
      await writeFile(target, content, { mode: path === ".env" ? 0o600 : 0o644 });
      if (EXECUTABLES.has(path)) {
        // oxlint-disable-next-line no-await-in-loop
        await chmod(join(root, path), 0o755);
      }
    }
  }
}
