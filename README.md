# Worship Ableton Controller for Stream Deck Neo

> A reusable live-performance controller built with Ableton Live, AbletonOSC,
> Bitfocus Companion 5 and the Elgato Stream Deck Neo. No audio files are
> included.

Dieses Repository enthält eine vollständige, portable Ausgangskonfiguration
für eine Worship-Setlist in Ableton Live. Die vier Hauptaktionen sind
`PREV`, `PLAY`, `STOP` und `NEXT`. Der 248×58-Pixel-Streifen des Stream Deck
Neo zeigt den laufenden Song und – falls abweichend – die bereits vorgewählte
nächste Scene.

![Status](https://img.shields.io/badge/Companion-5.0.3-blue)
![Ableton](https://img.shields.io/badge/Ableton%20Live-12.x-black)
![License](https://img.shields.io/badge/Code%20%26%20Config-MIT-green)

## Was enthalten ist

- `companion/Worship-Live.companionconfig` – portabler Companion-Voll-Export
  ohne Geräte-ID oder lokale Sicherungen.
- `ableton/Worship-Controller-Template.als` – bereinigte Referenzstruktur ohne
  Audio-Dateien und ohne persönliche Dateipfade.
- `tools/build_companion_config.mjs` – reproduzierbarer Generator für die
  Companion-Seite, Trigger und Variablen.
- `tools/make_public_assets.py` – entfernt lokale Hardware- und Dateipfade aus
  einem Export beziehungsweise einer `.als`-Kopie.
- `tools/validate_public_assets.py` – prüft vor der Veröffentlichung auf
  Audiodateien, lokale Pfade, Hardware-IDs und Secrets.
- `docs/ARCHITECTURE.md` – Zustandsmodell und Setlist-Erkennung.
- `docs/TROUBLESHOOTING.md` – Diagnose bei Verbindungs- oder Anzeigeproblemen.

Nicht enthalten sind Samples, Multitracks, Guides, Click-Audio, Plugin-Binaries
oder eine Companion-Datenbanksicherung.

Die GitHub-Action führt die Datenschutz- und Strukturprüfung bei jedem Push
und Pull Request erneut aus.

## Architektur

```text
Stream Deck Neo
      ↓
Bitfocus Companion 5
      ↓ UDP 11000
AbletonOSC Remote Script
      ↓
Ableton Live Session View

AbletonOSC → UDP 11001 → Companion (Status und Metadaten)
```

Es läuft keine zusätzliche Bridge im Hintergrund.

## Voraussetzungen

- macOS
- Ableton Live 12.x
- Bitfocus Companion 5.x
- Elgato Stream Deck Neo
- [AbletonOSC](https://github.com/ideoforms/AbletonOSC)

Die Referenz wurde mit Ableton Live 12.4.3, Companion 5.0.3 und AbletonOSC
Commit `0ca68214bd62c9b5cb641ca34006cfd70ba94430` erstellt.

## Installation

### 1. AbletonOSC installieren

AbletonOSC in den Ableton-Remote-Script-Ordner kopieren:

```text
~/Music/Ableton/User Library/Remote Scripts/AbletonOSC
```

Live neu starten und unter **Settings → Link, Tempo & MIDI** `AbletonOSC` als
Control Surface auswählen. MIDI Input und Output dürfen `None` bleiben.

### 2. Ableton-Set vorbereiten

Entweder das mitgelieferte Template als Ausgangspunkt verwenden oder ein
eigenes Session-View-Set nach [dieser Struktur](docs/ARCHITECTURE.md) aufbauen.

Wichtig:

- Scene 0 ist eine Überschrift und gehört nicht zur Setlist.
- Die Songs beginnen lückenlos bei Scene 1.
- Die Spur `INFINITY` muss genau einmal vorhanden und die 13. sichtbare Spur
  sein (AbletonOSC-Index 12).
- Der Clipname auf `INFINITY` enthält die Tonart, zum Beispiel `B`, `Gb` oder
  `Am`.
- Das Setlist-Ende ist die erste leere Scene oder eine Scene namens `SONG`,
  die weder einen INFINITY-Clip noch eine eigene Taktart besitzt.

### 3. Companion-Konfiguration importieren

Für PAD/CLICK ist mit dem Ableton-Modul **2.0.0** zuerst eine kleine
Status-Erweiterung notwendig. Sie liefert exakte Lautstärken und trackweise
Clip-/Mute-Zustände; es läuft weiterhin keine separate Bridge.

```bash
python3 tools/enable_raw_state.py "$HOME/Library/Application Support/companion/modules/ableton-osc-2.0.0/main.js"
```

Danach die Verbindung `ableton` in Companion neu starten. Das Skript behält
`main.js.before-worship-raw-state` als Sicherung. Nach Modul-Updates muss die
Kompatibilität erneut geprüft werden; andere Versionen sind nicht getestet.
Details: [PAD/CLICK und Sicherheit](docs/PAD-CLICK.md).

In Companion **Import / Export** öffnen und
`companion/Worship-Live.companionconfig` importieren.

Die öffentliche Datei enthält bewusst keine Stream-Deck-Seriennummer. Danach:

1. Unter **Surfaces** das lokale Stream Deck Neo auswählen.
2. Seite `1 – WORSHIP LIVE` als Startseite zuweisen.
3. Prüfen, dass die Elgato-Stream-Deck-Integration aktiv ist.

Die enthaltenen Verbindungen sind:

| Label | Modul | Ziel | Empfang |
|---|---|---|---|
| `ableton` | Ableton Live (OSC) | `127.0.0.1:11000` | UDP `11001` |
| `osc-send` | Generic OSC | `127.0.0.1:11000` | aus |

### 4. Sicher testen

Zuerst PA, Interface und Monitore stummschalten oder trennen. Danach:

1. PREV/NEXT drücken: Nur die Auswahl darf wechseln.
2. PLAY kurz testen.
3. STOP auch während eines PAD-/CLICK-Songwechsels prüfen.
4. Einen anderen Song vorwählen: PLAY muss langsam grün/amber blinken.

## Bedienung

| Taste | Funktion |
|---|---|
| `◀ PREV` | Vorherigen Song auswählen, ohne ihn zu starten |
| `▶ PLAY` | Ausgewählte Scene starten |
| `■ STOP` | Alle Clips und den Transport stoppen |
| `▶▶ NEXT` | Nächsten Song auswählen, ohne ihn zu starten |
| `PAD` | Pad der Auswahl starten, ergänzen oder ausschalten |
| `CLICK` | Click der Auswahl starten, ergänzen oder ausschalten |

Oben sind die äußeren Tasten leer, PAD und CLICK sitzen mittig. Unten liegen
PREV, PLAY, STOP und NEXT. Die äußeren unteren
Tasten bleiben Page Up/Page Down.

Während ein Song läuft, bleibt dessen Titel groß auf dem LCD. Wird mit
PREV/NEXT ein anderer Song vorgewählt, zeigt die Statuszeile
`AUSWAHL: <Titel>` und PLAY blinkt langsam. Erst ein Druck auf PLAY startet die
neue Scene vollständig. PAD oder CLICK wechseln dagegen mit einem einsekündigen
Fade ausschließlich zur jeweiligen Komponente des vorgewählten Songs.
Bei unveränderter Auswahl schalten sie nur ihre Komponente um. PLAY startet
anschließend den vollständigen Song von Anfang an.

## Dynamische Setlist

Die Songanzahl ist nicht fest im Companion-Profil gespeichert. Companion liest
regelmäßig alle Scene-Namen und die Clipnamen der INFINITY-Spur aus Live. Die
aktuelle Implementierung scannt maximal 72 Scene-Plätze und stoppt an der
ersten definierten Endmarke. Weitere Songs vor dieser Marke werden automatisch
übernommen.

## Wichtiger Hinweis zum Ableton-Template

Das Template enthält die ursprüngliche Track-, Routing-, Device- und
Scene-Struktur als technische Referenz. Alle Audio-Dateien fehlen absichtlich;
lokale Medienpfade wurden entfernt. Ableton kann deshalb beim Öffnen fehlende
Medien melden. Drittanbieter-Plugins sind nicht enthalten und müssen separat
lizenziert/installiert werden. Für den Controller sind nur Scene-Namen, die
INFINITY-Spur und ihre Clipnamen erforderlich. Für die neuen PAD-/CLICK-Aktionen
ist zusätzlich die genaue [Trackstruktur](docs/PAD-CLICK.md) erforderlich.
Für hörbare Pads müssen eigene Sounds beziehungsweise verfügbare Instrumente
eingesetzt werden; das Template liefert keine Sounds mit.

## Sicherheit

- PREV und NEXT senden ausschließlich eine Scene-Auswahl.
- PLAY ist außerhalb der erkannten Setlist sowie bei ungültiger INFINITY-Spur
  blockiert.
- STOP bricht ausstehende Startsequenzen ab, sendet `stop_all_clips` und
  `stop_playing` und stellt gesicherte Fade-Lautstärken wieder her.
- Der Blink-Trigger ist rein visuell und sendet keine Ableton-Befehle.
- Niemals eine neue Version erstmals an einer offenen PA testen.

## Lizenz

Code, Companion-Konfiguration und Dokumentation stehen unter der MIT License.
Das Ableton-Template enthält keine Sounds; Rechte an Ableton Live und
Drittanbieter-Plugins verbleiben bei deren jeweiligen Herstellern.
