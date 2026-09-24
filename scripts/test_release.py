"""Offline packaging regression tests; real cross-compilation runs in release CI."""

import hashlib
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import release


class ReleaseTests(unittest.TestCase):
    def fake_build(self, command, **kwargs):
        target = Path(command[command.index("-o") + 1])
        env = kwargs["env"]
        self.assertEqual(env["CGO_ENABLED"], "0")
        target.write_bytes(f'{env["GOOS"]}/{env["GOARCH"]}'.encode())

    def test_packages_checksums_formula_and_legacy_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            with patch("release.subprocess.run", side_effect=self.fake_build):
                release.build("v0.1.4", destination)
            manifest = dict(line.split("  ")[::-1] for line in (destination / "checksums.txt").read_text().splitlines())
            self.assertEqual(len(manifest), 10)
            for name, digest in manifest.items():
                self.assertEqual(hashlib.sha256((destination / name).read_bytes()).hexdigest(), digest)
            formula = (destination / "webdrive.rb").read_text()
            self.assertIn('version "0.1.4"', formula)
            self.assertIn('license "MIT"', formula)
            for system in ("darwin", "linux"):
                for arch in ("amd64", "arm64"):
                    name = f"webdrive_{system}_{arch}.tar.gz"
                    self.assertIn(f'/releases/download/v0.1.4/{name}', formula)
                    self.assertIn(f'sha256 "{manifest[name]}"', formula)
                    with tarfile.open(destination / name) as archive:
                        self.assertEqual(archive.getnames(), ["webdrive", "README.md", "LICENSE"])
                        self.assertEqual(archive.getmember("webdrive").mode, 0o755)
                        self.assertEqual(archive.extractfile("webdrive").read(), f"{system}/{arch}".encode())
                    self.assertEqual((destination / f"webdrive-{system}-{arch}").read_bytes(), f"{system}/{arch}".encode())
            with patch("release.subprocess.run", side_effect=self.fake_build):
                release.build("v0.1.4", destination)
            self.assertEqual(manifest, dict(line.split("  ")[::-1] for line in (destination / "checksums.txt").read_text().splitlines()))

    def test_rejects_nonstable_and_unsafe_tags_before_building(self):
        with tempfile.TemporaryDirectory() as directory:
            for tag in ("main", "v1.2", "v01.2.3", "v1.2.3-beta", "../v1.2.3"):
                with self.subTest(tag=tag), patch("release.subprocess.run") as run:
                    with self.assertRaises(ValueError):
                        release.build(tag, Path(directory))
                    run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
