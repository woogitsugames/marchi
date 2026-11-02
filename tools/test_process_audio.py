"""Offline tests for CC0 source identification and audio manifest safety."""
from __future__ import annotations

import copy
from array import array
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.process_audio import (
    MANIFEST,
    FREESOUND_SOURCES,
    budget_and_channels,
    FreesoundPage,
    freesound_preview,
    sha256,
    validate_manifest,
    loudest_window_index,
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
        with patch("tools.process_audio.urllib.request.urlopen", return_value=FakePage(self.html)):
            result = freesound_preview(self.source)
        self.assertEqual(
            result, self.preview.replace("-lq.mp3", "-hq.ogg")
        )

    def test_rejects_non_cc0_page(self) -> None:
        bad = self.html.replace(b"publicdomain/zero/1.0/", b"licenses/by/4.0/")
        with patch("tools.process_audio.urllib.request.urlopen", return_value=FakePage(bad)):
            with self.assertRaisesRegex(ValueError, "CC0"):
                freesound_preview(self.source)

    def test_rejects_wrong_sound_id_in_preview(self) -> None:
        bad = self.html.replace(b"475483_1040", b"999999_1040")
        with patch("tools.process_audio.urllib.request.urlopen", return_value=FakePage(bad)):
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

    def test_loudest_excerpt_skips_silent_lead(self) -> None:
        samples = array("f", [0.0] * 500)
        for i in range(260, 300):
            samples[i] = 0.6
        start = loudest_window_index(samples, 100, step=10, margin=10)
        self.assertGreater(start, 100)
        self.assertLessEqual(start, 260)
        self.assertGreaterEqual(start + 100, 300)

    def test_loudest_excerpt_rejects_silence(self) -> None:
        with self.assertRaisesRegex(ValueError, "silent"):
            loudest_window_index(array("f", [0.0] * 100), 50, step=10)

    def test_new_sound_chains_have_verified_manifest_metadata(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        validate_manifest(manifest)
        expected = {
            "sfx/quarry-chisel", "sfx/quarry-rock",
            "sfx/fisher-net", "sfx/fisher-splash",
            "sfx/charcoal-fire", "sfx/malt-bubbles",
            "sfx/brewery-barrels", "sfx/load-stone",
            "sfx/unload-stone", "sfx/load-fish",
            "sfx/unload-fish", "sfx/load-barrel",
            "sfx/unload-barrel",
        }
        pending = {t["id"] for t in manifest["pending_tracks"]}
        shipped = {t["id"] for t in manifest["tracks"]}
        if pending:
            # Prior to task 50 asset download, none of these IDs may be shipped.
            self.assertEqual(expected, pending)
            self.assertFalse(expected & shipped)
        else:
            # After promotion, the strict audio catalogue verifies all 26 files.
            self.assertTrue(expected <= shipped)
        for key in ("quarry_chisel", "rocks_fall", "fish_netted",
                    "fisher_splash", "malt_bubbles", "barrel"):
            source = manifest["sources"][key]
            self.assertEqual(source["license"], "CC0-1.0")
            self.assertEqual(source["provider"], "freesound")

    def test_runtime_catalogue_rejects_unrendered_tracks(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(ValueError, "Audio catalogue mismatch"):
                budget_and_channels(Path(root), [
                    {"id": "sfx/quarry-chisel", "kind": "sfx", "seconds": 2.4}
                ], ["ui/stall"])

    def test_rejects_path_traversal(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        manifest["tracks"][0]["id"] = "sfx/../unsafe"
        with self.assertRaisesRegex(ValueError, "Invalid audio asset ID"):
            validate_manifest(manifest)


    def test_task_50_promotes_only_the_expected_audio(self) -> None:
        from tools.finalize_audio_50 import EXPECTED, promote
        pending = [{"id": key} for key in sorted(EXPECTED)]
        example = {"tracks": [{"id": "sfx/axe"}], "pending_tracks": pending}
        result = promote(example)
        self.assertEqual(14, len(result["tracks"]))
        self.assertEqual([], result["pending_tracks"])
        self.assertEqual(13, len(example["pending_tracks"]))
        with self.assertRaisesRegex(ValueError, "exactly the 13"):
            promote({"tracks": [], "pending_tracks": pending[:-1]})

    def test_task_50_asset_docs_keep_the_verified_source_audit(self) -> None:
        from tools.finalize_audio_50 import updated_assets
        fixture = (
            "The shipped baseline has 23 runtime IDs (46 OGG/M4A files). Task 46 selected "
            "13 new audio IDs, so the strict checker keeps passing on the shipped 46 files.\n"
            "### Task 46 — New building and logistics sounds (awaiting binaries)\n"
            "**Status (2026-11-02):** Pending. "
            "Do not create source digests from page metadata.\n"
            "**Finish locally:** Run pipeline manually.\n"
            "### Original procedural effects retained\n"
        )
        row = "| quarry_chisel | Artiom | CC0-1.0 | source | 2026-11-02 | hash |"
        updated = updated_assets(fixture, "2026-11-02", [row], 152_000)
        self.assertIn(row, updated)
        self.assertIn("36 sound IDs and 72 OGG/M4A files", updated)
        self.assertNotIn("awaiting binaries", updated)
        self.assertNotIn("**Finish locally:**", updated)

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
