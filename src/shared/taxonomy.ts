// Topic taxonomy, keyword classifier, series-name rules and event-type detection.
// Classification is purely lexical and keeps its evidence, so that every "why is this relevant?"
// explanation points at the text that triggered it. Patterns run on norm()-alised text (no accents).

import { norm } from "./text";
import type { EventTopic, Evidence } from "./types";

export interface Topic {
  id: string;
  label: string;
  grp: "area" | "subfield";
  parent: string | null;
  color: string;
  keywords: RegExp[];
}

const T = (id: string, label: string, grp: "area" | "subfield", parent: string | null, color: string, keywords: RegExp[]): Topic =>
  ({ id, label, grp, parent, color, keywords });

export const AREAS: Topic[] = [
  T("topology", "Topology", "area", null, "#2f5d8a", [/topolog/, /\bmanifolds?\b/, /cobordism/, /\bknots?\b/, /\bnoeuds?\b/, /entrelacs/,
    /\blinks? (invariant|homotopy|concordance)/, /homeomorph/]),
  T("geometry", "Geometry", "area", null, "#4a6f5a", [/geometr/, /riemanni/, /curvature/, /courbure/, /\bmetrics?\b/, /minimal surface/,
    /surfaces? minimales?/, /hyperboli/]),
  T("algebra", "Algebra", "area", null, "#7a4f2a", [/\balgebras?\b/, /\balgebre/, /\brings?\b/, /\banneaux\b/, /\bmodules?\b/, /lie algebra/,
    /hopf/, /quiver/, /carquois/]),
  T("algebraic-geometry", "Algebraic Geometry", "area", null, "#6b5a8e", [/algebraic geometry/, /geometrie algebrique/, /\bschemes?\b/,
    /\bschemas?\b/, /algebraic variet/, /varietes? algebriques?/, /\bstacks?\b/, /\bchamps algebriques/, /sheaf|sheaves|faisceau/, /\bmotiv/,
    /hodge/, /fano/, /calabi-yau/, /birational/, /\bcurves? of genus/, /abelian variet/, /varietes? abeliennes?/, /bridgeland/]),
  T("number-theory", "Number Theory", "area", null, "#8a3b3b", [/number theory/, /theorie des nombres/, /arithmet/, /\bl-functions?\b/,
    /fonctions? l\b/, /\bp-adic/, /p-adique/, /langlands/, /automorphic/, /automorphe/, /diophant/, /galois rep/, /modular forms?/,
    /formes? modulaires?/, /prime numbers?/, /nombres premiers/, /multiplicative functions?/, /fonctions? multiplicatives?/,
    /elliptic curves?/, /courbes? elliptiques?/, /\bheights?\b/]),
  T("logic", "Logic", "area", null, "#5a5a5a", [/\blogic/, /\blogique/, /model theory/, /theorie des modeles/, /set theory/,
    /theorie des ensembles/, /o-minimal/, /definab/, /definissab/, /type theory/, /theorie des types/, /realizab/, /realisab/, /proof theory/,
    /lambda-calcul/, /forcing/, /computab/, /calculabilit/]),
  T("analysis", "Analysis", "area", null, "#3d6b73", [/\banalysis\b/, /\banalyse\b/, /banach/, /hilbert space/, /harmonic analysis/,
    /analyse harmonique/, /functional inequalit/, /inegalites? fonctionnelles?/, /operator algebras?/, /algebres? d'operateurs/, /c\*-algebr/,
    /von neumann/, /spectral theory/, /theorie spectrale/, /convex/]),
  T("probability", "Probability", "area", null, "#8a6d2f", [/probabil/, /random/, /aleatoire/, /stochastic/, /stochastique/, /brownian/,
    /brownien/, /percolation/, /martingale/, /markov/, /central limit/, /limite centrale/, /large deviations?/, /grandes deviations?/,
    /statistic/, /statistique/]),
  T("dynamical-systems", "Dynamical Systems", "area", null, "#2f7a6b", [/dynamical systems?/, /systemes? dynamiques?/, /ergodic/, /ergodique/,
    /\bflows?\b/, /diffeomorphism/, /diffeomorphisme/, /billiard/, /billard/, /entropy/, /entropie/, /hamiltonian/, /hamiltonien/, /kam\b/,
    /chaos/, /dynamics\b/, /dynamique/]),
  T("combinatorics", "Combinatorics", "area", null, "#7a6a2f", [/combinator/, /combinatoire/, /\bgraphs?\b/, /\bgraphes?\b/, /partitions?/,
    /permutations?/, /enumerat/, /enumerati/, /matroid/, /polytop/, /tableaux/, /coloring|colouring|coloriage/, /four-colou?r/]),
  T("mathematical-physics", "Mathematical Physics", "area", null, "#5b4a7a", [/mathematical physics/, /physique mathematique/, /quantum field/,
    /theorie quantique des champs/, /\bqft\b/, /\bcft\b/, /conformal field/, /string theory/, /theorie des cordes/, /gauge theor/,
    /theorie de jauge/, /statistical mechanics/, /mecanique statistique/, /ising/, /quantum/, /quantique/, /anyons?/, /topological recursion/,
    /recursion topologique/, /feynman/, /supersymmetr/]),
  T("category-theory", "Category Theory", "area", null, "#8e4a6b", [/categor(y|ies|ical)/, /categori/, /\bfunctors?\b/, /foncteurs?/,
    /\btopos\b/, /\btopoi\b/, /adjunction/, /monad/, /yoneda/, /sheaf theory/]),
  T("tda", "TDA", "area", null, "#2f6b8a", [/topological data analysis/, /\btda\b/, /persistent homology/, /homologie persistante/,
    /persistence (diagram|module)/, /mapper algorithm/, /datashape/]),
  T("applied", "Applied & Computational", "area", null, "#6a6a6a", [/numerical/, /numerique/, /optimi[sz]ation/, /machine learning/,
    /apprentissage/, /deep learning/, /neural network/, /reseaux de neurones/, /\bai\b/, /\bia\b/, /imaging/, /imagerie/, /finance/,
    /cryptograph/, /data science/, /algorithm/, /simulation/, /biolog/]),
  T("history", "History of Mathematics", "area", null, "#6b5a4a", [/history of mathematics/, /histoire des mathematiques/, /historical/,
    /historique/]),
  T("general", "General Mathematics", "area", null, "#555555", []),
];

export const SUBFIELDS: Topic[] = [
  T("pde", "PDE", "subfield", "analysis", "#3d6b73", [/\bpdes?\b/, /\bedps?\b/, /partial differential/, /equations? aux derivees partielles/,
    /navier-stokes/, /\beuler equations?/, /schrodinger/, /wave equations?/, /kinetic/, /cinetique/, /boltzmann/, /elliptic equations?/,
    /parabolic/, /hyperbolic equations?/, /diffuse interface/, /vortex/]),
  T("algebraic-topology", "Algebraic topology", "subfield", "topology", "#2f5d8a", [/algebraic topology/, /topologie algebrique/, /cohomolog/,
    /\bhomolog(y|ie|ies)\b/, /spectral sequence/, /suite spectrale/, /steenrod/, /classifying spaces?/, /espaces? classifiants?/, /loop spaces?/,
    /espaces? de lacets/, /stable homotopy/, /chromatic/, /chromatique/, /characteristic class/, /classes? caracteristiques?/, /\bthh\b/,
    /topological hochschild/, /goodwillie/, /homological stability/, /stabilite homologique/, /mapping spaces?/, /equivariant homotopy/,
    /adams spectral/, /bordism/]),
  T("homotopy-theory", "Homotopy theory", "subfield", "topology", "#2f5d8a", [/homotop/, /model categor/, /categories? de modeles/, /simplicial/,
    /simpliciaux/, /simpliciale/, /\bspectra\b/, /infinity-categor/, /∞-categor/, /\(∞,\s*1\)/, /infini-categor/, /infinies?-categor/,
    /motivic homotopy/, /homotopie motivique/, /a1-homotop/, /rational homotopy/, /homotopie rationnelle/, /univalen/, /hott\b/,
    /weak equivalen/, /quasi-isomorph/]),
  T("configuration-spaces", "Configuration spaces", "subfield", "topology", "#1f4e79", [/configuration spaces?/, /espaces? de configurations?/,
    /little (disks?|discs?|cubes?)/, /petits disques/, /fulton-macpherson/, /lambrechts-stanley/, /poincare duality models?/,
    /hyperplane arrangements?/, /arrangements? d'hyperplans/, /factori[sz]ation homology/, /homologie de factorisation/,
    /\be_n[- ]?(algebra|operad)/, /\be_\{?n\}?-/, /ordered configurations?/]),
  T("braid-groups", "Braid groups", "subfield", "topology", "#1f4e79", [/\bbraids?\b/, /\btresses?\b/, /artin groups?/, /groupes? d'artin/,
    /mapping class groups?/, /groupes? modulaires? des surfaces/, /groupes? de diffeotopie/, /surface braid/]),
  T("low-dim-topology", "Low-dimensional topology", "subfield", "topology", "#2f5d8a", [/\bknots?\b/, /\bnoeuds?\b/, /entrelacs/, /khovanov/,
    /3-manifolds?/, /4-manifolds?/, /varietes? de dimension [34]/, /heegaard/, /floer homology/, /seifert/, /concordance/,
    /quantum invariants?/, /invariants? quantiques?/, /link homology/, /skein/]),
  T("geometric-group-theory", "Geometric group theory", "subfield", "geometry", "#4a6f5a", [/geometric group theory/,
    /theorie geometrique des groupes/, /hyperbolic groups?/, /groupes? hyperboliques?/, /cat\(0\)/, /cayley graphs?/, /graphes? de cayley/,
    /lattices? in/, /reseaux? dans/, /amenab/, /moyennab/, /out\(f_n\)/, /outer space/, /quasi-isometr/, /coxeter/, /discrete groups?/,
    /groupes? discrets?/, /superrigid/, /zimmer/]),
  T("differential-geometry", "Differential geometry", "subfield", "geometry", "#4a6f5a", [/differential geometry/, /geometrie differentielle/,
    /riemanni/, /kahler/, /einstein metric/, /ricci/, /minimal surface/, /harmonic maps?/, /applications? harmoniques?/, /curvature/,
    /courbure/, /lagrangian/, /legendrian/, /immersions?/, /cartan geometr/]),
  T("symplectic", "Symplectic & contact", "subfield", "geometry", "#4a6f5a", [/symplecti/, /contact (geometry|structure|manifold)/,
    /geometrie de contact/, /floer/, /fukaya/, /lagrangian/, /legendrian/, /hamiltonian/, /hamiltonien/]),
  T("homological-algebra", "Homological algebra", "subfield", "algebra", "#7a4f2a", [/homological algebra/, /algebre homologique/,
    /derived categor/, /categories? derivees?/, /triangulated/, /triangulee/, /\bext\b/, /\btor\b/, /koszul/, /hochschild/, /cyclic homology/,
    /homologie cyclique/, /dg[- ]?(algebra|categor)/, /a_?\{?\\?infty\}?/, /a-infini/, /a∞/, /resolutions?/, /hovey/, /exact categor/,
    /abelian categor/, /categories? abeliennes?/, /tilting/, /cluster categor/]),
  T("higher-algebra", "Higher algebra & operads", "subfield", "algebra", "#7a4f2a", [/higher algebra/, /operads?/, /operade/, /operadique/,
    /e_n/, /\be_\\?infty/, /e-infini/, /ring spectra/, /spectres? en anneaux/, /props?\b/, /deformation theory/, /theorie des deformations/,
    /formality/, /formalite/, /maurer-cartan/, /l_?\\?infty/, /l-infini/, /koszul duality/, /dualite de koszul/, /grothendieck-teichm/]),
  T("higher-categories", "Higher categories", "subfield", "category-theory", "#8e4a6b", [/higher categor/, /categories? superieures?/,
    /infinity-categor/, /∞-categor/, /infinies?-categor/, /\(∞,\s*[1n]\)/, /polygraph/, /polygraphe/, /computads?/, /2-categor/,
    /n-categor/, /bicategor/, /double categor/, /enhanced categor/, /derivators?\b/, /derivateurs?\b/, /quasi-categor/, /segal spaces?/]),
  T("k-theory", "K-theory", "subfield", "algebra", "#7a4f2a", [/k-theor/, /k-theorie/, /\bkk-/, /algebraic k-/, /topological k-/, /\bk_0\b/,
    /\bk_1\b/, /assembly map/, /baum-connes/, /trace methods?/]),
  T("representation-theory", "Representation theory", "subfield", "algebra", "#7a4f2a", [/representation theory/,
    /theorie des representations/, /representations? of/, /representations? des?/, /lie groups?/, /groupes? de lie/, /reductive/,
    /reductifs?/, /quantum groups?/, /groupes? quantiques?/, /hecke/, /weyl/, /category o\b/, /categorie o\b/, /springer/,
    /character sheaves/, /affine lie/, /kac-moody/, /cherednik/, /perverse sheaves/, /faisceaux pervers/, /geometric satake/]),
  T("group-theory", "Group theory", "subfield", "algebra", "#7a4f2a", [/group theory/, /theorie des groupes/, /finite groups?/, /groupes? finis/,
    /profinite/, /\bgroups?\b/, /\bgroupes?\b/]),
  T("derived-geometry", "Derived geometry", "subfield", "algebraic-geometry", "#6b5a8e", [/derived (algebraic )?geometr/, /geometrie derivee/,
    /derived stacks?/, /champs derives/, /derived schemes?/, /shifted symplectic/, /symplectique decale/, /derived seminar/,
    /seminaire derive/]),
  T("moduli-spaces", "Moduli spaces", "subfield", "algebraic-geometry", "#6b5a8e", [/moduli/, /espaces? de modules/, /teichmuller/, /hurwitz/,
    /gromov-witten/, /stable curves?/, /courbes? stables?/, /character variet/, /higgs bundles?/, /fibres? de higgs/, /translation surfaces?/,
    /surfaces? de translation/]),
  T("tropical-geometry", "Tropical geometry", "subfield", "algebraic-geometry", "#6b5a8e", [/tropical/, /tropicale/, /berkovich/,
    /non-archimedean/, /non archimedien/]),
  T("arithmetic-geometry", "Arithmetic geometry", "subfield", "number-theory", "#8a3b3b", [/arithmetic geometry/, /geometrie arithmetique/,
    /p-adic hodge/, /hodge p-adique/, /perfectoid/, /period spaces?/, /espaces? de periodes/, /shimura/, /etale cohomology/,
    /cohomologie etale/, /crystalline/, /cristalline/, /prismatic/, /prismatique/]),
  T("operator-algebras", "Operator algebras", "subfield", "analysis", "#3d6b73", [/operator algebras?/, /algebres? d'operateurs/,
    /c\*-algebr/, /c\*-tensor/, /von neumann/, /subfactors?/, /sous-facteurs?/, /\bkk-theor/]),
];

export const TOPICS: Topic[] = [...AREAS, ...SUBFIELDS];
export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Phrases removed before testing a topic, so "operator algebras" is not Algebra, "topological dynamics" not Topology. */
const EXCLUDE: Record<string, RegExp[]> = {
  algebra: [/operator algebras?/g, /c\*-algebras?/g, /von neumann algebras?/g, /banach algebras?/g, /algebres? d'operateurs/g,
    /algebraic (geometry|topology|variet\w*|groups?|curves?|k-theor\w*|number)/g, /geometrie algebrique/g, /topologie algebrique/g,
    /sigma-algebras?/g],
  topology: [/topological (dynamics|insulators?|phases?|matter|entropy|groups?|vector spaces?|recursion|data analysis|field theor\w*|order|materials?|quantum|states?|indices|index|edge)/g,
    /recursion topologique/g, /indices? topologiques?/g, /weak(-\*)? topology/g, /topologie faible/g, /algebraic topology/g,
    /topologie algebrique/g],
  geometry: [/algebraic geometry/g, /geometrie algebrique/g, /arithmetic geometry/g, /geometrie arithmetique/g, /geometric group theory/g,
    /theorie geometrique des groupes/g, /tropical geometry/g, /derived (algebraic )?geometry/g, /information geometry/g,
    /geometric (measure|analysis|representation)/g, /algorithmic geometry/g, /geometrie algorithmique/g],
  "group-theory": [/geometric group theory/g, /theorie geometrique des groupes/g, /quantum groups?/g, /lie groups?/g, /groupes? de lie/g,
    /fundamental groups?/g, /homotopy groups?/g, /mapping class groups?/g, /braid groups?/g, /renormali[sz]ation group/g,
    /groupes? de tresses/g, /groupes? fondamentaux/g, /galois groups?/g, /research groups?/g, /working groups?/g, /groupes? de travail/g,
    /cayley graphs?/g],
  analysis: [/topological data analysis/g, /data analysis/g, /analyse de donnees/g, /numerical analysis/g, /analyse numerique/g,
    /analyse algebrique/g, /algebraic analysis/g],
  combinatorics: [/cayley graphs?/g, /graphes? de cayley/g, /knowledge graphs?/g],
  "mathematical-physics": [/quantum (groups?|loop|affine|cohomology|invariants?|k-theory)/g, /groupes? quantiques?/g,
    /invariants? quantiques?/g],
};

function stripExcluded(topicId: string, text: string): string {
  let t = text;
  for (const ex of EXCLUDE[topicId] ?? []) t = t.replace(ex, " ");
  return t;
}

// Generic words that alone are too weak in abstracts.
const WEAK_IN_ABSTRACT = new Set(["group-theory", "algebra", "geometry", "analysis", "dynamical-systems", "applied", "combinatorics",
  "mathematical-physics", "probability", "differential-geometry"]);

export function classifyText(title: string | null, abstract: string | null): Record<string, Evidence[]> {
  const out: Record<string, Evidence[]> = {};
  const nt = norm(title), na = norm(abstract);
  for (const topic of TOPICS) {
    for (const [field, raw] of [["title", nt], ["abstract", na]] as const) {
      if (!raw) continue;
      const text = stripExcluded(topic.id, raw);
      const hits = topic.keywords.map((p) => text.match(p)?.[0]?.trim()).filter((h): h is string => !!h);
      if (!hits.length) continue;
      const unique = [...new Set(hits)].sort();
      if (field === "abstract" && WEAK_IN_ABSTRACT.has(topic.id) && unique.length < 2) continue;
      if (field === "abstract" && (out[topic.id] ?? []).some((e) => e.field === "title")) continue;
      const f = field === "title" || unique.length >= 2 ? field : "abstract_weak";
      for (const h of unique.slice(0, 3)) (out[topic.id] ??= []).push({ field: f, term: h });
    }
  }
  return out;
}

// ------------------------------------------------------------ series name rules

const SERIES_NAME_RULES: [RegExp, string[]][] = [
  [/topolog/, ["topology"]],
  [/homotop/, ["homotopy-theory"]],
  [/symplecti/, ["symplectic"]],
  [/geometrie algebrique|algebraic geometry|\brega\b/, ["algebraic-geometry"]],
  [/geometrie tropicale|tropical/, ["tropical-geometry"]],
  [/geometri|geometry/, ["geometry"]],
  [/espaces de modules|moduli/, ["moduli-spaces"]],
  [/algebres? d'operateurs|operator algebras/, ["operator-algebras"]],
  [/algebres? enveloppantes/, ["representation-theory"]],
  [/\balgebr/, ["algebra"]],
  [/representation/, ["representation-theory"]],
  [/formes automorphes|automorphic|langlands/, ["number-theory", "representation-theory"]],
  [/groupes|groups/, ["group-theory"]],
  [/theorie des nombres|number theory|arithmet|nombres/, ["number-theory"]],
  [/logique|logic|theorie des modeles|model theory|realisabilite|types\b/, ["logic"]],
  [/categor|polygraph|topos/, ["category-theory"]],
  [/categories superieures|higher categor/, ["higher-categories"]],
  [/probabilit|matrices et graphes aleatoires/, ["probability"]],
  [/statisti/, ["probability", "applied"]],
  [/systemes dynamiques|dynamical|dynamique/, ["dynamical-systems"]],
  [/combinatoire|combinator|graphes/, ["combinatorics"]],
  [/physique mathematique|mathematical physics|physique theorique|theoretical physics|rencontres theoriciennes/, ["mathematical-physics"]],
  [/\bedp\b|\bpde\b|equations aux derivees|kinetic|cinetique|calcul des variations/, ["pde"]],
  [/analyse|analysis/, ["analysis"]],
  [/singularit/, ["algebraic-geometry"]],
  [/k-theor/, ["k-theory"]],
  [/derived|derive\b|seminaire derive/, ["derived-geometry"]],
  [/histoire|history/, ["history"]],
  [/optimi|imag|donnees|data|intelligence artificielle|\bia\b|\bai\b|apprentissage|financ|crypto|jeux|bachelier|fime|simulation|cast3m|biolog|numerique|calcul scientifique/, ["applied"]],
  [/datashape|topological data/, ["tda"]],
  [/colloqui|des mathematiques|bourbaki|nos mathematiques|raconte-moi|mathematic park/, ["general"]],
  [/hamiltonien/, ["symplectic", "dynamical-systems"]],
];

export function topicsFromSeriesName(name: string | null | undefined): string[] {
  const n = norm(name);
  const got: string[] = [];
  if (!n) return got;
  for (const [pat, ids] of SERIES_NAME_RULES) {
    for (const id of ids) {
      if (!got.includes(id) && pat.test(stripExcluded(id, n))) got.push(id);
    }
  }
  return got;
}

export function withParents(ids: string[]): string[] {
  const out = [...ids];
  for (const id of ids) {
    const p = TOPIC_BY_ID[id]?.parent;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

// ------------------------------------------------------------ event types

const EVENT_TYPE_RULES: [RegExp, string][] = [
  [/soutenance de these|thesis defen[cs]e|\bthese\b|soutenance|\bphd defen/, "thesis_defense"],
  [/soutenance d'habilitation|\bhdr\b/, "thesis_defense"],
  [/colloqui/, "colloquium"],
  [/\bschool\b|ecole d'ete|summer school|winter school|\becole\b/, "school"],
  [/workshop|atelier/, "workshop"],
  [/conference|congres|symposium|\bmeeting\b|rencontre|journees?\b|\bday\b|\bdays\b|fest\b|in honou?r/, "conference"],
  [/mini-?cours|minicourse|mini-course|\bcours\b|lectures?\b|lecture series|course/, "course"],
  [/groupe de travail|\bgdt\b|\bgt\b|working group|reading group|groupe de lecture|lecture group/, "working_group"],
  [/doctorant|thesards|non-permanent|jeunes chercheurs|junior|students?\b|etudiants|phd seminar|\brega\b/, "doctoral_seminar"],
  [/programme thematique|thematic (program|trimester)|trimestre|\bt[123]-20\d\d/, "program"],
  [/vernissage|exposition|grand public|tout public|fete de la science|mathematic park/, "outreach"],
  [/formation|training|user & training/, "training"],
];

export const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: "Seminar", working_group: "Working / reading group", colloquium: "Colloquium", conference: "Conference",
  workshop: "Workshop", school: "School", course: "Course / mini-course", doctoral_seminar: "Doctoral / junior seminar",
  thesis_defense: "Thesis defence", program: "Research programme", outreach: "Outreach", training: "Training", other: "Other",
};

export function detectEventType(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const n = norm(t);
    if (!n) continue;
    for (const [pat, type] of EVENT_TYPE_RULES) if (pat.test(n)) return type;
  }
  return null;
}

export type { EventTopic };
