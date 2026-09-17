# Architektur und Set-Struktur

## Session-View-Konvention

Die Steuerung arbeitet ausschließlich mit Session Scenes.

```text
Scene 0    SETLIST                      (Überschrift)
Scene 1    Erster Song                  INFINITY-Clip: Tonart
Scene 2    Zweiter Song                 INFINITY-Clip: Tonart
…
Scene n    Letzter Song                 INFINITY-Clip: Tonart
Scene n+1  SONG                         kein INFINITY-Clip, keine eigene Taktart
```

Die Spur `INFINITY` wird über ihren Namen gefunden und zusätzlich gegen den
AbletonOSC-Index 12 validiert. Damit wird verhindert, dass PLAY bei einer
unerwarteten Set-Struktur eine falsche Scene startet.

## Automatische Grenzerkennung

Companion ruft alle zehn Sekunden ab:

- `/live/song/get/scenes/name`
- `/live/track/get/clips/name 12`
- `/live/song/get/track_names`

Die Suche beginnt bei Scene 1 und endet am ersten der folgenden Fälle:

1. Scene-Name ist leer.
2. Scene-Name ist exakt `SONG`, der korrespondierende INFINITY-Clip ist leer
   und für die Scene ist keine eigene Taktart aktiviert.
3. Die technische Sicherheitsgrenze von 72 Scene-Plätzen ist erreicht.

## Zustände

- `selected_scene`: in Live vorgewählte Scene.
- `observed_scene`: tatsächlich laufender Slot, über Pad, Click und Backingtracks ermittelt.
- `last_setlist_scene`: dynamisch erkannte letzte Song-Scene.
- `selection_differs`: Song läuft, aber eine andere gültige Scene ist gewählt.
- `is_playing`: Live-Transportstatus.

Wenn `selection_differs` wahr ist, zeigt das LCD weiterhin den laufenden Titel,
die untere Zeile zeigt die Auswahl und PLAY blinkt. Der Blinkzustand verändert
nur die Buttonfarbe.

## Ports

| Richtung | Port |
|---|---:|
| Companion → AbletonOSC | UDP 11000 |
| AbletonOSC → Companion | UDP 11001 |
| Companion interne OSC-Schnittstelle | UDP 12321 |

## Aktualisierungsintervalle

- Jede Sekunde: Verbindung, Auswahl, Transport, laufender Slot sowie Metadaten
  der aktuell angezeigten Scene.
- Alle zehn Sekunden: Trackstruktur, Scene-Liste, INFINITY-Clipnamen und
  Listener.
- Jede Sekunde: rein visuelle Blinkphase.

Ab Version 1.1 werden alle 13 Referenzspuren validiert. Details zu Trackstruktur,
Einzelstarts und Fade-Sicherheit stehen in [PAD-CLICK.md](PAD-CLICK.md).
