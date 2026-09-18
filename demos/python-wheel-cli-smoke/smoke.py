#!/usr/bin/env python3
"""Install the Letta CLI wheel into a disposable venv and verify its boundary."""

import argparse
import json
import os
import platform
import re
import signal
import shutil
import subprocess
import sys
import tempfile
import venv
from pathlib import Path


def run(command, *, env=None, cwd=None, timeout=120):
    options = {}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    process = subprocess.Popen(
        [str(part) for part in command],
        env=env,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        **options,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            system_root = os.environ.get("SystemRoot", r"C:\Windows")
            taskkill = Path(system_root) / "System32" / "taskkill.exe"
            if taskkill.is_file():
                subprocess.run(
                    [str(taskkill), "/PID", str(process.pid), "/T", "/F"],
                    capture_output=True,
                    check=False,
                )
            else:
                process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise
    return subprocess.CompletedProcess(
        process.args, process.returncode, stdout, stderr
    )


def require(result, description, *, code=0, contains=None):
    combined = result.stdout + result.stderr
    if result.returncode != code or (contains and contains not in combined):
        raise RuntimeError(
            f"{description} failed (exit {result.returncode})\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return combined.strip()


def isolated_runtime_env(root, binary):
    home = root / "home"
    temporary = root / "tmp"
    home.mkdir()
    temporary.mkdir()
    env = {
        "HOME": str(home),
        "USERPROFILE": str(home),
        "PATH": str(binary),
        "TMPDIR": str(temporary),
        "TEMP": str(temporary),
        "TMP": str(temporary),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
    }
    # Windows process creation and standard-library discovery may need these
    # host paths. They do not add Node or npm to PATH.
    for key in ("SystemRoot", "WINDIR", "PATHEXT"):
        if key in os.environ:
            env[key] = os.environ[key]
    return env


def main():
    parser = argparse.ArgumentParser(
        description="Smoke-test the self-contained Letta Code Python wheel."
    )
    parser.add_argument(
        "--version",
        default="0.32.13",
        help="Exact PyPI letta version to install (default: 0.32.13).",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON.")
    args = parser.parse_args()

    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9 or newer is required")
    if not re.fullmatch(
        r"[0-9]+(?:\.[0-9]+){2}(?:[A-Za-z0-9.-]+)?", args.version
    ):
        raise SystemExit("--version must be one exact semver-like release version")

    with tempfile.TemporaryDirectory(prefix="letta-wheel-smoke-") as directory:
        root = Path(directory)
        environment = root / "venv"
        venv.EnvBuilder(with_pip=True, clear=True).create(environment)
        binary = environment / ("Scripts" if os.name == "nt" else "bin")
        python = binary / ("python.exe" if os.name == "nt" else "python")
        cli = binary / ("letta.exe" if os.name == "nt" else "letta")

        install = run(
            [
                python,
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-cache-dir",
                "--only-binary=:all:",
                "--no-deps",
                f"letta=={args.version}",
            ],
            cwd=root,
            timeout=300,
        )
        require(install, "wheel installation")

        env = isolated_runtime_env(root, binary)
        if shutil.which("node", path=env["PATH"]):
            raise RuntimeError("Node unexpectedly remains visible on isolated PATH")
        if shutil.which("npm", path=env["PATH"]):
            raise RuntimeError("npm unexpectedly remains visible on isolated PATH")

        package_probe = run(
            [
                python,
                "-c",
                (
                    "import importlib.metadata as m, letta_code; "
                    "from pathlib import Path; "
                    "p=Path(letta_code.__file__).parent/'_payload'; "
                    "print(m.version('letta')); print(p)"
                ),
            ],
            env=env,
            cwd=root,
        )
        package_lines = require(package_probe, "package metadata").splitlines()
        installed_version, payload = package_lines
        if installed_version != args.version:
            raise RuntimeError(
                f"installed letta {installed_version}, expected {args.version}"
            )

        bundled_node = Path(payload) / "bin" / (
            "node.exe" if os.name == "nt" else "node"
        )
        if not bundled_node.is_file():
            raise RuntimeError(f"bundled Node not found: {bundled_node}")
        node_version = require(
            run([bundled_node, "--version"], env=env, cwd=root), "bundled Node"
        )

        cli_version = require(
            run([cli, "--version"], env=env, cwd=root),
            "letta --version",
            contains="Letta Code",
        )
        require(
            run([cli, "--help"], env=env, cwd=root),
            "letta --help",
            contains="USAGE",
        )
        update = require(
            run([cli, "update"], env=env, cwd=root),
            "Python-managed update boundary",
            code=1,
            contains="uv tool upgrade letta",
        )
        for instruction in (
            "pipx upgrade letta",
            "python -m pip install --upgrade letta",
        ):
            if instruction not in update:
                raise RuntimeError(f"missing update instruction: {instruction}")

        report = {
            "package": f"letta=={installed_version}",
            "python": platform.python_version(),
            "platform": platform.platform(),
            "system_node_visible": False,
            "system_npm_visible": False,
            "cli_version": cli_version,
            "bundled_node_version": node_version,
            "help_probe": "passed",
            "update_owner": "Python package installer",
            "temporary_home": True,
            "model_turn_requested": False,
        }

        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print("Letta Python-wheel smoke")
            print(f"  package:             {report['package']}")
            print(f"  Python:              {report['python']}")
            print(f"  platform:            {report['platform']}")
            print("  system Node visible: no")
            print("  system npm visible:  no")
            print(f"  CLI:                 {report['cli_version']}")
            print(f"  bundled Node:        {report['bundled_node_version']}")
            print("  --help:              passed")
            print("  update owner:        Python package installer")
            print("  temporary HOME:      yes")
            print("  model turn requested: no")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
