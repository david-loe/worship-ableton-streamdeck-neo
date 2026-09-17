#!/usr/bin/env python3
"""Build public, machine-neutral artifacts from the local working files."""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path


MEDIA_SUFFIXES = r"(?:wav|wave|aif|aiff|mp3|flac|m4a|ogg)"


def sanitize_companion(source: Path, destination: Path) -> None:
    config = json.loads(source.read_text(encoding="utf-8"))

    # Hardware identities are local to one computer and must never be published.
    config["surfaces"] = {}
    config["surfaceGroups"] = {}
    config["surfacesRemote"] = {}
    config["surfaceInstances"] = {}
    config["surfaceInstanceCollections"] = []

    # The two required connections contain localhost addresses only. Refuse to
    # publish a future export if somebody adds credentials by mistake.
    for instance in config.get("instances", {}).values():
        if instance.get("secrets"):
            raise RuntimeError(f"Refusing to publish non-empty secrets for {instance.get('label')}")
        host = str(instance.get("config", {}).get("host", ""))
        if host and host not in {"127.0.0.1", "localhost"}:
            raise RuntimeError(f"Refusing to publish non-local host {host!r}")

    destination.write_text(json.dumps(config, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")


def sanitize_ableton(source: Path, destination: Path) -> None:
    with gzip.open(source, "rt", encoding="utf-8") as handle:
        xml = handle.read()

    # Remove absolute user paths and Ableton user-folder URLs.
    xml = re.sub(r'Value="(?:userfolder:)?/Users/[^"<]*"', 'Value=""', xml)
    xml = re.sub(r'Value="userfolder:[^"<]*"', 'Value=""', xml)

    # Keep the set structure but remove identifying media filenames and all
    # media references. The repository intentionally ships no audio.
    xml = re.sub(
        rf'(<(?:Path|RelativePath|FileName|DisplayName) Value=")[^"<]*\.{MEDIA_SUFFIXES}("\s*/>)',
        r'\1MEDIA_NOT_INCLUDED.wav\2',
        xml,
        flags=re.IGNORECASE,
    )
    xml = re.sub(
        rf'(<BrowserContentPath Value=")[^"<]*\.{MEDIA_SUFFIXES}("\s*/>)',
        r'\1\2',
        xml,
        flags=re.IGNORECASE,
    )

    # Remove the local project folder name wherever it survives URL encoding.
    xml = xml.replace("Master_Echo Project", "Worship-Controller-Template")
    xml = xml.replace("Master_Echo%20Project", "Worship-Controller-Template")

    with destination.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
            compressed.write(xml.encode("utf-8"))


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "Usage: make_public_assets.py SOURCE.companionconfig DEST.companionconfig SOURCE.als DEST.als"
        )

    companion_source, companion_destination, als_source, als_destination = map(Path, sys.argv[1:])
    sanitize_companion(companion_source, companion_destination)
    sanitize_ableton(als_source, als_destination)


if __name__ == "__main__":
    main()
