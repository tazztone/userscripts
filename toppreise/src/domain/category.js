/**
 * Category & Taxonomy Domain Layer
 * Manages category group mapping, emojis, brand rules, root slug normalization,
 * and category exclusion checks.
 */

export const normalizeName = name => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

export const ROOT_SLUG_MAP = Object.freeze({
  'computer-zubehoer': 'Computer & Zubehör', 'videogames': 'Videogames', 'tv-video': 'TV & Video',
  'foto-video': 'Foto & Video', 'foto': 'Foto & Video', 'smartphones-mobiltelefone': 'Smartphones & Mobiltelefone',
  'hifi-audio': 'HiFi & Audio', 'haushalt-kueche': 'Haushalt & Küche', 'drogerie': 'Drogerie',
  'sport-freizeit': 'Sport & Freizeit', 'spielwaren': 'Spielwaren', 'buerobedarf-schreibwaren': 'Bürobedarf & Schreibwaren',
  'haus-garten': 'Garten & Baumarkt', 'garten-baumarkt': 'Garten & Baumarkt', 'werkzeuge-werkstatt': 'Garten & Baumarkt',
  'auto-motorrad': 'Auto & Motorrad', 'filme': 'Filme', 'uhren': 'Uhren', 'buecher-medien': 'Bücher & Medien',
  'kleidung-mode': 'Kleidung & Mode', 'bekleidung-schuhe': 'Kleidung & Mode'
});

export const GROUP_EMOJIS = Object.freeze({
  'Filme': '🎬', 'Spielwaren': '🧸', 'Computer & Zubehör': '💻', 'Videogames': '🎮', 'HiFi & Audio': '🎧',
  'TV & Video': '📺', 'Smartphones & Mobiltelefone': '📱', 'Drogerie': '🧴', 'Sport & Freizeit': '⚽',
  'Haushalt & Küche': '☕', 'Auto & Motorrad': '🚗', 'Uhren': '⌚', 'Foto & Video': '📷', 'Bücher & Medien': '📚',
  'Kleidung & Mode': '👕', 'Garten & Baumarkt': '🪴', 'Sonstiges': '📦'
});

export const getGroupEmoji = g => GROUP_EMOJIS[g] || '📦';
export const normalizeRootSlug = s => s ? ROOT_SLUG_MAP[s.split('-c')[0].toLowerCase().trim()] || null : null;

export function extractCategoryDisplay(key) {
  if (!key) return { label: '', group: '' };
  if (key.startsWith('GROUP:')) return { label: key.slice(6), group: key.slice(6) };
  if (key.startsWith('PATH:')) {
    const parts = key.slice(5).split('/');
    return { label: parts.slice(1).join('/') || parts[0] || '', group: parts[0] || '' };
  }
  return { label: key, group: '' };
}

export const BRAND_RULES = Object.freeze([
  { regex: /\b(game|games|spiel|spiele|nintendo|switch|playstation|ps[3-5]|xbox|pc spiele|konsole|konsolen|gamepad|controller|lenkrad|vr headset|amiibo|simulationen|rennspiel|actionspiele|tabletop spiele)\b/i, group: 'Videogames' },
  { regex: /\b(lego[s]?|playmobil|cobi|cada|mega construx|fischertechnik|ravensburger|schleich|barbie|hot wheels|action figuren|funko|nerf|spielwaren|spielzeug|puppe[n]?|plue?sch|autorennbahn|rc modelle|multicopter|puzzles|gesellschaftsspiele|familienspiele|kartenspiele|experimentierkaesten|bau konstruktionsspielzeug|outdoor spielzeug|spielzeugroboter)\b/i, group: 'Spielwaren' },
  { regex: /\b(reifen|pneus|sommerreifen|winterreifen|allwetterreifen|felgen|dachbox(?:en)?|dachtrae?ger|kindersitz(?:e)?|autozubehoer|car hifi|car video|motorradhelm|dashcam)\b/i, group: 'Auto & Motorrad' },
  { regex: /\b(fritteuse[n]?|heissluftfritteuse[n]?|vollautomat(?:en)?|kaffee|espressomaschine[n]?|kaffeemue?hle|kue?chengera?e?te?|haushaltsgera?e?te?|staubsauger|saugroboter|wischroboter|fensterreinigungsroboter|mikrowelle[n]?|backofen|herd|kue?hlschrank|gefrierschrank|geschirrspue?ler|waschmaschine[n]?|wae?schetrockner|mixer|blender|wasserkocher|toaster|thermoskanne|abfallsystem|raumduft|dampfgarer|slowcooker|saftpresse|entsafter|geschirr|besteck|glae?ser|toe?pfe?|pfanne[n]?|kochgeschirr|spirituosen|wein|whisky|gin|rum|vodka|saug und wischroboter|klimageraete|senseo maschinen|sonstige kuechengeraete)\b/i, group: 'Haushalt & Küche' },
  { regex: /\b(haarglae?tter|glae?tteisen|bartschneider|haarschneider|haar bartschneider|rasierer|elektrorasierer|epilierer|haartrockner|foe?hn|zahnbue?rste[n]?|elektrozahnbue?rste[n]?|parfu?e?m|due?fte?|eau de|duschpflege|duschgel|shampoo|seife|geschenkset[s]?|hautpflege|koe?rperpflege|kosmetik|make-up|makeup|sonnenschutz|kontaktlinsen|hygiene)\b/i, group: 'Drogerie' },
  { regex: /\b(smartphone[s]?|mobiltelefon[e]?|handy[s]?|iphone|galaxy|pixel|smartring[e]?|smartwatch(es)?|activity tracker|hue?lle[n]?|cover|oberschalen cover|schutzfolie|panzerglas|ladekabel|powerbank[s]?|magsafe|funktelefon|festnetz)\b/i, group: 'Smartphones & Mobiltelefone' },
  { regex: /\b(kopfhoe?rer|in-ear|earbuds|lautsprecher|bluetooth lautsprecher|soundbar|plattenspieler|receiver|av receiver|home cinema av receiver|verstae?rker|hifi|radio|cd player|dac|subwoofer|mikrofon|musikinstrument|gitarre|piano|keyboard)\b/i, group: 'HiFi & Audio' },
  { regex: /\b(tv|fernseher|tv geraete|beamer|projektor|home cinema|heimkino|blu-ray player|dvd player|actioncam|actionkamera|camcorder|media player|streaming stick|chromecast|apple tv)\b/i, group: 'TV & Video' },
  { regex: /\b(kamera[s]?|digitalkamera|spiegellose|dslr|objektiv[e]?|stativ[e]?|blitz|fotostudio|drohne|sofortbildkamera)\b/i, group: 'Foto & Video' },
  { regex: /\b(dvd|blu-ray|blu ray|4k ultra hd|film[e]?|kino|serie|tv serien|western|abenteuer|action|krimi|drama|komoe?die|thriller|horror|anime|dokumentation)\b/i, group: 'Filme' },
  { regex: /\b(crosstrainer|laufband|laufbae?nder|ergometer|rudergera?e?t|fitness|krafttraining|fitness krafttraining|hantel[n]?|matten|velo[s]?|fahrrad|ebike|e-bike|velohelm|skihelme|skibrille|skihelm|koffer|rucksack|taschenmesser|fernglas|camping|zelt|schlafsack|tretroller|scooter|inline skates|gps|gps navigations geraete|navigation|navigations|activity tracker smartwatches)\b/i, group: 'Sport & Freizeit' },
  { regex: /\b(rasenmae?her|rasenroboter|grill|gasgrill|elektrogrill|holzkohlegrill|bohrmaschine|akkuschrauber|sae?ge|schleifer|schwingschleifer|schalter|taster|steckdose|lampe[n]?|leuchtmittel|led|smart home|gartenmoe?bel|hochdruckreiniger|werkzeug[e]?)\b/i, group: 'Garten & Baumarkt' },
  { regex: /\b(uhr[en]?|armbanduhr|damenuhr|herrenuhr|chronograph|automatikuhr|wanduhr|wecker)\b/i, group: 'Uhren' },
  { regex: /\b(kleidung|bekleidung|jacke[n]?|hose[n]?|t-shirt|pullover|hemd|kleid|schuhe|sneaker|stiefel|tasche[n]?|handtasche|rucksack|sonnenbrille[n]?|schmuck|ring|kette)\b/i, group: 'Kleidung & Mode' },
  { regex: /\b(buch|bue?cher|roman|taschenbuch|sachbuch|hoe?rbuch|comic|manga|zeitschrift)\b/i, group: 'Bücher & Medien' },
  { regex: /\b(usb|speicherstick[s]?|ssd|hdds?|solid state|festplatte[n]?|grafikkarte[n]?|notebook[s]?|laptop[s]?|tablet[s]?|ebook|monitore|monitor|drucker|scanner|nas|mainboard[s]?|prozessor[en]?|cpu|gpu|pc gehaeuse|netzteil[e]?|ladegera?e?t[e]?|ladegeraete netzadapter|kabel|hub|dockingstation|tastatur[en]?|maus|mae?use|mausmatte|webcam[s]?|headset|aktenvernichter|papierschredder|arbeitsspeicher|ram|netzwerk|wlan|router|switch|server|western digital|externe solid state drives ssd|usb speichersticks)\b/i, group: 'Computer & Zubehör' }
]);

export function resolveCategoryGroup(categoryName, card = null, cardHrefsGetter = null) {
  if (card && cardHrefsGetter) {
    for (const href of cardHrefsGetter(card)) {
      const match = href.match(/\/(?:preisvergleich|produktsuche)\/([^\/]+)\//i);
      if (match && match[1]) {
        for (const seg of match[1].split('/').filter(Boolean)) {
          const canonical = normalizeRootSlug(seg);
          if (canonical) return canonical;
          const normSeg = seg.toLowerCase().replace(/-/g, ' ');
          for (const rule of BRAND_RULES) if (rule.regex.test(normSeg)) return rule.group;
        }
      }
    }
  }
  if (categoryName) {
    const norm = categoryName.toLowerCase();
    for (const rule of BRAND_RULES) if (rule.regex.test(norm)) return rule.group;
  }
  return 'Sonstiges';
}

export const isPathExcluded = (catName, rootGroup, excludedCats = []) =>
  excludedCats.includes(`GROUP:${rootGroup}`) || (catName && (excludedCats.includes(catName) || excludedCats.includes(`PATH:${rootGroup}/${catName}`)));
