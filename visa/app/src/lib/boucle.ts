import type { ResultatAffirmation, Statut } from "./types";

/**
 * La boucle juge → correction : Visa vérifie, l'IA qui a écrit le mémo corrige les passages signalés,
 * Visa revérifie. Sans appel réseau ici : le rédacteur et le vérificateur sont passés en paramètre.
 *
 * Garde-fou : une correction n'est gardée que si la revérification la met en vert ou en orange
 * (ou si l'IA supprime le passage). Sinon le passage précédent reste, toujours signalé.
 */

/** Un passage signalé, avec la preuve envoyée à l'IA. */
export interface Probleme {
  id: string;
  passage: string;
  statut: Statut;
  message: string;
  preuves: {
    source: string;
    officiel: string | null;
    /** « en vigueur du 01/05/2008 au 24/09/2017 » */
    version: string | null;
    /** Extrait retrouvé mot pour mot dans le texte officiel. */
    extrait: string | null;
    /** Début du texte applicable à la date des faits, pour que l'IA corrige sur pièce. */
    texte: string | null;
  }[];
  /** La correction du tour précédent, rejetée par la revérification. */
  rejet?: { propose: string; raison: string };
}

export interface Tentative {
  id: string;
  avant: string;
  /** "" : l'IA supprime le passage. */
  propose: string;
  /** La revérification du passage proposé ; null s'il est supprimé. */
  resultat: ResultatAffirmation | null;
  retenue: boolean;
  raison: string;
}

export interface Tour {
  /** Le tour 1 produit la version 2. */
  numero: number;
  signales: Probleme[];
  tentatives: Tentative[];
}

export interface Version {
  numero: number;
  texte: string;
  /** Mêmes identifiants qu'en version 1 ; un passage supprimé n'y figure plus. */
  resultats: ResultatAffirmation[];
  synthese: Record<Statut, number>;
  /** Passages supprimés depuis la version 1. */
  supprimes: string[];
}

export interface Boucle {
  versions: Version[];
  tours: Tour[];
  arret: string;
}

export interface Correcteur {
  /** L'IA qui a écrit le mémo : le passage réécrit pour chaque identifiant qu'elle corrige. */
  corriger(texte: string, problemes: Probleme[]): Promise<Record<string, string>>;
  /** Revérifie un passage réécrit, sous le même identifiant. */
  reverifier(id: string, passage: string): Promise<ResultatAffirmation>;
}

export function compter(resultats: ResultatAffirmation[]): Record<Statut, number> {
  const s: Record<Statut, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
  for (const r of resultats) s[r.statut]++;
  return s;
}

function dateCourte(iso: string | null): string {
  if (!iso) return "?";
  const [a, m, j] = iso.split("-");
  return j ? `${j}/${m}/${a}` : iso;
}

/** Les passages orange ou rouges, chacun avec sa preuve : statut, message, extrait vérifié, version applicable. */
export function problemes(resultats: ResultatAffirmation[], rejets: Map<string, Probleme["rejet"]> = new Map()): Probleme[] {
  return resultats
    .filter((r) => r.statut === "rouge" || r.statut === "orange")
    .map((r) => ({
      id: r.affirmation.id,
      passage: r.affirmation.passage,
      statut: r.statut,
      message: r.message,
      preuves: r.verifications.map((v) => {
        const va = v.versionApplicable;
        const texte = va?.texte || v.officielle?.texte || null;
        return {
          source: v.citee.brut,
          officiel: v.officielle ? `${v.officielle.titre} (${v.officielle.base})` : null,
          version: va ? (va.fin ? `en vigueur du ${dateCourte(va.debut)} au ${dateCourte(va.fin)}` : `en vigueur depuis le ${dateCourte(va.debut)}`) : null,
          extrait: v.jugement?.extraitRetrouve ? v.jugement.extrait : null,
          texte: texte ? texte.slice(0, 3000) : null,
        };
      }),
      ...(rejets.get(r.affirmation.id) ? { rejet: rejets.get(r.affirmation.id) } : {}),
    }));
}

/** Remplace un passage dans le texte ; supprimé, on retire aussi l'espace qui le précède. */
export function remplacerPassage(texte: string, avant: string, apres: string): string | null {
  const i = texte.indexOf(avant);
  if (!avant || i < 0) return null;
  if (apres) return texte.slice(0, i) + apres + texte.slice(i + avant.length);
  const debut = i > 0 && texte[i - 1] === " " ? i - 1 : i;
  return texte.slice(0, debut) + texte.slice(i + avant.length);
}

const LIBELLE: Record<Statut, string> = { vert: "vérifié", orange: "à revoir", rouge: "faux", gris: "non vérifiable" };

export async function boucler(
  v1: { texte: string; resultats: ResultatAffirmation[] },
  correcteur: Correcteur,
  options: { toursMax?: number; apresTour?: (b: Boucle) => void } = {},
): Promise<Boucle> {
  const toursMax = options.toursMax ?? 2;
  const b: Boucle = {
    versions: [{ numero: 1, texte: v1.texte, resultats: v1.resultats, synthese: compter(v1.resultats), supprimes: [] }],
    tours: [],
    arret: "",
  };
  const rejets = new Map<string, Probleme["rejet"]>();

  for (;;) {
    const courante = b.versions[b.versions.length - 1];
    if (courante.synthese.rouge === 0) {
      b.arret = courante.numero === 1 ? "Aucune affirmation fausse : pas de correction demandée." : "Plus aucune affirmation fausse.";
      break;
    }
    if (b.tours.length >= toursMax) {
      b.arret = `${toursMax} tours de correction : il reste ${courante.synthese.rouge} affirmation(s) fausse(s), à corriger à la main.`;
      break;
    }

    const signales = problemes(courante.resultats, rejets);
    const parId = new Map(courante.resultats.map((r) => [r.affirmation.id, r]));
    let propositions: Record<string, string> = {};
    try {
      propositions = await correcteur.corriger(courante.texte, signales);
    } catch (e) {
      b.arret = `L'IA n'a pas pu corriger (${e instanceof Error ? e.message : String(e)}).`;
      break;
    }

    const tour: Tour = { numero: b.tours.length + 1, signales, tentatives: [] };
    let texte = courante.texte;
    const resultats = new Map(parId);
    const supprimes = [...courante.supprimes];
    rejets.clear();
    // Seuls les passages signalés peuvent changer : le reste est gardé mot pour mot.
    const changes = signales
      .map((p) => ({ p, nouveau: typeof propositions[p.id] === "string" ? propositions[p.id].trim() : null }))
      .filter((c): c is { p: Probleme; nouveau: string } => c.nouveau !== null && c.nouveau !== c.p.passage.trim());
    // Deux revérifications à la fois : au-delà, l'API du modèle refuse les appels.
    const verifies: (ResultatAffirmation | Error | null)[] = new Array(changes.length).fill(null);
    let suivant = 0;
    await Promise.all(
      Array.from({ length: Math.min(2, changes.length) }, async () => {
        while (suivant < changes.length) {
          const k = suivant++;
          const { p, nouveau } = changes[k];
          if (!nouveau) continue;
          verifies[k] = await correcteur.reverifier(p.id, nouveau).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
        }
      }),
    );
    for (const [k, { p, nouveau }] of changes.entries()) {
      if (!nouveau) {
        const t = remplacerPassage(texte, p.passage, "");
        if (t === null) continue;
        texte = t;
        resultats.delete(p.id);
        supprimes.push(p.id);
        tour.tentatives.push({ id: p.id, avant: p.passage, propose: "", resultat: null, retenue: true, raison: "passage supprimé par l'IA" });
        continue;
      }
      const verifie = verifies[k];
      if (!verifie) continue;
      if (verifie instanceof Error) {
        const raison = `revérification impossible (${verifie.message}) : correction écartée`;
        rejets.set(p.id, { propose: nouveau, raison });
        tour.tentatives.push({ id: p.id, avant: p.passage, propose: nouveau, resultat: null, retenue: false, raison });
        continue;
      }
      const retenue = verifie.statut === "vert" || verifie.statut === "orange";
      const raison = retenue
        ? `revérifié : ${LIBELLE[verifie.statut]}`
        : `rejetée, revérifiée ${LIBELLE[verifie.statut]} : ${verifie.message}`;
      if (retenue) {
        const t = remplacerPassage(texte, p.passage, nouveau);
        if (t === null) continue;
        texte = t;
        resultats.set(p.id, verifie);
      } else {
        rejets.set(p.id, { propose: nouveau, raison: verifie.message });
      }
      tour.tentatives.push({ id: p.id, avant: p.passage, propose: nouveau, resultat: verifie, retenue, raison });
    }
    b.tours.push(tour);
    if (tour.tentatives.length === 0) {
      b.arret = "L'IA n'a proposé aucune correction.";
      options.apresTour?.(b);
      break;
    }
    // Rien de gardé : pas de nouvelle version, mais l'IA retente au tour suivant avec la raison du rejet.
    if (tour.tentatives.some((t) => t.retenue)) {
      const liste = [...resultats.values()];
      b.versions.push({ numero: courante.numero + 1, texte, resultats: liste, synthese: compter(liste), supprimes });
    }
    options.apresTour?.(b);
  }
  return b;
}

/* ───────────── Le mémo final en mode révision : différences entre la version 1 et la dernière ───────────── */

export interface Difference {
  id: string;
  debut: number;
  avant: string;
  /** null : passage supprimé. */
  apres: string | null;
  /** La vérification du passage final ; null s'il est supprimé. */
  resultat: ResultatAffirmation | null;
  /** Le tour où la correction a été gardée ; null si le passage n'a pas changé mais reste signalé. */
  tour: number | null;
  note: number;
}

export type Segment = { texte: string } | { difference: Difference };

/** Le texte de la version 1, découpé autour de ce qui a changé ou reste signalé dans la dernière version. */
export function revision(b: Boucle): { segments: Segment[]; differences: Difference[] } {
  const v1 = b.versions[0];
  const finale = b.versions[b.versions.length - 1];
  const final = new Map(finale.resultats.map((r) => [r.affirmation.id, r]));
  const tourDe = new Map<string, number>();
  for (const t of b.tours) for (const x of t.tentatives) if (x.retenue) tourDe.set(x.id, t.numero);

  const zones = v1.resultats
    .map((r) => {
      const id = r.affirmation.id;
      const f = final.get(id) ?? null;
      const supprime = finale.supprimes.includes(id);
      const change = supprime || (f !== null && f.affirmation.passage !== r.affirmation.passage);
      const signale = f !== null && (f.statut === "rouge" || f.statut === "orange");
      if (!change && !signale) return null;
      return {
        id,
        debut: v1.texte.indexOf(r.affirmation.passage),
        avant: r.affirmation.passage,
        apres: supprime ? null : (f?.affirmation.passage ?? r.affirmation.passage),
        resultat: supprime ? null : f,
        tour: change ? (tourDe.get(id) ?? null) : null,
      };
    })
    .filter((z): z is Omit<Difference, "note"> => z !== null && z.debut >= 0)
    .sort((a, c) => a.debut - c.debut);

  const segments: Segment[] = [];
  const differences: Difference[] = [];
  let curseur = 0;
  for (const z of zones) {
    if (z.debut < curseur) continue;
    const d: Difference = { ...z, note: differences.length + 1 };
    if (z.debut > curseur) segments.push({ texte: v1.texte.slice(curseur, z.debut) });
    segments.push({ difference: d });
    differences.push(d);
    curseur = z.debut + z.avant.length;
  }
  if (curseur < v1.texte.length) segments.push({ texte: v1.texte.slice(curseur) });
  return { segments, differences };
}

/** La preuve d'un passage final : la première source retrouvée, sa version et l'extrait vérifié. */
export function preuve(r: ResultatAffirmation | null): string {
  if (!r) return "";
  const v = r.verifications.find((x) => x.officielle && x.jugement?.extraitRetrouve) ?? r.verifications.find((x) => x.officielle);
  if (!v?.officielle) return r.message;
  const va = v.versionApplicable;
  const version = va ? (va.fin ? `, version en vigueur du ${dateCourte(va.debut)} au ${dateCourte(va.fin)}` : `, version en vigueur depuis le ${dateCourte(va.debut)}`) : "";
  const extrait = v.jugement?.extraitRetrouve ? ` : « ${v.jugement.extrait} »` : "";
  return `${v.officielle.titre} (${v.officielle.base}${version})${extrait}`;
}

/** Le mémo final à copier : la dernière version, puis une note par passage corrigé ou encore signalé. */
export function memoFinalEnTexte(b: Boucle): string {
  const finale = b.versions[b.versions.length - 1];
  const { differences } = revision(b);
  if (differences.length === 0) return finale.texte;
  const notes = differences.map((d) => {
    const etat =
      d.apres === null
        ? `supprimé par l'IA (tour ${d.tour})`
        : d.tour !== null
          ? `corrigé par l'IA (tour ${d.tour}), revérifié : ${LIBELLE[d.resultat!.statut]}`
          : `${LIBELLE[d.resultat!.statut]}, non corrigé : ${d.resultat!.message}`;
    const p = d.apres !== null && d.tour !== null ? ` — ${preuve(d.resultat)}` : "";
    return `[${d.note}] ${d.id} · ${etat}${p}`;
  });
  return `${finale.texte}\n\nVérification Visa — à valider par l'avocat :\n${notes.join("\n")}`;
}
