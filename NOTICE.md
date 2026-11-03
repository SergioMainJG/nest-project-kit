# NOTICE

**@sergioar/nest-project-kit**
Copyright (c) 2026 Sergio Elias Arce Roldán

This project is licensed under the MIT License; see [LICENSE.md](LICENSE.md). This notice adds attribution and clarifications. It does not change, restrict or add conditions to the MIT License.

## 1. Relationship with NestJS

nest-project-kit is an **independent, unofficial** tool. It generates projects that use the [NestJS](https://nestjs.com/) framework, and it is itself built with NestJS. It is not affiliated with, sponsored by or endorsed by the NestJS project or its core team.

- NestJS is Copyright (c) 2017-present Kamil Mysliwiec and is distributed under the MIT License: <https://github.com/nestjs/nest/blob/master/LICENSE>.
- The structure of the generated code follows the public NestJS documentation (<https://docs.nestjs.com/>) and the conventions of the official Nest CLI. No source code from the NestJS repositories is copied into this project except the packages bundled as dependencies (section 4).
- "NestJS", "Nest" and the Nest logo belong to their respective owners. They are used here only to describe what this tool is compatible with (nominative use), and they do not imply any endorsement.

## 2. Origin of the generated code

The templates this tool writes into new projects derive from **template-nest-rest-api** (<https://github.com/SergioMainJG/template-nest-rest-api>), which has the same author and the same MIT License. A snapshot of that template is kept in `reference/` in the source repository for reference; it is not part of the published npm package.

## 3. Code you generate is yours

The files that nest-project-kit writes into a new project ("generated code") belong to whoever generates them. As the copyright holder of the templates, the author grants you a perpetual, worldwide, royalty-free permission to use, copy, modify, distribute, sublicense and relicense the generated code under any terms of your choice, **including proprietary terms, with no obligation to keep this notice or the MIT License text in it**.

This permission covers only the generated code. The tool itself (this repository and the npm package) stays under the MIT License. The dependencies listed in a generated `package.json` keep their own licenses (section 5).

## 4. Third-party code bundled in the npm package

The published file `dist/main.cjs` bundles third-party packages such as `@nestjs/common`, `@nestjs/core`, `nest-commander`, `commander`, `@inquirer/prompts`, `rxjs` and `reflect-metadata`. Their copyright notices, license texts and NOTICE files are reproduced in `dist/THIRD_PARTY_LICENSES.md`, which is generated on every build and shipped with the package.

These packages are licensed under MIT, ISC, BSD-3-Clause, 0BSD or Apache-2.0. All of these licenses are permissive and compatible with the MIT License of this project.

## 5. Packages installed in generated projects

Generated projects declare dependencies (NestJS packages, ORMs, validators, loggers and others) that the user's package manager downloads from the npm registry. nest-project-kit does not redistribute them. Each one is governed by its own license, and complying with those licenses is the responsibility of whoever distributes the generated project.

**Third-party Bun adapter.** The `--framework bun` option uses [`nestjs-platform-bun`](https://github.com/Zaki-goumri/nestjs-platform-bun), a community adapter that the NestJS team does not maintain. When this notice was written, that package **did not declare a license**, either on npm or in its repository. Without a license, the default copyright rules apply. Check its current licensing status before you distribute a project that depends on it.

## 6. No warranty

As the MIT License states, the software and the code it generates are provided "as is", without warranty of any kind. Review the generated code, its dependencies and its security settings before you use it in production.
