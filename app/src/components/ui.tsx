// Les petites pièces partagées : le feu tricolore, la barre de synthèse,
// la pyramide des normes et la frise des versions.
//
// Chaque verdict porte toujours le même mot. Un juriste doit pouvoir apprendre
// ces quatre mots une fois et les retrouver partout.

import type { Affirmation, Compte, Rang, Source, Verdict } from "../types";
import { formaterDate } from "../engine/etapes";

/** Le mot attaché à chaque couleur. Il ne change jamais d'un écran à l'autre. */
export const MOT: Record<Verdict, string> = {
  vert: "Vérifié",
  orange: "À revoir",
  rouge: "Bloquant",
  gris: "Non vérifié",
};

/** Ce que la couleur veut dire, en une phrase, pour la légende. */
export const SENS: Record<Verdict, string> = {
  vert: "La source existe, s'appliquait aux faits, a le rang annoncé et dit bien cela.",
  orange: "La source est réelle, mais la date, le rang ou la portée demandent une correction.",
  rouge: "La source est introuvable, abrogée, ou elle dit autre chose. À ne pas déposer.",
  gris: "Visa n'a pas pu vérifier : sans preuve, rien ne passe au vert.",
};

export const ORDRE: Verdict[] = ["rouge", "orange", "gris", "vert"];

export function Jeton({ verdict, texte }: { verdict: Verdict; texte?: string }) {
  return (
    <span className={`jeton v-${verdict}`}>
      <span className="puce" />
      {texte ?? MOT[verdict]}
    </span>
  );
}

/** La barre à l'échelle, puis la légende chiffrée. */
export function BarreSynthese({ compte, total }: { compte: Compte; total: number }) {
  const part = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <div className="synthese">
      <div className="barre" role="img" aria-label={ORDRE.map((v) => `${compte[v]} ${MOT[v]}`).join(", ")}>
        {ORDRE.map((v) => (
          <span key={v} className={`s-${v}`} style={{ width: `${part(compte[v])}%` }} />
        ))}
      </div>
      <div className="legende">
        {ORDRE.map((v) => (
          <span key={v} className="rangee" style={{ gap: 7 }}>
            <Jeton verdict={v} />
            <b>{compte[v]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

const ETAGES: { rang: Rang; nom: string; largeur: number; lie: string }[] = [
  { rang: "constitution", nom: "Constitution", largeur: 46, lie: "lie tout le monde" },
  { rang: "international", nom: "Traités et droit de l'Union", largeur: 58, lie: "lie le juge" },
  { rang: "loi", nom: "Lois, ordonnances, codes", largeur: 70, lie: "lie le juge" },
  { rang: "reglement", nom: "Décrets et arrêtés", largeur: 82, lie: "lie le juge" },
  { rang: "jurisprudence", nom: "Jurisprudence", largeur: 92, lie: "fait autorité, ne lie pas" },
  { rang: "circulaire", nom: "Circulaires et réponses ministérielles", largeur: 100, lie: "ne lie pas le juge" },
];

/** La pyramide, avec l'étage de la source citée mis en évidence. */
export function Pyramide({ rang, alerte }: { rang: Rang; alerte: boolean }) {
  return (
    <div className="pyramide">
      {ETAGES.map((e) => {
        const ici = e.rang === rang;
        return (
          <div
            key={e.rang}
            className={`etage ${ici ? "ici" : ""} ${ici && alerte ? "alerte" : ""}`}
            style={{ width: `${e.largeur}%` }}
          >
            {e.nom}
            {ici && <span className="lie">— {e.lie}</span>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * La frise des versions. Deux repères seulement : celle qui s'appliquait au
 * jour des faits, et celle que l'auteur a citée.
 */
export function FriseVersions({ source, dateDesFaits }: { source: Source; dateDesFaits: string }) {
  if (source.versions.length < 2) return null;
  const jour = dateDesFaits.slice(0, 10);
  const applicable = source.versions.find((v) => v.debut <= jour && (!v.fin || jour < v.fin));
  const derniere = source.versions[source.versions.length - 1];
  return (
    <div className="frise">
      {source.versions.map((v) => {
        const estApplicable = v === applicable;
        const citeeATort = v === derniere && applicable !== derniere;
        return (
          <div
            key={v.debut}
            className={`version ${estApplicable ? "applicable" : ""} ${citeeATort ? "citee-a-tort" : ""}`}
          >
            <div className="rangee">
              <span className="quand">
                Du {formaterDate(v.debut)} {v.fin ? `au ${formaterDate(v.fin)}` : "à aujourd'hui"}
              </span>
              <span className="sort" style={{ marginLeft: "auto" }}>
                {estApplicable ? "↙ applicable aux faits" : citeeATort ? "↖ version citée" : ""}
              </span>
            </div>
            <p className="res">{v.resume}</p>
            <div className="ext">« {v.extrait} »</div>
          </div>
        );
      })}
    </div>
  );
}

/** Le texte officiel, avec le passage retenu surligné mot pour mot. */
export function TexteOfficiel({ source }: { source: Source }) {
  if (!source.texte) {
    return (
      <div className="citation">
        Aucun texte : Visa n'a trouvé cette référence dans aucune base officielle. Il n'y a donc rien à surligner.
      </div>
    );
  }
  if (!source.passage) return <div className="citation">{source.texte}</div>;
  const index = source.texte.indexOf(source.passage);
  if (index === -1) return <div className="citation">{source.texte}</div>;
  return (
    <div className="citation">
      {source.texte.slice(0, index)}
      <mark>{source.passage}</mark>
      {source.texte.slice(index + source.passage.length)}
    </div>
  );
}

/** Le bandeau qui dit d'où viennent les données. Il ne doit jamais mentir. */
export function BandeauSource({ reel, environnement }: { reel: boolean; environnement: string }) {
  return (
    <div className="bandeau">
      <span className="pastille">{reel ? "🔗" : "📁"}</span>
      <span>
        {reel ? (
          <>
            Visa interroge Légifrance et Judilibre en direct, en <b>{environnement}</b>. Chaque verdict porte
            l'identifiant de la source retrouvée.
          </>
        ) : (
          <>
            Aucun identifiant PISTE n'est renseigné : Visa lit les <b>sources mises en cache</b> pour cette
            démonstration. Les identifiants Légifrance et Judilibre sont affichés tels quels, mais rien n'est
            interrogé en direct.
          </>
        )}
      </span>
    </div>
  );
}

/** « 3 bloquantes, 2 à revoir » — la phrase courte d'un lot d'affirmations. */
export function resumeCourt(affirmations: Affirmation[]): string {
  const c = affirmations.reduce<Compte>(
    (acc, a) => ({ ...acc, [a.verdict]: acc[a.verdict] + 1 }),
    { vert: 0, orange: 0, rouge: 0, gris: 0 },
  );
  return ORDRE.filter((v) => c[v]).map((v) => `${c[v]} ${MOT[v].toLowerCase()}`).join(" · ");
}
