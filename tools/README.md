# Werkzeuge

## Öffentliche Dateien prüfen

```bash
python3 tools/validate_public_assets.py
```

Die Prüfung validiert JSON und Ableton-XML und bricht ab, wenn lokale Pfade,
Hardware-Zuordnungen, nicht-lokale OSC-Hosts, Secrets oder Audio-Dateien
gefunden werden. Sie läuft bei jedem Push zusätzlich über GitHub Actions.

## Companion-Konfiguration neu erzeugen

`build_companion_config.mjs` nimmt einen Companion-5-Voll-Export, der bereits
die Verbindungen `ableton` und `osc-send` enthält, und baut daraus die Seite,
Variablen und Trigger neu auf:

```bash
node tools/build_companion_config.mjs input.companionconfig output.companionconfig
```

Der Generator bewahrt eine im Eingabeexport vorhandene Neo-Zuordnung. Vor
einer Veröffentlichung deshalb anschließend immer `make_public_assets.py`
verwenden und die Ausgabe validieren.

## Export und Ableton-Kopie bereinigen

```bash
python3 tools/make_public_assets.py \
  private.companionconfig companion/Worship-Live.companionconfig \
  private.als ableton/Worship-Controller-Template.als
python3 tools/validate_public_assets.py
```

Nur mit Kopien arbeiten. Das Skript überschreibt die angegebenen Zieldateien.
