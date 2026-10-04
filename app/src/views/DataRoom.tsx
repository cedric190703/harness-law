// La data room, telle qu'elle a été traitée. L'écran répond à la question que
// le juriste se pose en premier : qu'est-ce qui a été lu, et qu'est-ce qui ne
// l'a pas été ?
//
// La couverture est en haut, avant les documents. Ce qui n'a pas été lu est une
// information de premier rang, pas une note de bas de page.

import { useState } from "react";
import type { Audit, Document, RoleDocument } from "../types";
import { BandeauMoteur, Chiffre } from "../components/ui";
import { aller, court, ouvrirDocument, useEtat } from "../store";
import { LecteurDocument } from "./LecteurDocument";

const ROLES: { id: RoleDocument; nom: string; quoi: string; marque: string }[] = [
  { id: "retenu", nom: "Retenus", quoi: "Dépouillés clause par clause.", marque: "●" },
  { id: "avenant", nom: "Avenants", quoi: "Rattachés au contrat qu'ils modifient.", marque: "+" },
  { id: "ecarte", nom: "Écartés", quoi: "Doublons et brouillons, avec le motif.", marque: "✕" },
  { id: "illisible", nom: "Illisibles", quoi: "Non lus : le rapport le dit.", marque: "?" },
  { id: "liste-demandes", nom: "Périmètre", quoi: "La liste de demandes.", marque: "▣" },
  { id: "reponses-vendeur", nom: "Réponses", quoi: "Les affirmations du vendeur.", marque: "▤" },
];

export function DataRoom({ audit }: { audit: Audit }) {
  const [role, setRole] = useState<RoleDocument | null>(null);
  const documentOuvert = useEtat((e) => e.documentOuvert);
  const cv = audit.couverture;
  const liste = role ? audit.documents.filter((d) => d.role === role) : audit.documents;
  const nonLus = cv.illisibles.length + cv.ecartes.length;

  return (
    <div className="vue">
      <div className="large">
        <BandeauMoteur moteur={audit.moteur} />

        <div className="carte" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Ce qui a été lu, et ce qui ne l'a pas été</h3>
          <p className="sous" style={{ marginBottom: 16 }}>
            Un outil qui ne dit pas ce qu'il n'a pas lu oblige à tout relire. Les quatre chiffres ci-dessous
            sont la première chose à regarder.
          </p>
          <div className="puces-chiffres">
            <Chiffre valeur={`${cv.depouilles}`} quoi={`documents dépouillés sur ${cv.total} versés`} />
            <Chiffre valeur={`${cv.illisibles.length}`} quoi="illisibles : rien n'en a été tiré" ton={cv.illisibles.length ? "alerte" : "calme"} />
            <Chiffre valeur={`${cv.ecartes.length}`} quoi="écartés, chacun avec son motif" />
            <Chiffre
              valeur={`${cv.demandesManquantes}/${cv.demandesTotal}`}
              quoi="demandes non satisfaites par le vendeur"
              ton={cv.demandesManquantes ? "alerte" : "calme"}
            />
          </div>
          {nonLus > 0 && (
            <p className="sous" style={{ marginTop: 16, marginBottom: 0 }}>
              <b style={{ color: "var(--encre)" }}>
                {nonLus} documents n'ont pas nourri le rapport.
              </b>{" "}
              Les écartés le sont pour une raison vérifiable en un clic. Les illisibles sont un trou dans
              l'audit, signalé comme tel dans chaque constat qui en dépend.
            </p>
          )}
        </div>

        {cv.illisibles.length > 0 && (
          <div className="carte alerte-bord">
            <h3 style={{ marginBottom: 10 }}>Les documents que Visa n'a pas pu lire</h3>
            {cv.illisibles.map((d) => (
              <div key={d.id} className="ligne-plate">
                <span className="code">{d.id}</span>
                <div>
                  <b>{d.nom}</b>
                  <div className="sous">{d.pourquoi}</div>
                </div>
                <span className="droite">
                  {d.aReconnaitre ? (
                    <span className="jeton g-inconnu"><span className="puce" />reconnaissance nécessaire</span>
                  ) : (
                    <span className="jeton g-critique"><span className="puce" />à redemander</span>
                  )}
                </span>
              </div>
            ))}
            <p className="sous" style={{ marginTop: 12, marginBottom: 0 }}>
              Tant que ces pièces ne sont pas lisibles, aucun chiffre les concernant n'est repris au rapport —
              pas même celui avancé par le vendeur.
            </p>
          </div>
        )}

        <div className="rangee" style={{ margin: "26px 0 12px", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ marginRight: 8 }}>Les {audit.documents.length} fichiers versés</h3>
          <button className={`bouton sm ${role === null ? "fort" : ""}`} onClick={() => setRole(null)}>
            Tous
          </button>
          {ROLES.map((r) => {
            const n = audit.documents.filter((d) => d.role === r.id).length;
            if (!n) return null;
            return (
              <button key={r.id} className={`bouton sm ${role === r.id ? "fort" : ""}`} onClick={() => setRole(role === r.id ? null : r.id)}>
                {r.nom} ({n})
              </button>
            );
          })}
        </div>

        <div className="table-docs">
          {liste.map((d) => (
            <LigneDocument key={d.id} doc={d} audit={audit} />
          ))}
        </div>

        <div className="carte" style={{ marginTop: 22 }}>
          <div className="rangee">
            <h3>Ce que le vendeur n'a pas communiqué</h3>
            <button className="bouton sm" style={{ marginLeft: "auto" }} onClick={() => aller("chantiers")}>
              Voir par chantier
            </button>
          </div>
          <p className="sous" style={{ marginTop: 5 }}>
            {audit.demandes.manquants.length} lignes de la liste de demandes ne sont pas satisfaites. Chacune
            borne ce que l'audit peut affirmer.
          </p>
          <div className="colonnes" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", marginTop: 14 }}>
            {audit.demandes.manquants.map((m) => (
              <div key={m.code} className="demande">
                <span className={`code ${m.etat === "manquant" ? "manquant" : "partiel"}`}>{m.code}</span>
                <div>
                  <div>{m.quoi}</div>
                  <div className="sous">{m.etat === "manquant" ? "Non reçu" : `Partiel — ${m.detail}`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {documentOuvert && <LecteurDocument id={documentOuvert} onFermer={() => ouvrirDocument(null)} />}
    </div>
  );
}

function LigneDocument({ doc, audit }: { doc: Document; audit: Audit }) {
  const r = ROLES.find((x) => x.id === doc.role)!;
  const constats = audit.constats.filter((c) => c.provenance.retenu === doc.id);
  const parent = doc.parentDe ? audit.documents.find((d) => d.chemin === doc.parentDe) : null;
  return (
    <button className={`doc-ligne r-${doc.role}`} onClick={() => doc.lisible && ouvrirDocument(doc.id)}>
      <span className="marque" title={r.nom}>{r.marque}</span>
      <span className="code">{doc.id}</span>
      <div className="quoi">
        <div className="nom">{doc.nom}</div>
        <div className="meta">
          {doc.dossier} · {(doc.octets / 1024).toFixed(1)} ko
          {doc.pages > 1 ? ` · ${doc.pages} pages` : ""}
        </div>
        {doc.motifTri && <div className={`motif ${doc.role === "illisible" ? "grave" : ""}`}>{court(doc.motifTri, 170)}</div>}
        {doc.origineTexte?.par === "reconnaissance" && (
          <div className="motif">
            Scan lu par reconnaissance de caractères ({doc.origineTexte.modele}). Les passages qui en viennent
            sont à confirmer sur l'original.
          </div>
        )}
        {parent && <div className="motif">Modifie : {parent.nom}</div>}
      </div>
      <span className="droite">
        {constats.length > 0 && <span className="compte-constats">{constats.length} constat{constats.length > 1 ? "s" : ""}</span>}
        {doc.lisible ? <span className="sous">lire →</span> : <span className="sous">non lisible</span>}
      </span>
    </button>
  );
}
