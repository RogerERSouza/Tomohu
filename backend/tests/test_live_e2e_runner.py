"""Regression coverage for the isolated browser test server lifecycle."""

import importlib.util
import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

spec = importlib.util.spec_from_file_location(
    "live_e2e_runner", Path(__file__).resolve().parents[2] / "scripts/run_live_e2e.py"
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def test_windows_stops_owned_tree_before_waiting(monkeypatch):
    server = Mock(pid=12345)
    server.poll.return_value = None
    events = []

    def taskkill(command, **kwargs):
        assert command == ["taskkill", "/PID", "12345", "/T", "/F"]
        events.append("tree")
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(runner.subprocess, "run", taskkill)
    server.wait.side_effect = lambda **kwargs: events.append("wait")
    runner.stop_server(server, windows=True)
    assert events == ["tree", "wait"]
    server.terminate.assert_not_called()


def test_windows_cleanup_failure_is_reported(monkeypatch):
    server = Mock(pid=12345)
    server.poll.return_value = None
    monkeypatch.setattr(
        runner.subprocess, "run", lambda *args, **kwargs: Mock(returncode=1)
    )
    with pytest.raises(RuntimeError, match="process tree"):
        runner.stop_server(server, windows=True)


def test_exited_server_is_not_signalled(monkeypatch):
    server = Mock()
    server.poll.return_value = 0
    kill = Mock()
    monkeypatch.setattr(runner.subprocess, "run", kill)
    runner.stop_server(server, windows=True)
    kill.assert_not_called()
    server.terminate.assert_not_called()


def test_unresponsive_server_is_killed():
    server = Mock()
    server.poll.return_value = None
    server.wait.side_effect = [subprocess.TimeoutExpired("api", 10), 0]
    runner.stop_server(server, windows=False)
    server.terminate.assert_called_once()
    server.kill.assert_called_once()
    assert server.wait.call_count == 2


def test_real_server_process_exits_before_cleanup():
    server = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    try:
        runner.stop_server(server)
        assert server.poll() is not None
    finally:
        if server.poll() is None:
            server.kill()
            server.wait(timeout=10)
