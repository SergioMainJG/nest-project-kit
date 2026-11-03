import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { isHttpApp } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";
import { composeFile } from "../infra/compose.js";
import { containerfile, containerignore } from "../infra/containerfile.js";
import { caddyfile, nginxTemplate } from "../infra/proxy.js";
import { quadletFiles } from "../infra/quadlets.js";

const DOCKER_README = `\`\`\`bash
bun run secrets init          # once: .env with generated secrets
bun run secrets sync docker   # writes .secrets/* for compose
docker compose up --build -d
\`\`\``;

const PODMAN_README = `Rootless Podman with systemd Quadlet units (\`quadlets/\`). Replace \`__PROJECT_DIR__\` with the
absolute path of this project, then:

\`\`\`bash
bun run secrets init          # once: .env with generated secrets
bun run secrets sync podman   # creates/replaces the podman secrets
mkdir -p ~/.config/containers/systemd && cp quadlets/* ~/.config/containers/systemd/
systemctl --user daemon-reload && systemctl --user start app
\`\`\``;

const addProxy = (blueprint: Blueprint, options: ProjectOptions): void => {
  if (!isHttpApp(options) || options.rp === "none") {
    return;
  }
  if (options.rp === "caddy") {
    blueprint.addFile("proxy/Caddyfile", caddyfile);
  } else {
    blueprint.addFile("proxy/nginx.conf.template", nginxTemplate);
  }
};

/** Containerfile/Dockerfile plus compose.yaml (docker) or Quadlet units (podman), and a proxy. */
export const containerFeature = defineFeature({
  apply(blueprint, options) {
    const isDocker = options.container === "docker";
    blueprint
      .addFile(isDocker ? "Dockerfile" : "Containerfile", containerfile(options))
      .addFile(isDocker ? ".dockerignore" : ".containerignore", containerignore);
    if (isDocker) {
      blueprint.addFile("compose.yaml", composeFile(options)).addReadme("Docker", DOCKER_README);
    } else {
      for (const [path, content] of Object.entries(quadletFiles(options))) {
        blueprint.addFile(path, content);
      }
      blueprint.addReadme("Podman", PODMAN_README);
    }
    addProxy(blueprint, options);
  },
  isEnabled: (options) => options.container !== "none",
  name: "container",
});
