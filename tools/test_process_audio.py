"""Offline tests for CC0 source identification and audio manifest safety."""
from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from process_audio import (
    MANIFEST,
    FREESOUND_SOURCES,
    FreesoundPage,
    freesound_preview,
    sha256,
    validate_manifest,
)


class FakePage:
    def __init__(self, page: bytes):
        self.page = page
        self.url = "https://freesound.org/people/o_ciz/sounds/475483/"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, size: int) -> bytes:
        return self.page


class FreesoundTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = {
            "provider": "freesound",
            "author": "o_ciz",
            "sound_id": 475483,
            "page": "https://freesound.org/people/o_ciz/sounds/475483/",
            "license": "CC0-1.0",
            "preview": "ogg-hq",
            "filename": "475483-hq.ogg",
        }
        self.preview = (
            "https://cdn.freesound.org/previews/475/"
            "475483_10403327-lq.mp3"
        )
        self.html = (
            '<meta property="og:audio" content="' + self.preview + '">'
            '<a href="https://creativecommons.org/publicdomain/zero/1.0/">'
            "Creative Commons 0</a>"
        ).encode()

    def test_verified_cc0_hq_preview(self) -> None:
        with patch("process_audio.urllib.request.urlopen", return_value=FakePage(self.html)):
            result = freesound_preview(self.source)
        self.assertEqual(
            result, self.preview.replace("-lq.mp3", "-hq.ogg")
        )

    def test_rejects_non_cc0_page(self) -> None:
        bad = self.html.replace(b"publicdomain/zero/1.0/", b"licenses/by/4.0/")
        with patch("process_audio.urllib.request.urlopen", return_value=FakePage(bad)):
            with self.assertRaisesRegex(ValueError, "CC0"):
                freesound_preview(self.source)

    def test_rejects_wrong_sound_id_in_preview(self) -> None:
        bad = self.html.replace(b"475483_1040", b"999999_1040")
        with patch("process_audio.urllib.request.urlopen", return_value=FakePage(bad)):
            with self.assertRaisesRegex(ValueError, "Untrusted"):
                freesound_preview(self.source)

    def test_rejects_wrong_page_or_author(self) -> None:
        bad = dict(self.source)
        bad["author"] = "someone_else"
        with self.assertRaisesRegex(ValueError, "author"):
            freesound_preview(bad)

    def test_no_duplicate_track_ids(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        validate_manifest(manifest)
        changed = copy.deepcopy(manifest)
        changed["tracks"].append(changed["tracks"][0])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_manifest(changed)

    def test_no_unlicensed_or_insecure_sources(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        changed = copy.deepcopy(manifest)
        changed["sources"]["axe"]["license"] = "CC-BY-4.0"
        with self.assertRaisesRegex(ValueError, "Non-CC0"):
            validate_manifest(changed)

    def test_sha256(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / "sound"
            file.write_bytes(b"test")
            self.assertEqual(
                sha256(file),
                "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            )


if __name__ == "__main__":
    unittest.main()
