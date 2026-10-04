// Le fil du raisonnement : comment Visa est passé d'une phrase à un verdict.
//
// Rien n'est écrit à la main ici. Chaque pas est *dérivé* des données du
// dossier — la citation, la source retrouvée, les quatre contrôles, la
// contradiction. Le fil ne peut donc jamais raconter autre chose que ce que le
// rapport conclut : c'est la même matière, montrée dans l'ordre où elle a été
// établie.

import { CODES } from "./piste";
import { CONTROLES, formaterDate } from "./etapes";
import type { Affirmation, Verdict } from "../types";

export type GenreDePas =
  | "affirmation"
  | "reference"
  | "requete"
  | "source"
  | "controle"
  | "contradiction"
  | "conclusion";

export type PasRaisonnement = {
  id: string;
  /** Son numéro, affiché sur la carte. */
  ordre: number;
  genre: GenreDePas;
  titre: string;
  /** Ce que Visa a fait à ce pas. */
  action: string;
  /** Ce qu'il a constaté. Un extrait est toujours copié, jamais reformulé. */
  constat: string | null;
  /** Ce qu'il en déduit. */
  deduction: string | null;
  verdict: Verdict | null;
  outil: string | null;
  /** La requête exacte envoyée à la base, quand il y en a une. */
  requete: string | null;
  /** Le rang du contrôle, de 1 à 4. Les autres pas n'en ont pas. */
  numeroControle: number | null;
};

/** « L. 1235-3 » → le numéro tel que l'attend Légifrance : « L1235-3 ». */
function numeroArticle(citation: string): string | null {
  const m = citation.match(/\b([LRDA])\.?\s*(\d+[\d-]*)/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** Le code visé par la citation, s'il est connu de Visa. */
function codeVise(citation: string): { nom: string; id: string } | null {
  const bas = citation.toLowerCase();
  for (const [nom, id] of Object.entries(CODES)) {
    if (bas.includes(nom)) return { nom, id };
  }
  return null;
}

/** « n° 00-45.135 » → le numéro de pourvoi. */
function numeroPourvoi(citation: string): string | null {
  return citation.match(/\b\d{2}-\d{2}\.\d{3}\b/)?.[0] ?? null;
}

/** Le pire verdict, dans l'ordre de sévérité. C'est lui qui conclut. */
function pire(verdicts: Verdict[]): Verdict {
  const ordre: Verdict[] = ["rouge", "orange", "gris", "vert"];
  return ordre.find((v) => verdicts.includes(v)) ?? "gris";
}

/**
 * Ce que le juriste doit faire de cette ligne. C'est la vraie conclusion : un
 * verdict qui ne dit pas quoi faire ne sert à rien.
 */
export function quoiFaire(a: Affirmation): string {
  const existe = a.controles.find((c) => c.id === "existence")!.verdict;
  const vigueur = a.controles.find((c) => c.id === "vigueur")!.verdict;
  const rang = a.controles.find((c) => c.id === "rang")!.verdict;
  const portee = a.controles.find((c) => c.id === "portee")!.verdict;

  if (existe === "rouge") return "Retirer la référence. Elle n'existe pas : la citer engage votre responsabilité.";
  if (existe === "gris") return "Citer une source, ou retirer l'affirmation. En l'état, elle n'est pas défendable.";
  if (portee === "rouge" && vigueur === "rouge")
    return "Retirer le visa et refonder l'affirmation : le texte est abrogé et ne dit pas cela.";
  if (vigueur === "rouge") return "Remplacer par le texte en vigueur au jour des faits.";
  if (portee === "rouge") return "Retirer cette référence : le texte officiel ne soutient pas l'affirmation, voire la contredit.";
  if (vigueur === "orange") return "Corriger la version citée, ou présenter la source comme une évolution postérieure aux faits.";
  if (rang === "orange") return "Ne pas présenter cette source comme obligatoire. L'appuyer sur un texte de rang supérieur.";
  if (portee === "orange") return "Resserrer la formulation sur ce que le texte dit réellement.";
  return "Peut être déposée en l'état. Source vérifiée, applicable aux faits, et elle dit bien cela.";
}

/** Le fil complet, dans l'ordre où Visa a procédé. */
export function construireRaisonnement(a: Affirmation, dateDesFaits: string): PasRaisonnement[] {
  const pas: PasRaisonnement[] = [];
  const ajouter = (p: Omit<PasRaisonnement, "ordre" | "numeroControle"> & { numeroControle?: number }) => {
    pas.push({ numeroControle: null, ...p, ordre: pas.length + 1 });
  };
  const s = a.source;
  const estDecision = s ? s.rang === "jurisprudence" || s.base === "introuvable" : false;

  ajouter({
    id: "pas-affirmation",
    genre: "affirmation",
    titre: "L'affirmation",
    action: "Visa lit la phrase telle qu'elle est écrite, sans la réécrire.",
    constat: a.phrase,
    deduction: "Une règle de droit est avancée : elle doit s'appuyer sur une source.",
    verdict: null,
    outil: null,
    requete: null,
  });

  if (!a.citation) {
    ajouter({
      id: "pas-reference",
      genre: "reference",
      titre: "Aucune référence",
      action: "Visa cherche la source citée par l'auteur dans la phrase.",
      constat: "L'auteur n'en cite aucune.",
      deduction:
        "Visa s'arrête ici : il ne complète jamais une référence absente, même quand elle paraît évidente. Inventer la source serait exactement l'erreur qu'on traque.",
      verdict: "gris",
      outil: null,
      requete: null,
    });
  } else {
    const code = codeVise(a.citation);
    const num = numeroArticle(a.citation);
    const pourvoi = numeroPourvoi(a.citation);

    ajouter({
      id: "pas-reference",
      genre: "reference",
      titre: "La référence citée",
      action: "Visa isole la référence et reconnaît sa nature.",
      constat: a.citation,
      deduction: estDecision
        ? `Une décision de justice${pourvoi ? `, pourvoi n° ${pourvoi}` : ""} : à chercher par son numéro de pourvoi.`
        : code && num
          ? `Un article du ${code.nom} : à chercher par son numéro, ${num}.`
          : "Un texte réglementaire : à chercher par son identifiant.",
      verdict: null,
      outil: "Mistral — Magistral",
      requete: null,
    });

    ajouter({
      id: "pas-requete",
      genre: "requete",
      titre: estDecision ? "Interroger Judilibre" : "Interroger Légifrance",
      action: estDecision
        ? "Visa cherche la décision par son numéro de pourvoi, au fonds JURI."
        : "Visa demande l'article par son numéro, dans le code visé.",
      constat: null,
      deduction: "Visa va chercher le texte lui-même. Il ne se fie jamais à ce que le modèle croit savoir.",
      verdict: null,
      outil: estDecision ? "API Judilibre" : "API Légifrance",
      requete: estDecision
        ? `POST /search\n{ "fond": "JURI",\n  "champs": [{ "typeChamp": "NUM_AFFAIRE",\n    "criteres": [{ "typeRecherche": "EXACTE",\n      "valeur": "${pourvoi ?? a.citation}" }] }] }`
        : s?.rang === "circulaire"
          ? `POST /consult/circulaire\n{ "id": "${s.identifiant}" }`
          : `POST /consult/getArticleWithIdAndNum\n{ "id": "${code?.id ?? "LEGITEXT…"}",\n  "num": "${num ?? "…"}" }`,
    });

    ajouter({
      id: "pas-source",
      genre: "source",
      titre: s?.identifiant ? "La source, retrouvée" : "Aucun résultat",
      action: s?.identifiant
        ? "La base renvoie le texte officiel et son identifiant."
        : "La base ne renvoie rien.",
      constat: s?.identifiant
        ? `${s.identifiant} — ${s.intitule}`
        : "0 résultat. Aucune décision ne porte ce numéro de pourvoi.",
      deduction: s?.identifiant
        ? "Tout ce qui suit sera comparé à ce texte, et à lui seul."
        : "Une référence qu'aucune base ne connaît est une référence inventée. Le reste du contrôle n'a plus d'objet.",
      verdict: s?.identifiant ? "vert" : "rouge",
      outil: s?.base === "introuvable" ? null : s?.base ?? null,
      requete: null,
    });
  }

  // Les quatre contrôles, toujours les quatre, même quand l'un d'eux ne peut
  // rien conclure : un contrôle sauté serait un contrôle invisible.
  CONTROLES.forEach((ctl, rang) => {
    const c = a.controles.find((x) => x.id === ctl.id)!;
    const versionApplicable =
      ctl.id === "vigueur" && s
        ? s.versions.find((v) => v.debut <= dateDesFaits && (!v.fin || dateDesFaits < v.fin))
        : undefined;
    ajouter({
      id: `pas-${ctl.id}`,
      genre: "controle",
      titre: ctl.titre,
      action: ctl.question,
      constat: c.preuve,
      deduction:
        ctl.id === "vigueur" && versionApplicable
          ? `${c.reponse} Version applicable aux faits du ${formaterDate(dateDesFaits)} : « ${versionApplicable.extrait} »`
          : c.reponse,
      verdict: c.verdict,
      outil:
        ctl.id === "portee"
          ? "Comparaison mot pour mot"
          : ctl.id === "vigueur"
            ? "Comparaison des dates de version"
            : null,
      requete: null,
      numeroControle: rang + 1,
    });
  });

  if (a.contradiction) {
    ajouter({
      id: "pas-contradiction",
      genre: "contradiction",
      titre: "L'avocat adverse",
      action: "Un second agent plaide contre l'affirmation, puis Visa vérifie son passage mot pour mot.",
      constat: `« ${a.contradiction.passage} »`,
      deduction: a.contradiction.passageRetrouve
        ? `${a.contradiction.argument} Le passage a été retrouvé dans le texte officiel : l'objection tient.`
        : `${a.contradiction.argument} Le passage n'a pas été retrouvé : Visa écarte l'objection. Le contradicteur non plus n'a pas le droit d'inventer.`,
      verdict: a.contradiction.passageRetrouve ? "orange" : "vert",
      outil: "Mistral — Magistral, puis vérification mot pour mot",
      requete: null,
    });
  }

  const verdicts = a.controles.map((c) => c.verdict);
  ajouter({
    id: "pas-conclusion",
    genre: "conclusion",
    titre: "La conclusion",
    action: "Le verdict d'ensemble est le plus sévère des quatre contrôles. Jamais une moyenne.",
    constat: motifDuPire(a),
    deduction: quoiFaire(a),
    verdict: pire(verdicts),
    outil: null,
    requete: null,
  });

  return pas;
}

/** Quel contrôle a décidé du verdict, et pourquoi. */
function motifDuPire(a: Affirmation): string {
  const verdict = pire(a.controles.map((c) => c.verdict));
  const decisifs = a.controles.filter((c) => c.verdict === verdict);
  const noms = decisifs
    .map((c) => CONTROLES.find((x) => x.id === c.id)!.titre.replace(/\s*\?$/, ""))
    .join(", ");
  if (verdict === "vert") return `Les quatre contrôles passent : ${a.controles.length} sur ${a.controles.length}.`;
  return `Décidé par ${decisifs.length > 1 ? "les contrôles" : "le contrôle"} « ${noms} ».`;
}
