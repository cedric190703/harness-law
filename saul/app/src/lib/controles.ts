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
 * Les règles de Saul, sans appel au modèle : partagées par l'app (moteur.ts)
 * et par le skill « carte des sources » (scripts/carte.ts).
 */

const PIRE: Statut[] = ["rouge", "orange", "gris", "vert"];

/** Le statut le plus grave l'emporte ; sans aucun contrôle, rien n'est vert. */
export function pire(statuts: Statut[]): Statut {
  for (const s of PIRE) if (statuts.includes(s)) return s;
  return "gris";
}

/** La version d'un article applicable à la date des faits. */
export function versionALaDate(versions: VersionTexte[], date: string): VersionTexte | null {
  return versions.find((v) => (!v.debut || v.debut <= date) && (!v.fin || date < v.fin)) ?? null;
}

type Trace = Omit<EntreeJournal, "t">;

export interface Recherche {
  officielle: SourceOfficielle | null;
  controles: Controle[];
  /** Ce qui s'est passé, pour le journal (sans l'identifiant de l'affirmation). */
  trace: Trace | null;
}

/** 1. Existe ? Retrouve la source citée dans la base adaptée. */
export async function rechercherSource(s: SourceCitee, pieces: Piece[]): Promise<Recherche> {
  if (s.type === "circulaire") {
    return {
      officielle: null,
      controles: [
        { nom: "existe", statut: "gris", message: "Circulaire : recherche automatique non disponible." },
        {
          nom: "rang",
          statut: "orange",
          message:
            "Une circulaire est sous la loi et le décret : elle ne lie pas le juge. À appuyer sur un texte de rang supérieur.",
        },
      ],
      trace: { acteur: "Règles", action: "rang : circulaire, sous la loi et le décret" },
    };
  }
  if (s.type !== "piece" && !pisteConfigure()) {
    return {
      officielle: null,
      controles: [{ nom: "existe", statut: "gris", message: "Bases officielles non connectées : non vérifié." }],
      trace: null,
    };
  }

  let r: SourceOfficielle | null | "non_identifiable";
  try {
    r = await retrouverSource(s, pieces);
  } catch (e) {
    return {
      officielle: null,
      controles: [{ nom: "existe", statut: "gris", message: "Base officielle injoignable : non vérifié." }],
      trace: { acteur: "Chercheur", action: "erreur base officielle", detail: String(e).slice(0, 200) },
    };
  }
  if (r === "non_identifiable") {
    return {
      officielle: null,
      controles: [
        {
          nom: "existe",
          statut: "gris",
          message: `Référence incomplète (« ${s.brut} ») : impossible de l'identifier sans numéro.`,
        },
      ],
      trace: { acteur: "Chercheur", action: "référence incomplète, non vérifiable" },
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
              ? `« ${s.brut} » ne correspond à aucune pièce du dossier.`
              : `« ${s.brut} » est introuvable dans les bases officielles.`,
        },
      ],
      trace: { acteur: "Chercheur", action: `« ${s.brut} » INTROUVABLE` },
    };
  }
  return {
    officielle: r,
    controles: [{ nom: "existe", statut: "vert", message: `Retrouvée sur ${r.base}.` }],
    trace: { acteur: "Chercheur", action: `trouvée sur ${r.base}`, detail: r.titre },
  };
}

/** 2 et 3. En vigueur à la date des faits ? Quel rang dans la hiérarchie des normes ? */
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
            ? `Pas encore en vigueur à la date des faits (${dateFaits}) : en vigueur depuis le ${premiere.debut}.`
            : `Plus en vigueur à la date des faits (${dateFaits}).`,
      });
    } else if (version !== courante && version.texte !== courante.texte) {
      controles.push({
        nom: "date",
        statut: "orange",
        message: `Le texte a changé depuis les faits : la version applicable au ${dateFaits} (en vigueur du ${version.debut ?? "?"} au ${version.fin ?? "?"}) n'est pas la version actuelle.`,
      });
    } else {
      controles.push({ nom: "date", statut: "vert", message: `En vigueur à la date des faits (${dateFaits}).` });
    }
    trace = {
      acteur: "Règles",
      action: `${officielle.versions.length} version(s) de l'article, version au ${dateFaits} : ${version ? `du ${version.debut} au ${version.fin ?? "aujourd'hui"}` : "aucune"}`,
    };
  } else if (officielle.etat && /ABROGE|PERIME|ANNULE/.test(officielle.etat)) {
    controles.push({ nom: "date", statut: "rouge", message: `Texte ${officielle.etat.toLowerCase()}.` });
  }
  if (s.type === "decision" && s.date && officielle.date && s.date !== officielle.date) {
    controles.push({
      nom: "date",
      statut: "orange",
      message: `Date citée (${s.date}) différente de la date réelle de la décision (${officielle.date}).`,
    });
  }

  if (officielle.rang >= 6 && officielle.rang < 7) {
    controles.push({ nom: "rang", statut: "orange", message: `${officielle.rangLibelle} : ne lie pas le juge.` });
  } else if (officielle.rang > 0) {
    controles.push({ nom: "rang", statut: "vert", message: `Rang : ${officielle.rangLibelle}.` });
  }
  return { version, controles, trace };
}

/** Le texte sur lequel on juge : la version applicable à la date des faits, sinon le texte courant. */
export function texteApplicable(officielle: SourceOfficielle, version: VersionTexte | null): string {
  return version?.texte || officielle.texte;
}

/** Le verdict de l'avocat adverse, avec le garde-fou : son extrait doit exister mot pour mot. */
export function jugementVerifie(brut: Omit<Jugement, "extraitRetrouve">, texte: string): Jugement {
  return {
    verdict: brut.verdict,
    raisonnement: brut.raisonnement ?? [],
    extrait: brut.extrait ?? "",
    correction: brut.correction ?? "",
    extraitRetrouve: contientVerbatim(texte, brut.extrait ?? ""),
  };
}

/** 4. Dit-elle vraiment ça ? Sans jugement, ou sans extrait retrouvé, ce n'est jamais vert. */
export function controlerContenu(j: Jugement | null): Controle {
  if (!j) return { nom: "contenu", statut: "gris", message: "Contenu non jugé : à vérifier à la main." };
  if (!j.extraitRetrouve) {
    return {
      nom: "contenu",
      statut: "gris",
      message: "L'avocat adverse n'a pas pu citer le texte mot pour mot : verdict écarté, à vérifier à la main.",
    };
  }
  if (j.verdict === "SOUTIENT") return { nom: "contenu", statut: "vert", message: "La source dit bien cela." };
  if (j.verdict === "PARTIEL") return { nom: "contenu", statut: "orange", message: `Partiellement : ${j.correction}` };
  return { nom: "contenu", statut: "rouge", message: `La source ne dit pas cela : ${j.correction}` };
}

/** Le statut d'une affirmation : la pire de ses sources ; sans source citée, gris. */
export function conclureAffirmation(
  a: Affirmation,
  verifications: VerificationSource[],
): { statut: Statut; message: string } {
  if (a.sources.length === 0) return { statut: "gris", message: "Aucune source citée : à vérifier à la main." };
  const statut = pire(verifications.map((v) => v.statut));
  const message =
    statut === "vert"
      ? "Sources retrouvées et conformes."
      : verifications
          .flatMap((v) => v.controles.filter((c) => c.statut === statut).map((c) => c.message))
          .filter((m, i, t) => t.indexOf(m) === i)
          .join(" ");
  return { statut, message };
}
