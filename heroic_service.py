#!/usr/bin/env python3
import json
import os
import random
import re
import secrets
import shlex
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse


class HeroicService:
    def __init__(self):
        self.home = Path.home()
        self.service_dir = self.home / ".config" / "heroic-decky"
        self.service_info_path = self.service_dir / "service.json"
        self.service_token = secrets.token_hex(24)

        self.heroic_config_root = (
            self.home / ".var" / "app" / "com.heroicgameslauncher.hgl" / "config" / "heroic"
        )
        self.legendary_config = self.heroic_config_root / "legendaryConfig" / "legendary"
        self.legendary_metadata = self.legendary_config / "metadata"
        self.legendary_installed = self.legendary_config / "installed.json"
        self.heroic_config_json = self.heroic_config_root / "config.json"
        self.heroic_games_config_root = self.heroic_config_root / "GamesConfig"
        self.decky_state_json = self.heroic_config_root / "decky_state.json"
        self.legendary_bin = "/app/bin/heroic/resources/app.asar.unpacked/build/bin/x64/linux/legendary"
        self.flatpak_app_id = "com.heroicgameslauncher.hgl"

        self.active_jobs = {}
        self.active_jobs_lock = threading.Lock()

    def _read_json_file(self, path, default):
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default

    def _write_json_file(self, path, data):
        os.makedirs(path.parent, exist_ok=True)
        temp_path = path.with_suffix(path.suffix + ".tmp")
        temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def _load_heroic_config(self):
        return self._read_json_file(self.heroic_config_json, {})

    def _save_heroic_config(self, config):
        self._write_json_file(self.heroic_config_json, config)

    def _default_install_path(self):
        config = self._load_heroic_config()
        return config.get("defaultInstallPath") or str(self.home / "Games" / "Heroic")

    def _set_default_install_path(self, install_path):
        config = self._load_heroic_config()
        config["defaultInstallPath"] = install_path
        self._save_heroic_config(config)

    def _decky_state(self):
        state = self._read_json_file(self.decky_state_json, {})
        if not isinstance(state, dict):
            state = {}
        if "jobs" not in state or not isinstance(state["jobs"], dict):
            state["jobs"] = {}
        return state

    def _save_decky_state(self, state):
        state["updatedAt"] = int(time.time())
        self._write_json_file(self.decky_state_json, state)

    def _set_persisted_job(self, app_name, status, progress=None, message=None, install_path=None):
        state = self._decky_state()
        existing = state["jobs"].get(app_name, {})
        state["jobs"][app_name] = {
            "status": status,
            "progress": progress,
            "message": message,
            "installPath": install_path if install_path is not None else existing.get("installPath"),
            "updatedAt": time.time(),
        }
        self._save_decky_state(state)

    def _clear_persisted_job(self, app_name):
        state = self._decky_state()
        if app_name in state["jobs"]:
            del state["jobs"][app_name]
            self._save_decky_state(state)

    def _load_persisted_job(self, app_name):
        return self._decky_state().get("jobs", {}).get(app_name)

    def _write_game_config(self, app_name, install_path):
        os.makedirs(self.heroic_games_config_root, exist_ok=True)
        path = self.heroic_games_config_root / f"{app_name}.json"
        payload = self._read_json_file(path, {})
        if not isinstance(payload, dict):
            payload = {}

        game_cfg = payload.get(app_name, {})
        if not isinstance(game_cfg, dict):
            game_cfg = {}

        game_cfg["installPath"] = install_path
        payload[app_name] = game_cfg
        payload.setdefault("version", "v0")
        payload.setdefault("explicit", True)
        self._write_json_file(path, payload)

    def _run_flatpak_shell(self, script, capture_output=True):
        cmd = ["flatpak", "run", "--command=sh", self.flatpak_app_id, "-lc", script]
        return subprocess.run(
            cmd,
            check=True,
            text=True,
            capture_output=capture_output,
        )

    def _legendary_shell(self, args):
        quoted_args = " ".join(shlex.quote(arg) for arg in args)
        config_path = shlex.quote(str(self.legendary_config))
        legendary_bin = shlex.quote(self.legendary_bin)
        return (
            f"LEGENDARY_CONFIG_PATH={config_path} {legendary_bin} {quoted_args}"
        )

    def _run_legendary_json(self, args):
        proc = self._run_flatpak_shell(self._legendary_shell(args))
        stdout = proc.stdout.strip()
        return json.loads(stdout) if stdout else []

    def _spawn_legendary(self, args):
        cmd = ["flatpak", "run", "--command=sh", self.flatpak_app_id, "-lc", self._legendary_shell(args)]
        return subprocess.Popen(
            cmd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )

    def _load_installed_map(self):
        return self._read_json_file(self.legendary_installed, {})

    def _pick_box_art(self, metadata):
        images = metadata.get("keyImages", [])
        preferred = ["DieselGameBoxTall", "OfferImageTall", "Thumbnail", "DieselGameBox"]
        for image_type in preferred:
            for image in images:
                if image.get("type") == image_type and image.get("url"):
                    return image["url"]
        for image in images:
            if image.get("url"):
                return image["url"]
        return ""

    def _game_status(self, app_name, is_installed):
        with self.active_jobs_lock:
            job = self.active_jobs.get(app_name)
            if job:
                return job.get("status", "queued"), job.get("progress")
        persisted = self._load_persisted_job(app_name)
        if persisted:
            return persisted.get("status", "queued"), persisted.get("progress")
        return ("installed", None) if is_installed else ("notInstalled", None)

    def _iter_library_games(self):
        installed_map = self._load_installed_map()
        if not self.legendary_metadata.exists():
            return []

        games = []
        for metadata_file in sorted(self.legendary_metadata.glob("*.json")):
            try:
                data = json.loads(metadata_file.read_text(encoding="utf-8"))
            except Exception:
                continue

            metadata = data.get("metadata", {})
            categories = metadata.get("categories", [])
            if any(category.get("path") == "mods" for category in categories):
                continue
            if metadata.get("mainGameItem"):
                continue

            release_info = metadata.get("releaseInfo", [])
            if release_info and all(
                all(platform in ("Android", "iOS") for platform in info.get("platform", []))
                for info in release_info
            ):
                continue

            app_name = data.get("app_name")
            if not app_name:
                continue

            installed = installed_map.get(app_name, {})
            is_installed = app_name in installed_map
            status, progress = self._game_status(app_name, is_installed)

            games.append(
                {
                    "appName": app_name,
                    "title": metadata.get("title") or data.get("app_title") or app_name,
                    "runner": "legendary",
                    "isInstalled": is_installed,
                    "status": status,
                    "progress": progress,
                    "boxArt": self._pick_box_art(metadata),
                }
            )
        return games

    def _set_job(self, app_name, status, progress=None, message=None):
        with self.active_jobs_lock:
            self.active_jobs[app_name] = {
                "status": status,
                "progress": progress,
                "message": message,
                "updatedAt": time.time(),
            }
        self._set_persisted_job(app_name, status, progress, message)

    def _clear_job(self, app_name):
        with self.active_jobs_lock:
            self.active_jobs.pop(app_name, None)
        self._clear_persisted_job(app_name)

    def _track_install(self, app_name, install_path):
        try:
            args = ["install", app_name, "--base-path", install_path, "--yes"]
            proc = self._spawn_legendary(args)
            self._set_job(app_name, "queued", {"percent": 0})
            self._set_persisted_job(app_name, "queued", {"percent": 0}, None, install_path)
            self._write_game_config(app_name, install_path)

            percent_re = re.compile(r"(\d{1,3}(?:\.\d+)?)%")
            while True:
                line = proc.stdout.readline() if proc.stdout else ""
                if not line and proc.poll() is not None:
                    break
                if not line:
                    continue
                line = line.strip()
                match = percent_re.search(line)
                progress = None
                if match:
                    percent = max(0.0, min(100.0, float(match.group(1))))
                    progress = {"percent": percent, "bytes": "", "eta": ""}
                    self._set_job(app_name, "installing", progress, line)
                    self._set_persisted_job(app_name, "installing", progress, line, install_path)
                elif "queue" in line.lower():
                    self._set_job(app_name, "queued", {"percent": 0}, line)
                    self._set_persisted_job(app_name, "queued", {"percent": 0}, line, install_path)
                else:
                    current = self.active_jobs.get(app_name, {})
                    self._set_job(
                        app_name,
                        current.get("status", "installing"),
                        current.get("progress") or {"percent": 0},
                        line,
                    )

            return_code = proc.wait()
            if return_code == 0:
                self._clear_job(app_name)
            else:
                current = self._load_persisted_job(app_name) or {}
                self._set_job(
                    app_name,
                    "error",
                    current.get("progress") or {"percent": 0},
                    f"legendary exited with {return_code}",
                )
                self._set_persisted_job(
                    app_name,
                    "error",
                    (current.get("progress") if current else None) or {"percent": 0},
                    f"legendary exited with {return_code}",
                    install_path,
                )
        except Exception as error:
            current = self._load_persisted_job(app_name) or {}
            self._set_job(app_name, "error", current.get("progress") or {"percent": 0}, str(error))
            self._set_persisted_job(
                app_name,
                "error",
                current.get("progress") or {"percent": 0},
                str(error),
                install_path,
            )

    def service_paths(self):
        return {
            "heroicConfigRoot": str(self.heroic_config_root),
            "heroicConfigJson": str(self.heroic_config_json),
            "heroicGamesConfigRoot": str(self.heroic_games_config_root),
            "legendaryConfigRoot": str(self.legendary_config),
            "legendaryMetadataRoot": str(self.legendary_metadata),
            "legendaryInstalledJson": str(self.legendary_installed),
            "deckyStateJson": str(self.decky_state_json),
            "legendaryBinary": self.legendary_bin,
            "defaultInstallPath": self._default_install_path(),
        }

    def get_install_path(self):
        return {"defaultInstallPath": self._default_install_path()}

    def set_install_path(self, install_path):
        if not install_path or not isinstance(install_path, str):
            raise RuntimeError("install path must be a non-empty string")
        self._set_default_install_path(install_path)
        return {"ok": True, "defaultInstallPath": install_path}

    def bridge_status(self):
        # Kept for plugin compatibility; now reports direct Legendary service health.
        if not self.legendary_config.exists():
            return {
                "ok": False,
                "message": f"Heroic Flatpak config was not found at {self.legendary_config}",
            }
        return {
            "ok": True,
            "message": "Connected to bundled Legendary via Heroic Flatpak storage",
        }

    def start_heroic(self):
        # Kept for frontend compatibility; this now means service is ready.
        return {
            "ok": True,
            "started": False,
            "message": "Heroic Decky service is running.",
        }

    def list_games(self, runner):
        if runner != "legendary":
            return []
        return self._iter_library_games()

    def install_game(self, app_name, runner, install_path=None):
        if runner != "legendary":
            raise RuntimeError("Only legendary is currently supported")
        install_path = install_path or self._default_install_path()
        self._set_default_install_path(install_path)
        thread = threading.Thread(
            target=self._track_install,
            args=(app_name, install_path),
            daemon=True,
        )
        thread.start()
        return {
            "ok": True,
            "queued": True,
            "appName": app_name,
            "runner": runner,
            "path": install_path,
        }

    def delete_game(self, app_name, runner):
        if runner != "legendary":
            raise RuntimeError("Only legendary is currently supported")
        proc = self._run_flatpak_shell(self._legendary_shell(["uninstall", app_name, "--yes"]))
        self._clear_job(app_name)
        return {
            "ok": True,
            "removed": True,
            "appName": app_name,
            "stdout": proc.stdout,
        }

    def add_to_steam(self, app_name, runner):
        # Not yet reimplemented directly; report explicit limitation instead of bridging.
        raise RuntimeError(
            "Direct Steam shortcut integration has not been reimplemented in the standalone service yet."
        )

    def launch_game(self, app_name, runner):
        if runner != "legendary":
            raise RuntimeError("Only legendary is currently supported")
        proc = self._spawn_legendary(["launch", app_name])
        return {
            "ok": True,
            "launched": True,
            "appName": app_name,
            "pid": proc.pid,
        }


service = HeroicService()


class Handler(BaseHTTPRequestHandler):
    server_version = "HeroicDeckyService/2.0"

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _is_authorized(self):
        token = self.headers.get("X-Heroic-Decky-Service-Token", "")
        return token == service.service_token

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path == "/health":
            self._json(200, {"ok": True, "service": "heroic-decky"})
            return

        if not self._is_authorized():
            self._json(401, {"error": "unauthorized"})
            return

        if parsed.path == "/bridge_status":
            self._json(200, service.bridge_status())
            return

        if parsed.path == "/service_paths":
            self._json(200, service.service_paths())
            return

        if parsed.path == "/settings/install_path":
            self._json(200, service.get_install_path())
            return

        if parsed.path == "/games":
            runner = (qs.get("runner", ["legendary"])[0] or "legendary")
            try:
                self._json(200, {"games": service.list_games(runner)})
            except Exception as error:
                self._json(500, {"error": str(error)})
            return

        self._json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)

        if not self._is_authorized():
            self._json(401, {"error": "unauthorized"})
            return

        if parsed.path == "/start_heroic":
            self._json(200, service.start_heroic())
            return

        try:
            body = self._read_json()
        except Exception:
            self._json(400, {"error": "invalid json"})
            return

        runner = body.get("runner", "legendary")
        install_path = body.get("installPath")
        path_parts = [part for part in parsed.path.split("/") if part]

        if parsed.path == "/settings/install_path":
            try:
                self._json(200, service.set_install_path(install_path))
            except Exception as error:
                self._json(500, {"error": str(error)})
            return

        if len(path_parts) == 3 and path_parts[0] == "games":
            app_name = unquote(path_parts[1])
            action = path_parts[2]

            try:
                if action == "install":
                    self._json(200, service.install_game(app_name, runner, install_path))
                    return
                if action == "add-to-steam":
                    self._json(200, service.add_to_steam(app_name, runner))
                    return
                if action == "launch":
                    self._json(200, service.launch_game(app_name, runner))
                    return
            except Exception as error:
                self._json(500, {"error": str(error)})
                return

        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if not self._is_authorized():
            self._json(401, {"error": "unauthorized"})
            return

        path_parts = [part for part in parsed.path.split("/") if part]
        if len(path_parts) == 2 and path_parts[0] == "games":
            app_name = unquote(path_parts[1])
            runner = (qs.get("runner", ["legendary"])[0] or "legendary")
            try:
                self._json(200, service.delete_game(app_name, runner))
            except Exception as error:
                self._json(500, {"error": str(error)})
            return

        self._json(404, {"error": "not found"})

    def log_message(self, format_str, *args):
        return


def main():
    os.makedirs(service.service_dir, exist_ok=True)
    host = "127.0.0.1"
    port = random.randint(39500, 42000)
    httpd = ThreadingHTTPServer((host, port), Handler)

    info = {
        "port": port,
        "token": service.service_token,
        "updatedAt": int(time.time()),
        "version": 2,
    }
    with open(service.service_info_path, "w", encoding="utf-8") as file_handle:
        json.dump(info, file_handle)

    httpd.serve_forever()


if __name__ == "__main__":
    main()
