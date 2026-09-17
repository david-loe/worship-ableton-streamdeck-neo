#!/usr/bin/env python3
"""Fail when public assets contain local identities, secrets, or bundled audio."""

from __future__ import annotations

import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "companion" / "Worship-Live.companionconfig"
ABLETON_PATH = ROOT / "ableton" / "Worship-Controller-Template.als"
MEDIA_EXTENSIONS = {".wav", ".wave", ".aif", ".aiff", ".mp3", ".flac", ".m4a", ".ogg"}
FORBIDDEN_TEXT = (
    "/Users/",
    "userfolder:",
    "Master_Echo Project",
)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def validate_repository_files() -> None:
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS:
            fail(f"Audio file must not be committed: {path.relative_to(ROOT)}")


def validate_companion() -> None:
    raw = CONFIG_PATH.read_text(encoding="utf-8")
    config = json.loads(raw)

    for value in FORBIDDEN_TEXT:
        if value in raw:
            fail(f"Companion export contains forbidden text: {value}")

    for field in ("surfaces", "surfacesRemote", "surfaceInstances"):
        if config.get(field):
            fail(f"Companion export contains local hardware data in {field}")

    for instance in config.get("instances", {}).values():
        label = instance.get("label", "unknown")
        if instance.get("secrets"):
            fail(f"Companion connection {label!r} contains secrets")
        host = str(instance.get("config", {}).get("host", ""))
        if host and host not in {"127.0.0.1", "localhost"}:
            fail(f"Companion connection {label!r} contains non-local host {host!r}")


def validate_ableton() -> None:
    with gzip.open(ABLETON_PATH, "rb") as handle:
        xml = handle.read()
    ET.fromstring(xml)
    text = xml.decode("utf-8")

    for value in FORBIDDEN_TEXT:
        if value in text:
            fail(f"Ableton template contains forbidden text: {value}")

    media_values = re.findall(
        r'Value="([^\"]+\.(?:wav|wave|aif|aiff|mp3|flac|m4a|ogg))"',
        text,
        flags=re.IGNORECASE,
    )
    unexpected = sorted({value for value in media_values if value != "MEDIA_NOT_INCLUDED.wav"})
    if unexpected:
        fail(f"Ableton template contains media references: {unexpected[:5]}")


def main() -> None:
    validate_repository_files()
    validate_companion()
    validate_ableton()
    print("Public asset validation passed")


if __name__ == "__main__":
    main()
