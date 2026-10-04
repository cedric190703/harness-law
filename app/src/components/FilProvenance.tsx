// Le chemin qui mène à une information du rapport.
//
// Il se lit de gauche à droite : la question posée, les documents parcourus,
// ceux qui contenaient quelque chose, celui qui a été retenu — avec sa clause
// et sa page —, le passage copié, le texte rédigé, le droit applicable, et le
// mécanisme proposé au contrat de cession.
//
// Les pas apparaissent un par un. Ce n'est pas un ornement : c'est ce qui
// montre au juriste qu'il peut s'arrêter au pas qui l'intéresse au lieu de
// rouvrir les documents.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Constat, Document } from "../types";
import { court } from "../store";
import { classe } from "./ui";

const COL = 340;
const LARGEUR = 292;
const H = 170;
const H_PETIT = 104;
const ECART = 14;

export type GenrePas =
  | "question"
  | "parcourus"
  | "document"
  | "passage"
  | "redaction"
  | "droit"
  | "spa";

type Pas = {
  id: string;
  ordre: number;
  genre: GenrePas;
  rang: string;
  titre: string;
  corps: string | null;
  bas: string | null;
  /** « retenu » colore le pas, « écarté » l'estompe. */
  ton: "neutre" | "retenu" | "ecarte" | "gravite" | "inconnu";
  petit?: boolean;
};

const LIBELLE: Record<GenrePas, string> = {
  question: "La question d'audit",
  parcourus: "Ce qui a été parcouru",
  document: "Les documents consultés",
  passage: "Le passage retenu",
  redaction: "Ce qui est rédigé",
  droit: "Le droit applicable",
  spa: "Au contrat de cession",
};

/**
 * Construit le fil d'un constat. Tout vient du constat lui-même : le fil ne
 * peut donc rien dire que le rapport ne dise pas.
 */
export function filDuConstat(c: Constat, documents: Document[]): Pas[] {
  const pas: Pas[] = [];
  const ajouter = (p: Omit<Pas, "ordre">) => pas.push({ ...p, ordre: pas.length + 1 });
  const parId = new Map(documents.map((d) => [d.id, d]));
  const p = c.provenance;

  ajouter({
    id: "p-question",
    genre: "question",
    rang: "Pas 1",
    titre: c.question,
    corps: c.pourquoi,
    bas: null,
    ton: "neutre",
  });

  ajouter({
    id: "p-parcourus",
    genre: "parcourus",
    rang: "Pas 2",
    titre: `${p.parcourus.length} documents parcourus`,
    corps: `${p.consultes.length} contenaient un passage répondant à la question. Les ${
      p.parcourus.length - p.consultes.length
    } autres ont été lus sans rien trouver sur ce point.`,
    bas: p.motif ? `Motif de recherche : ${p.motif}` : null,
    ton: "neutre",
  });

  // Un pas par document consulté : le retenu, puis ceux écartés avec leur motif.
  const consultes = p.consultes.map((id) => {
    const d = parId.get(id);
    const estRetenu = id === p.retenu;
    const ecarte = p.ecartes.find((e) => e.document === id);
    return {
      id: `p-doc-${id}`,
      genre: "document" as const,
      rang: estRetenu ? "Retenu" : "Écarté",
      titre: d?.nom ?? id,
      corps: estRetenu
        ? [p.clause, p.page ? `page ${p.page}` : null].filter(Boolean).join(" · ") || "Document retenu."
        : (ecarte?.pourquoi ?? "Non retenu."),
      bas: estRetenu ? null : d?.motifTri && d.motifTri !== ecarte?.pourquoi ? d.motifTri : null,
      ton: estRetenu ? ("retenu" as const) : ("ecarte" as const),
      petit: true,
    };
  });
  // Les documents écartés qui n'étaient pas dans les consultés (doublons,
  // brouillons) comptent aussi : c'est ce que le juriste veut contester.
  for (const e of p.ecartes.filter((x) => !p.consultes.includes(x.document))) {
    consultes.push({
      id: `p-doc-${e.document}`,
      genre: "document" as const,
      rang: "Écarté",
      titre: e.nom,
      corps: e.pourquoi,
      bas: null,
      ton: "ecarte" as const,
      petit: true,
    });
  }
  if (!consultes.length && p.retenu) {
    consultes.push({
      id: `p-doc-${p.retenu}`,
      genre: "document" as const,
      rang: "Retenu",
      titre: p.nomRetenu ?? p.retenu,
      corps: [p.clause, p.page ? `page ${p.page}` : null].filter(Boolean).join(" · ") || "Document retenu.",
      bas: null,
      ton: "retenu" as const,
      petit: true,
    });
  }
  consultes.forEach(ajouter);

  ajouter({
    id: "p-passage",
    genre: "passage",
    rang: `Pas ${pas.length + 1}`,
    titre: p.extrait ? "Copié du document" : "Aucun passage",
    corps: p.extrait ?? "Le dossier ne porte pas l'information : rien n'a pu être copié.",
    bas: p.extrait ? "Ce passage existe mot pour mot dans le document retenu." : null,
    ton: p.extrait ? "neutre" : "inconnu",
  });

  ajouter({
    id: "p-redaction",
    genre: "redaction",
    rang: `Pas ${pas.length + 1}`,
    titre: c.valeur,
    corps: court(c.redaction, 220),
    bas: c.nonEtabli ? "Fait non établi par le dossier." : null,
    ton: c.nonEtabli ? "inconnu" : "gravite",
  });

  if (c.droit?.resultat) {
    const r = c.droit.resultat;
    ajouter({
      id: "p-droit",
      genre: "droit",
      rang: `Pas ${pas.length + 1}`,
      titre: r.verifie ? (r.article?.reference ?? "Jurisprudence") : "Droit non vérifié",
      corps: r.verifie
        ? `${r.article ? `${r.article.etat}, ${r.article.identifiant}. ` : ""}${
            r.jurisprudence ? `${r.jurisprudence.total} décisions au soutien dans Judilibre.` : ""
          }`
        : r.motif,
      bas: r.verifie ? r.base : null,
      ton: r.verifie ? "neutre" : "inconnu",
    });
  }

  if (c.spa) {
    ajouter({
      id: "p-spa",
      genre: "spa",
      rang: `Pas ${pas.length + 1}`,
      titre: c.spa.mecanisme,
      corps: court(c.spa.redaction, 230),
      bas: null,
      ton: "gravite",
    });
  }

  return pas;
}

type DonneesPas = { pas: Pas; gravite: string; ouvert: boolean; dernier: boolean };
type PasNode = Node<DonneesPas, "pas">;

function Carte({ data }: NodeProps<PasNode>) {
  const { pas, gravite, ouvert, dernier } = data;
  return (
    <div
      className={`pas-noeud t-${pas.ton} ${pas.petit ? "pas-petit" : ""} ${ouvert ? "ouvert" : ""} ${
        dernier ? "dernier" : ""
      } ${pas.ton === "gravite" ? `g-${gravite}` : ""}`}
      style={{ width: LARGEUR, height: pas.petit ? H_PETIT : H }}
      title="Cliquez pour lire ce pas en entier"
    >
      <Handle type="target" position={Position.Left} />
      <span className="filet" />
      <div className="pas-haut">
        <span className="pas-rang">{pas.rang}</span>
        <span className="pas-genre">{LIBELLE[pas.genre]}</span>
      </div>
      <div className="pas-titre">{court(pas.titre, pas.petit ? 58 : 92)}</div>
      {pas.corps && <div className={`pas-corps ${pas.genre === "passage" ? "verbatim" : ""}`}>{pas.corps}</div>}
      {pas.bas && <div className="pas-bas">{pas.bas}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { pas: Carte };

export function FilProvenance({
  constat,
  documents,
  cle,
  pasOuvert,
  onOuvrir,
}: {
  constat: Constat;
  documents: Document[];
  cle: string;
  pasOuvert: string | null;
  onOuvrir: (id: string | null) => void;
}) {
  const pas = useMemo(() => filDuConstat(constat, documents), [constat, documents]);
  const [visibles, setVisibles] = useState(0);
  const minuteurs = useRef<number[]>([]);

  const derouler = () => {
    minuteurs.current.forEach(clearTimeout);
    minuteurs.current = [];
    setVisibles(0);
    let cumul = 220;
    pas.forEach((p, i) => {
      cumul += p.genre === "document" ? 240 : 500;
      minuteurs.current.push(window.setTimeout(() => setVisibles(i + 1), cumul));
    });
  };

  useEffect(() => {
    derouler();
    return () => minuteurs.current.forEach(clearTimeout);
    // On rejoue en changeant de constat, pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  // Les documents consultés occupent une même colonne, empilés.
  const colonnes = useMemo(() => {
    const ordre: GenrePas[] = ["question", "parcourus", "document", "passage", "redaction", "droit", "spa"];
    const presentes = ordre.filter((g) => pas.some((p) => p.genre === g));
    return new Map(presentes.map((g, i) => [g, i * COL]));
  }, [pas]);

  const docs = pas.filter((p) => p.genre === "document");
  const bande = docs.length * H_PETIT + Math.max(0, docs.length - 1) * ECART;
  const yCentre = Math.max(0, bande / 2 - H / 2);

  const nodes = useMemo<Node[]>(() => {
    let rangDoc = 0;
    return pas
      .filter((p) => p.ordre <= visibles)
      .map((p) => ({
        id: p.id,
        type: "pas" as const,
        position: {
          x: colonnes.get(p.genre) ?? 0,
          y: p.genre === "document" ? rangDoc++ * (H_PETIT + ECART) : yCentre,
        },
        draggable: false,
        data: {
          pas: p,
          gravite: classe(constat.gravite),
          ouvert: pasOuvert === p.id,
          dernier: p.ordre === visibles && visibles < pas.length,
        },
      })) satisfies PasNode[];
  }, [pas, visibles, colonnes, yCentre, pasOuvert, constat.gravite]);

  const edges = useMemo<Edge[]>(() => {
    const vus = new Set(pas.filter((p) => p.ordre <= visibles).map((p) => p.id));
    const lien = (de: string, vers: string): Edge | null => {
      if (!vus.has(de) || !vus.has(vers)) return null;
      const cible = pas.find((p) => p.id === vers)!;
      const couleur =
        cible.ton === "ecarte" ? "#c9c2b2" : cible.ton === "inconnu" ? "#9c988f" : cible.ton === "retenu" ? "#2d7a58" : "#8f99ab";
      return {
        id: `${de}->${vers}`,
        source: de,
        target: vers,
        type: "smoothstep",
        animated: cible.ordre === visibles && visibles < pas.length,
        style: { stroke: couleur, strokeWidth: 2, opacity: cible.ton === "ecarte" ? 0.5 : 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: couleur },
      };
    };
    const liens: (Edge | null)[] = [];
    const chaine = pas.filter((p) => p.genre !== "document");
    const avant = pas.find((p) => p.genre === "parcourus");
    const apres = pas.find((p) => p.genre === "passage");
    // La chaîne principale, en sautant la colonne des documents.
    const sansDocs = chaine.filter((p) => p.genre !== "parcourus" || true);
    for (let i = 1; i < sansDocs.length; i += 1) {
      const de = sansDocs[i - 1];
      const vers = sansDocs[i];
      if (de.genre === "parcourus" && vers.genre === "passage") continue; // passe par les documents
      liens.push(lien(de.id, vers.id));
    }
    // L'éventail vers les documents, et le retour depuis le seul retenu.
    if (avant) docs.forEach((d) => liens.push(lien(avant.id, d.id)));
    if (apres) {
      const retenu = docs.find((d) => d.ton === "retenu");
      if (retenu) liens.push(lien(retenu.id, apres.id));
      else docs.forEach((d) => liens.push(lien(d.id, apres.id)));
    }
    return liens.filter(Boolean) as Edge[];
  }, [pas, visibles, docs]);

  return (
    <div className="flux fil">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onOuvrir((n.data as DonneesPas).pas.id)}
        onPaneClick={() => onOuvrir(null)}
        minZoom={0.28}
        maxZoom={1.35}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#ddd6c7" />
        <Controls showInteractive={false} position="bottom-right" />
        <Cadrer visibles={visibles} />
        <Panel position="top-left">
          <div className="fil-barre">
            <div className="fil-compte">
              Pas <b>{Math.min(visibles, pas.length)}</b> sur {pas.length}
            </div>
            <div className="fil-jauge">
              <span style={{ width: `${(Math.min(visibles, pas.length) / pas.length) * 100}%` }} />
            </div>
            <button className="bouton sm" onClick={derouler}>↻ Rejouer</button>
            {visibles < pas.length && (
              <button className="bouton sm" onClick={() => { minuteurs.current.forEach(clearTimeout); setVisibles(pas.length); }}>
                Tout afficher
              </button>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function Cadrer({ visibles }: { visibles: number }) {
  const flow = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => flow.fitView({ padding: 0.14, duration: visibles <= 1 ? 0 : 420 }), 40);
    return () => clearTimeout(t);
  }, [visibles, flow]);
  return null;
}
