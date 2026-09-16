// Campus gazetteer, location matching and rough travel-time estimates.
// Coordinates are approximate (~100–200 m) and only used for estimates; the UI labels them as such.

import { norm } from "./text";

export interface Place {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  transit: string;
  zone: "paris" | "petite-couronne" | "grande-couronne";
  kind: "campus" | "hub";
  last_mile_min: number;
  patterns: RegExp[];
}

const P = (id: string, name: string, address: string, city: string, lat: number, lon: number, transit: string,
  zone: Place["zone"], last_mile_min: number, patterns: RegExp[], kind: Place["kind"] = "campus"): Place =>
  ({ id, name, address, city, lat, lon, transit, zone, kind, last_mile_min, patterns });

export const PLACES: Place[] = [
  P("jussieu", "Campus Pierre et Marie Curie (Jussieu)", "4 place Jussieu", "Paris 5e", 48.8466, 2.3563, "Métro 7/10 Jussieu", "paris", 5,
    [/jussieu/, /campus pierre et marie curie/, /\bbarre 1[0-9]-[0-9]{2}/, /\b1[0-9]-[0-9]{2}-[0-9]{3}\b/, /couloir 1[0-9]-[0-9]{2}/, /\bupmc\b/]),
  P("sophie-germain", "Bâtiment Sophie Germain (Université Paris Cité)", "8 place Aurélie Nemours", "Paris 13e", 48.8272, 2.381,
    "Métro 14 / RER C Bibliothèque François Mitterrand", "paris", 5, [/sophie germain/, /aurelie nemours/, /batiment sophie/]),
  P("halle-aux-farines", "Halle aux Farines (Université Paris Cité)", "Esplanade Pierre Vidal-Naquet", "Paris 13e", 48.8295, 2.3825,
    "Métro 14 / RER C Bibliothèque François Mitterrand", "paris", 5, [/halle aux farines/]),
  P("ihp", "Institut Henri Poincaré", "11 rue Pierre et Marie Curie", "Paris 5e", 48.8443, 2.344, "RER B Luxembourg", "paris", 5,
    [/\bihp\b/, /henri poincare/, /11,? rue pierre et marie curie/, /batiment (borel|perrin)/,
      /amphi(theatre|theater)? (hermite|darboux|charles hermite|gaston darboux|yvonne choquet)/,
      /salle (yvette cauchois|maryam mirzakhani|olga ladyjenska|maurice frechet|pierre grisvard|emile borel|paul langevin)/, /maison poincare/]),
  P("ens-ulm", "École normale supérieure (45 rue d'Ulm)", "45 rue d'Ulm", "Paris 5e", 48.8418, 2.3442, "RER B Luxembourg", "paris", 5,
    [/\bens\b(?! (paris-)?saclay| rennes| lyon)/, /ecole normale superieure(?! (paris-)?saclay)/, /rue d'ulm/, /amphi galois/, /salle w\b/, /\bdma\b/]),
  P("college-de-france", "Collège de France", "11 place Marcelin Berthelot", "Paris 5e", 48.8491, 2.3451,
    "RER B Luxembourg / Métro 10 Maubert-Mutualité", "paris", 5, [/college de france/]),
  P("mse", "Maison des Sciences Économiques", "106-112 boulevard de l'Hôpital", "Paris 13e", 48.8363, 2.3587, "Métro 5 Campo-Formio", "paris", 3,
    [/maison des sciences economiques/]),
  P("cnam", "Cnam", "292 rue Saint-Martin", "Paris 3e", 48.8667, 2.3547, "Métro 3/11 Arts et Métiers", "paris", 3,
    [/\bcnam\b/, /conservatoire national des arts/]),
  P("dauphine", "Université Paris Dauphine-PSL", "Place du Maréchal de Lattre de Tassigny", "Paris 16e", 48.8705, 2.2741,
    "Métro 2 Porte Dauphine / RER C Avenue Foch", "paris", 5, [/dauphine/, /marechal de lattre/]),
  P("villetaneuse", "Institut Galilée, Université Sorbonne Paris Nord (LAGA)", "99 avenue Jean-Baptiste Clément", "Villetaneuse", 48.9566, 2.3417,
    "Tram T8 / T11 Villetaneuse-Université", "petite-couronne", 8,
    [/villetaneuse/, /institut galilee/, /universite paris 13/, /sorbonne paris nord/, /\blaga\b/]),
  P("paris8", "Université Paris 8", "2 rue de la Liberté", "Saint-Denis", 48.9454, 2.3633, "Métro 13 Saint-Denis-Université", "petite-couronne", 5,
    [/paris 8\b/, /saint-denis/]),
  P("upec", "Université Paris-Est Créteil", "61 avenue du Général de Gaulle", "Créteil", 48.7895, 2.4501, "Métro 8 Créteil-Université",
    "petite-couronne", 5, [/creteil/, /\bupec\b/]),
  P("nanterre", "Université Paris Nanterre", "200 avenue de la République", "Nanterre", 48.9025, 2.214, "RER A Nanterre-Université",
    "petite-couronne", 5, [/nanterre/]),
  P("champs-sur-marne", "Cité Descartes (Université Gustave Eiffel / École des Ponts)", "5 boulevard Descartes", "Champs-sur-Marne", 48.8406, 2.5868,
    "RER A Noisy-Champs", "grande-couronne", 10,
    [/champs-sur-marne/, /marne-la-vallee/, /gustave eiffel/, /cite descartes/, /\bcermics\b/, /ecole des ponts/, /\benpc\b/, /batiment copernic/]),
  P("ihes", "IHES", "35 route de Chartres", "Bures-sur-Yvette", 48.6963, 2.1669, "RER B Bures-sur-Yvette (≈10 min walk)", "grande-couronne", 12,
    [/\bihes\b/, /i\.h\.e\.s/, /leon motchane/, /marilyn et james simons/, /bures-sur-yvette/]),
  P("orsay", "Institut de Mathématique d'Orsay (bât. 307)", "Rue Michel Magat, bâtiment 307", "Orsay", 48.7117, 2.1705,
    "RER B Orsay-Ville or Le Guichet, then bus/walk to the plateau", "grande-couronne", 18,
    [/\borsay\b/, /batiment 307/, /\bbat\.? 307/, /\blmo\b/, /\bimo\b/, /institut de mathematique d'orsay/, /institut pascal/]),
  P("polytechnique", "École polytechnique (CMLS)", "Route de Saclay", "Palaiseau", 48.7136, 2.211, "RER B Lozère (stairs) or Massy-Palaiseau + bus",
    "grande-couronne", 18, [/polytechnique/, /palaiseau/, /\bcmls\b/, /\bcpht\b/, /\bcmap\b/, /telecom paris/, /ip paris/]),
  P("saclay-plateau", "Plateau de Saclay (CEA / Maison de la Simulation)", "Saclay", "Saclay / Gif-sur-Yvette", 48.71, 2.148, "RER B Le Guichet + bus",
    "grande-couronne", 20, [/maison de la simulation/, /cea saclay/, /centralesupelec/, /ens paris-saclay/]),
  P("cergy", "CY Cergy Paris Université — site Saint-Martin (AGM)", "2 avenue Adolphe Chauvin", "Pontoise", 49.0437, 2.088,
    "RER C / Transilien H-J Pontoise", "grande-couronne", 12, [/cergy/, /pontoise/, /adolphe chauvin/, /site saint-martin/, /\bagm\b/]),
  P("evry", "Université d'Évry (LaMME)", "23 boulevard de France", "Évry-Courcouronnes", 48.626, 2.443, "RER D Évry-Courcouronnes",
    "grande-couronne", 10, [/\bevry\b/, /lamme/]),
  P("versailles", "UVSQ (Laboratoire de Mathématiques de Versailles)", "45 avenue des États-Unis", "Versailles", 48.8105, 2.1435,
    "RER C / Transilien Versailles-Chantiers", "grande-couronne", 12, [/versailles/, /\buvsq\b/]),
  P("hub-chatelet", "Châtelet – Les Halles", "", "Paris 1er", 48.8619, 2.347, "", "paris", 0, [], "hub"),
  P("hub-gare-du-nord", "Gare du Nord", "", "Paris 10e", 48.8809, 2.3553, "", "paris", 0, [], "hub"),
  P("hub-gare-de-lyon", "Gare de Lyon", "", "Paris 12e", 48.8443, 2.3743, "", "paris", 0, [], "hub"),
  P("hub-montparnasse", "Montparnasse", "", "Paris 14e", 48.8412, 2.32, "", "paris", 0, [], "hub"),
  P("hub-saint-lazare", "Saint-Lazare", "", "Paris 8e", 48.8763, 2.3253, "", "paris", 0, [], "hub"),
  P("hub-denfert", "Denfert-Rochereau", "", "Paris 14e", 48.8339, 2.3324, "", "paris", 0, [], "hub"),
  P("hub-nation", "Nation", "", "Paris 12e", 48.8483, 2.3959, "", "paris", 0, [], "hub"),
  P("hub-republique", "République", "", "Paris 3e/10e/11e", 48.8675, 2.3637, "", "paris", 0, [], "hub"),
  P("hub-la-defense", "La Défense", "", "Puteaux", 48.8918, 2.238, "", "petite-couronne", 0, [], "hub"),
];

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

const OUTSIDE_REGION_RE =
  /cargese|marseille|luminy|cirm|lyon|grenoble|toulouse|bordeaux|strasbourg|lille|rennes|nantes|nice|montpellier|oberwolfach|banff|bonn|zurich|london|online only|virtual only/;

export function matchLocation(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const n = norm(t);
    if (!n) continue;
    for (const p of PLACES) if (p.kind === "campus" && p.patterns.some((re) => re.test(n))) return p.id;
  }
  return null;
}

export function isOutsideRegion(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && OUTSIDE_REGION_RE.test(norm(t)));
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const r = 6371, rad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Crude door-to-door public-transport estimate (walking below ~1.3 km): access+waiting 10 min,
 * network distance 1.35 × crow-fly, 18 km/h inside Paris or 30 km/h with RER/tram legs, plus the
 * site's last mile. Rounded to 5 minutes — meant for "is this 20 or 70 minutes?".
 */
export function estimateTravelMinutes(origin: [number, number], destId: string): number | null {
  const dest = PLACE_BY_ID[destId];
  if (!dest) return null;
  const d = haversineKm(origin, [dest.lat, dest.lon]);
  let minutes: number;
  if (d < 1.3) minutes = ((d * 1.3) / 4.8) * 60;
  else {
    const speed = dest.zone === "paris" && d < 9 ? 18 : 30;
    minutes = 10 + ((d * 1.35) / speed) * 60 + dest.last_mile_min;
  }
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function mapsUrl(destId: string, origin?: [number, number] | null): string | null {
  const dest = PLACE_BY_ID[destId];
  if (!dest) return null;
  const q = `${dest.lat},${dest.lon}`;
  if (origin) return `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${q}&travelmode=transit`;
  return `https://www.openstreetmap.org/?mlat=${dest.lat}&mlon=${dest.lon}#map=17/${dest.lat}/${dest.lon}`;
}
