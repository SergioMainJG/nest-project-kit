# NestJS template

Plantilla de API REST lista para empezar un proyecto: NestJS 12 sobre Fastify, ejecutada con Bun.

| Área           | Stack                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Runtime        | Bun en todo: app, tests (`bun --bun vitest`), scripts y contenedor       |
| HTTP           | Fastify, helmet, compresión, CORS, rate limiting (`@nestjs/throttler`)   |
| Validación     | ArkType (Standard Schema) para envs, body y respuestas                   |
| Base de datos  | PostgreSQL con `Bun.SQL` + Drizzle ORM (`@nestjs/drizzle`)               |
| Cache          | cache-manager: memoria (L1) + Redis/Dragonfly (L2)                       |
| Auth           | Passport local + JWT (HS256), contraseñas con `Bun.password` (argon2id)  |
| Observabilidad | Winston, correlation id (UUIDv7), health checks, NestJS Observe opcional |
| Docs de la API | Swagger + Scalar en `/reference`                                         |
| Calidad        | oxfmt, oxlint (type-aware), vitest, lint-staged                          |

## Primeros pasos

```bash
bun install
cp template.env .env
openssl rand -base64 32   # pégalo en JWT_SECRET
```

Levanta Postgres y Dragonfly con los quadlets (Podman + systemd, rootless). Sus contraseñas salen de `DATABASE_URL` y `CACHE_URL`. Los scripts de `quadlets/` son scripts de Rust (`cargo +nightly -Zscript`), así que necesitas el toolchain nightly (`rustup toolchain install nightly`):

```bash
./quadlets/sync-secrets.rs   # .env → podman secrets
./quadlets/install.rs postgres dragonfly --start
```

Aplica las migraciones y arranca en modo desarrollo:

```bash
bun run db:migrate
bun run start:dev
```

- API: `http://localhost:3000`
- Referencia de la API: `http://localhost:3000/reference`

## Qué personalizar

Todo lo específico de tu proyecto sale del `.env`: no hay nombres de app repartidos por el código.

| Qué                               | Dónde                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| Nombre de la app                  | `APP_NAME` → logs, Swagger, `iss`/`aud` del JWT, Observe             |
| Variables de entorno y su formato | `src/config/envs/envs.schema.ts` y `template.env`                    |
| Límites de rate limiting          | `THROTTLERS` en `src/config/throttler/throttler-config.service.ts`   |
| Cache en memoria (LRU, TTL)       | `src/config/cache/cache-config.service.ts`                           |
| CSP de helmet, CORS               | `src/main.setup.ts`                                                  |
| Tablas                            | `src/config/drizzle/schemas/` (exporta cada tabla en `index.ts`)     |
| Contraseñas de la infraestructura | `DATABASE_URL` y `CACHE_URL` del `.env` (`quadlets/sync-secrets.rs`) |
| Nombre del paquete y autor        | `package.json`, `LICENSE.md`                                         |

Variables opcionales (no están en `template.env`; agrégalas solo si las usas):

| Variable                                 | Efecto                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`                              | `error`, `warn`, `info`, `http`, `verbose`, `debug` o `silly`. Por defecto `info` en producción y `debug` en el resto |
| `OBSERVE_APP_KEY` + `OBSERVE_APP_SECRET` | Activan NestJS Observe (https://observe.nestjs.com)                                                                   |

## Estructura

```
src/
├── auth/            registro, login (passport-local) y JWT (guard global + @Public())
├── users/           tabla users, servicio y GET /users/me
├── health/          GET /health/live y /health/ready (Postgres + cache)
├── common/          @Public() y filtro global de errores
├── config/          un servicio por integración (envs, drizzle, cache, jwt, logger, throttler, observe)
├── main.setup.ts    configuración de Fastify/Nest compartida por main.ts y los e2e
├── migrate.ts       aplica las migraciones de drizzle/ con Bun.SQL
└── main.ts
drizzle/             migraciones SQL generadas (se versionan)
test/
├── integration/     módulos reales contra PostgreSQL (PGlite)
├── e2e/             la app completa vía HTTP (fastify.inject)
└── utils/
quadlets/            app (maestro), Postgres, Dragonfly y Caddy para Podman
```

## Endpoints

| Método | Ruta             | Auth   | Descripción                           |
| ------ | ---------------- | ------ | ------------------------------------- |
| POST   | `/auth/register` | —      | Crea un usuario `{ email, password }` |
| POST   | `/auth/login`    | —      | Devuelve `{ accessToken }`            |
| GET    | `/users/me`      | Bearer | Usuario autenticado                   |
| GET    | `/health/live`   | —      | El proceso responde                   |
| GET    | `/health/ready`  | —      | Postgres y la cache responden         |

Todas las rutas requieren JWT salvo las marcadas con `@Public()`. Los errores tienen siempre la forma `{ statusCode, error, message, path, timestamp, correlationId }`.

## Scripts

```bash
bun run start:dev     # desarrollo con recarga
bun run build         # typecheck + compilación con SWC a dist/
bun run start:prod    # bun dist/main.js

bun run test          # unitarios (src/**/*.spec.ts)
bun run test:int      # integración (test/integration)
bun run test:e2e      # e2e (test/e2e)
bun run test:all      # todo
bun run test:cov      # todo, con cobertura

bun run db:generate   # genera una migración a partir de los cambios en schemas/
bun run db:migrate    # aplica las migraciones pendientes (src/migrate.ts, usa DATABASE_URL)
bun run db:studio     # explorador de la base de datos

bun run check         # formato + lint
bun run typecheck
```

Los tests de integración y e2e no necesitan infraestructura: usan PostgreSQL real en memoria (PGlite, con las mismas migraciones) y cache en memoria. El entorno de test está en `test/test-env.ts`; el `.env` local se ignora con `NODE_ENV=test`.

## Git hooks

`bun install` instala un hook de pre-commit (simple-git-hooks) que ejecuta lint-staged: `oxlint --fix` y `oxfmt` sobre los archivos en stage. Si lo cambias en `package.json`, reinstálalo con `bunx simple-git-hooks`.

## Despliegue con Quadlet

`quadlets/app` es la unidad maestra: al arrancarla, systemd construye la imagen desde este repositorio y levanta el resto.

| Archivo     | Qué hace                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `app.build` | `app-build.service`: `podman build` del `Containerfile` del repo → `localhost/app:latest`        |
| `app.kube`  | `app.service`: requiere `app-build`, `postgres` y `dragonfly`; arranca `caddy` si está instalado |
| `app.yaml`  | Pod con un initContainer que aplica las migraciones (`bun dist/migrate.js`) y la API             |

Los YAML no llevan variables ni contraseñas: `quadlets/sync-secrets.rs` lee el `.env` y crea un podman secret por pod, que los YAML referencian con `envFrom`/`secretKeyRef`.

| Secret          | Contenido                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `app-env`       | Las variables de `template.env` y las opcionales (`LOG_LEVEL`, `OBSERVE_*`) si están definidas |
| `postgres-env`  | `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`, sacados de `DATABASE_URL`                |
| `dragonfly-env` | `DFLY_requirepass`, sacado de la contraseña de `CACHE_URL`                                     |

`NODE_ENV`, `HOST` y `PORT` los fija `app.yaml` (producción, `127.0.0.1:3000`); si están en el `.env` se ignoran.

```bash
./quadlets/sync-secrets.rs      # o ./quadlets/sync-secrets.rs ruta/a/prod.env
./quadlets/install.rs
systemctl --user start app.service
```

Al cambiar el `.env`, vuelve a ejecutar `sync-secrets.rs` y reinicia los servicios. Postgres solo aplica `POSTGRES_PASSWORD` al crear el volumen: con datos existentes, cambia la contraseña también con `ALTER USER`.

`install.rs` sustituye las rutas del repo, instala `app` al final y, con `--start`, la arranca después de sus dependencias. La API usa la red del host y escucha en `127.0.0.1:3000`; Caddy la publica en 80/443.

Sin Quadlet:

```bash
podman build -t my-app .
podman run --rm --env-file .env my-app bun dist/migrate.js
podman run --env-file .env -p 3000:3000 my-app
```

## CI/CD

Los workflows no tienen nada específico del proyecto: la versión de Bun sale de `packageManager` en `package.json` y las imágenes de Postgres y Dragonfly, de `quadlets/`. Cambiarlas ahí actualiza la CI.

| Workflow    | Cuándo                                    | Qué hace                                                                                                                                                   |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-ci.yml` | Pull requests, manual y desde `02-cd.yml` | Formato, lint y typecheck · tests (unit, integración, e2e) · build, migraciones y endpoints contra Postgres y Dragonfly reales · build del `Containerfile` |
| `02-cd.yml` | Push a `main`, tags `vX.Y.Z` y manual     | Ejecuta el CI; si pasa, publica `ghcr.io/<owner>/<repo>` (`main`, `latest`, `sha-…`, `X.Y.Z`, `X.Y`) y, en tags, crea la release de GitHub                 |

La publicación usa `GITHUB_TOKEN`: no hay secretos que configurar. Si el repositorio es privado, el paquete de GHCR también lo es.

## Licencia

[MIT](LICENSE.md)
