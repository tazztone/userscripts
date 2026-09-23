#!/usr/bin/env python3
"""
Verification Script for Toppreise Category Lookup Engine
Tests category mapping accuracy against benchmark site category terms using BRAND_RULES and ROOT_SLUG_MAP.
"""

import os
import re
import sys

BENCHMARK_CATEGORIES = [
    'CaDA', 'Heissluftfritteusen', 'Vollautomaten', 'Haarglaetter',
    'Haar Bartschneider', 'USB SpeicherSticks', 'Smartringe',
    'Home Cinema AV Receiver', 'Zubehoer Fuer Kuechengeraete',
    'GPS Navigations Geraete', 'Parfum', 'Externe Solid State Drives SSD',
    'Western', 'Ladegeraete Netzadapter', 'Amiibo',
    'Lego City', 'Lego Architecture', 'Lego Duplo', 'Lego Marvel',
    'Playmobil', 'Schleich', 'Hot Wheels', 'Barbie',
    'Kopfhoerer', 'Bluetooth Lautsprecher', 'Plattenspieler',
    'Eau De Parfum', 'Elektrozahnbuersten', 'Haartrockner',
    'Staubsauger', 'Saugroboter', 'Kaffee Espressomaschinen',
    'TV Geraete', 'Beamer', 'Notebooks', 'Grafikkarten', 'Monitore',
    'Smartphones', 'Reifen', 'Skihelme', 'Koffer',
    'Nintendo Switch Games', 'PS5 Konsolen', 'Actionspiele',
    'Puzzles', 'Kartenspiele', 'Familienspiele',
    'Aktenvernichter', 'Webcams', 'Activity Tracker Smartwatches',
    'Fitness Krafttraining', 'Schwingschleifer',
    'Bau Konstruktionsspielzeug', 'Outdoor Spielzeug',
    'Experimentierkaesten', 'Tabletop Spiele',
    'Saug Und Wischroboter', 'Klimageraete',
    'Senseo Maschinen', 'Sonstige Kuechengeraete',
    'Oberschalen Cover', 'Huellen',
    'Dachboxen', 'Dachtraeger', 'Kindersitze',
    'Car HiFi Car Video', 'RC Modelle', 'Multicopter', 'Spielzeugroboter',
]

def main():
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    userscript_path = os.path.join(os.path.dirname(tools_dir), "toppreise.user.js")
    
    if not os.path.exists(userscript_path):
        print(f"❌ Error: {userscript_path} not found.")
        sys.exit(1)

    with open(userscript_path, "r", encoding="utf-8") as f:
        content = f.read()

    rules = []
    for m in re.finditer(r"regex:\s*/\\b\((.*?)\)\\b/i,\s*group:\s*['\"](.*?)['\"]", content):
        pattern = re.compile(rf"\b({m.group(1)})\b", re.IGNORECASE)
        group = m.group(2)
        rules.append((pattern, group))

    if not rules:
        print("❌ Error: BRAND_RULES not found in toppreise.user.js")
        sys.exit(1)

    mapped = []
    unmapped = []
    
    for cat in BENCHMARK_CATEGORIES:
        norm = cat.strip().lower()
        matched = False
        for pat, grp in rules:
            if pat.search(norm):
                mapped.append((cat, grp))
                matched = True
                break
        if not matched:
            unmapped.append(cat)

    print("==================================================")
    print("📊 TOPPREISE CATEGORY MAP VERIFICATION SUMMARY")
    print("==================================================")
    print(f"Total Benchmark Terms : {len(BENCHMARK_CATEGORIES)}")
    print(f"Mapped Terms          : {len(mapped)} ({len(mapped)/len(BENCHMARK_CATEGORIES)*100:.1f}%)")
    print(f"Unmapped (Sonstiges)  : {len(unmapped)}")
    print(f"Total Active Rules    : {len(rules)}")
    print("==================================================")

    if unmapped:
        print("\n⚠️ Unmapped categories (fall back to card URL / Sonstiges):")
        for u in unmapped:
            print(f"  • {u}")

    print("\n✅ Sample Mapped Categories:")
    for cat, root in sorted(mapped[:20], key=lambda x: x[1]):
        print(f"  • {cat:35s} => {root}")

    # Success criteria: At least 95% of benchmark categories must be resolved
    if len(mapped) / len(BENCHMARK_CATEGORIES) < 0.95:
        print("\n❌ Verification failed: Mapped percentage below 95% threshold.")
        sys.exit(1)
    else:
        print("\n✨ Verification PASSED! Taxonomy coverage satisfies quality gate.")

if __name__ == '__main__':
    main()
