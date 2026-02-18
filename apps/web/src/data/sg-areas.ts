export interface SgArea {
  lat: number;
  lng: number;
  label: string;
}

export const SG_AREA_CENTROIDS: Record<string, SgArea> = {
  'ang mo kio': { lat: 1.3800939, lng: 103.8420975, label: 'Ang Mo Kio, Singapore' },
  bedok: { lat: 1.3240702, lng: 103.9283972, label: 'Bedok, Singapore' },
  bishan: { lat: 1.3519117, lng: 103.8489708, label: 'Bishan, Singapore' },
  'boon lay': { lat: 1.3385504, lng: 103.7058124, label: 'Boon Lay, Singapore' },
  'bukit batok': { lat: 1.3556584, lng: 103.7547317, label: 'Bukit Batok, Singapore' },
  'bukit merah': { lat: 1.2755708, lng: 103.8231103, label: 'Bukit Merah, Singapore' },
  'bukit panjang': { lat: 1.3791486, lng: 103.761413, label: 'Bukit Panjang, Singapore' },
  'bukit timah': { lat: 1.3546901, lng: 103.7763724, label: 'Bukit Timah, Singapore' },
  'central water catchment': { lat: 1.3761316, lng: 103.8011964, label: 'Central Water Catchment, Singapore' },
  changi: { lat: 1.3501573, lng: 103.9978328, label: 'Changi, Singapore' },
  'changi bay': { lat: 1.3279883, lng: 104.0343607, label: 'Changi Bay, Singapore' },
  'choa chu kang': { lat: 1.3857186, lng: 103.7445876, label: 'Choa Chu Kang, Singapore' },
  clementi: { lat: 1.3175909, lng: 103.7607506, label: 'Clementi, Singapore' },
  'downtown core': { lat: 1.2867893, lng: 103.855497, label: 'Downtown Core, Singapore' },
  geylang: { lat: 1.3208955, lng: 103.8895225, label: 'Geylang, Singapore' },
  hougang: { lat: 1.3636374, lng: 103.8898002, label: 'Hougang, Singapore' },
  'jurong east': { lat: 1.3204168, lng: 103.7347925, label: 'Jurong East, Singapore' },
  'jurong west': { lat: 1.341612, lng: 103.7049027, label: 'Jurong West, Singapore' },
  kallang: { lat: 1.3111254, lng: 103.8665434, label: 'Kallang, Singapore' },
  'lim chu kang': { lat: 1.4309666, lng: 103.719476, label: 'Lim Chu Kang, Singapore' },
  mandai: { lat: 1.423623, lng: 103.8024597, label: 'Mandai, Singapore' },
  'marina east': { lat: 1.2889033, lng: 103.8723408, label: 'Marina East, Singapore' },
  'marina south': { lat: 1.2808941, lng: 103.8656305, label: 'Marina South, Singapore' },
  'marine parade': { lat: 1.3000669, lng: 103.896164, label: 'Marine Parade, Singapore' },
  museum: { lat: 1.2959466, lng: 103.8474873, label: 'Museum, Singapore' },
  newton: { lat: 1.3131833, lng: 103.8380402, label: 'Newton, Singapore' },
  'north eastern islands': { lat: 1.4012762, lng: 104.0370541, label: 'North-Eastern Islands, Singapore' },
  novena: { lat: 1.3269837, lng: 103.8353089, label: 'Novena, Singapore' },
  orchard: { lat: 1.3031208, lng: 103.8313759, label: 'Orchard, Singapore' },
  outram: { lat: 1.282858, lng: 103.8420606, label: 'Outram, Singapore' },
  'pasir ris': { lat: 1.3786232, lng: 103.9483209, label: 'Pasir Ris, Singapore' },
  'paya lebar': { lat: 1.3174795, lng: 103.8923525, label: 'Paya Lebar, Singapore' },
  pioneer: { lat: 1.3375884, lng: 103.6974103, label: 'Pioneer, Singapore' },
  punggol: { lat: 1.4054163, lng: 103.9100375, label: 'Punggol, Singapore' },
  queenstown: { lat: 1.2891716, lng: 103.7844895, label: 'Queenstown, Singapore' },
  'river valley': { lat: 1.2983306, lng: 103.8357067, label: 'River Valley, Singapore' },
  rochor: { lat: 1.3041388, lng: 103.8532845, label: 'Rochor, Singapore' },
  seletar: { lat: 1.408995, lng: 103.8815868, label: 'Seletar, Singapore' },
  sembawang: { lat: 1.4557615, lng: 103.818849, label: 'Sembawang, Singapore' },
  sengkang: { lat: 1.3912793, lng: 103.8877082, label: 'Sengkang, Singapore' },
  serangoon: { lat: 1.351692, lng: 103.8708846, label: 'Serangoon, Singapore' },
  simpang: { lat: 1.4435449, lng: 103.8648682, label: 'Simpang, Singapore' },
  'southern islands': { lat: 1.2436323, lng: 103.8355545, label: 'Southern Islands, Singapore' },
  'straits view': { lat: 1.2714772, lng: 103.8587995, label: 'Straits View, Singapore' },
  'sungei kadut': { lat: 1.4149971, lng: 103.7533106, label: 'Sungei Kadut, Singapore' },
  tampines: { lat: 1.3541234, lng: 103.9438554, label: 'Tampines, Singapore' },
  tanglin: { lat: 1.3083745, lng: 103.8175951, label: 'Tanglin, Singapore' },
  'toa payoh': { lat: 1.335592, lng: 103.8481461, label: 'Toa Payoh, Singapore' },
  tuas: { lat: 1.2825772, lng: 103.6325987, label: 'Tuas, Singapore' },
  'western islands': { lat: 1.2595841, lng: 103.6704952, label: 'Western Islands, Singapore' },
  'western water catchment': { lat: 1.3821619, lng: 103.6898255, label: 'Western Water Catchment, Singapore' },
  woodlands: { lat: 1.436897, lng: 103.786216, label: 'Woodlands, Singapore' },
  yishun: { lat: 1.4293839, lng: 103.8350282, label: 'Yishun, Singapore' },
};

const SG_AREA_ALIASES: Record<string, string> = {
  woodland: 'woodlands',
  amk: 'ang mo kio',
  cbd: 'downtown core',
  'city centre': 'downtown core',
  'city center': 'downtown core',
  northeastern: 'north eastern islands',
  'northeastern islands': 'north eastern islands',
  'north-eastern islands': 'north eastern islands',
  'north eastern island': 'north eastern islands',
};

export function normalizeAreaLikeQuery(raw: string): string {
  let query = raw.trim().replace(/\s+/g, ' ');
  query = query.replace(/^(?:area|location)\s*[:=]\s*/i, '');
  query = query.replace(/^(?:near(?:\s+me)?|around|in)\s+/i, '');
  query = query.replace(/(?:\s+area)$/i, '');
  return query.trim().replace(/\s+/g, ' ');
}

function areaAliasKey(raw: string): string {
  return normalizeAreaLikeQuery(raw)
    .toLowerCase()
    .replace(/\bsingapore\b/g, ' ')
    .replace(/\b(?:district|estate|town|region)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function lookupSgArea(rawQuery: string): SgArea | null {
  const alias = areaAliasKey(rawQuery);
  const canonical = SG_AREA_CENTROIDS[alias] ? alias : SG_AREA_ALIASES[alias];
  if (!canonical) return null;
  const area = SG_AREA_CENTROIDS[canonical];
  return area ?? null;
}
