// Le schéma du contrôle : ce que Visa fait, dans l'ordre, sur un seul écran.
//
// Il est dessiné pour être lu de gauche à droite comme une phrase : on part du
// texte, on le découpe, on va chercher les sources dans deux bases, on passe
// quatre contrôles en parallèle, on fait contredire, on consigne.
//
// Les positions sont écrites à la main. Un placement automatique donnerait un
// résultat différent à chaque ouverture, et c'est exactement ce qu'il ne faut
// pas ici : le juriste doit retrouver le même dessin à chaque fois.

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CONTROLES, compter } from "../engine/etapes";
import type { Affirmation, Etape, EtapeId, Verdict } from "../types";
import { Jeton, MOT } from "./ui";

const TRAIT_FAIT = "#8f99ab";
const TRAIT_ACTIF = "#2f4a73";
const TRAIT_ATTENTE = "#dcd6c9";

type Commun = {
  rang: string;
  titre: string;
  explication: string;
  outil: string | null;
  etat: Etape["etat"];
  compte: string | null;
  verdict: Verdict | null;
  etapeId: EtapeId;
  ouvert: boolean;
  petit?: boolean;
};

type CarteNode = Node<Commun, "carte">;
type CadreNode = Node<{ titre: string; soustitre: string; etat: Etape["etat"] }, "cadre">;

function classeEtat(d: Commun): string {
  if (d.etat === "en attente") return "attente";
  if (d.etat === "en cours") return "e-cours";
  return d.verdict ? `e-${d.verdict}` : "";
}

/** Une étape, telle qu'elle apparaît sur le schéma. */
function Carte({ data }: NodeProps<CarteNode>) {
  return (
    <div
      className={`noeud ${d(data)} ${data.petit ? "petit-noeud" : ""} ${data.ouvert ? "ouvert" : ""}`}
      title="Cliquez pour voir le détail des tâches"
    >
      <Handle type="target" position={Position.Left} />
      <span className="filet" />
      <span className="rang">{data.rang}</span>
      <span className="nom">{data.titre}</span>
      <span className="quoi">{data.explication}</span>
      <span className="pied">
        {data.etat === "en cours" ? (
          <>
            <span className="en-cours-point" />
            <span className="compte">en cours…</span>
          </>
        ) : data.etat === "en attente" ? (
          <span className="compte" style={{ color: "var(--encre-3)" }}>
            en attente
          </span>
        ) : (
          <span className="compte">{data.compte ?? "fait"}</span>
        )}
        {data.outil && <span className="outil">{data.outil}</span>}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function d(data: Commun) {
  return classeEtat(data);
}

/** Le cadre qui réunit les quatre contrôles, pour montrer qu'ils vont ensemble. */
function Cadre({ data }: NodeProps<CadreNode>) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 16,
        border: "1px dashed var(--trait-fort)",
        background: "rgba(255,255,255,0.55)",
        padding: "12px 14px",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontFamily: "var(--serif)", fontSize: 15.5 }}>{data.titre}</div>
      <div style={{ fontSize: 11.5, color: "var(--encre-3)", lineHeight: 1.35, marginTop: 2 }}>{data.soustitre}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { carte: Carte, cadre: Cadre };

/** Le pire verdict d'un lot, dans l'ordre de sévérité. */
function pire(verdicts: Verdict[]): Verdict | null {
  const ordre: Verdict[] = ["rouge", "orange", "gris", "vert"];
  return ordre.find((v) => verdicts.includes(v)) ?? null;
}

export function FluxControle({
  etapes,
  affirmations,
  etapeOuverte,
  onOuvrir,
}: {
  etapes: Etape[];
  affirmations: Affirmation[];
  etapeOuverte: EtapeId | null;
  onOuvrir: (id: EtapeId) => void;
}) {
  const parId = useMemo(() => new Map(etapes.map((e) => [e.id, e])), [etapes]);

  const nodes = useMemo<Node[]>(() => {
    const e = (id: EtapeId) => parId.get(id)!;
    const avecCitation = affirmations.filter((a) => a.citation);
    const articles = avecCitation.filter((a) => a.source && a.source.rang !== "jurisprudence");
    const decisions = avecCitation.filter((a) => !a.source || a.source.rang === "jurisprudence");
    const recherche = e("recherche");
    const controles = e("controles");

    const carte = (
      id: string,
      etapeId: EtapeId,
      rang: string,
      position: { x: number; y: number },
      sur: Partial<Commun> = {},
    ): Node => {
      const etape = e(etapeId);
      return {
        id,
        type: "carte",
        position,
        draggable: false,
        data: {
          rang,
          titre: etape.titre,
          explication: etape.explication,
          outil: etape.outil,
          etat: etape.etat,
          compte: etape.compte,
          verdict: null,
          etapeId,
          ouvert: etapeOuverte === etapeId,
          ...sur,
        } satisfies Commun,
      };
    };

    const introuvables = decisions.filter((a) => a.source && !a.source.identifiant).length;

    return [
      carte("texte", "texte", "Étape 1", { x: 0, y: 190 }, { verdict: "vert" }),
      carte("decoupage", "decoupage", "Étape 2", { x: 310, y: 190 }, { verdict: "vert" }),

      // L'étape 3 se montre par base : c'est là que le juriste veut savoir
      // *où* Visa est allé chercher.
      carte("legifrance", "recherche", "Étape 3 · base", { x: 620, y: 88 }, {
        titre: "Légifrance",
        explication: "Les articles de code, les lois, les décrets et les circulaires.",
        outil: "API Légifrance",
        compte: recherche.etat === "terminée" ? `${articles.length} articles retrouvés` : null,
        verdict: recherche.etat === "terminée" ? "vert" : null,
        petit: true,
      }),
      carte("judilibre", "recherche", "Étape 3 · base", { x: 620, y: 300 }, {
        titre: "Judilibre",
        explication: "Les décisions de la Cour de cassation, par numéro de pourvoi.",
        outil: "API Judilibre",
        compte:
          recherche.etat === "terminée"
            ? introuvables
              ? `${decisions.length - introuvables} retrouvées, ${introuvables} introuvable${introuvables > 1 ? "s" : ""}`
              : `${decisions.length} décisions retrouvées`
            : null,
        verdict: recherche.etat === "terminée" ? (introuvables ? "rouge" : "vert") : null,
        petit: true,
      }),

      {
        id: "cadre",
        type: "cadre",
        position: { x: 890, y: 14 },
        draggable: false,
        selectable: false,
        style: { width: 244, height: 460 },
        data: {
          titre: "Étape 4 — les quatre contrôles",
          soustitre: "Les mêmes quatre questions, sur chaque affirmation.",
          etat: controles.etat,
        },
      } satisfies CadreNode,

      ...CONTROLES.map((ctl, i) => {
        const verdicts = affirmations.map((a) => a.controles.find((c) => c.id === ctl.id)?.verdict).filter(Boolean) as Verdict[];
        const v = controles.etat === "terminée" ? pire(verdicts) : null;
        const c = compter(
          affirmations.map((a) => ({ ...a, verdict: a.controles.find((x) => x.id === ctl.id)?.verdict ?? "gris" })),
        );
        const ennuis = c.rouge + c.orange;
        return {
          id: `ctl-${ctl.id}`,
          type: "carte",
          parentId: "cadre",
          extent: "parent" as const,
          position: { x: 18, y: 58 + i * 98 },
          draggable: false,
          data: {
            rang: `Contrôle ${i + 1}`,
            titre: ctl.titre,
            explication: ctl.question,
            outil: null,
            etat: controles.etat,
            compte:
              controles.etat === "terminée"
                ? ennuis
                  ? `${ennuis} à traiter sur ${affirmations.length}`
                  : `${affirmations.length} sur ${affirmations.length}`
                : null,
            verdict: v,
            etapeId: "controles" as EtapeId,
            ouvert: etapeOuverte === "controles",
            petit: true,
          } satisfies Commun,
        } satisfies CarteNode;
      }),

      carte("contradiction", "contradiction", "Étape 5", { x: 1200, y: 190 }, {
        verdict: parId.get("contradiction")!.etat === "terminée" ? "vert" : null,
      }),
      carte("journal", "journal", "Étape 6", { x: 1510, y: 190 }, {
        verdict: parId.get("journal")!.etat === "terminée" ? pire(affirmations.map((a) => a.verdict)) : null,
      }),
    ];
  }, [parId, affirmations, etapeOuverte]);

  const edges = useMemo<Edge[]>(() => {
    const etat = (id: EtapeId) => parId.get(id)!.etat;
    const lien = (id: string, source: string, target: string, depuis: EtapeId): Edge => {
      const e = etat(depuis);
      const couleur = e === "terminée" ? TRAIT_FAIT : e === "en cours" ? TRAIT_ACTIF : TRAIT_ATTENTE;
      return {
        id,
        source,
        target,
        type: "smoothstep",
        animated: e === "en cours",
        style: { stroke: couleur, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: couleur },
      };
    };
    return [
      lien("e1", "texte", "decoupage", "texte"),
      lien("e2", "decoupage", "legifrance", "decoupage"),
      lien("e3", "decoupage", "judilibre", "decoupage"),
      lien("e4", "legifrance", "cadre", "recherche"),
      lien("e5", "judilibre", "cadre", "recherche"),
      lien("e6", "cadre", "contradiction", "controles"),
      lien("e7", "contradiction", "journal", "contradiction"),
    ];
  }, [parId]);

  const c = compter(affirmations);

  return (
    <div className="flux">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => {
          const etapeId = (n.data as Commun).etapeId;
          if (etapeId) onOuvrir(etapeId);
        }}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.35}
        maxZoom={1.3}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#ddd6c7" />
        <Controls showInteractive={false} position="bottom-right" />
        <Panel position="bottom-left">
          <div
            className="carte"
            style={{ padding: "13px 16px", maxWidth: 420, display: "flex", flexDirection: "column", gap: 9 }}
          >
            <div style={{ fontSize: 12.5, color: "var(--encre-2)", lineHeight: 1.5 }}>
              Chaque carte est une étape. <b>Cliquez-la</b> pour voir, une par une, les tâches qu'elle a
              exécutées et la preuve de chacune.
            </div>
            {affirmations.length > 0 && (
              <div className="legende" style={{ gap: "6px 14px" }}>
                {(["rouge", "orange", "gris", "vert"] as Verdict[]).map((v) => (
                  <span key={v} className="rangee" style={{ gap: 6 }}>
                    <Jeton verdict={v} texte={`${c[v]} ${MOT[v].toLowerCase()}`} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
