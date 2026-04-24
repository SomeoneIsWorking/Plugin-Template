import json
import os
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class Plugin:
    def __init__(self):
        self._bridge_info = None
        self._heroic_process = None

    def _bridge_info_paths(self):
        home = os.path.expanduser("~")
        return [
            os.path.join(home, ".config", "heroic", "decky-bridge.json"),
            os.path.join(
                home,
                ".var",
                "app",
                "com.heroicgameslauncher.hgl",
                "config",
                "heroic",
                "decky-bridge.json",
            ),
            os.path.join(home, ".local", "share", "heroic", "decky-bridge.json"),
        ]

    def _load_bridge_info(self):
        if self._bridge_info:
            return self._bridge_info

        for path in self._bridge_info_paths():
            if not os.path.exists(path):
                continue

            with open(path, "r", encoding="utf-8") as file_handle:
                loaded = json.load(file_handle)

            if "port" in loaded and "token" in loaded:
                self._bridge_info = loaded
                return loaded

        raise RuntimeError(
            "Heroic bridge file was not found. Start Heroic first so the bridge can initialize."
        )

    def _heroic_request(self, method, path, payload=None, query=None):
        bridge = self._load_bridge_info()
        base_url = f"http://127.0.0.1:{bridge['port']}{path}"

        if query:
            base_url = f"{base_url}?{urlencode(query)}"

        body = None
        headers = {"X-Heroic-Decky-Token": bridge["token"]}
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = Request(base_url, data=body, headers=headers, method=method)

        try:
            with urlopen(req, timeout=8) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            message = error.read().decode("utf-8")
            raise RuntimeError(message or f"Heroic request failed with HTTP {error.code}")
        except URLError as error:
            self._bridge_info = None
            raise RuntimeError(f"Unable to reach Heroic bridge: {error}")

    def _bridge_ready(self):
        self._bridge_info = None
        self._heroic_request("GET", "/health")

    def _start_heroic_process(self):
        candidates = [
            ["flatpak", "run", "com.heroicgameslauncher.hgl", "--no-gui"],
            ["flatpak", "run", "com.heroicgameslauncher.hgl"],
            ["heroic", "--no-gui"],
            ["heroic"],
            ["com.heroicgameslauncher.hgl", "--no-gui"],
        ]

        for command in candidates:
            try:
                self._heroic_process = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                    close_fds=True,
                )
                return {"started": True, "command": " ".join(command)}
            except FileNotFoundError:
                continue
            except Exception:
                continue

        return {
            "started": False,
            "message": "Could not launch Heroic. Install Heroic as flatpak or ensure the heroic command is in PATH.",
        }

    def _wait_for_bridge(self, timeout_seconds=25, interval_seconds=1):
        end_time = time.monotonic() + timeout_seconds
        last_error = ""

        while time.monotonic() < end_time:
            try:
                self._bridge_ready()
                bridge = self._load_bridge_info()
                return {"ok": True, "port": bridge["port"]}
            except Exception as error:
                last_error = str(error)
                time.sleep(interval_seconds)

        return {
            "ok": False,
            "message": last_error
            or "Heroic started but bridge did not become available in time.",
        }

    async def start_heroic(self):
        try:
            self._bridge_ready()
            bridge = self._load_bridge_info()
            return {
                "ok": True,
                "started": False,
                "port": bridge["port"],
                "message": "Heroic is already running.",
            }
        except Exception:
            pass

        start_result = self._start_heroic_process()
        if not start_result.get("started"):
            return {
                "ok": False,
                "started": False,
                "message": start_result["message"],
            }

        waited = self._wait_for_bridge()
        if waited["ok"]:
            return {
                "ok": True,
                "started": True,
                "port": waited["port"],
                "message": f"Started Heroic using: {start_result['command']}",
            }

        return {
            "ok": False,
            "started": True,
            "message": waited["message"],
        }

    async def get_bridge_status(self, auto_start=False):
        try:
            self._bridge_ready()
            bridge = self._load_bridge_info()
            return {
                "ok": True,
                "port": bridge["port"],
                "message": "Connected to Heroic bridge",
            }
        except Exception as error:
            if auto_start:
                return await self.start_heroic()
            return {
                "ok": False,
                "message": str(error),
            }

    async def list_games(self, runner="legendary"):
        data = self._heroic_request("GET", "/games", query={"runner": runner})
        return data.get("games", [])

    async def install_game(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._heroic_request(
            "POST",
            f"/games/{encoded}/install",
            payload={"runner": runner},
        )

    async def delete_game(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._heroic_request(
            "DELETE",
            f"/games/{encoded}",
            query={"runner": runner},
        )

    async def add_to_steam(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._heroic_request(
            "POST",
            f"/games/{encoded}/add-to-steam",
            payload={"runner": runner},
        )

    async def _main(self):
        return