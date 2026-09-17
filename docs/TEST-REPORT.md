# Testprotokoll – 17. September 2026

Referenz: Live 12.4.3, Companion 5.0.3, Ableton-OSC-Modul 2.0.0 mit
Status-Erweiterung, Generic OSC 2.7.0, Original-Session-Set.
Audioausgabe: interne Mac-Lautsprecher, während aller Playback-Tests stumm.
Button-Aktionen wurden über Companions HTTP-API ausgelöst; Live-Zustände
über die tatsächlich empfangenen OSC-Antworten geprüft.

Bestanden:

- Gestoppt → PAD-only; CLICK ergänzen; PAD ausschalten.
- Gestoppt → CLICK-only; letzte aktive Komponente ausschalten stoppt Transport.
- Click → Vorwahl → PAD-only des neuen Songs.
- Pad → Vorwahl → CLICK-only des neuen Songs.
- PLAY startet den Vollsong; PLAY nach anderer Vorwahl startet exakt diese Scene.
- Im Vollsong PAD beziehungsweise CLICK ausschalten, andere Komponente bleibt aktiv.
- STOP während Wechsel nach 50 ms, 350 ms, 800 ms und 1300 ms:
  kein nachträglicher Start, Transport gestoppt, Übergang freigegeben.
- Fade-Pegel nach Wechsel und STOP wiederhergestellt (Float-Toleranz 1e-7).
- Laufender Slot und Vorwahl werden getrennt erkannt; Click-only wird erkannt.
- UDP 11000 wird von Live, UDP 11001 vom Companion-Modul gebunden.
- Aktiver Export: obere mittlere Tasten PAD/CLICK; Titel 48, Untertitel 36.
- Öffentliche Dateien auf Medien, lokale Pfade, Geräte-IDs und Secrets geprüft.
- Live beendet: ABLETON OFFLINE, Startfreigabe false.
- Companion-Prozess neu gestartet: Konfiguration mit 61 Triggern und zentrierten
  PAD-/CLICK-Tasten erhalten; ohne Live bleiben Starts gesperrt.

Grenzen dieser Prüfung:

- Keine akustische Beurteilung über PA/Audiointerface; Ausgabe blieb stumm.
- Kein Hardware-Langzeittest und keine Zusicherung für alle Launch-Quantisierungen.
- Fehlende Zielclips und abweichende Trackstrukturen sind per Bedingungen gesperrt,
  wurden aber nicht durch Löschen/Umbenennen im Original-Set provoziert.
- Kein Absturztest während Fade. Wiederherstellung ist implementiert, muss vor
  Bühneneinsatz bei der eigenen Signalführung separat geprüft werden.
- Vollständiger Live-Neustart wurde hier nicht erneut ausgeführt: Live meldete
  ein bereits vorgemerktes Update auf 12.4.6 beim nächsten Start. Nach diesem
  Versionswechsel zuerst einen stummen Funktionstest durchführen.

Das originale Set wurde beim Beenden **nicht gespeichert**.
