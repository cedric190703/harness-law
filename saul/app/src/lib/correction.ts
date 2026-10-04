import type { NoteSource, Reecriture, ResultatAffirmation, VerificationSource } from "./types";
import { contientVerbatim, normaliser } from "./verbatim";

/**
 * Saul propose la correction, sans jamais inventer. Règles sans appel au modèle,
 * partagées par l'app (le rédacteur, l'affichage) et par le skill « carte des sources » :
 * - une proposition n'est retenue que si son extrait est retrouvé mot pour mot dans le texte officiel ;
 * - elle ne peut citer que des sources déjà retrouvées et vérifiées ;
 * - décision introuvable, ou qui ne dit pas cela : on retire la référence (« source à trouver »), jamais une autre à la place ;
 * - circulaire : on s'appuie sur un texte de rang supérieur seulement s'il est déjà cité et vérifié dans le mémo.
 */

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 2016-03-15 » → « 15 mars 2016 » */
export function dateLongue(iso: string): string {
  const [a, m, j] = iso.split("-");
  if (!j) return iso;
  const jour = Number(j);
  return `${jour === 1 ? "1er" : jour} ${MOIS[Number(m) - 1]} ${a}`;
}

function dateCourte(iso: string | null): string {
  if (!iso) return "?";
  const [a, m, j] = iso.split("-");
  return j ? `${j}/${m}/${a}` : iso;
}

/** Un texte officiel sur lequel le rédacteur peut s'appuyer. */
export interface Candidat {
  /** « A4-1 » : affirmation A4, première source citée (même numérotation que le skill). */
  cle: string;
  /** La référence telle que l'IA l'avait écrite. */
  brut: string;
  citation: string;
  note: Omit<NoteSource, "extrait">;
  /** Le texte applicable à la date des faits. */
  texte: string;
}

export interface PlanRedaction {
  cas: "rediger";
  /** « propre » : les sources de l'affirmation ; « rang_superieur » : textes vérifiés cités ailleurs dans le mémo. */
  appui: "propre" | "rang_superieur";
  candidats: Candidat[];
  /** Références de l'affirmation qui ne doivent pas rester dans la proposition (introuvables, non vérifiées). */
  interdits: string[];
  /** Ce qu'on affiche si aucune proposition n'est retenue. */
  repli: Reecriture;
}

export type Plan = PlanRedaction | { cas: "fixe"; reecriture: Reecriture };

/** Ce que rend le rédacteur (Mistral dans l'app, l'agent dans le skill). Rien n'y est cru sur parole. */
export interface PropositionBrute {
  possible?: boolean;
  source?: string;
  passage?: string;
  extrait?: string;
  explication?: string;
}

function estCirculaire(v: VerificationSource): boolean {
  return v.citee.type === "circulaire" || v.officielle?.rang === 6;
}

function estIntrouvable(v: VerificationSource): boolean {
  return !v.officielle && v.controles.some((c) => c.nom === "existe" && c.statut === "rouge");
}

/** Le texte officiel applicable à la date des faits, s'il existe et peut fonder une réécriture. */
function texteUtilisable(v: VerificationSource): string | null {
  const o = v.officielle;
  if (!o || estCirculaire(v)) return null;
  if (v.controles.some((c) => c.nom === "date" && c.statut === "rouge")) return null;
  if (o.versions.length > 0 && !v.versionApplicable) return null;
  return v.versionApplicable?.texte || o.texte || null;
}

/** La référence à écrire : la version applicable si le texte a changé, la vraie date d'une décision mal datée. */
export function citation(v: VerificationSource, dateFaits: string): string {
  const o = v.officielle;
  const brut = v.citee.brut.trim();
  if (!o) return brut;
  if (v.citee.type === "decision" && o.date && v.citee.date && v.citee.date !== o.date && v.citee.numero_affaire) {
    return `${v.citee.juridiction ?? "Décision"}, ${dateLongue(o.date)}, n° ${v.citee.numero_affaire}`;
  }
  const courante = o.versions[o.versions.length - 1];
  if (v.versionApplicable && courante && v.versionApplicable.texte !== courante.texte) {
    return `${brut}, dans sa rédaction en vigueur au ${dateLongue(dateFaits)}`;
  }
  return brut;
}

function candidat(cle: string, v: VerificationSource, texte: string, dateFaits: string): Candidat {
  const o = v.officielle!;
  const va = v.versionApplicable;
  return {
    cle,
    brut: v.citee.brut.trim(),
    citation: citation(v, dateFaits),
    note: {
      citation: citation(v, dateFaits),
      titre: o.titre,
      base: o.base,
      url: o.url,
      version: va
        ? va.fin
          ? `en vigueur du ${dateCourte(va.debut)} au ${dateCourte(va.fin)}`
          : `en vigueur depuis le ${dateCourte(va.debut)}`
        : null,
    },
    texte,
  };
}

/**
 * Retire les références du passage. Entre parenthèses, elles deviennent « [source à trouver] » ;
 * dans le corps de la phrase, la phrase ne tient que par elles : "" (passage à supprimer).
 * null si l'une d'elles n'y figure pas telle quelle.
 */
export function retirerReferences(passage: string, bruts: string[]): string | null {
  let t = passage;
  for (const b of bruts) {
    const i = t.toLowerCase().indexOf(b.trim().toLowerCase());
    if (!b.trim() || i < 0) return null;
    const fin = i + b.trim().length;
    if (t[i - 1] !== "(" || t[fin] !== ")") return "";
    t = `${t.slice(0, i - 1)}[source à trouver]${t.slice(fin + 1)}`;
  }
  return t;
}

/**
 * La référence exacte dans le passage proposé : la version applicable, la vraie date d'une décision.
 * Le modèle l'oublie parfois ; on remplace la référence d'origine, ou on l'ajoute à la fin.
 */
export function assurerCitation(passage: string, c: Pick<Candidat, "brut" | "citation">): string {
  if (normaliser(passage).includes(normaliser(c.citation))) return passage;
  const i = passage.toLowerCase().indexOf(c.brut.toLowerCase());
  if (c.brut && i >= 0) return `${passage.slice(0, i)}${c.citation}${passage.slice(i + c.brut.length)}`;
  return /[.!?]$/.test(passage) ? `${passage.slice(0, -1)} (${c.citation}).` : `${passage} (${c.citation})`;
}

/** Les références juridiques d'un texte, normalisées : articles, numéros de pourvoi, numéros de texte. */
export function references(t: string): string[] {
  const refs = new Set<string>();
  for (const m of t.matchAll(/\b([LRDA])\s?\.?\s?(\d+(?:-\d+)+)\b/g)) refs.add(`${m[1]}${m[2]}`);
  for (const m of t.matchAll(/\bart(?:icle)?s?\.?\s+(\d+(?:-\d+)*)\b/gi)) refs.add(`ART${m[1]}`);
  for (const m of t.matchAll(/\b(\d{2}-\d{2}\.\d{3})\b/g)) refs.add(`POURVOI${m[1]}`);
  for (const m of t.matchAll(/\bn[°o]\s*(\d{2,4}-\d{1,5})(?![.\d])/gi)) refs.add(`NUM${m[1]}`);
  return [...refs];
}

/** Décide, sans modèle, ce qu'on peut proposer pour une affirmation ; null si elle n'est ni orange ni rouge. */
export function planifier(r: ResultatAffirmation, tous: ResultatAffirmation[], dateFaits: string): Plan | null {
  if (r.statut !== "orange" && r.statut !== "rouge") return null;
  const id = r.affirmation.id;
  const passage = r.affirmation.passage;

  const propres: Candidat[] = [];
  const interdits: string[] = [];
  r.verifications.forEach((v, j) => {
    const texte = texteUtilisable(v);
    if (texte) propres.push(candidat(`${id}-${j + 1}`, v, texte, dateFaits));
    else interdits.push(v.citee.brut);
  });

  // Les références à retirer : introuvables, ou décisions qui ne disent pas ce qu'on leur fait dire.
  const aRetirer = r.verifications.filter(
    (v) =>
      estIntrouvable(v) ||
      (v.citee.type === "decision" && v.controles.some((c) => c.nom === "contenu" && c.statut === "rouge")),
  );
  let repli: Reecriture = {
    type: "a_la_main",
    propose: null,
    source: null,
    motif: "À réécrire à la main.",
  };
  if (aRetirer.length > 0) {
    const sansReference = retirerReferences(
      passage,
      aRetirer.map((v) => v.citee.brut),
    );
    const pourquoi = aRetirer
      .map((v) => `« ${v.citee.brut} » ${estIntrouvable(v) ? "introuvable dans les bases officielles" : "ne dit pas cela"}`)
      .join(" ; ");
    repli =
      sansReference === null
        ? {
            type: "a_la_main",
            propose: null,
            source: null,
            motif: `${pourquoi} : supprimer la référence ou la remplacer par une source vérifiée.`,
          }
        : sansReference === ""
          ? {
              type: "supprimer",
              propose: "",
              source: null,
              motif: `${pourquoi}, et le passage ne tient que par cette référence : à supprimer, ou à réécrire sur une source vérifiée.`,
            }
          : {
              type: "source_a_trouver",
              propose: sansReference,
              source: null,
              motif: `${pourquoi} : référence retirée. Ne pas plaider ce passage sans une source vérifiée.`,
            };
  }

  if (propres.length > 0) return { cas: "rediger", appui: "propre", candidats: propres, interdits, repli };
  if (aRetirer.length > 0) return { cas: "fixe", reecriture: repli };

  if (r.verifications.some(estCirculaire)) {
    const rangSuperieur: Candidat[] = [];
    const vus = new Set<string>();
    for (const autre of tous) {
      if (autre.affirmation.id === id) continue;
      autre.verifications.forEach((v, j) => {
        const o = v.officielle;
        const texte = texteUtilisable(v);
        if (!o || !texte || v.statut !== "vert" || o.rang < 1 || o.rang > 5) return;
        const cle = `${o.base}:${o.id}`;
        if (vus.has(cle)) return;
        vus.add(cle);
        rangSuperieur.push(candidat(`${autre.affirmation.id}-${j + 1}`, v, texte, dateFaits));
      });
    }
    const aAppuyer: Reecriture = {
      type: "rang_superieur",
      propose: null,
      source: null,
      motif: "Une circulaire ne lie pas le juge : à appuyer sur un texte de rang supérieur.",
    };
    if (rangSuperieur.length === 0) {
      return {
        cas: "fixe",
        reecriture: {
          ...aAppuyer,
          motif: `Aucun texte de rang supérieur n'est cité et vérifié dans le mémo. ${aAppuyer.motif}`,
        },
      };
    }
    return { cas: "rediger", appui: "rang_superieur", candidats: rangSuperieur, interdits, repli: aAppuyer };
  }

  const pasEnVigueur = r.verifications.some((v) => v.controles.some((c) => c.nom === "date" && c.statut === "rouge"));
  return {
    cas: "fixe",
    reecriture: {
      ...repli,
      motif: pasEnVigueur
        ? "Le texte cité n'était pas en vigueur à la date des faits : à réécrire à la main sur le texte applicable."
        : "Pas de texte officiel exploitable : à réécrire à la main.",
    },
  };
}

/** Le garde-fou : une proposition n'est retenue que si tout ce qu'elle cite est vérifié. */
export function retenirProposition(plan: PlanRedaction, original: string, p: PropositionBrute | null): Reecriture {
  const refus = (raison: string): Reecriture => ({ ...plan.repli, motif: `${raison} ${plan.repli.motif}` });
  let passage = p?.passage?.trim() ?? "";
  // Le modèle recopie parfois les guillemets qui entourent le passage dans sa consigne.
  if (/^[«"“]/.test(passage) && !/^[«"“]/.test(original.trim())) {
    passage = passage.replace(/^[«"“]\s*/, "").replace(/\s*[»"”]$/, "");
  }
  if (!p || p.possible === false || !passage) {
    return refus(
      plan.appui === "rang_superieur"
        ? "Aucun des textes de rang supérieur vérifiés dans le mémo ne fonde ce passage."
        : "Le rédacteur n'a pas trouvé de formulation sûre dans le texte officiel.",
    );
  }
  const choisi =
    plan.candidats.find((c) => c.cle === p.source?.trim()) ?? (plan.candidats.length === 1 ? plan.candidats[0] : null);
  if (!choisi) return refus(`Source « ${p.source ?? ""} » inconnue : proposition écartée.`);
  if (!p.extrait || !contientVerbatim(choisi.texte, p.extrait)) {
    return refus("Extrait non retrouvé mot pour mot dans le texte officiel : proposition écartée.");
  }
  const autorisees = new Set(plan.candidats.flatMap((c) => references(`${c.citation} ${c.note.titre}`)));
  const etrangeres = references(passage).filter((x) => !autorisees.has(x));
  if (etrangeres.length > 0) {
    return refus(`La proposition cite une référence non vérifiée (${etrangeres.join(", ")}) : écartée.`);
  }
  const gardee = plan.interdits.find((b) => normaliser(b).length >= 8 && normaliser(passage).includes(normaliser(b)));
  if (gardee) return refus(`La proposition garde une référence non vérifiée (« ${gardee} ») : écartée.`);
  if (normaliser(passage) === normaliser(original)) return refus("Le rédacteur n'a rien changé au passage.");
  return {
    type: "remplacer",
    propose: assurerCitation(passage, choisi),
    source: { ...choisi.note, extrait: p.extrait.trim() },
    motif: p.explication?.trim() || "Réécrit sur le texte officiel applicable à la date des faits.",
  };
}

/* ───────────── Mode révision ───────────── */

export const MENTION: Record<Reecriture["type"], string> = {
  remplacer: "rewritten",
  source_a_trouver: "source to find",
  supprimer: "passage to delete",
  rang_superieur: "to support with a higher-ranking text",
  a_la_main: "to rewrite by hand",
};

/** Le passage avant / après, réduit à ce qui change (mot à mot, au début et à la fin). */
export function diffMots(
  avant: string,
  apres: string,
): { prefixe: string; retire: string; ajoute: string; suffixe: string } {
  const a = avant.split(/(\s+)/);
  const b = apres.split(/(\s+)/);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return {
    prefixe: a.slice(0, p).join(""),
    retire: a.slice(p, a.length - s).join(""),
    ajoute: b.slice(p, b.length - s).join(""),
    suffixe: a.slice(a.length - s).join(""),
  };
}

/* ───────────── Le résumé pour l'avocat ───────────── */

export interface Point {
  id: string;
  motif: string;
  resume: string;
}

/** Du plus grave au moins grave : la source n'existe pas, elle dit autre chose, elle n'était pas en vigueur… */
const GRAVITE: { nom: string; statut: string; motif: (message: string) => string }[] = [
  { nom: "existe", statut: "rouge", motif: () => "source introuvable" },
  { nom: "contenu", statut: "rouge", motif: () => "la source ne dit pas cela" },
  { nom: "date", statut: "rouge", motif: () => "texte pas en vigueur à la date des faits" },
  { nom: "contenu", statut: "orange", motif: () => "la source ne dit cela qu'en partie" },
  {
    nom: "date",
    statut: "orange",
    motif: (m) => (m.startsWith("Date citée") ? "date de la décision erronée" : "texte modifié depuis les faits"),
  },
  { nom: "rang", statut: "orange", motif: () => "circulaire : ne lie pas le juge" },
];

function gravite(r: ResultatAffirmation): { rang: number; motif: string } {
  const controles = r.verifications.flatMap((v) => v.controles);
  for (const [rang, g] of GRAVITE.entries()) {
    const c = controles.find((x) => x.nom === g.nom && x.statut === g.statut);
    if (c) return { rang, motif: g.motif(c.message) };
  }
  return { rang: GRAVITE.length, motif: r.message };
}

const numero = (id: string) => Number(id.replace(/\D/g, "")) || 0;

export function resumePourAvocat(resultats: ResultatAffirmation[]): {
  aCorriger: Point[];
  aRelire: Point[];
  verifies: number;
  nonVerifiables: number;
} {
  const point = (r: ResultatAffirmation): Point => ({
    id: r.affirmation.id,
    motif: gravite(r).motif,
    resume: r.affirmation.resume,
  });
  const ordre = (a: ResultatAffirmation, b: ResultatAffirmation) => numero(a.affirmation.id) - numero(b.affirmation.id);
  return {
    aCorriger: resultats
      .filter((r) => r.statut === "rouge")
      .sort((a, b) => gravite(a).rang - gravite(b).rang || ordre(a, b))
      .map(point),
    aRelire: resultats
      .filter((r) => r.statut === "orange")
      .sort(ordre)
      .map(point),
    verifies: resultats.filter((r) => r.statut === "vert").length,
    nonVerifiables: resultats.filter((r) => r.statut === "gris").length,
  };
}
