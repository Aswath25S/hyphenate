const STATES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware',
  FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky',
  LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico',
  NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};
const CITIES = ['san francisco', 'new york', 'nyc', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'denver', 'atlanta',
  'miami', 'dallas', 'houston', 'salt lake', 'portland', 'philadelphia', 'washington', 'san diego', 'san jose', 'palo alto',
  'mountain view', 'menlo park', 'oakland', 'brooklyn', 'nashville', 'raleigh', 'phoenix', 'minneapolis', 'pittsburgh',
  'detroit', 'columbus', 'charlotte', 'lehi', 'boulder', 'cambridge', 'jersey city', 'irvine', 'santa monica', 'remote us',
  'bay area', 'sunnyvale', 'redwood city', 'san mateo', 'tampa', 'orlando', 'st. louis', 'kansas city', 'indianapolis'];
const NON_US = /\b(canada|toronto|vancouver|montreal|london|uk|united kingdom|ireland|dublin|germany|berlin|munich|france|paris|india|bangalore|bengaluru|hyderabad|pune|mumbai|singapore|australia|sydney|melbourne|japan|tokyo|mexico|brazil|são paulo|sao paulo|netherlands|amsterdam|spain|madrid|barcelona|poland|warsaw|israel|tel aviv|philippines|manila|argentina|colombia|bogota|portugal|lisbon|sweden|stockholm|denmark|switzerland|zurich|emea|apac|latam|europe)\b/i;

/** Is at least one location in the US? Unknown or blank counts as not proven. */
export function isUsLocation(locs: string[], text = ''): boolean {
  for (const raw of locs) {
    const l = raw.toLowerCase();
    if (/\b(united states|usa|u\.s\.|us-remote|remote[ ,(-]*us\b|\bus\b)/i.test(raw)) return true;
    if (Object.values(STATES).some((s) => l.includes(s))) return true;
    if (Object.keys(STATES).some((a) => new RegExp(`(,|\\s)${a}(\\b|$)`).test(raw))) return !NON_US.test(raw) || /\bUS\b/.test(raw);
    if (CITIES.some((c) => l.includes(c)) && !NON_US.test(raw)) return true;
  }
  if (!locs.length || locs.every((l) => /^remote$/i.test(l.trim()))) {
    // Remote with no country: accept when the text mentions US pay ranges or states.
    return /\$\s?\d{2,3}[,.]?\d{0,3}/.test(text) || /\bUnited States\b/.test(text);
  }
  return false;
}
