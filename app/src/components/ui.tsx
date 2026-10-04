// Les pièces partagées. Les quatre gravités portent toujours le même mot et la
// même couleur, d'un écran à l'autre : un juriste les apprend une fois.

import type { Constat, Gravite, OrigineTexte } from "../types";
import type { Audit } from "../types";
import { GRAVITES } from "../store";

export const SENS: Record<Gravite, string> = {
  critique: "À traiter avant signature : exposition juridique ou économique majeure.",
  "élevée": "Changement défavorable important pour l'acquéreur.",
  moyenne: "Point réel mais négociable.",
  faible: "Point d'information, ou conforme à ce qui était attendu.",
};

export function Gravite({ gravite, texte }: { gravite: Gravite; texte?: string }) {
  return (
    <span className={`jeton g-${classe(gravite)}`}>
      <span className="puce" />
      {texte ?? gravite}
    </span>
  );
}

/** Les accents français ne passent pas dans un nom de classe. */
export function classe(g: Gravite): string {
  return { critique: "critique", "élevée": "elevee", moyenne: "moyenne", faible: "faible" }[g];
}

/** Le marqueur d'un fait que le dossier ne permet pas d'établir. */
export function NonEtabli() {
  return (
    <span className="jeton g-inconnu" title="Le dossier ne permet pas d'établir ce fait">
      <span className="puce" />
      non établi
    </span>
  );
}

/** La barre des gravités, à l'échelle, puis la légende chiffrée. */
export function BarreGravites({ constats }: { constats: Constat[] }) {
  const total = constats.length || 1;
  const compte = GRAVITES.map((g) => [g, constats.filter((c) => c.gravite === g).length] as const);
  return (
    <div className="synthese">
      <div className="barre" role="img" aria-label={compte.map(([g, n]) => `${n} ${g}`).join(", ")}>
        {compte.map(([g, n]) => (
          <span key={g} className={`s-${classe(g)}`} style={{ width: `${(n / total) * 100}%` }} />
        ))}
      </div>
      <div className="legende">
        {compte.filter(([, n]) => n).map(([g, n]) => (
          <Gravite key={g} gravite={g} texte={`${n} ${g}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Le bandeau qui dit avec quoi l'audit a été fait. Il ne doit jamais laisser
 * croire qu'un modèle a travaillé quand il n'a pas répondu.
 */
export function BandeauMoteur({ moteur }: { moteur: Audit["moteur"] }) {
  const r = moteur.reconnaissance;
  return (
    <div className={`bandeau ${moteur.modele.disponible ? "" : "attention"}`}>
      <span className="pastille">{moteur.modele.disponible ? "●" : "▲"}</span>
      <span>
        <b>Extraction :</b> {moteur.extraction}. <b>Droit applicable :</b> {moteur.droit}.{" "}
        <b>Documents scannés :</b>{" "}
        {r.employee ? (
          <>
            {r.documents.length} lu{r.documents.length > 1 ? "s" : ""} par {r.modele}. Les passages qui en
            viennent portent la mention « lu par reconnaissance » et doivent être confirmés sur l'original.
          </>
        ) : (
          <>non lus — {r.motif}</>
        )}
      </span>
    </div>
  );
}

/** Un chiffre mis en avant, avec ce qu'il compte. */
export function Chiffre({ valeur, quoi, ton }: { valeur: string; quoi: string; ton?: "alerte" | "calme" }) {
  return (
    <div className={`chiffre ${ton ?? ""}`}>
      <b>{valeur}</b>
      <span>{quoi}</span>
    </div>
  );
}

/** Un extrait du document, cité tel quel. Le surlignage marque ce qui est retenu. */
export function Extrait({ texte, surligner }: { texte: string; surligner?: string | null }) {
  if (!surligner) return <div className="citation">{texte}</div>;
  const i = texte.indexOf(surligner);
  if (i === -1) return <div className="citation">{texte}</div>;
  return (
    <div className="citation">
      {texte.slice(0, i)}
      <mark>{surligner}</mark>
      {texte.slice(i + surligner.length)}
    </div>
  );
}

/**
 * Le marqueur d'un texte lu par machine. Il ne disparaît jamais : c'est la
 * différence entre « c'est écrit dans le fichier » et « une machine a lu une
 * image », et seul le juriste peut la lever en ouvrant l'original.
 */
export function Origine({ origine }: { origine: OrigineTexte | null }) {
  if (!origine || origine.par !== "reconnaissance") return null;
  return (
    <span className="jeton g-inconnu" title={`Lu par ${origine.modele} — à confirmer sur l'original`}>
      <span className="puce" />
      lu par reconnaissance
    </span>
  );
}

/** Le renvoi exact : document, clause, page. Ce qu'un juriste recopie. */
export function Renvoi({
  nom,
  clause,
  page,
  compact,
  origine,
}: {
  nom: string | null;
  clause: string | null;
  page: number | null;
  compact?: boolean;
  origine?: OrigineTexte | null;
}) {
  if (!nom) return <span className="sous">source non établie</span>;
  return (
    <span className={`renvoi ${compact ? "compact" : ""}`}>
      <span className="doc">{nom}</span>
      {clause && <span className="cl">{clause}</span>}
      {page && <span className="pg">p. {page}</span>}
      {origine?.par === "reconnaissance" && <span className="pg ocr">lu par reconnaissance</span>}
    </span>
  );
}
