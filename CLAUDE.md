# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@sergioar/nest-project-kit` (commands `nest-project-kit` and alias `nest-generator`): a CLI (NestJS 12 + nest-commander, run with **Bun**) that scaffolds NestJS projects with the plugins the user picks. The requirements are in `.specs/requirements.md`. `reference/template-nest-rest-api/` is the original REST template the generated code is based on. It is reference material only: it is not built, linted or tested. The README is in Spanish; keep user-facing docs in Spanish. Code, CLI messages and generated projects are in English.

## Commands

```bash
bun run dev -- new demo --dry-run   # run the CLI from src/
bun run build                       # rspack → dist/main.cjs (single minified CJS file, Node ≥ 22 or Bun)
bun run check                       # oxfmt --check && oxlint (type-aware); what CI runs
bun run typecheck
bun run test                        # unit: src/**/*.spec.ts
bun run test:int                    # integration: test/integration/**/*.int-spec.ts
bun run test:all

bun --bun vitest run --project unit src/options/option-resolver.spec.ts -t "rejects"
```

Always run vitest through `bun --bun vitest`.

## Architecture

- **Options** (`src/options/`): `catalog/*.options.ts` declares every option (flag, choices, aliases, default, `isAvailable`, `allowedValues`) in the order it is asked. Later options depend on earlier ones. `resolveOptions(raw, asker?)` normalizes explicit flags, skips options that don't apply (setting them to `unavailableValue`, or throwing `IncompatibleOptionsError` if they were passed explicitly), and asks or uses defaults for the rest. To add an option: add it to `option-types.ts` and a catalog file. The `new` command registers its flag automatically, and the `new.command.spec.ts` flag count must be bumped.
- **CLI** (`src/cli/`): `NewCommand` is the default command. It is interactive when there is a TTY and the name is missing or `-i` is passed. `GeneratorService` orchestrates name → options → `buildProject` → `ProjectWriter` → `PostGenerate` (bun install, fmt, git). A required value (the project name) gets 3 attempts (`askWithRetry`), then a `RetryLimitExceededError`.
- **Errors** (`src/errors/generator-errors.ts`): every expected failure is a `GeneratorError` with an exit code (64 invalid input, 74 I/O, 130 cancelled). `main.ts` prints it through `Reporter` without a stack.
- **Generator** (`src/generator/`): each plugin is a `Feature` (`features/*.feature.ts`, registered in order in `features/index.ts`) that adds files, deps, env vars and `app.module.ts`/`main.setup.ts` pieces to a `Blueprint`. `renderers/` turns the blueprint into files. ORMs are `OrmKit`s in `features/orm/`. File bodies live in `templates/` and `infra/` (containers, quadlets, compose, proxy, `scripts/secrets.ts`). `buildProject()` is pure, so tests call it directly. Generated package versions are pinned in `versions.ts`.
- **Module format**: generated projects are always ESM (`"type": "module"`, `nodenext`, `.js` relative imports), with no option and no prompt. Do not add a CommonJS path unless it is explicitly requested; NestJS keeps CJS only for projects that predate v12.
- **Bun adapter**: `--framework bun` uses the third-party `nestjs-platform-bun` (github.com/Zaki-goumri/nestjs-platform-bun) and switches the generated runtime to Bun (`usesBunRuntime`).
- **Build & publish**: `rspack.config.ts` bundles everything (all deps are devDependencies) into `dist/main.cjs`, the only published file (`files`). The bundle drops lazily-required optional packages (Nest microservices/websockets, class-validator, nest-commander's Fig completion, cosmiconfig's TypeScript loader). `main.ts` must not use top-level await, because the output is CommonJS. Releases go out from `.github/workflows/release.yml` on `v*` tags, and `prepublishOnly` runs the full verification.
- **Licensing**: MIT (`LICENSE.md`). `NOTICE.md` covers the NestJS attribution and non-affiliation, the origin of the templates, the grant that makes generated code the user's, and third-party caveats. `MODIFICATIONS.md` covers redistribution and contributions. `scripts/third-party-licenses.ts` is an rspack plugin that writes `dist/THIRD_PARTY_LICENSES.md` from every bundled package, and that file must ship with the bundle (`files`). When you add a dependency to the bundle or to `versions.ts`, check its license, and record non-permissive or missing licenses in `NOTICE.md`.

## Verifying generated projects

Unit and integration tests check the file sets (`test/integration/generation-matrix.int-spec.ts` checks imports, declared deps, env keys and JSON validity). After changing templates, also generate real projects and run `bun install && bun run typecheck && bun run build && bun run test:all && bun run check` inside them for the affected combinations. Generate them outside this repo, or `git init` them first: oxfmt and eslint honor the parent `.gitignore`.

## Lint conventions (oxlint, enforced as errors)

Files use kebab-case. Default exports are not allowed (except `*.config.*`). Prefer `interface` over `type` aliases for object shapes, and put `import type` in a separate top-level import. No `any`, no non-null assertions, no `console`, no nested ternaries. Typed `vi.fn<T>()` mocks, and no conditionals inside tests. Imports, object keys, interface members and union members are sorted naturally (perfectionist). Size limits: complexity ≤10, ≤50 lines per function (move long template literals into module constants), ≤300 lines per file, ≤4 params, ≤15 imports per file (composition roots `app.module.ts` and `generator/features/index.ts` are exempt). Relative imports use the `.js` extension (ESM).
