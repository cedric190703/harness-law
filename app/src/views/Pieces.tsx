// Les pièces de la data room. Le volet de droite, troisième onglet.
//
// Compact à dessein : la liste des fichiers n'est pas le travail du juriste,
// c'est ce qui borne son travail. Le versement est ici, parce qu'une pièce qui
// arrive relance l'audit.

import { useRef, useState } from "react";
import type { Audit, RoleDocument } from "../types";
import { court, depuis, lienExport, ouvrirDocument, useEtat, verserPieces } from "../store";

const MARQUE: Record<RoleDocument, { signe: string; nom: string }> = {
  retenu: { signe: "●", nom: "retenue" },
  avenant: { signe: "+", nom: "avenant" },
  ecarte: { signe: "✕", nom: "écartée" },
  illisible: { signe: "?", nom: "non lue" },
  "liste-demandes": { signe: "▣", nom: "périmètre" },
  "reponses-vendeur": { signe: "▤", nom: "réponses" },
};

export function Pieces({ audit }: { audit: Audit }) {
  const [filtre, setFiltre] = useState<RoleDocument | null>(null);
  const historique = useEtat((e) => e.historique);
  const liste = filtre ? audit.documents.filter((d) => d.role === filtre) : audit.documents;
  const cv = audit.couverture;

  return (
    <div className="pieces">
      <Depot />

      <div className="rangee" style={{ gap: 6, flexWrap: "wrap", margin: "16px 0 10px" }}>
        <button className={`puce-acteur ${!filtre ? "actif" : ""}`} onClick={() => setFiltre(null)}>
          {audit.documents.length} pièces
        </button>
        {(Object.keys(MARQUE) as RoleDocument[]).map((r) => {
          const n = audit.documents.filter((d) => d.role === r).length;
          if (!n) return null;
          return (
            <button key={r} className={`puce-acteur ${filtre === r ? "actif" : ""}`} onClick={() => setFiltre(filtre === r ? null : r)}>
              {MARQUE[r].nom} {n}
            </button>
          );
        })}
      </div>

      <div className="liste-pieces">
        {liste.map((d) => {
          const constats = audit.constats.filter((c) => c.provenance.retenu === d.id).length;
          return (
            <button
              key={d.id}
              className={`piece r-${d.role}`}
              onClick={() => d.lisible && ouvrirDocument(d.id)}
              title={d.lisible ? "Ouvrir la pièce" : "Pièce non lisible"}
            >
              <span className="signe">{MARQUE[d.role].signe}</span>
              <span className="quoi">
                <span className="nom">{d.nom}</span>
                {d.motifTri && <span className="motif">{court(d.motifTri, 120)}</span>}
                {d.origineTexte?.par === "reconnaissance" && (
                  <span className="motif">Lue par reconnaissance ({d.origineTexte.modele}) — à confirmer.</span>
                )}
              </span>
              {constats > 0 && <span className="compte">{constats}</span>}
            </button>
          );
        })}
      </div>

      <div className="bloc-dossier">
        <span className="etiquette">Le dossier</span>
        <div className="sous">
          {historique.length} passage{historique.length > 1 ? "s" : ""} · dernier {depuis(audit.lanceLe)} ·{" "}
          {audit.travail.relus} constats relus · {cv.demandesManquantes} demandes sans réponse
        </div>
        <div className="rangee" style={{ marginTop: 11, gap: 8, flexWrap: "wrap" }}>
          <a className="bouton sm" href={lienExport("rapport.md")} download>↓ Rapport</a>
          <a className="bouton sm" href={lienExport("tableau.csv")} download>↓ Tableau</a>
          <button className="bouton sm" onClick={() => window.print()}>↓ Journal d'audit (PDF)</button>
        </div>
      </div>
    </div>
  );
}

function Depot() {
  const enCours = useEtat((e) => e.enCours);
  const dernier = useEtat((e) => e.dernierVersement);
  const [survol, setSurvol] = useState(false);
  const entree = useRef<HTMLInputElement>(null);

  const envoyer = (l: FileList | null) => {
    if (l?.length) verserPieces([...l]);
    if (entree.current) entree.current.value = "";
  };

  return (
    <>
      <div
        className={`depot ${survol ? "survol" : ""} ${enCours ? "occupe" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); envoyer(e.dataTransfer.files); }}
        onClick={() => !enCours && entree.current?.click()}
      >
        <input ref={entree} type="file" multiple hidden onChange={(e) => envoyer(e.target.files)} />
        {enCours ? <span>Versement et passage de l'audit…</span> : (
          <>
            <b>Verser des pièces</b>
            <span>Déposez-les ici. Chaque versement relance l'audit et signale les relectures périmées.</span>
          </>
        )}
      </div>
      {dernier && (
        <div className="bandeau compact" style={{ marginTop: 11 }}>
          <span className="pastille">●</span>
          <span>
            {dernier.verses.filter((v) => !v.refuse).length} pièce(s) versées dans « {dernier.lot} ».
            {dernier.verses.filter((v) => v.refuse).map((v) => ` ${v.nom} refusé : ${v.refuse}`)}
          </span>
        </div>
      )}
    </>
  );
}
