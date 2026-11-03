# @sergioar/nest-project-kit

[![npm](https://img.shields.io/npm/v/@sergioar/nest-project-kit)](https://www.npmjs.com/package/@sergioar/nest-project-kit)

CLI interactivo que genera proyectos **NestJS 12** con los plugins que elijas: adaptador HTTP, ORM, caché, validación, autenticación, documentación, logging, observabilidad, contenedores, proxy inverso, CI y más. Se basa en [template-nest-rest-api](https://github.com/SergioMainJG/template-nest-rest-api) (la copia de referencia está en `reference/`) y sigue las recomendaciones de la [documentación oficial de NestJS](https://docs.nestjs.com/).

Está construido con **Bun**, **NestJS** + **nest-commander** (Commander) y se empaqueta con **rspack** en un único archivo CommonJS que corre en Node ≥ 22 o en Bun.

## Instalación

No hace falta instalarlo; se ejecuta con `npx` o `bunx`:

```bash
npx @sergioar/nest-project-kit
bunx @sergioar/nest-project-kit
```

O de forma global, lo que instala los comandos `nest-project-kit` y su alias `nest-generator`:

```bash
npm install -g @sergioar/nest-project-kit
bun add -g @sergioar/nest-project-kit
```

Requisitos: Node ≥ 22 o Bun para ejecutar el CLI, y **Bun** para instalar y correr los proyectos generados. Si Bun no está instalado, el proyecto se genera igual y solo se omite `bun install`.

## Uso

```bash
# Modo interactivo: pregunta cada opción con las flechas del teclado
npx @sergioar/nest-project-kit

# Con nombre y flags; lo que falte se pregunta (o se usan los valores por defecto con -y)
npx @sergioar/nest-project-kit new orders-api --framework express --orm typeorm --database-motor mysql
npx @sergioar/nest-project-kit new orders-api -y         # todo por defecto, sin preguntas
npx @sergioar/nest-project-kit new orders-api --dry-run  # lista los archivos sin escribirlos

# Con la instalación global
nest-project-kit new orders-api
```

Flags propios del comando `new`:

| Flag                            | Descripción                                            |
| ------------------------------- | ------------------------------------------------------ |
| `-i, --interactive`             | pregunta toda opción que no se haya pasado como flag   |
| `-y, --yes`                     | nunca pregunta; usa los valores por defecto            |
| `--directory <path>`            | directorio padre del proyecto (por defecto, el actual) |
| `--dry-run`                     | muestra los archivos que generaría sin escribir nada   |
| `--skip-install` / `--skip-git` | no ejecuta `bun install` / no inicializa git           |

Sin TTY (por ejemplo en CI) nunca se pregunta: el nombre es obligatorio y el resto toma su valor por defecto.

## Opciones

Las opciones se resuelven en orden y **de forma condicional**: si una no aplica a lo elegido antes, se omite (no se pregunta) y queda desactivada. Si la pasas explícitamente cuando no aplica, el CLI explica por qué y termina con código 64.

| Opción            | Flag                 | Valores (por defecto en **negritas**)                                  | Condición                                                         |
| ----------------- | -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Tipo de app       | `--type-app`         | **api**, graphql, microservice, mvc, cli                               |                                                                   |
| Adaptador HTTP    | `--framework`        | **fastify**, express, node, bun¹                                       | apps HTTP (api, graphql, mvc); graphql/mvc solo fastify o express |
| Compilador TS     | `--ts-compiler`      | **swc**, tsc, default                                                  |                                                                   |
| Validación        | `--validator`        | class, **arktype**, zod, valibot                                       |                                                                   |
| ORM               | `--orm`              | **drizzle**, typeorm, mongodb, prisma, mikroorm, sequelize, none/false |                                                                   |
| Base de datos     | `--database-motor`   | pg, mysql, sqlite, mongo                                               | requiere ORM; mongo solo con `mongodb`                            |
| Usuarios + auth   | `--has-users`        | **true**, false                                                        | requiere ORM y app HTTP                                           |
| Hashing           | `--hashing`          | **argon2**, bcrypt, none/false                                         | con usuarios no admite `none`                                     |
| Auth oficial      | `--has-auth-2`       | true, **false** (`@nestjs/authentication` + `@nestjs/authorization`)   | requiere usuarios                                                 |
| Caché             | `--cache`            | **dragonfly**, redis, valkey, memory, none/false                       |                                                                   |
| Logger            | `--logger`           | **winston**, pino, nest, none/false                                    |                                                                   |
| Observabilidad    | `--observability`    | nestjs (`@nestjs/observe`), sentry, **none**                           |                                                                   |
| Documentación     | `--swagger`          | **scalar**, swagger, none/false (`true` = scalar)                      | api y mvc                                                         |
| Health checks     | `--has-health`       | **true** (`terminus`), false                                           | apps HTTP                                                         |
| Rate limiting     | `--has-throttler`    | **true** (`throttler`), false                                          | apps HTTP                                                         |
| Correo            | `--has-mail`         | true (`@nestjs/mail`), **false**                                       |                                                                   |
| Almacenamiento    | `--has-storage`      | true (`@nestjs/storage`), **false**                                    |                                                                   |
| Resiliencia       | `--has-resilience`   | true (`@nestjs/resilience`), **false**                                 |                                                                   |
| WebSockets        | `--ws`               | true (`@nestjs/websockets` + socket.io), **false**                     | apps HTTP                                                         |
| OWASP             | `--has-owasp`        | **true**, false                                                        | apps HTTP; `false` desactiva y oculta las tres siguientes         |
| Cabeceras seguras | `--has-safe-headers` | **true**, false                                                        | requiere OWASP                                                    |
| CORS              | `--has-cors`         | **true**, false                                                        | requiere OWASP                                                    |
| CSRF              | `--has-csrf`         | true, false (por defecto true solo en mvc)                             | requiere OWASP y express o fastify                                |
| Contenedores      | `--containerization` | **podman** (Quadlets), docker (compose), none                          | no aplica a apps cli                                              |
| Proxy inverso     | `--reverse-proxy`    | **caddy** (alias `candy`), nginx, none                                 | requiere app HTTP y contenedores                                  |
| GitHub Actions    | `--gh-actions`       | **true**, false                                                        |                                                                   |
| Formateador       | `--formatter`        | **oxfmt**, prettier, biome                                             |                                                                   |
| Linter            | `--linter`           | **eslint**, biome, standardjs, none                                    |                                                                   |
| Licencia          | `--license`          | **mit**, none/false                                                    |                                                                   |

¹ **Bun** usa [`nestjs-platform-bun`](https://github.com/Zaki-goumri/nestjs-platform-bun), una integración de terceros que **no** mantiene el equipo de NestJS. Al elegirla, el proyecto corre sobre Bun y las integraciones de terceros usan Bun por debajo (`Bun.env`, `Bun.password`, `@socket.io/bun-engine`, `bun:sqlite`…); las integraciones oficiales de NestJS 12.3 se mantienen.

## Qué genera

Cada proyecto incluye `package.json` con versiones exactas, `tsconfig`, Vitest con pruebas unitarias y e2e, `.env`, `template.env` y `scripts/secrets.ts`:

```bash
bun run secrets init          # crea .env desde template.env con secretos aleatorios
bun run secrets check         # verifica que .env tenga todas las variables requeridas
bun run secrets sync docker   # escribe .secrets/*-env para compose.yaml
bun run secrets sync podman   # crea/actualiza los podman secrets de las Quadlets
```

Según las opciones, también genera el `Containerfile`/`Dockerfile`, las unidades Quadlet o `compose.yaml`, la configuración de Caddy o nginx, el workflow de GitHub Actions y la licencia.

## Errores

Todos los errores se muestran en stderr con un mensaje legible, una pista cuando la hay y un código de salida:

| Código | Caso                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| 64     | valor de flag inválido, opciones incompatibles, nombre inválido o faltante           |
| 64     | nombre del proyecto inválido **3 veces** en modo interactivo (el programa se cierra) |
| 74     | el directorio destino ya existe y no está vacío                                      |
| 130    | cancelado con Ctrl+C                                                                 |
| 1      | error inesperado (se muestra el stack)                                               |

## Desarrollo

```bash
bun install
bun run dev -- new demo --dry-run   # ejecuta el CLI desde src/
bun run check                       # oxfmt --check && oxlint (type-aware)
bun run typecheck
bun run test                        # unitarias: src/**/*.spec.ts
bun run test:int                    # integración: test/integration/**/*.int-spec.ts
bun run build                       # rspack → dist/main.cjs (un solo archivo, minificado)
node dist/main.cjs --help
```

### Publicación

El paquete publica un solo archivo (`dist/main.cjs`) sin dependencias de runtime, porque todo va empaquetado. `prepublishOnly` corre `check`, `typecheck`, todas las pruebas y el build antes de publicar.

```bash
npm pack --dry-run        # revisa qué se va a publicar
npm publish               # primera publicación, manual (requiere npm login)
```

Las siguientes versiones se publican desde GitHub Actions (`.github/workflows/release.yml`) al subir un tag que coincida con la versión de `package.json`:

```bash
npm version minor         # 0.1.0 → 0.2.0, crea el commit y el tag v0.2.0
git push --follow-tags
```

El workflow publica con _provenance_. Para no necesitar el secreto `NPM_TOKEN`, configura **Trusted Publishing** en npmjs.com (paquete → Settings → Trusted publishers) con este repositorio, el workflow `release.yml` y el entorno `npm`.

### Arquitectura

- `src/options/`: catálogo declarativo de opciones (`catalog/`), reglas condicionales (`option-rules.ts`), normalización de valores y `resolveOptions()`, que valida flags, aplica las condiciones y completa el resto preguntando o con valores por defecto.
- `src/prompts/`: puerto de prompts (`@inquirer/prompts`) y `askWithRetry()` (3 intentos para datos obligatorios).
- `src/generator/`: cada plugin es un `Feature` que agrega archivos, dependencias, variables de entorno y piezas de `app.module.ts`/`main.ts` a un `Blueprint`; los `renderers/` lo convierten en archivos. `buildProject()` es puro (sin disco ni red).
- `src/cli/`: comando `new` de nest-commander (un flag por opción del catálogo), escritura a disco, `bun install`, git y reporte.

Las versiones de los paquetes generados están fijadas en `src/generator/versions.ts`.
