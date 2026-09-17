# Fehlerdiagnose

## `ABLETON OFFLINE`

1. Ableton Live und das richtige Set öffnen.
2. In Live prüfen, dass AbletonOSC als Control Surface gewählt ist.
3. In Companion die Verbindung `ableton` kontrollieren.
4. Prüfen, ob UDP 11000 und 11001 belegt sind:

   ```bash
   lsof -nP -iUDP:11000 -iUDP:11001
   ```

## `CONFIG ERROR`

Die Spur `INFINITY` muss genau einmal vorkommen und am nullbasierten
AbletonOSC-Trackindex 12 liegen, also als 13. sichtbare Spur.

In **Variables → Custom Variables** kontrollieren:

- `infinity_index = 12`
- `infinity_count = 1`
- `infinity_ok = true`
- `scene_names_raw` ist gefüllt
- `infinity_clip_names_raw` ist gefüllt

In **Variables → Expression Variables** muss `last_setlist_scene` einen Wert
größer oder gleich 1 zeigen.

## NEXT endet zu früh

- Zwischen den Songs darf kein leerer Scene-Name liegen.
- Eine Scene namens `SONG` ohne INFINITY-Clip und ohne eigene Taktart ist eine
  Endmarke.
- Strukturänderungen werden spätestens nach etwa zehn Sekunden übernommen.

## Songtitel oder Tonart stimmen nicht

- Titel kommt direkt vom Scene-Namen.
- Tonart kommt direkt vom korrespondierenden Clipnamen auf `INFINITY`.
- Scene und INFINITY-Clip müssen denselben Slotindex besitzen.

## Neo fehlt unter Surfaces

1. Elgato Stream Deck App vollständig schließen.
2. Neo direkt per USB anschließen.
3. In Companion **Surfaces → Rescan USB** ausführen.
4. Elgato-Integration aktivieren und Seite `WORSHIP LIVE` zuweisen.

## STOP/PANIC testen

STOP und PANIC senden nacheinander:

```text
/live/song/stop_all_clips
/live/song/stop_playing
```

Für Tests zuerst die Audioausgabe sicher stummschalten. Das öffentliche Profil
enthält keine automatischen PLAY-Tests.

