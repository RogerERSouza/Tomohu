"""Run browser/account integration against an isolated real API database."""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]


def stop_server(server: subprocess.Popen, *, windows: bool = os.name == "nt") -> None:
    """Stop the owned API before temporary database cleanup, including Windows children."""
    if server.poll() is not None:
        return
    if windows:
        # The Windows venv redirector can own a child interpreter holding DB handles.
        result = subprocess.run(
            ["taskkill", "/PID", str(server.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode and server.poll() is None:
            raise RuntimeError("Could not stop the isolated API process tree.")
    else:
        server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait(timeout=10)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run isolated live browser integration tests"
    )
    parser.add_argument("--suite", choices=("accounts", "privacy"), default="accounts")
    args = parser.parse_args()
    spec = (
        "tests/e2e/accountsLive.spec.ts"
        if args.suite == "accounts"
        else "tests/e2e/privacyLive.spec.ts"
    )
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 8000)) == 0:
            raise SystemExit(
                "Port 8000 is busy. Stop the existing API before this test."
            )
    with tempfile.TemporaryDirectory(prefix="tomohu-e2e-") as directory:
        database = os.getenv("TOMOHU_E2E_DATABASE_URL")
        if database:
            url = make_url(database)
            if not url.drivername.startswith("postgresql") or not (
                url.database or ""
            ).endswith("_test"):
                raise SystemExit("Use a dedicated PostgreSQL database ending in _test.")
        else:
            database = "sqlite:///" + str(Path(directory) / "accounts.db")
        env = {
            **os.environ,
            "TOMOHU_ENVIRONMENT": "test",
            "TOMOHU_DATABASE_URL": database,
            "TOMOHU_CORS_ORIGINS": "http://127.0.0.1:4173",
            "TOMOHU_JWT_SECRET": "isolated-account-e2e-secret-" * 3,
            "TOMOHU_LIVE_API": "1",
            "VITE_API_BASE_URL": "http://127.0.0.1:8000",
            "PYTHONPATH": str(ROOT / "backend"),
            "TOMOHU_PYTHON": sys.executable,
            "TOMOHU_MAIL_MODE": "outbox",
            "TOMOHU_MAIL_OUTBOX": str(Path(directory) / "mail"),
            "TOMOHU_FRONTEND_URL": "http://127.0.0.1:4173/",
        }
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=ROOT / "backend",
            env=env,
            check=True,
        )
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
                "--no-access-log",
                "--workers",
                "1",
            ],
            cwd=ROOT / "backend",
            env=env,
        )
        worker = None
        try:
            worker = subprocess.Popen(
                [sys.executable, "-m", "app.email_worker"],
                cwd=ROOT / "backend",
                env=env,
            )
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError("The isolated API failed to start.")
                try:
                    with urllib.request.urlopen(
                        "http://127.0.0.1:8000/health", timeout=1
                    ):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Timed out starting the isolated API.")
            npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
            if not npm:
                raise RuntimeError("npm is required for browser integration tests.")
            subprocess.run(
                [npm, "run", "test:e2e", "--", spec],
                cwd=ROOT,
                env=env,
                check=True,
            )
        finally:
            if worker is not None:
                stop_server(worker)
            stop_server(server)


if __name__ == "__main__":
    main()
