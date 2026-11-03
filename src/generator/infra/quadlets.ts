import type { ProjectOptions } from "../../options/option-types.js";
import type { InfraService } from "./services.js";

import { isHttpApp, usesBunRuntime } from "../../options/option-rules.js";
import { toDirectoryName } from "../../options/project-name.js";
import { appPort, backingServices, needsMigrations } from "./services.js";

const kubeUnit = (
  description: string,
  yaml: string,
  requires: readonly string[] = [],
): string => `[Unit]
Description=${description}
${requires.length > 0 ? `Requires=${requires.join(" ")}\nAfter=${requires.join(" ")}\n` : ""}
[Kube]
Yaml=${yaml}
Network=host

[Service]
Restart=always
TimeoutStartSec=900

[Install]
WantedBy=default.target
`;

const servicePod = (service: InfraService): string => `apiVersion: v1
kind: Pod
metadata:
  name: ${service.name}
spec:
  restartPolicy: Always
  containers:
    - name: ${service.name}
      image: ${service.image}${service.args === undefined ? "" : `\n      command: ${JSON.stringify(service.args)}`}
      envFrom:
        - secretRef:
            name: ${service.secret}
      ports:
        - containerPort: ${service.port}
          hostPort: ${service.port}
          hostIP: 127.0.0.1${
            service.healthcheck === undefined
              ? ""
              : `
      livenessProbe:
        exec:
          command: ["sh", "-c", ${JSON.stringify(service.healthcheck)}]
        initialDelaySeconds: 15
        periodSeconds: 30`
          }${
            service.dataPath === undefined
              ? ""
              : `
      volumeMounts:
        - name: data
          mountPath: ${service.dataPath}
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: ${service.name}-data`
          }
`;

const appPod = (options: ProjectOptions, image: string): string => {
  const runtime = usesBunRuntime(options) ? "bun" : "node";
  const migrate = needsMigrations(options)
    ? `  initContainers:
    - name: migrate
      image: ${image}-build
      imagePullPolicy: Never
      command: ["bun", "run", "db:migrate"]
      envFrom:
        - secretRef:
            name: app-env
`
    : "";
  const probe =
    isHttpApp(options) && options.health
      ? `
      livenessProbe:
        exec:
          command: ["${runtime}", "-e", "fetch('http://127.0.0.1:${appPort(options)}/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
        initialDelaySeconds: 10
        periodSeconds: 30`
      : "";
  return `apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  restartPolicy: Always
${migrate}  containers:
    - name: app
      image: ${image}
      imagePullPolicy: Never
      envFrom:
        - secretRef:
            name: app-env
      env:
        - name: NODE_ENV
          value: production
        - name: HOST
          value: 127.0.0.1
        - name: PORT
          value: "${appPort(options)}"${probe}
`;
};

const caddyPod = (options: ProjectOptions): string => `apiVersion: v1
kind: Pod
metadata:
  name: proxy
spec:
  restartPolicy: Always
  containers:
    - name: proxy
      image: ${options.rp === "caddy" ? "docker.io/library/caddy:2-alpine" : "docker.io/library/nginx:1-alpine"}
      env:
        - name: DOMAIN
          value: localhost
        - name: UPSTREAM
          value: 127.0.0.1:${appPort(options)}
      volumeMounts:
        - name: conf
          mountPath: ${options.rp === "caddy" ? "/etc/caddy" : "/etc/nginx/templates"}
          readOnly: true
  volumes:
    - name: conf
      hostPath:
        path: __PROJECT_DIR__/proxy
        type: Directory
`;

/** Podman Quadlet units (systemd) for the app, its backing services and the proxy. */
export const quadletFiles = (options: ProjectOptions): Record<string, string> => {
  const image = `localhost/${toDirectoryName(options.name)}:latest`;
  const services = backingServices(options);
  const files: Record<string, string> = {
    "quadlets/app.build": `[Build]\nImageTag=${image}\nFile=__PROJECT_DIR__/Containerfile\nSetWorkingDirectory=__PROJECT_DIR__\n\n[Service]\nTimeoutStartSec=1800\n`,
    "quadlets/app.kube": kubeUnit("Application", "app.yaml", [
      "app-build.service",
      ...services.map((s) => `${s.name}.service`),
    ]),
    "quadlets/app.yaml": appPod(options, image),
  };
  if (needsMigrations(options)) {
    files["quadlets/app-migrate.build"] =
      `[Build]\nImageTag=${image}-build\nFile=__PROJECT_DIR__/Containerfile\nSetWorkingDirectory=__PROJECT_DIR__\nTarget=build\n\n[Service]\nTimeoutStartSec=1800\n`;
  }
  for (const service of services) {
    files[`quadlets/${service.name}.kube`] = kubeUnit(
      service.name === "db" ? "Database" : "Cache",
      `${service.name}.yaml`,
    );
    files[`quadlets/${service.name}.yaml`] = servicePod(service);
  }
  if (isHttpApp(options) && options.rp !== "none") {
    files["quadlets/proxy.kube"] = kubeUnit("Reverse proxy", "proxy.yaml", ["app.service"]);
    files["quadlets/proxy.yaml"] = caddyPod(options);
  }
  return files;
};
