#!/usr/bin/env -S cargo +nightly -Zscript
---
[package]
edition = "2024"
---
//! quadlets/sync-secrets.rs
//!
//! Lee el `.env` del proyecto y crea/actualiza un secret de podman por pod
//! (`podman secret create --replace`). Cada secret es un `kind: Secret` de
//! Kubernetes con los valores en base64, así que los YAML de los quadlets
//! solo los referencian (`envFrom.secretRef` / `secretKeyRef`) y nunca
//! llevan contraseñas escritas.
//!
//! Uso (desde la raíz del repo):
//!   ./quadlets/sync-secrets.rs            usa ./.env
//!   ./quadlets/sync-secrets.rs otro.env
//!
//! Secrets que crea:
//!   app-env        APP_NAME, DOMAIN_ORIGIN, DATABASE_URL, CACHE_URL, CACHE_TTL,
//!                  CACHE_MAX_TTL, JWT_SECRET, JWT_EXPIRES_IN (obligatorias) y
//!                  LOG_LEVEL, OBSERVE_APP_KEY, OBSERVE_APP_SECRET (si vienen)
//!   postgres-env   POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB, sacados de
//!                  DATABASE_URL para que haya una sola fuente de verdad (si la
//!                  URL no trae base, se usa el nombre del usuario)
//!   dragonfly-env  DFLY_requirepass, sacado de la contraseña de CACHE_URL;
//!                  Dragonfly lee cualquier flag desde DFLY_<flag>
//!
//! Notas:
//! - NODE_ENV, HOST y PORT los fija `app.yaml` (PORT va amarrado al
//!   livenessProbe y al upstream de Caddy); si vienen en el `.env` se ignoran.
//! - Los valores pueden ir entre comillas (KEY="valor" o KEY='valor') y las
//!   líneas pueden empezar con `export `.
//! - Las credenciales de las URLs se decodifican (`%40` → `@`). El último '@'
//!   separa credenciales y host, así que se tolera un '@' sin escapar en la contraseña.
//! - Los valores van en `data` (base64): no hay que escapar nada en el YAML y
//!   podman entrega los bytes exactos, sin '\n' colado al final.
//! - Se validan todas las variables antes de tocar podman: si falta alguna no
//!   se crea ningún secret.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

const APP_REQUIRED: &[&str] = &[
    "APP_NAME",
    "DOMAIN_ORIGIN",
    "DATABASE_URL",
    "CACHE_URL",
    "CACHE_TTL",
    "CACHE_MAX_TTL",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
];

const APP_OPTIONAL: &[&str] = &["LOG_LEVEL", "OBSERVE_APP_KEY", "OBSERVE_APP_SECRET"];

const QUADLET_ENV: &[&str] = &["NODE_ENV", "HOST", "PORT"];

fn unquote(value: &str) -> &str {
    let v = value.trim();
    for q in ['"', '\''] {
        if v.len() >= 2 && v.starts_with(q) && v.ends_with(q) {
            return &v[1..v.len() - 1];
        }
    }
    v
}

fn parse_env(path: &Path) -> Result<BTreeMap<String, String>, String> {
    let content = fs::read_to_string(path).map_err(|e| {
        format!(
            "no pude leer {}: {e}\n¿Copiaste template.env a .env?",
            path.display()
        )
    })?;

    let mut map = BTreeMap::new();
    for (n, raw) in content.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, value)) = line.split_once('=') else {
            eprintln!("⚠️  línea {} sin '=': {:?}", n + 1, raw);
            continue;
        };
        map.insert(key.trim().to_string(), unquote(value).to_string());
    }
    Ok(map)
}

fn percent_decode(s: &str) -> Result<String, String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = s
                .get(i + 1..i + 3)
                .and_then(|h| u8::from_str_radix(h, 16).ok())
                .ok_or_else(|| format!("escape '%' inválido en {s:?}"))?;
            out.push(hex);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| format!("{s:?} no es UTF-8 tras decodificar"))
}

struct UrlParts {
    user: String,
    password: String,
    path: String,
}

fn parse_url(key: &str, url: &str) -> Result<UrlParts, String> {
    let (_, rest) = url
        .split_once("://")
        .ok_or_else(|| format!("{key} no es una URL"))?;
    let (userinfo, host_path) = rest.rsplit_once('@').unwrap_or(("", rest));
    let (user, password) = userinfo.split_once(':').unwrap_or((userinfo, ""));
    let path = host_path
        .split_once('/')
        .map_or("", |(_, p)| p)
        .split('?')
        .next()
        .unwrap_or("");

    Ok(UrlParts {
        user: percent_decode(user)?,
        password: percent_decode(password)?,
        path: percent_decode(path)?,
    })
}

fn base64(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ALPHABET[(n >> (18 - 6 * i)) as usize & 63] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

fn kube_secret(name: &str, data: &BTreeMap<&str, String>) -> String {
    let mut yaml = format!("apiVersion: v1\nkind: Secret\nmetadata:\n  name: {name}\ndata:\n");
    for (key, value) in data {
        yaml.push_str(&format!("  {key}: {}\n", base64(value.as_bytes())));
    }
    yaml
}

fn create_secret(name: &str, content: &str) -> Result<(), String> {
    let mut child = Command::new("podman")
        .args(["secret", "create", "--replace", name, "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("no pude ejecutar podman: {e}"))?;

    child
        .stdin
        .take()
        .unwrap()
        .write_all(content.as_bytes())
        .map_err(|e| format!("escribiendo a stdin: {e}"))?;

    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(())
}

fn warn_default_password(key: &str, password: &str) {
    if password == "change-me" {
        eprintln!("⚠️  la contraseña de {key} sigue en 'change-me'");
    }
}

fn build_secrets(
    vars: &BTreeMap<String, String>,
) -> Result<Vec<(&'static str, BTreeMap<&'static str, String>)>, Vec<String>> {
    let mut errors = Vec::new();
    let mut app = BTreeMap::new();

    for key in APP_REQUIRED {
        match vars.get(*key) {
            Some(v) if !v.is_empty() => {
                app.insert(*key, v.clone());
            }
            _ => errors.push(format!("{key} falta o está vacío")),
        }
    }
    for key in APP_OPTIONAL {
        if let Some(v) = vars.get(*key).filter(|v| !v.is_empty()) {
            app.insert(*key, v.clone());
        }
    }
    if app.get("JWT_SECRET").is_some_and(|v| v == "change-me") {
        errors.push("JWT_SECRET sigue en 'change-me' (openssl rand -base64 32)".into());
    }

    let mut postgres = BTreeMap::new();
    if let Some(url) = app.get("DATABASE_URL") {
        match parse_url("DATABASE_URL", url) {
            Ok(db) if db.user.is_empty() || db.password.is_empty() => {
                errors.push("DATABASE_URL necesita usuario y contraseña (postgres://user:pass@…)".into())
            }
            Ok(db) => {
                warn_default_password("DATABASE_URL", &db.password);
                let name = if db.path.is_empty() { db.user.clone() } else { db.path };
                postgres.insert("POSTGRES_USER", db.user);
                postgres.insert("POSTGRES_PASSWORD", db.password);
                postgres.insert("POSTGRES_DB", name);
            }
            Err(e) => errors.push(e),
        }
    }

    let mut dragonfly = BTreeMap::new();
    if let Some(url) = app.get("CACHE_URL") {
        match parse_url("CACHE_URL", url) {
            Ok(cache) if cache.password.is_empty() => {
                errors.push("CACHE_URL necesita contraseña (redis://:pass@…)".into())
            }
            Ok(cache) => {
                warn_default_password("CACHE_URL", &cache.password);
                dragonfly.insert("DFLY_requirepass", cache.password);
            }
            Err(e) => errors.push(e),
        }
    }

    if errors.is_empty() {
        Ok(vec![
            ("app-env", app),
            ("postgres-env", postgres),
            ("dragonfly-env", dragonfly),
        ])
    } else {
        Err(errors)
    }
}

fn main() {
    let path = env::args().nth(1).unwrap_or_else(|| ".env".to_string());

    let vars = match parse_env(Path::new(&path)) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("❌ {e}");
            std::process::exit(1);
        }
    };

    let secrets = match build_secrets(&vars) {
        Ok(s) => s,
        Err(errors) => {
            for e in errors {
                eprintln!("❌ {e} en {path}");
            }
            eprintln!("\nNo se creó ningún secret.");
            std::process::exit(1);
        }
    };

    let mut failed: Vec<&str> = Vec::new();
    for (name, data) in &secrets {
        match create_secret(name, &kube_secret(name, data)) {
            Ok(()) => {
                let keys: Vec<&str> = data.keys().copied().collect();
                println!("✅ {name}  ←  {}", keys.join(", "));
            }
            Err(e) => {
                eprintln!("❌ {name}: {e}");
                failed.push(name);
            }
        }
    }

    println!("\n{}/{} secrets listos.", secrets.len() - failed.len(), secrets.len());

    for key in QUADLET_ENV {
        if vars.contains_key(*key) {
            println!("ℹ️  {key} lo fija app.yaml; el valor del .env se ignora");
        }
    }

    println!("\nℹ️  Postgres solo aplica POSTGRES_PASSWORD al crear el volumen: si cambias");
    println!("   la contraseña con datos existentes, cámbiala también con ALTER USER.");

    println!("\nSiguiente paso:");
    println!("  systemctl --user restart postgres.service dragonfly.service app.service");

    if !failed.is_empty() {
        eprintln!("\n⚠️  Revisa: {}", failed.join(", "));
        std::process::exit(1);
    }
}
