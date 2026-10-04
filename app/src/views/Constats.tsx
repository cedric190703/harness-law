// L'écran central. Pour chaque information du rapport, le chemin qui y mène.
//
// La disposition tient tout entière dans une idée : l'extrait du document et le
// texte rédigé côte à côte, dans la même largeur, à la même hauteur. Le juriste
// lit les deux d'un seul regard et confirme ou corrige en quelques secondes. Il
// ne refait pas la recherche : elle est déjà tracée.

import { useState } from "react";
import type { Audit, Constat } from "../types";
import { FilProvenance } from "../components/FilProvenance";
import { BarreGravites, Gravite, NonEtabli, Origine, Renvoi } from "../components/ui";
import { LecteurDocument } from "./LecteurDocument";
import { GRAVITES, basculerRelu, nomChantier, ouvrirConstat, poser, useEtat } from "../store";

export function Constats({ audit }: { audit: Audit }) {
  const ouvert = useEtat((e) => e.constatOuvert);
  const chantierFiltre = useEtat((e) => e.chantierFiltre);
  const graviteFiltre = useEtat((e) => e.graviteFiltre);
  const [lire, setLire] = useState<{ id: string; passage: string | null } | null>(null);

  const constat = audit.constats.find((c) => c.id === ouvert) ?? null;
  const liste = audit.constats.filter(
    (c) => (!chantierFiltre || c.chantier === chantierFiltre) && (!graviteFiltre || c.gravite === graviteFiltre),
  );
  const relus = audit.constats.filter((c) => c.relu).length;

  if (constat) {
    return (
      <>
        <Fiche constat={constat} audit={audit} onLire={(passage) => setLire({ id: constat.provenance.retenu!, passage })} />
        {lire && <LecteurDocument id={lire.id} surligner={lire.passage} onFermer={() => setLire(null)} />}
      </>
    );
  }

  return (
    <div className="vue">
      <div className="large">
        <div className="carte">
          <BarreGravites constats={audit.constats} />
          <div className="rangee" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
            <button className={`bouton sm ${!graviteFiltre && !chantierFiltre ? "fort" : ""}`} onClick={() => poser({ graviteFiltre: null, chantierFiltre: null })}>
              Tous ({audit.constats.length})
            </button>
            {GRAVITES.filter((g) => audit.constats.some((c) => c.gravite === g)).map((g) => (
              <button key={g} className={`bouton sm ${graviteFiltre === g ? "fort" : ""}`} onClick={() => poser({ graviteFiltre: graviteFiltre === g ? null : g })}>
                {g} ({audit.constats.filter((c) => c.gravite === g).length})
              </button>
            ))}
            <span className="sous" style={{ marginLeft: "auto" }}>
              {relus} relu{relus > 1 ? "s" : ""} sur {audit.constats.length}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {liste.map((c) => (
            <button key={c.id} className={`ligne g-bord-${c.gravite === "élevée" ? "elevee" : c.gravite}`} onClick={() => ouvrirConstat(c.id)}>
              <div className="tete">
                <span className="ref">{c.id}</span>
                <Gravite gravite={c.gravite} />
                <span className="cit">{nomChantier(audit.chantiers, c.chantier)}</span>
                {c.nonEtabli && <NonEtabli />}
                {c.relu && <span className="vu">✓ relu</span>}
              </div>
              <div className="txt">{c.question} — <b>{c.valeur}</b></div>
              <div className="dit">
                <Renvoi
                  nom={c.provenance.nomRetenu}
                  clause={c.provenance.clause}
                  page={c.provenance.page}
                  origine={c.provenance.origineTexte}
                  compact
                />
                {c.spa && <span className="meca">→ {c.spa.mecanisme}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fiche({ constat: c, audit, onLire }: { constat: Constat; audit: Audit; onLire: (passage: string | null) => void }) {
  const [pasOuvert, setPasOuvert] = useState<string | null>(null);
  const p = c.provenance;

  return (
    <div className="vue pleine">
      <div className="fiche-tete">
        <button className="bouton discret sm" onClick={() => ouvrirConstat(null)}>← Tous les constats</button>
        <div className="fiche-titre">
          <span className="ref">{c.id}</span>
          <Gravite gravite={c.gravite} />
          {c.nonEtabli && <NonEtabli />}
          <span className="sous">{nomChantier(audit.chantiers, c.chantier)}</span>
        </div>
        <h2>{c.question}</h2>
        <p className="sous" style={{ margin: "5px 0 0", maxWidth: "86ch" }}>{c.pourquoi}</p>
        <div className="rangee" style={{ marginTop: 12, gap: 9 }}>
          <button className={`bouton sm ${c.relu ? "" : "fort"}`} onClick={() => basculerRelu(c.id)}>
            {c.relu ? "✓ Relu — annuler" : "Marquer comme relu"}
          </button>
          {p.retenu && (
            <button className="bouton sm" onClick={() => onLire(p.extrait)}>
              Ouvrir le document au passage
            </button>
          )}
        </div>
      </div>

      {/* Le cœur : l'extrait et la rédaction côte à côte. */}
      <div className="cote-a-cote">
        <div className="volet">
          <div className="volet-tete">
            <span className="etiquette">Ce que dit le document</span>
            <Renvoi nom={p.nomRetenu} clause={p.clause} page={p.page} />
          </div>
          {p.origineTexte?.par === "reconnaissance" && (
            <div className="avis-ocr">
              <Origine origine={p.origineTexte} />
              <span>
                Ce document est un scan sans couche de texte. Le passage ci-dessous a été lu par{" "}
                {p.origineTexte.modele}, et non copié d'un fichier : <b>confirmez-le sur l'original</b> avant de
                l'opposer.
              </span>
            </div>
          )}
          {p.extrait ? (
            <>
              <blockquote className="verbatim">{p.extrait}</blockquote>
              <div className="sous" style={{ marginTop: 10 }}>
                Copié du document, mot pour mot. {p.ligne ? `Ligne ${p.ligne}.` : ""}{" "}
                {p.retenu && (
                  <button className="lien-constat" onClick={() => onLire(p.extrait)}>Voir dans le document →</button>
                )}
              </div>
            </>
          ) : (
            <div className="vide-volet">
              Aucun passage : le dossier ne porte pas l'information. Rien n'a été copié, donc rien n'est affirmé.
            </div>
          )}
        </div>

        <div className="volet">
          <div className="volet-tete">
            <span className="etiquette">Ce qui est rédigé au rapport</span>
            <span className="sous">{c.valeur}</span>
          </div>
          <p className="redaction">{c.redaction}</p>
          {c.impact && (
            <>
              <span className="etiquette" style={{ marginTop: 16 }}>Pourquoi cela compte pour {audit.cote}</span>
              <p className="redaction impact">{c.impact}</p>
            </>
          )}
        </div>
      </div>

      {/* Ce qui a été écarté, et pourquoi. */}
      {p.ecartes.length > 0 && (
        <div className="ecartes-bande">
          <span className="etiquette" style={{ marginBottom: 0 }}>Écarté en route</span>
          {p.ecartes.map((e) => (
            <span key={e.document} className="ecarte-puce" title={e.pourquoi}>
              <b>{e.nom}</b> — {e.pourquoi}
            </span>
          ))}
        </div>
      )}

      {/* Le droit applicable, vérifié sur le texte officiel. */}
      {c.droit?.resultat && <Droit resultat={c.droit.resultat} />}

      {/* Le mécanisme proposé au contrat de cession. */}
      {c.spa && (
        <div className="spa-bande">
          <div>
            <span className="etiquette">Au contrat de cession</span>
            <div className="meca-nom">{c.spa.mecanisme}</div>
          </div>
          <p className="redaction">{c.spa.redaction}</p>
        </div>
      )}

      <div className="fil-entete" style={{ borderTop: "1px solid var(--trait)" }}>
        <div className="fil-phrase">Le chemin complet, pas par pas</div>
        <div className="fil-cite">
          {p.parcourus.length} documents parcourus, {p.consultes.length} consultés, 1 retenu. Cliquez un pas
          pour le lire en entier.
        </div>
      </div>
      <FilProvenance
        constat={c}
        documents={audit.documents}
        cle={c.id}
        pasOuvert={pasOuvert}
        onOuvrir={setPasOuvert}
      />
    </div>
  );
}

function Droit({ resultat }: { resultat: NonNullable<Constat["droit"]>["resultat"] }) {
  if (!resultat) return null;
  if (!resultat.verifie) {
    return (
      <div className="droit-bande non-verifie">
        <span className="etiquette">Le droit applicable</span>
        <p style={{ margin: 0 }}>{resultat.motif} Aucune conclusion de droit n'est tirée.</p>
      </div>
    );
  }
  const a = resultat.article;
  const j = resultat.jurisprudence;
  return (
    <div className="droit-bande">
      <div className="rangee" style={{ alignItems: "flex-start", marginBottom: 12 }}>
        <span className="etiquette" style={{ marginBottom: 0 }}>La clause tient-elle en droit ?</span>
        <span className="sous" style={{ marginLeft: "auto" }}>{resultat.base}</span>
      </div>
      <div className="droit-colonnes">
        {a && (
          <div>
            <div className="droit-ref">
              {a.reference}
              <span className={`jeton ${a.etat === "en vigueur" ? "g-faible" : "g-critique"}`}>
                <span className="puce" />{a.etat}
              </span>
            </div>
            <blockquote className="verbatim petit">{a.texte}</blockquote>
            <div className="sous" style={{ marginTop: 8 }}>
              <code>{a.identifiant}</code>
              {a.versionApplicable && <> · version applicable depuis le {a.versionApplicable.debut}</>}
              {a.nombreVersions > 1 && <> · {a.nombreVersions} versions</>}
              {" · "}
              <a href={a.lien} target="_blank" rel="noreferrer">Légifrance ↗</a>
            </div>
          </div>
        )}
        {j && (
          <div>
            <div className="droit-ref">
              Jurisprudence <span className="sous">{j.total} décisions au soutien</span>
            </div>
            {j.decisions.map((d) => (
              <div key={d.numero} className="decision">
                <div className="rangee">
                  <b>{d.numero}</b>
                  <span className="sous">{d.date} · {d.juridiction} {d.chambre}</span>
                </div>
                <div className="sous resume">{d.resume}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
