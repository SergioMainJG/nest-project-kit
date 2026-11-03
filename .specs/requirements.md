# Requerimientos para TUI NestJS Projects Scaffolding

# Especificaciones

## 1. Visión General
- **Objetivo:** El proyecto tiene como proposito servir como un generador de proyectos de NestJS con plugins ya incluidos, escogiendo libremente que plugins instalar y cuales no
- **Usuarios:** Desarrolladores

## 2. Comportamiento Esperado (Flujo Feliz)
- **Entradas:**
  - npx nest-generator # como generador en tiempo real
  - npx nest-generator new <name> [options]
  - options:
    - http-adapter(--framework): node, express, fastify, bun(especificar que es integración de 3ros, no oficial de Nest. Si se escoge Bun, todos los paquetes de 3ros deben usar Bun por debajo a excepción de las integraciones oficiales de NestV12.3).
    - hashing(--hashing): no, false, bcrypt, argon2
    - validator(--validator): class, arktype, zod, valibot.
    - orm (--orm): drizzle, typeorm, mongodb, prisma, mikroorm, sequelize, none, false.
    - cache (--cache): redis, dragonfly, valkey, memory, none, false.
    - observability (--observability): nestjs observability, sentry, none.
    - doc (--swager):  none, false, true, scalar, swagger.
    - users (--has-users): none, false, true
    - container (--containerization): docker, podman, none.
    - db (--databse-motor): mysql, pg,mongo, sqlite.
    - ts (--ts-compiler): swc, tsc, default.
    - license: none, false, mit.
    - fmt (--formatter): prettier, biome, oxfmt,
    - lint (--linter): eslint, biome, standardjs, none.
    - gha (--gh-actions): none, false, true.
    - rp (--reverse-proxy): none, candy, nginx.
    - health (--has-health): terminus
    - throttler (--has-throttler): throttler
    - logger (--logger): winston, pino, nest, none, false.
    - mail (--has-mail): @nestjs/mail
    - storage (--has-storage): @nestjs/storage
    - auth2 (--has-auth-2): @nestjs/authorization and @nestjs/authentication
    - security headers (--has-safe-headers): true, false.
    - cors (--has-cors): true, false.
    - csrf (--has-csrf): true, false.
    - owasp (--has-owasp): false (todas las opciones relacionadas a seguridad quedan como false y no se muestran), true (se muestran todas las opciones).
    - resilience (--has-resilience): @nestjs/resilience
    - app (--type-app): api, graphql, microservice, mvc, cli.
    - websockets (--ws): @nestjs/websockets @nestjs/platform-socket.io
- **Pasos para ejecución paso a paso:**
  - Seleccionar cada opción con las teclas.
- **Salidas:**
  - generación del proyecto con todas las salidas deseadas. Si no se s 

## 3. Casos de Error y Restricciones
- Qué pasa si falta un dato obligatorio: Se reintenta 3 veces, si falla posterior, se cierra el programa.

## 4. Criterios de Aceptación
- [ ] Caso exitoso verificado.
- [ ] Se toma como base github.com/SergioMainJG/template-nest-rest-api
- [ ] Inglés
- [ ] Manejo condicional de opciones exitoso
- [ ] Manejo de errores implementado y visible.
- [ ] Usa Bun, Nestj con commander
- [ ] Unit Testing orientado al negocio
- [ ] Integration Testing orientado al funcionamiento
- [ ] Creación de env, template.env, y de scripts para el manejo de secretos
- [ ] Tomar de referencia total al equipo y sugerencias del equipo de nest (https://docs.nestjs.com/)
- [ ] Optimizar el build de producción con rspack y commander
