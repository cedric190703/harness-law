// Le déroulé : comment les six étapes du contrôle se construisent à partir des
// affirmations, et comment chacune se décompose en tâches séparées.
//
// Une seule règle gouverne ce fichier : chaque tâche doit pouvoir s'afficher
// seule, avec son libellé, son état et sa preuve. C'est ce grain-là que le
// juriste suit à l'écran et retrouve dans le journal d'audit.

import { passageDansSource } from "./piste";
import type { Affirmation, Compte, ControleId, Etape, Tache } from "../types";

export const VIDE: Compte = { vert: 0, orange: 0, rouge: 0, gris: 0 };

export function compter(affirmations: Affirmation[]): Compte {
  return affirmations.reduce<Compte>((acc, a) => ({ ...acc, [a.verdict]: acc[a.verdict] + 1 }), { ...VIDE });
}

/** Les quatre contrôles, dans l'ordre, avec la question posée au juriste. */
export const CONTROLES: { id: ControleId; titre: string; question: string }[] = [
  { id: "existence", titre: "Elle existe ?", question: "Cette référence existe-t-elle vraiment dans une base officielle ?" },
  { id: "vigueur", titre: "En vigueur à la date des faits ?", question: "Le texte cité s'appliquait-il le jour des faits ?" },
  { id: "rang", titre: "Quel rang ?", question: "La source a-t-elle l'autorité qu'on lui prête ?" },
  { id: "portee", titre: "Elle dit bien cela ?", question: "Le texte officiel soutient-il l'affirmation, mot pour mot ?" },
];

/** « 1 introuvable, 2 à revoir, 11 confirmées » — le résumé d'un contrôle. */
function resumeControle(affirmations: Affirmation[], id: ControleId): string {
  const c = compter(
    affirmations.map((a) => ({ ...a, verdict: a.controles.find((x) => x.id === id)?.verdict ?? "gris" })),
  );
  const morceaux = [
    c.rouge ? `${c.rouge} bloquante${c.rouge > 1 ? "s" : ""}` : null,
    c.orange ? `${c.orange} à revoir` : null,
    c.gris ? `${c.gris} non vérifiable${c.gris > 1 ? "s" : ""}` : null,
    c.vert ? `${c.vert} confirmée${c.vert > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return morceaux.join(", ");
}

/**
 * Construit le déroulé complet. `avancement` dit jusqu'où le contrôle est allé
 * (0 = rien de lancé, 6 = terminé) : au-delà, les étapes restent « en attente »
 * et n'affichent aucun compte. Rien ne se colore avant d'être établi.
 */
export function construireEtapes(
  affirmations: Affirmation[],
  dateDesFaits: string,
  avancement = 6,
): Etape[] {
  const atteinte = (rang: number) => avancement > rang;
  const encours = (rang: number) => avancement === rang;
  const etat = (rang: number) => (atteinte(rang) ? "terminée" : encours(rang) ? "en cours" : "en attente") as Etape["etat"];

  const avecCitation = affirmations.filter((a) => a.citation);
  const articles = avecCitation.filter((a) => a.source?.base === "Légifrance" || a.source?.rang !== "jurisprudence");
  const decisions = avecCitation.filter((a) => a.source?.rang === "jurisprudence" || a.source?.base === "introuvable");
  const contredites = affirmations.filter((a) => a.contradiction);
  const c = compter(affirmations);

  /** Les tâches d'une étape ne se révèlent qu'au fur et à mesure. */
  const taches = (rang: number, liste: Tache[]): Tache[] =>
    atteinte(rang)
      ? liste
      : encours(rang)
        ? liste.map((t, i) => (i < Math.ceil(liste.length / 2) ? t : { ...t, etat: "en cours", detail: null }))
        : liste.map((t) => ({ ...t, etat: "en attente", detail: null }));

  const dateLisible = formaterDate(dateDesFaits);

  return [
    {
      id: "texte",
      titre: "Le texte à vérifier",
      explication: "Visa lit la note telle qu'elle a été rédigée, sans la réécrire.",
      outil: "Aucun modèle — simple lecture",
      etat: etat(0),
      compte: atteinte(0) ? `Faits du ${dateLisible}` : null,
      taches: taches(0, [
        { id: "T-texte-1", libelle: "Lire la note soumise", etat: "terminée", detail: "Note de 4 parties, 418 mots.", affirmationId: null },
        {
          id: "T-texte-2",
          libelle: "Retenir la date des faits",
          etat: "terminée",
          detail: `${dateLisible} — c'est cette date qui décide quelle version de chaque texte s'applique.`,
          affirmationId: null,
        },
        {
          id: "T-texte-3",
          libelle: "Noter l'outil déclaré par le juriste",
          etat: "terminée",
          detail: "Entre au journal d'audit, comme le demande le guide CNB du 17 mars 2026.",
          affirmationId: null,
        },
      ]),
    },

    {
      id: "decoupage",
      titre: "Découpage en affirmations",
      explication: "Chaque phrase qui avance une règle de droit devient une ligne à vérifier, avec sa référence.",
      outil: "Mistral — Magistral (raisonnement visible)",
      etat: etat(1),
      compte: atteinte(1) ? `${affirmations.length} affirmations` : null,
      taches: taches(
        1,
        affirmations.map((a) => ({
          id: `T-dec-${a.id}`,
          libelle: `${a.id} — ${court(a.phrase, 72)}`,
          etat: "terminée" as const,
          detail: a.citation ? `Référence citée : ${a.citation}` : "Aucune référence citée par l'auteur.",
          affirmationId: a.id,
        })),
      ),
    },

    {
      id: "recherche",
      titre: "Recherche des sources officielles",
      explication: "Visa va chercher le texte lui-même : Légifrance pour les articles, Judilibre pour les décisions.",
      outil: "API Légifrance et Judilibre (PISTE)",
      etat: etat(2),
      compte: atteinte(2)
        ? `${avecCitation.filter((a) => a.source?.identifiant).length} sources retrouvées sur ${avecCitation.length}`
        : null,
      taches: taches(2, [
        ...articles.map((a) => ({
          id: `T-rech-${a.id}`,
          libelle: `${a.id} — ${a.citation}`,
          etat: "terminée" as const,
          detail: a.source?.identifiant ? `Légifrance : ${a.source.identifiant}` : "Introuvable.",
          affirmationId: a.id,
        })),
        ...decisions.map((a) => ({
          id: `T-rech-${a.id}`,
          libelle: `${a.id} — ${a.citation}`,
          etat: "terminée" as const,
          detail: a.source?.identifiant ? `Judilibre : ${a.source.identifiant}` : "Aucun résultat pour ce numéro de pourvoi.",
          affirmationId: a.id,
        })),
        ...affirmations
          .filter((a) => !a.citation)
          .map((a) => ({
            id: `T-rech-${a.id}`,
            libelle: `${a.id} — aucune référence à chercher`,
            etat: "terminée" as const,
            detail: "Sans référence, Visa ne cherche pas : la ligne reste non vérifiable.",
            affirmationId: a.id,
          })),
      ]),
    },

    {
      id: "controles",
      titre: "Les quatre contrôles",
      explication: "Sur chaque affirmation, Visa pose quatre questions toujours identiques, dans le même ordre.",
      outil: "Comparaison déterministe sur le texte officiel",
      etat: etat(3),
      compte: atteinte(3) ? `${affirmations.length * 4} contrôles` : null,
      taches: taches(
        3,
        CONTROLES.map((ctl) => ({
          id: `T-ctl-${ctl.id}`,
          libelle: ctl.titre,
          etat: "terminée" as const,
          detail: resumeControle(affirmations, ctl.id),
          affirmationId: null,
        })),
      ),
    },

    {
      id: "contradiction",
      titre: "La contradiction",
      explication:
        "Un second agent joue l'avocat adverse. Il doit citer un passage exact, et Visa vérifie mot pour mot qu'il existe : le contradicteur lui-même ne peut pas inventer.",
      outil: "Mistral — Magistral, puis vérification mot pour mot",
      etat: etat(4),
      compte: atteinte(4) ? `${contredites.length} affirmations contredites` : null,
      taches: taches(
        4,
        contredites.map((a) => ({
          id: `T-contra-${a.id}`,
          libelle: `${a.id} — ${court(a.contradiction!.argument, 80)}`,
          etat: "terminée" as const,
          detail:
            a.source && passageDansSource(a.source, a.contradiction!.passage)
              ? `Passage retrouvé mot pour mot : « ${court(a.contradiction!.passage, 90)} »`
              : "Passage non retrouvé dans le texte officiel : l'objection est écartée.",
          affirmationId: a.id,
        })),
      ),
    },

    {
      id: "journal",
      titre: "Le journal d'audit",
      explication:
        "Tout ce qui précède est consigné : sources, identifiants, versions comparées, verdicts, et la relecture du juriste.",
      outil: "Export PDF, prêt pour le guide CNB",
      etat: etat(5),
      compte: atteinte(5) ? `${c.rouge} bloquantes · ${c.orange} à revoir · ${c.gris} non vérifiables` : null,
      taches: taches(5, [
        {
          id: "T-journal-1",
          libelle: "Consigner chaque source avec son identifiant de base",
          etat: "terminée",
          detail: `${avecCitation.filter((a) => a.source?.identifiant).length} identifiants Légifrance ou Judilibre.`,
          affirmationId: null,
        },
        {
          id: "T-journal-2",
          libelle: "Consigner les versions comparées",
          etat: "terminée",
          detail: `${affirmations.filter((a) => (a.source?.versions.length ?? 0) > 1).length} textes ont plusieurs versions : Visa garde celle appliquée et celle citée.`,
          affirmationId: null,
        },
        {
          id: "T-journal-3",
          libelle: "Attendre la relecture du juriste",
          etat: "en cours",
          detail: "Un journal ne se clôt pas sans signature humaine.",
          affirmationId: null,
        },
      ]),
    },
  ];
}

export function formaterDate(iso: string): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(iso);
  return `${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

export function court(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1).trimEnd()}…`;
}
