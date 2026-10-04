import { pisteConfigure } from "./piste";
import { retrouverSource, type Piece } from "./sources";
import type {
  Affirmation,
  Controle,
  EntreeJournal,
  Jugement,
  SourceCitee,
  SourceOfficielle,
  Statut,
  VerificationSource,
  VersionTexte,
} from "./types";
import { contientVerbatim } from "./verbatim";

/**
 * Saul's rules, with no model call: shared by the app (moteur.ts)
 * and by the « source map » skill (scripts/carte.ts).
 */

const PIRE: Statut[] = ["rouge", "orange", "gris", "vert"];

/** The most serious status wins; with no check at all, nothing is green. */
export function pire(statuts: Statut[]): Statut {
  for (const s of PIRE) if (statuts.includes(s)) return s;
  return "gris";
}

/** The version of an article applicable at the date of the facts. */
export function versionALaDate(versions: VersionTexte[], date: string): VersionTexte | null {
  return versions.find((v) => (!v.debut || v.debut <= date) && (!v.fin || date < v.fin)) ?? null;
}

type Trace = Omit<EntreeJournal, "t">;

export interface Recherche {
  officielle: SourceOfficielle | null;
  controles: Controle[];
  /** What happened, for the log (without the statement's id). */
  trace: Trace | null;
}

/** 1. Does it exist? Finds the cited source in the right database. */
export async function rechercherSource(s: SourceCitee, pieces: Piece[]): Promise<Recherche> {
  if (s.type === "circulaire") {
    return {
      officielle: null,
      controles: [
        { nom: "existe", statut: "gris", message: "Circular: automatic lookup is not available." },
        {
          nom: "rang",
          statut: "orange",
          message:
            "A circular ranks below statute and decree: it does not bind the court. Support it with a higher-ranking text.",
        },
      ],
      trace: { acteur: "Rules", action: "rank: circular, below statute and decree" },
    };
  }
  if (s.type !== "piece" && !pisteConfigure()) {
    return {
      officielle: null,
      controles: [{ nom: "existe", statut: "gris", message: "Official databases not connected: not verified." }],
      trace: null,
    };
  }

  let r: SourceOfficielle | null | "non_identifiable";
  try {
    r = await retrouverSource(s, pieces);
  } catch (e) {
    return {
      officielle: null,
      controles: [{ nom: "existe", statut: "gris", message: "Official database unreachable: not verified." }],
      trace: { acteur: "Researcher", action: "official database error", detail: String(e).slice(0, 200) },
    };
  }
  if (r === "non_identifiable") {
    return {
      officielle: null,
      controles: [
        {
          nom: "existe",
          statut: "gris",
          message: `Incomplete reference (“${s.brut}”): it cannot be identified without a number.`,
        },
      ],
      trace: { acteur: "Researcher", action: "incomplete reference, not verifiable" },
    };
  }
  if (!r) {
    return {
      officielle: null,
      controles: [
        {
          nom: "existe",
          statut: "rouge",
          message:
            s.type === "piece"
              ? `“${s.brut}” matches no document in the file.`
              : `“${s.brut}” cannot be found in the official databases.`,
        },
      ],
      trace: { acteur: "Researcher", action: `“${s.brut}” NOT FOUND` },
    };
  }
  return {
    officielle: r,
    controles: [{ nom: "existe", statut: "vert", message: `Found in ${r.base}.` }],
    trace: { acteur: "Researcher", action: `found in ${r.base}`, detail: r.titre },
  };
}

/** 2 and 3. In force at the date of the facts? What rank in the hierarchy of norms? */
export function controlerDateEtRang(
  s: SourceCitee,
  officielle: SourceOfficielle,
  dateFaits: string,
): { version: VersionTexte | null; controles: Controle[]; trace: Trace | null } {
  const controles: Controle[] = [];
  let version: VersionTexte | null = null;
  let trace: Trace | null = null;

  if (officielle.versions.length > 0) {
    version = versionALaDate(officielle.versions, dateFaits);
    const courante = officielle.versions[officielle.versions.length - 1];
    if (!version) {
      const premiere = officielle.versions[0];
      controles.push({
        nom: "date",
        statut: "rouge",
        message:
          premiere.debut && dateFaits < premiere.debut
            ? `Not yet in force at the date of the facts (${dateFaits}): in force since ${premiere.debut}.`
            : `No longer in force at the date of the facts (${dateFaits}).`,
      });
    } else if (version !== courante && version.texte !== courante.texte) {
      controles.push({
        nom: "date",
        statut: "orange",
        message: `The text changed since the facts: the version applicable on ${dateFaits} (in force from ${version.debut ?? "?"} to ${version.fin ?? "?"}) is not the current version.`,
      });
    } else {
      controles.push({ nom: "date", statut: "vert", message: `In force at the date of the facts (${dateFaits}).` });
    }
    trace = {
      acteur: "Rules",
      action: `${officielle.versions.length} version(s) of the article; version on ${dateFaits}: ${version ? `from ${version.debut} to ${version.fin ?? "today"}` : "none"}`,
    };
  } else if (officielle.etat && /ABROGE|PERIME|ANNULE/.test(officielle.etat)) {
    controles.push({ nom: "date", statut: "rouge", message: `Text marked ${officielle.etat.toLowerCase()}.` });
  }
  if (s.type === "decision" && s.date && officielle.date && s.date !== officielle.date) {
    controles.push({
      nom: "date",
      statut: "orange",
      message: `Date cited (${s.date}) differs from the actual date of the decision (${officielle.date}).`,
    });
  }

  if (officielle.rang >= 6 && officielle.rang < 7) {
    controles.push({ nom: "rang", statut: "orange", message: `${officielle.rangLibelle}: does not bind the court.` });
  } else if (officielle.rang > 0) {
    controles.push({ nom: "rang", statut: "vert", message: `Rank: ${officielle.rangLibelle}.` });
  }
  return { version, controles, trace };
}

/** The text we judge against: the version applicable at the date of the facts, otherwise the current text. */
export function texteApplicable(officielle: SourceOfficielle, version: VersionTexte | null): string {
  return version?.texte || officielle.texte;
}

/** Opposing counsel's verdict, with the safeguard: its excerpt must exist word for word. */
export function jugementVerifie(brut: Omit<Jugement, "extraitRetrouve">, texte: string): Jugement {
  return {
    verdict: brut.verdict,
    raisonnement: brut.raisonnement ?? [],
    extrait: brut.extrait ?? "",
    correction: brut.correction ?? "",
    extraitRetrouve: contientVerbatim(texte, brut.extrait ?? ""),
  };
}

/** 4. Does it really say that? With no verdict, or no excerpt found, it is never green. */
export function controlerContenu(j: Jugement | null): Controle {
  if (!j) return { nom: "contenu", statut: "gris", message: "Content not judged: check it by hand." };
  if (!j.extraitRetrouve) {
    return {
      nom: "contenu",
      statut: "gris",
      message: "Opposing counsel could not quote the text word for word: verdict set aside, check it by hand.",
    };
  }
  if (j.verdict === "SOUTIENT") return { nom: "contenu", statut: "vert", message: "The source does say this." };
  if (j.verdict === "PARTIEL") return { nom: "contenu", statut: "orange", message: `Partly: ${j.correction}` };
  return { nom: "contenu", statut: "rouge", message: `The source does not say this: ${j.correction}` };
}

/** A statement's status: the worst of its sources; with no source cited, grey. */
export function conclureAffirmation(
  a: Affirmation,
  verifications: VerificationSource[],
): { statut: Statut; message: string } {
  if (a.sources.length === 0) return { statut: "gris", message: "No source cited: check it by hand." };
  const statut = pire(verifications.map((v) => v.statut));
  const message =
    statut === "vert"
      ? "Sources found and conforming."
      : verifications
          .flatMap((v) => v.controles.filter((c) => c.statut === statut).map((c) => c.message))
          .filter((m, i, t) => t.indexOf(m) === i)
          .join(" ");
  return { statut, message };
}
