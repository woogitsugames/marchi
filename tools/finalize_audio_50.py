#!/usr/bin/env python3
"""Finish task 50 in a private staging directory before publishing any assets.

Requires internet access to Freesound and FFmpeg on the operator's machine.
Run: python3 tools/finalize_audio_50.py
Never generates audio during CI and never edits src/audio/sounds.ts.
"""
from __future__ import annotations

from datetime import datetime, timezone
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

BASE = Path(__file__).resolve().parents[1]
EXPECTED = {
    "sfx/quarry-chisel", "sfx/quarry-rock", "sfx/fisher-net",
    "sfx/fisher-splash", "sfx/charcoal-fire", "sfx/malt-bubbles",
    "sfx/brewery-barrels", "sfx/load-stone", "sfx/unload-stone",
    "sfx/load-fish", "sfx/unload-fish", "sfx/load-barrel",
    "sfx/unload-barrel",
}
NEW_BYTES_LIMIT = 400_000


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def promote(manifest: dict) -> dict:
    pending = manifest.get("pending_tracks", [])
    pending_ids = [track["id"] for track in pending]
    if len(pending_ids) != 13 or set(pending_ids) != EXPECTED:
        raise ValueError("Task 50 needs exactly the 13 expected pending tracks")
    result = copy.deepcopy(manifest)
    result["tracks"].extend(result["pending_tracks"])
    result["pending_tracks"] = []
    result["pending_tracks_note"] = (
        "Task 50: all 13 pending recordings rendered and verified; "
        "src/audio/sounds.ts remains intentionally unchanged."
    )
    return result


def updated_assets(text: str, day: str, rows: list[str], new_bytes: int) -> str:
    before = "### Task 46 — New building and logistics sounds (awaiting binaries)"
    after = "### Task 46 — New building and logistics sounds (task 50 delivered)"
    if before not in text:
        raise ValueError("docs/ASSETS.md: expected task 46 section missing")
    text = text.replace(before, after, 1)
    status = (
        "**Status (" + day + "):** Task 50 delivered 13 CC0-derived sound "
        "effects as 26 OGG/M4A files. Both codec versions total "
        + str(new_bytes) + " bytes (limit: " + str(NEW_BYTES_LIMIT)
        + " bytes). Original Freesound recordings were accessed through "
        "official public HQ OGG previews; filenames, hashes and source "
        "metadata are recorded in docs/audio-provenance.json. "
        "src/audio/sounds.ts was intentionally not modified."
    )
    text, n = re.subn(
        r"(?s)\*\*Status \(2026-11-02\):\*\*.*?"
        r"Do not create source digests from page metadata\.",
        status, text, count=1,
    )
    if n != 1:
        raise ValueError("docs/ASSETS.md: expected pending status missing")
    audit = (
        "\n#### Task 50 — Source download audit (" + day + ")\n\n"
        "| Runtime ID | Author | Licence | Page | Download date (UTC) | Source SHA-256 |\n"
        "|---|---|---|---|---|---|\n"
        + "\n".join(rows) + "\n\n"
    )
    text, n = re.subn(
        r"(?s)\*\*Finish locally:\*\*.*?(?=\n### Original procedural effects retained)",
        "**Reproduce task 50:** In a clean checkout run "
        "python3 tools/finalize_audio_50.py, then "
        "python3 tools/process_audio.py --check. "
        "Listen to all 13 tracks before merging the PR.\n\n",
        text, count=1,
    )
    if n != 1:
        raise ValueError("docs/ASSETS.md: outdated completion instructions missing")
    # The original paragraph is line-wrapped; replace it by a bounded pattern.
    text, n = re.subn(
        r"(?s)The shipped baseline has 23 runtime IDs \(46 OGG/M4A files\).*?"
        r"the shipped 46 files\.",
        "The shipped catalogue contains **36 sound IDs and 72 OGG/M4A files**. "
        "The 13 additional recordings were delivered in task 50. "
        "The strict catalogue checker includes all 72 files.",
        text, count=1,
    )
    if n != 1:
        raise ValueError("docs/ASSETS.md: outdated baseline statement missing")
    marker = "### Original procedural effects retained"
    if marker not in text:
        raise ValueError("docs/ASSETS.md: next section missing")
    return text.replace(marker, audit + marker, 1)


def main() -> None:
    manifest_path = BASE / "tools/audio_sources.json"
    assets_path = BASE / "docs/ASSETS.md"
    provenance_path = BASE / "docs/audio-provenance.json"
    process_path = BASE / "tools/process_audio.py"
    original = json.loads(manifest_path.read_text(encoding="utf-8"))
    promoted = promote(original)
    used_keys = sorted({track["source"] for track in original["pending_tracks"]})
    date = datetime.now(timezone.utc).date().isoformat()
    existing_sources = {
        key: (BASE / "tools/audio-src" / original["sources"][key]["filename"]).is_file()
        for key in used_keys
    }
    for track in original["pending_tracks"]:
        for extension in ("ogg", "m4a"):
            if (BASE / "public/assets/audio" / (track["id"] + "." + extension)).exists():
                raise FileExistsError("Refusing to overwrite a pending output: " + track["id"])

    # No files in the user's worktree are touched until every staged check passes.
    with tempfile.TemporaryDirectory(prefix="marchia-task-50-") as scratch:
        stage = Path(scratch)
        for relative in ("tools/process_audio.py", "docs/audio-provenance.json"):
            destination = stage / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(BASE / relative, destination)
        shutil.copytree(BASE / "public/assets/audio", stage / "public/assets/audio")
        source_dir = BASE / "tools/audio-src"
        if source_dir.is_dir():
            shutil.copytree(source_dir, stage / "tools/audio-src")
        staged_manifest = stage / "tools/audio_sources.json"
        staged_manifest.write_text(
            json.dumps(promoted, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        command = [sys.executable, str(stage / "tools/process_audio.py"), "--fetch"]
        for track in original["pending_tracks"]:
            command.extend(("--track-id", track["id"]))
        print("Rendering 13 CC0 sounds in isolated workspace...", flush=True)
        subprocess.run(command, check=True)
        subprocess.run(
            [sys.executable, str(stage / "tools/process_audio.py"), "--check"],
            check=True,
        )
        outputs = [
            stage / "public/assets/audio" / (track["id"] + "." + extension)
            for track in original["pending_tracks"]
            for extension in ("ogg", "m4a")
        ]
        if not all(path.is_file() for path in outputs):
            raise RuntimeError("The audio pipeline did not deliver all 26 outputs")
        new_bytes = sum(path.stat().st_size for path in outputs)
        if new_bytes > NEW_BYTES_LIMIT:
            raise ValueError(
                "Task 50 budget exceeded: " + str(new_bytes)
                + " > " + str(NEW_BYTES_LIMIT) + " bytes"
            )
        staged_provenance = stage / "docs/audio-provenance.json"
        provenance = json.loads(staged_provenance.read_text(encoding="utf-8"))
        previous_provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        rows = []
        for key in used_keys:
            source = original["sources"][key]
            source_file = stage / "tools/audio-src" / source["filename"]
            if not source_file.is_file():
                raise FileNotFoundError(source_file)
            record = provenance["sources"][key]
            if sha256(source_file) != record["sha256"]:
                raise ValueError("Preview digest mismatch: " + key)
            record["license"] = source["license"]
            previous_date = previous_provenance.get("sources", {}).get(key, {}).get(
                "downloaded_on_utc"
            )
            downloaded = previous_date if existing_sources[key] else date
            record["downloaded_on_utc"] = downloaded
        for track in original["pending_tracks"]:
            source = original["sources"][track["source"]]
            record = provenance["sources"][track["source"]]
            date_label = record["downloaded_on_utc"] or "unknown (pre-existing file)"
            rows.append(
                "| " + track["id"] + " | " + source["author"] + " | "
                + source["license"] + " | " + source["page"] + " | "
                + date_label + " | " + record["sha256"] + " |"
            )
        staged_provenance.write_text(
            json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        docs = updated_assets(
            assets_path.read_text(encoding="utf-8"), date, rows, new_bytes
        )
        # Re-check after enhancing the provenance document.
        subprocess.run(
            [sys.executable, str(stage / "tools/process_audio.py"), "--check"],
            check=True,
        )

        # Record original text and track newly introduced paths for rollback.
        text_paths = (manifest_path, provenance_path, assets_path)
        backup = {path: path.read_bytes() for path in text_paths}
        created: list[Path] = []
        try:
            for path in outputs + [
                stage / "tools/audio-src" / original["sources"][key]["filename"]
                for key in used_keys
            ]:
                relative = path.relative_to(stage)
                dest = BASE / relative
                dest.parent.mkdir(parents=True, exist_ok=True)
                if dest.exists():
                    if sha256(dest) != sha256(path):
                        raise RuntimeError("Refusing to replace a pre-existing file: " + str(dest))
                    continue
                shutil.copy2(path, dest)
                created.append(dest)
            manifest_path.write_text(
                staged_manifest.read_text(encoding="utf-8"), encoding="utf-8"
            )
            provenance_path.write_text(
                staged_provenance.read_text(encoding="utf-8"), encoding="utf-8"
            )
            assets_path.write_text(docs, encoding="utf-8")
            subprocess.run(
                [sys.executable, str(process_path), "--check"], check=True
            )
        except Exception:
            for path, contents in backup.items():
                path.write_bytes(contents)
            for path in created:
                path.unlink(missing_ok=True)
            raise
    print("PASS: 13 new IDs, 26 audio files, " + str(new_bytes) + " bytes")
    print("Source audit: docs/ASSETS.md; hashes: docs/audio-provenance.json")
    print("src/audio/sounds.ts was not changed.")


if __name__ == "__main__":
    main()
