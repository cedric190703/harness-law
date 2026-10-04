// La preuve d'un constat. Le volet de droite, premier onglet.
//
// Tout tient dans une idée : l'extrait du document et le texte rédigé côte à
// côte. Le juriste lit les deux d'un seul regard, et confirme ou corrige en
// quelques secondes. Il ne refait pas la recherche : elle est déjà tracée.

import { useState } from "react";
import type { Audit, Constat } from "../types";
import { Gravite, NonEtabli, Origine } from "../components/ui";
import { basculerRelu, nomChantier, poserCorrection, poserNote } from "../store";

export function Preuve({
  audit,
  constat: c,
  onLire,
}: {
  audit: Audit;
  constat: Constat | null;
  onLire: (id: string, passage: string | null) => void;
}) {
  if (!c) {
    return (
      <div className="vide-volet-plein">
        <h3>Cliquez un passage du rapport</h3>
        <p>
          Vous verrez l'extrait du document à côté du texte rédigé, les pièces écartées en route, le droit
          applicable, et la clause proposée au contrat.
        </p>
      </div>
    );
  }
  const p = c.provenance;
  const perime = audit.changements.aRevoir.some((x) => x.cle === c.cle);
  const droit = c.droit?.resultat;

  return (
    <div className="preuve">
      <div className="preuve-tete">
        <span className="code">{c.id}</span>
        <Gravite gravite={c.gravite} />
        {c.nonEtabli && <NonEtabli />}
        <span className="sous">{nomChantier(audit.chantiers, c.chantier)}</span>
        <button className={`bouton sm ${c.relu ? "" : "fort"}`} style={{ marginLeft: "auto" }} onClick={() => basculerRelu(c.id)}>
          {c.relu ? "✓ relu" : "Marquer relu"}
        </button>
      </div>

      {perime && (
        <div className="bandeau attention compact">
          <span className="pastille">▲</span>
          <span>Vous aviez validé ce constat, et une pièce arrivée depuis l'a changé.</span>
        </div>
      )}

      {/* Le cœur : le document et la rédaction, côte à côte. */}
      <div className="duo">
        <section>
          <div className="duo-tete">
            <span className="etiquette">Ce que dit la pièce</span>
            {p.retenu && (
              <button className="lien-constat" onClick={() => onLire(p.retenu!, p.extrait)}>
                ouvrir →
              </button>
            )}
          </div>
          <div className="duo-renvoi">
            {p.nomRetenu ?? "aucune pièce"}
            {p.clause ? ` · ${p.clause}` : ""}
            {p.page ? ` · p. ${p.page}` : ""}
          </div>
          {p.origineTexte?.par === "reconnaissance" && (
            <div className="avis-ocr compact">
              <Origine origine={p.origineTexte} />
              <span>Scan lu par {p.origineTexte.modele} : à confirmer sur l'original.</span>
            </div>
          )}
          {p.extrait ? (
            <blockquote className="verbatim">{p.extrait}</blockquote>
          ) : (
            <div className="vide-volet">
              Aucun passage : le dossier ne porte pas l'information. Rien n'a été copié, donc rien n'est affirmé.
            </div>
          )}
        </section>

        <section>
          <div className="duo-tete">
            <span className="etiquette">Ce qui est rédigé</span>
          </div>
          <div className="duo-renvoi">{c.valeur}</div>
          <Redaction constat={c} />
        </section>
      </div>

      {/* Le chemin, en une ligne de puces plutôt qu'en schéma. */}
      <div className="chemin">
        <span className="etiquette">Le chemin</span>
        <div className="puces-chemin">
          <span className="puce-chemin">{p.parcourus.length} pièces parcourues</span>
          <span className="puce-chemin">{p.consultes.length} en portaient un passage</span>
          <span className="puce-chemin retenu">1 retenue</span>
          {p.ecartes.map((e) => (
            <span key={e.document} className="puce-chemin ecarte" title={e.pourquoi}>
              {e.nom} — {e.pourquoi}
            </span>
          ))}
        </div>
      </div>

      {droit && (
        <div className="bloc-droit">
          <span className="etiquette">La clause tient-elle en droit ?</span>
          {!droit.verifie ? (
            <p className="sous">{droit.motif} Aucune conclusion de droit n'est tirée.</p>
          ) : (
            <>
              {droit.article && (
                <>
                  <div className="droit-ref">
                    {droit.article.reference}
                    <span className={`jeton ${droit.article.etat === "en vigueur" ? "g-faible" : "g-critique"}`}>
                      <span className="puce" />
                      {droit.article.etat}
                    </span>
                  </div>
                  <blockquote className="verbatim petit">{droit.article.texte}</blockquote>
                  <div className="sous" style={{ marginTop: 6 }}>
                    <code>{droit.article.identifiant}</code> ·{" "}
                    <a href={droit.article.lien} target="_blank" rel="noreferrer">
                      Légifrance ↗
                    </a>
                  </div>
                </>
              )}
              {droit.jurisprudence && (
                <div className="jurisprudence">
                  <div className="sous">{droit.jurisprudence.total} décisions au soutien dans Judilibre</div>
                  {droit.jurisprudence.decisions.slice(0, 2).map((d) => (
                    <div key={d.numero} className="decision">
                      <b>{d.numero}</b> <span className="sous">{d.date} · {d.chambre}</span>
                      <div className="sous resume">{d.resume}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {c.spa && (
        <div className="bloc-spa">
          <span className="etiquette">Au contrat de cession — {c.spa.mecanisme}</span>
          <p>{c.spa.redaction}</p>
        </div>
      )}

      <Note constat={c} />
    </div>
  );
}

/** La rédaction, et la correction du juriste. L'originale n'est jamais effacée. */
function Redaction({ constat: c }: { constat: Constat }) {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(c.correction ?? c.redaction);

  if (edition) {
    return (
      <div>
        <textarea className="champ" style={{ minHeight: 150 }} value={texte} onChange={(e) => setTexte(e.target.value)} />
        <div className="rangee" style={{ marginTop: 8, gap: 8 }}>
          <button
            className="bouton fort sm"
            onClick={() => {
              poserCorrection(c.id, texte.trim() === c.redaction.trim() ? "" : texte);
              setEdition(false);
            }}
          >
            Enregistrer
          </button>
          <button className="bouton sm" onClick={() => { setTexte(c.correction ?? c.redaction); setEdition(false); }}>
            Annuler
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="redaction">{c.correction ?? c.redaction}</p>
      <div className="rangee" style={{ marginTop: 8, gap: 10 }}>
        <button className="bouton discret sm" onClick={() => setEdition(true)}>
          {c.correction ? "Modifier" : "Corriger"}
        </button>
        {c.correction && (
          <button className="bouton discret sm" onClick={() => { poserCorrection(c.id, ""); setTexte(c.redaction); }}>
            Revenir à l'origine
          </button>
        )}
      </div>
      {c.correction && (
        <details className="origine-redaction">
          <summary>La rédaction d'origine</summary>
          <p>{c.redaction}</p>
        </details>
      )}
    </div>
  );
}

function Note({ constat: c }: { constat: Constat }) {
  const [texte, setTexte] = useState(c.note ?? "");
  const [ouvert, setOuvert] = useState(Boolean(c.note));
  if (!ouvert) {
    return (
      <button className="bouton discret sm" onClick={() => setOuvert(true)}>
        + une note
      </button>
    );
  }
  return (
    <div>
      <span className="etiquette">Votre note</span>
      <textarea
        className="champ"
        style={{ minHeight: 62 }}
        placeholder="Vérifié avec le client, à confirmer en séance…"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => texte !== (c.note ?? "") && poserNote(c.id, texte)}
      />
    </div>
  );
}
