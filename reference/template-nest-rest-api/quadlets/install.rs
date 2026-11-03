#!/usr/bin/env -S cargo +nightly -Zscript
---
[package]
edition = "2024"
---
//! quadlets/install.rs
//!
//! Instala apps Quadlet (.kube + YAML + configs) en
//! `${XDG_CONFIG_HOME:-~/.config}/containers/systemd/<app>/`.
//!
//! Uso:
//!   ./quadlets/install.rs                   instala todas las apps (cada carpeta con <app>/<app>.kube)
//!   ./quadlets/install.rs postgres caddy    instala solo esas
//!   ./quadlets/install.rs app --start       instala la API; al arrancarla levanta postgres, dragonfly y caddy
//!
//! Opciones:
//!   --force   sobrescribe archivos que ya existan en el destino
//!   --move    mueve en lugar de copiar (borra la carpeta de origen)
//!   --start   arranca o reinicia los servicios al terminar
//!
//! Notas:
//! - La carpeta de los quadlets se ubica con `CARGO_MANIFEST_DIR`, que cargo
//!   apunta a la carpeta del script; el repo es su carpeta padre.
//! - Solo se copian archivos regulares (los symlinks se ignoran, como `find -type f`).
//! - En los `.yaml` y `.build` de primer nivel se sustituyen `__APP_DIR__` por la
//!   carpeta destino y `__PROJECT_DIR__` por la raíz del repo.
//! - Permisos: carpetas 755, archivos 644, YAML de primer nivel 600 (pueden
//!   referenciar secrets) y la carpeta destino 700. Con SELinux activo, todo lo
//!   que no sea `.kube`, `.yaml` o `.build` recibe la etiqueta `container_file_t`
//!   para que los pods puedan montarlo.
//! - `app` se instala al final porque su unidad depende de las demás.
//! - Si el YAML de una app referencia el secret `<app>-env` y no existe, se avisa
//!   que hay que correr `./quadlets/sync-secrets.rs`.
//! - Caddy necesita que `ip_unprivileged_port_start` sea ≤ 80 para usar 80/443 en rootless.

use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio, exit};

const USAGE: &str = "\
Instala apps Quadlet (.kube + YAML + configs) en ~/.config/containers/systemd/<app>/

Uso:
  ./install.rs                   instala todas las apps (cada carpeta con <app>/<app>.kube)
  ./install.rs postgres caddy    instala solo esas
  ./install.rs app --start       instala la API; al arrancarla levanta postgres, dragonfly y caddy

Opciones:
  --force   sobrescribe archivos que ya existan en el destino
  --move    mueve en lugar de copiar (borra la carpeta de origen)
  --start   arranca o reinicia los servicios al terminar";

const UNLABELED_EXTENSIONS: &[&str] = &["kube", "yaml", "build"];

struct Options {
    force: bool,
    move_src: bool,
    start: bool,
    apps: Vec<String>,
}

struct Paths {
    script_dir: PathBuf,
    project_dir: PathBuf,
    dest_root: PathBuf,
}

fn fail(msg: &str) -> ! {
    eprintln!("✗ {msg}");
    exit(1);
}

fn parse_args() -> Options {
    let mut opts = Options {
        force: false,
        move_src: false,
        start: false,
        apps: Vec::new(),
    };
    for arg in env::args().skip(1) {
        match arg.as_str() {
            "--force" => opts.force = true,
            "--move" => opts.move_src = true,
            "--start" => opts.start = true,
            "-h" | "--help" => {
                println!("{USAGE}");
                exit(0);
            }
            a if a.starts_with('-') => {
                eprintln!("Opción desconocida: {a}");
                exit(1);
            }
            _ => opts.apps.push(arg),
        }
    }
    opts
}

fn resolve_paths() -> Paths {
    let script_dir = env::var_os("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    let project_dir = script_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| fail("no pude ubicar la raíz del repo"));
    let config_home = env::var_os("XDG_CONFIG_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| fail("no están definidos XDG_CONFIG_HOME ni HOME"));
    Paths {
        script_dir,
        project_dir,
        dest_root: config_home.join("containers/systemd"),
    }
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

fn discover_apps(script_dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(script_dir) else {
        return Vec::new();
    };
    let mut apps: Vec<String> = entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| {
            fs::read_dir(script_dir.join(name)).is_ok_and(|files| {
                files
                    .flatten()
                    .any(|f| f.path().extension().is_some_and(|ext| ext == "kube"))
            })
        })
        .collect();
    apps.sort();
    apps
}

fn walk(dir: &Path, files: &mut Vec<PathBuf>, dirs: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        if kind.is_dir() {
            dirs.push(entry.path());
            walk(&entry.path(), files, dirs)?;
        } else if kind.is_file() {
            files.push(entry.path());
        }
    }
    Ok(())
}

fn tree(root: &Path) -> std::io::Result<(Vec<PathBuf>, Vec<PathBuf>)> {
    let (mut files, mut dirs) = (Vec::new(), Vec::new());
    walk(root, &mut files, &mut dirs)?;
    files.sort();
    dirs.sort();
    Ok((files, dirs))
}

fn copy_files(src: &Path, dest: &Path, force: bool) -> std::io::Result<()> {
    let (files, _) = tree(src)?;
    for file in files {
        let rel = file.strip_prefix(src).unwrap_or(&file);
        let target = dest.join(rel);
        if target.exists() && !force {
            println!(
                "  = {} (ya existe, se conserva; usa --force para sobrescribir)",
                rel.display()
            );
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&file, &target)?;
        println!("  + {}", rel.display());
    }
    Ok(())
}

fn top_level_with_ext(dir: &Path, exts: &[&str]) -> std::io::Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let matches = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| exts.contains(&e));
        if entry.file_type()?.is_file() && matches {
            out.push(path);
        }
    }
    Ok(out)
}

fn substitute_placeholders(dest: &Path, project_dir: &Path) -> std::io::Result<()> {
    let app_dir = dest.to_string_lossy();
    let project = project_dir.to_string_lossy();
    for path in top_level_with_ext(dest, &["yaml", "build"])? {
        let content = fs::read_to_string(&path)?;
        let replaced = content
            .replace("__APP_DIR__", &app_dir)
            .replace("__PROJECT_DIR__", &project);
        if replaced != content {
            fs::write(&path, replaced)?;
        }
    }
    Ok(())
}

fn chmod(path: &Path, mode: u32) -> std::io::Result<()> {
    fs::set_permissions(path, fs::Permissions::from_mode(mode))
}

fn set_permissions(dest: &Path) -> std::io::Result<()> {
    let (files, dirs) = tree(dest)?;
    for dir in &dirs {
        chmod(dir, 0o755)?;
    }
    for file in &files {
        chmod(file, 0o644)?;
    }
    for yaml in top_level_with_ext(dest, &["yaml"])? {
        chmod(&yaml, 0o600)?;
    }
    chmod(dest, 0o700)?;

    if command_succeeds("selinuxenabled", &[]) {
        let to_label: Vec<&PathBuf> = files
            .iter()
            .chain(dirs.iter())
            .filter(|p| {
                !p.extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| UNLABELED_EXTENSIONS.contains(&e))
            })
            .collect();
        if !to_label.is_empty() {
            let status = Command::new("chcon")
                .args(["-t", "container_file_t"])
                .args(&to_label)
                .status()?;
            if !status.success() {
                eprintln!("  ⚠ chcon falló en {}", dest.display());
            }
        }
    }
    Ok(())
}

fn check_secret(app: &str, dest: &Path) {
    let secret = format!("{app}-env");
    let references = fs::read_to_string(dest.join(format!("{app}.yaml")))
        .is_ok_and(|yaml| yaml.contains(&format!("name: {secret}")));
    if references && !command_succeeds("podman", &["secret", "exists", &secret]) {
        println!("  ⚠ Falta el secret {secret}: créalo desde el .env con ./quadlets/sync-secrets.rs");
    }
}

fn check_unprivileged_ports() {
    let start_port = fs::read_to_string("/proc/sys/net/ipv4/ip_unprivileged_port_start")
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(1024);
    if start_port > 80 {
        println!(
            "  ⚠ En rootless, Caddy no podrá usar los puertos 80/443 (ip_unprivileged_port_start={start_port})."
        );
        println!("    Solución permanente:");
        println!(
            "      echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-unprivileged-ports.conf"
        );
        println!("      sudo sysctl --system");
    }
}

fn install_app(app: &str, paths: &Paths, opts: &Options) -> Result<(), String> {
    let src = paths.script_dir.join(app);
    let dest = paths.dest_root.join(app);
    let kube = src.join(format!("{app}.kube"));

    if !kube.is_file() {
        return Err(format!("{app}: no existe {}", kube.display()));
    }

    println!("→ {app} → {}", dest.display());
    let io = |e: std::io::Error| format!("{app}: {e}");
    fs::create_dir_all(&dest).map_err(io)?;
    copy_files(&src, &dest, opts.force).map_err(io)?;
    substitute_placeholders(&dest, &paths.project_dir).map_err(io)?;
    set_permissions(&dest).map_err(io)?;

    check_secret(app, &dest);

    if app == "caddy" {
        check_unprivileged_ports();
    }

    if opts.move_src {
        fs::remove_dir_all(&src).map_err(io)?;
        println!("  − origen eliminado (--move)");
    }
    Ok(())
}

fn systemctl(args: &[&str]) -> bool {
    Command::new("systemctl")
        .arg("--user")
        .args(args)
        .status()
        .is_ok_and(|s| s.success())
}

fn linger_enabled(user: &str) -> bool {
    Command::new("loginctl")
        .args(["show-user", user, "--property=Linger", "--value"])
        .stderr(Stdio::null())
        .output()
        .is_ok_and(|o| String::from_utf8_lossy(&o.stdout).trim() == "yes")
}

fn main() {
    let mut opts = parse_args();
    let paths = resolve_paths();

    if !command_succeeds("podman", &["--version"]) {
        fail("podman no está instalado.");
    }

    if opts.apps.is_empty() {
        opts.apps = discover_apps(&paths.script_dir);
    }
    if opts.apps.is_empty() {
        fail("No se encontró ninguna carpeta <app>/<app>.kube junto al script.");
    }

    let has_app = opts.apps.iter().any(|a| a == "app");
    let mut ordered: Vec<String> = opts.apps.iter().filter(|a| *a != "app").cloned().collect();
    if has_app {
        ordered.push("app".to_string());
    }

    for app in &ordered {
        if let Err(e) = install_app(app, &paths, &opts) {
            fail(&e);
        }
    }

    if !systemctl(&["daemon-reload"]) {
        fail("systemctl --user daemon-reload falló");
    }

    let mut failed = false;
    for app in &ordered {
        let unit = format!("{app}.service");
        if !command_succeeds("systemctl", &["--user", "cat", &unit]) {
            eprintln!("✗ Quadlet no generó {unit}. Revisa el error con:");
            eprintln!("    /usr/lib/systemd/system-generators/podman-system-generator --user --dryrun");
            failed = true;
            continue;
        }
        if opts.start {
            if !systemctl(&["restart", &unit]) {
                fail(&format!("no pude reiniciar {unit}"));
            }
            println!("✓ {unit} iniciado");
        } else {
            println!("✓ {unit} listo → systemctl --user start {unit}");
        }
    }

    let user = env::var("USER").unwrap_or_default();
    if !linger_enabled(&user) {
        println!();
        println!("⚠ Sin linger, los servicios solo corren mientras tengas una sesión abierta");
        println!("  y no arrancan al encender la máquina. Actívalo con:");
        println!("    loginctl enable-linger {user}");
    }

    if failed {
        exit(1);
    }
}
