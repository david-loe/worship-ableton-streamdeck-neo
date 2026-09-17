# PAD / CLICK ab Version 1.1

Oben: **leer · PAD · CLICK · leer**. Unten: **PREV · PLAY · STOP · NEXT**.
Die Untertitel sind gelb, Schriftgröße 36 mit automatischer Verkleinerung
bei längeren Statusmeldungen; die Haupttitel verwenden Größe 48.

| Zustand | PAD / CLICK |
|---|---|
| Gestoppt | Nur entsprechende Komponente der Auswahl starten |
| Gleicher Song, Komponente aus | Komponente ergänzen |
| Gleicher Song, Komponente an | Komponente ausschalten |
| Anderer Song vorgewählt | Alten Song ausblenden; nur neue Komponente starten |

Untertitel: START, STOP, NEUER SONG, WECHSEL … oder NICHT BEREIT.
PLAY startet die gesamte vorgewählte Scene neu und aktiviert Pad sowie Click.
PREV/NEXT verändern nie die Wiedergabe. PANIC ist entfernt, weil STOP dieselbe
vollständige Stoppfunktion übernimmt.

## Referenzstruktur und Grenzen

Die aktuelle Fade-Konfiguration verlangt exakt diese 13 Spuren in dieser
Reihenfolge (nullbasierte Indizes):

```text
0 1-MIDI                 7 Bass
1 GLITZER                8 Vocals
2 Midi-Perc              9 GUIDE
3 Track-Bus             10 CLICK AUDIO
4 Track                 11 CLICK
5 Perc (nicht pitchen)  12 INFINITY
6 EGs
```

Dies ist eine Sicherheitsprüfung, keine Beschränkung auf vier Songs.
Die Setlist wird weiterhin dynamisch bis zur Endmarke erkannt (maximal 72
Scene-Plätze). Andere Tracknamen, Routingstrukturen oder Reihenfolgen erfordern
eine bewusste Anpassung von `names` und `leaves` in `tools/pad-click.mjs` und
erneute Tests. Gruppen und Unterspuren dürfen nicht doppelt gefadet werden.

Im Begleitbetrieb wird der loopende MIDI-Click auf Spur 11 gestartet.
CLICK schaltet bei einem Vollsong beide Click-Spuren per Mute, damit sie
synchron bleiben. PAD schaltet INFINITY. Backingtracks bleiben dabei unberührt.
Leere Zielclips oder ungültige Metadaten verhindern den Wechsel vor dem Fade.
Scene-Tempo muss positiv sein. Ist die Scene-Taktart deaktiviert, wird für
Einzelstarts die Taktart ihres MIDI-Click-Clips verwendet.

## Übergang und STOP

Vor dem Wechsel werden die bestätigten Lautstärken der Signalquellen
0, 1, 2, 4, 5, 6, 7, 8 und 12 gesichert. GUIDE und beide Click-Ausgaben werden
sofort gestoppt. Zehn Schritte über eine Sekunde senken die Quellen ab;
Track-Bus 3 wird nicht zusätzlich gefadet. Danach werden alte Clips gestoppt,
die Lautstärken exakt wiederhergestellt und nur der Zielclip gestartet.
Effekt-Nachhall kann darüber hinaus ausklingen.

Währenddessen sind neue Starts gesperrt. STOP bleibt immer aktiv, bricht die
drei Starttasten-Sequenzen ab, stoppt Clips und Transport und stellt die
gesicherten Pegel wieder her. Persistierte Pegelsicherungen ermöglichen eine
Wiederherstellung nach unterbrochenem Fade. Nach einem Absturz zunächst dasselbe
Set laden und Pegel prüfen, bevor ein anderes Set geöffnet wird.

Die Regelung nutzt UDP und Companion-Aktionsfolgen, keine harte Echtzeit- oder
Transaktionsgarantie. Nicht während eines Fades Routing oder Fader manuell
ändern. Neustarts oder Netzwerkverluste während eines Fades sind vor Live-Einsatz
gesondert zu testen. Neue Versionen zuerst bei stummer Audioausgabe prüfen.

## Zustandsquelle und Modul-Erweiterung

`playing_slot_index`, Mute und exakte Volume-Werte aller 13 Tracks werden
abgefragt und über Listener verfolgt. Damit funktioniert die Anzeige auch
bei Click-only oder ausgeschaltetem Pad. Unterschiedliche gleichzeitig laufende
Scene-Indizes zeigen MEHRERE SONGS und sperren neue Starts; STOP bleibt aktiv.

Das offizielle Ableton-OSC-Modul 2.0.0 gibt einige Antworten nicht als Raw-
Variablen aus und rundet native Volume-Variablen. `enable_raw_state.py` ergänzt
deshalb `worship_volume_N`, `worship_mute_N`, `worship_playing_slot_index_N`
sowie Raw-Antworten im installierten Modul. Die Originaldatei bleibt als
`.before-worship-raw-state` gesichert. Zum Rückbau bei gestopptem Live die
gesicherte Datei wieder als `main.js` einsetzen und die Verbindung neu starten.
Ohne Erweiterung bleibt die neue Steuerung nicht bereit.

Generator aufrufen (Node.js 22 oder neuer):

```bash
node tools/build_companion_config.mjs companion/Worship-Live.companionconfig /tmp/Worship-Live.json
```

Den erzeugten Export in Companion importieren; lokale Verbindungen und Surfaces
bei einem Update beibehalten. Der Generator ersetzt Seite 1, Trigger sowie
Custom-/Expression-Variablen: vorher immer einen vollständigen Export sichern.

## Geänderte Komponenten

- `tools/build_companion_config.mjs`: bindet PAD-/CLICK-Generator ein.
- `tools/pad-click.mjs`: native Aktionen, Statusabfragen, Fade und Layout.
- `tools/enable_raw_state.py`: reproduzierbare, gesicherte Modul-Erweiterung.
- `companion/Worship-Live.companionconfig`: bereinigter öffentlicher Export.
- Dokumentation und CI-Prüfung.

Originale `.als`-Dateien, Audio-Routings, Geräte und Medien werden nicht
gespeichert oder verändert. Laufzeit-Mutes und Tempoänderungen werden nicht
ins Set gespeichert. Die öffentliche Template-Datei bleibt unverändert.
