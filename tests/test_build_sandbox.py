"""Sandbox builds install only a successfully compiled helper."""

import shutil
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.fixture
def build_script(tmp_path: Path) -> Path:
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    script = scripts / "build_sandbox.py"
    shutil.copyfile(Path(__file__).parents[1] / "scripts" / script.name, script)
    return script


def test_missing_cargo_explains_prerequisite(build_script: Path) -> None:
    run = subprocess.run(
        [sys.executable, str(build_script)], env={"PATH": ""}, check=False, capture_output=True, text=True
    )
    assert run.returncode != 0
    assert "cargo not found" in run.stderr
    assert not (build_script.parents[1] / "packages" / "sandbox" / "bin").exists()


@pytest.mark.parametrize("exit_code", [0, 13])
def test_installs_successful_build_only(build_script: Path, tmp_path: Path, exit_code: int) -> None:
    cargo = tmp_path / "cargo"
    cargo.write_text(
        f"#!{sys.executable}\n"
        "import sys\nfrom pathlib import Path\n"
        "assert sys.argv[1:4] == ['build', '--release', '--manifest-path']\n"
        "manifest = Path(sys.argv[4])\nassert manifest.name == 'Cargo.toml'\n"
        "binary = manifest.parent / 'target' / 'release' / 'totvibe-sandbox'\n"
        "binary.parent.mkdir(parents=True)\nbinary.write_bytes(b'compiled helper')\n"
        f"sys.exit({exit_code})\n"
    )
    cargo.chmod(0o700)
    run = subprocess.run(
        [sys.executable, str(build_script)], env={"PATH": str(tmp_path)}, check=False, capture_output=True
    )
    installed = tmp_path / "packages" / "sandbox" / "bin" / "totvibe-sandbox"
    if exit_code:
        assert run.returncode != 0
        assert not installed.exists()
    else:
        assert run.returncode == 0, run.stderr
        assert installed.read_bytes() == b"compiled helper"
