import json
import os
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class Plugin:
    def __init__(self):
        self._service_info = None
        self._service_process = None

    def _service_info_path(self):
        return os.path.join(
            os.path.expanduser("~"),
            ".config",
            "heroic-decky",
            "service.json",
        )

    def _service_unit_path(self):
        return os.path.join(
            os.path.expanduser("~"),
            ".config",
            "systemd",
            "user",
            "heroic-decky.service",
        )

    def _service_script_path(self):
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "heroic_service.py")

    def _load_service_info(self):
        if self._service_info:
            return self._service_info

        path = self._service_info_path()
        if not os.path.exists(path):
            raise RuntimeError("Heroic Decky service info file was not found.")

        with open(path, "r", encoding="utf-8") as file_handle:
            loaded = json.load(file_handle)

        if "port" not in loaded or "token" not in loaded:
            raise RuntimeError("Heroic Decky service info is invalid.")

        self._service_info = loaded
        return loaded

    def _service_request(self, method, path, payload=None, query=None):
        svc = self._load_service_info()
        base_url = f"http://127.0.0.1:{svc['port']}{path}"

        if query:
            base_url = f"{base_url}?{urlencode(query)}"

        body = None
        headers = {"X-Heroic-Decky-Service-Token": svc["token"]}
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
            raise RuntimeError(message or f"Service request failed with HTTP {error.code}")
        except URLError as error:
            self._service_info = None
            raise RuntimeError(f"Unable to reach Heroic Decky service: {error}")

    def _write_service_unit(self):
        unit_path = self._service_unit_path()
        os.makedirs(os.path.dirname(unit_path), exist_ok=True)

        service_script = self._service_script_path()
        unit = f"""[Unit]
Description=Heroic Decky Plugin Service
After=default.target

[Service]
Type=simple
ExecStart=/usr/bin/env python3 {service_script}
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
"""

        with open(unit_path, "w", encoding="utf-8") as file_handle:
            file_handle.write(unit)

    def _start_service_systemd(self):
        try:
            subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
            subprocess.run(
                ["systemctl", "--user", "enable", "--now", "heroic-decky.service"],
                check=True,
            )
            return True
        except Exception:
            return False

    def _start_service_fallback(self):
        service_script = self._service_script_path()
        self._service_process = subprocess.Popen(
            ["python3", service_script],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )

    def _wait_for_service(self, timeout_seconds=15, interval_seconds=1):
        end_time = time.monotonic() + timeout_seconds
        last_error = ""

        while time.monotonic() < end_time:
            try:
                self._service_info = None
                status = self._service_request("GET", "/health")
                if status.get("ok"):
                    svc = self._load_service_info()
                    return {"ok": True, "port": svc["port"]}
            except Exception as error:
                last_error = str(error)
                time.sleep(interval_seconds)

        return {
            "ok": False,
            "message": last_error
            or "Heroic Decky service did not become available in time.",
        }

    def _ensure_service(self):
        self._write_service_unit()

        started = self._start_service_systemd()
        if not started:
            self._start_service_fallback()

        return self._wait_for_service()

    async def start_heroic(self):
        try:
            self._service_request("GET", "/health")
            svc = self._load_service_info()
            return {
                "ok": True,
                "started": False,
                "port": svc["port"],
                "message": "Heroic Decky service is already running.",
            }
        except Exception:
            pass

        waited = self._ensure_service()
        if waited["ok"]:
            return {
                "ok": True,
                "started": True,
                "port": waited["port"],
                "message": "Heroic Decky service started.",
            }

        return {
            "ok": False,
            "started": True,
            "message": waited["message"],
        }

    async def get_bridge_status(self, auto_start=False):
        try:
            status = self._service_request("GET", "/bridge_status")
            if not status.get("ok"):
                return status

            svc = self._load_service_info()
            return {
                "ok": True,
                "port": svc["port"],
                "message": "Connected to Heroic Decky service",
            }
        except Exception as error:
            if auto_start:
                result = await self.start_heroic()
                if result.get("ok"):
                    return await self.get_bridge_status(auto_start=False)
                return result
            return {
                "ok": False,
                "message": str(error),
            }

    async def list_games(self, runner="legendary"):
        data = self._service_request("GET", "/games", query={"runner": runner})
        return data.get("games", [])

    async def get_service_paths(self):
        return self._service_request("GET", "/service_paths")

    async def get_install_path(self):
        return self._service_request("GET", "/settings/install_path")

    async def set_install_path(self, install_path):
        return self._service_request(
            "POST",
            "/settings/install_path",
            payload={"installPath": install_path},
        )

    async def install_game(self, app_name, runner="legendary", install_path=None):
        encoded = quote(app_name, safe="")
        payload = {"runner": runner}
        if install_path:
            payload["installPath"] = install_path
        return self._service_request(
            "POST",
            f"/games/{encoded}/install",
            payload=payload,
        )

    async def delete_game(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._service_request(
            "DELETE",
            f"/games/{encoded}",
            query={"runner": runner},
        )

    async def add_to_steam(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._service_request(
            "POST",
            f"/games/{encoded}/add-to-steam",
            payload={"runner": runner},
        )

    async def launch_game(self, app_name, runner="legendary"):
        encoded = quote(app_name, safe="")
        return self._service_request(
            "POST",
            f"/games/{encoded}/launch",
            payload={"runner": runner},
        )

    async def _main(self):
        self._ensure_service()
        return