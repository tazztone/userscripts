# Toppreise Suite

Begriffe der Suite zur Verifizierung historischer Tiefstpreise auf Toppreise.ch. Diese Sprache gilt für UI-Texte, Tooltips und README; Code-Bezeichner (`REAL_DEAL_*`, `BESTPREISE_*`, `tp-deal-*`) sind historisch gewachsen und folgen ihr (noch) nicht.

## Language

**Tiefstpreis**:
Der niedrigste belegte historische Preis eines Produkts.
_Avoid_: Real Deal, Bestpreis (als Synonym für den verifizierten Tiefstpreis)

**Toppreis**:
Das aktuell günstigste Angebot einer Produktseite (Toppreise-native Anzeige) — keine historische Aussage und kein Tiefstpreis.

**Händler**:
Der Shop des aktuell günstigsten Angebots eines geprüften Deals (erste Händlerzeile der Karte bzw. der Produktseite).
_Avoid_: Store (in UI-Texten), Verkäufer

**Differenz (ungeprüft)**:
Die vom Badge angezeigte Toppreise-Differenz (z. B. gegenüber UVP). Solange ungeprüft, ist sie kein Tiefstpreis.
_Avoid_: Site-Rabatt, Site-%

**Prüfen**:
Eine Differenz anhand der Preishistorie verifizieren und dadurch in einen Tiefstpreis (oder Aufschlag) auflösen.
_Avoid_: Check Deals, checken

**Schlechter Deal**:
Geprüfter Preis, der kein Tiefstpreis ist (Aufschlag gegenüber dem historischen Tief); Badge markiert ihn, Sortierung legt ihn nach hinten — kein Filtergrund, wird nie entfernt.
_Avoid_: Non-Deal

**Berechnungsparameter**:
Gewichtung, Ø-Zeitraum, Mindest-Datenpunkte, Ausreißer-Filter, Glitch-Band und Glitch-Fenster als Eingaben der Gewichteten Differenz; keine Sortierung, kein Filter.
_Avoid_: Sortier-Slider (für ⚖️/Ø), Filter-Slider

**Gewichtete Differenz**:
Die eine Kennzahl des Tiefstpreise-Feeds: Gewichtungs-Blended Ø-Rabatt und Rekord-Marge im aktuellen Slider-Mix. Sie steht auf dem Badge, treibt Kartenfarbe und Feed-Reihenfolge; Rek/Ø erscheinen nur noch als Split in der Subline. Fällt sie aus (kein Median/ungeprüfte Historie), steht ersatzweise der Vortief-Abstand auf dem Badge.
_Avoid_: Score, Tiefstpreis-Score (in UI-Texten)

**Vortief-Abstand**:
Der gemessene Abstand zum vorherigen Tief; Ersatzkennzahl auf dem Badge, wenn kein Blend existiert. Die Heatmap ist blind: gleiche Badge-% → gleiche Innen-Wasche, egal ob Blend, Vortief-Abstand oder ungeprüfte Site-%.

**Filtern**:
Entfernen von Karten aus der Liste (`display:none`), Abblenden (`tp-dimmed`) oder Hervorheben per Innenrand (`tp-highlighted`) — je Ursache per Verbergen/Dimmen/Hervorheben im Filter-Popover wählbar.
_Avoid_: Dimmen (als Filter), Anzeige (für Entfernen)

**Filtergrund**:
Eine einzelne Ursache (Negativ, Min-Angebote, Händler, Ungeprüfte, Fallback-Tief) — je mit Normal/Dimmen/Verbergen/Hervorheben je Ursache.
_Avoid_: Ursache (in UI-Texten)

**Gefilterte**:
Durch einen Filtergrund verborgene Karten (`tp-filtered`). Gedimmte (`tp-dimmed`) und hervorgehobene (`tp-highlighted`) Karten bleiben sichtbar.
_Avoid_: Gedimmte (für Entfernte)

 **Ansicht**:
 Rein visuelle Darstellung ohne Entfernen: Heatmap-Farbe, Streifen, Kanten-Glow, Badge-Texte sowie per-cause Dimmen (`tp-dimmed`, Deckkraft per Dimmer-Einstellung) und Hervorheben (`tp-highlighted`). Ungeprüfte Karten lesen sich an voller Deckkraft mit grau gestreiftem Badge, solange ihr Filtergrund nicht auf Dimmen steht.
 _Avoid_: Anzeige (für Entfernen), Modus (für Darstellung — Neue Tiefstpreise bleibt Sortierung)

**Neue Tiefstpreise**:
Reine Feed-Sortierung nach Gewichteter Differenz; filtert nichts. Dieselbe Sortierung steht auf /produktsuche/* als „Tiefstpreis-Sortierung" bereit.
_Avoid_: Tiefstpreise-Modus (als Filter), Nur Tiefstpreise

**Fallback-Tief**:
Verifizierter Tiefstpreis ohne qualifizierten Ø-Vergleich; heizt wie jeder andere Deal (blinde Heatmap), entfernt, gedimmt oder hervorgehoben im Tiefstpreise-Feed wenn „Fallback-Tiefs" an ist (Modus je Ursache). Normal = gezeigt, Dimmen/Verbergen/Hervorheben = Filtergrund aktiv.
_Avoid_: Vortief (als UI-Text), dünne Historie

**Ungeprüfte**:
Filtergrund: verbirgt, dimmt oder hebt ungeprüfte Karten hervor wenn aktiv (je Modus) — deterministisch, unabhängig vom Scan-Stand (kein Sonderverhalten auf checklosen Seiten); Ansicht streift sie sonst nur.
 _Avoid_: Nur geprüfte (als Filterlabel), separater Modus, Sonderverhalten
