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
Geprüfter Preis, der kein Tiefstpreis ist (Aufschlag gegenüber dem historischen Tief); im Tiefstpreise-Modus ausgeblendet.
_Avoid_: Non-Deal

**Gewichtete Differenz**:
Die eine Kennzahl des Tiefstpreise-Feeds: Gewichtungs-Blended Ø-Rabatt und Rekord-Marge im aktuellen Slider-Mix. Sie steht auf dem Badge, treibt Kartenfarbe und Feed-Reihenfolge; Rek/Ø erscheinen nur noch als Split in der Subline. Fällt sie aus (kein Median/ungeprüfte Historie), steht ersatzweise der Vortief-Abstand auf dem Badge.
_Avoid_: Score, Tiefstpreis-Score (in UI-Texten)

**Vortief-Abstand**:
Der gemessene Abstand zum vorherigen Tief; Ersatzkennzahl auf dem Badge, wenn kein Blend existiert. Im Tiefstpreise-Modus heizt er zusätzlich die Kartenkante von innen (Inset-Glühen statt Full-Wash, nie über die Kartenkante hinaus), damit der Fallback nie als Blend durchgeht.

**Gefilterte**:
Karten mit einer Filterursache (Negativ, Min-Angebote, Händler, Schlechter Deal, Ungeprüfte).
_Avoid_: Ausgeblendete (als Sammelbegriff — nur Verbergen blendet wirklich aus)

**Anzeige**:
Die Darstellungsart aller Gefilterten: Highlight (bernsteinfarbene Kontur), Dimmen (abgedunkelt) oder Verbergen (ausgeblendet).
_Avoid_: Modus (für die Darstellung — Tiefstpreise-Modus bleibt)

**Nur geprüfte**:
Eine Filterursache wie jede andere: ungeprüfte Karten werden Gefilterte und folgen der Anzeige.
_Avoid_: separater Modus, Sonderverhalten
