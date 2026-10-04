// Le fil du raisonnement, déroulé à l'écran.
//
// Il se lit de gauche à droite : l'affirmation, la référence, la requête
// envoyée à la base, la source retrouvée, les quatre contrôles en parallèle,
// la contradiction, la conclusion.
//
// Les pas apparaissent un par un, dans l'ordre où Visa les a franchis. Ce n'est
// pas un effet : c'est la seule façon de montrer qu'un verdict est le bout
// d'une chaîne, et non une opinion rendue d'un bloc.

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
import type { PasRaisonnement } from "../engine/raisonnement";
import type { Verdict } from "../types";
import { Jeton } from "./ui";

const COL = 348;
const LARGEUR = 300;
const H_PRINCIPAL = 176;
const H_CONTROLE = 128;
const ECART_CONTROLE = 18;

const GENRE_LIBELLE: Record<PasRaisonnement["genre"], string> = {
  affirmation: "Le point de départ",
  reference: "Ce qui est cité",
  requete: "La requête envoyée",
  source: "Le texte officiel",
  controle: "Contrôle",
  contradiction: "La contradiction",
  conclusion: "Le bout de la chaîne",
};

type DonneesPas = { pas: PasRaisonnement; ouvert: boolean; dernier: boolean };
type PasNode = Node<DonneesPas, "pas">;

function CartePas({ data }: NodeProps<PasNode>) {
  const { pas, ouvert, dernier } = data;
  const controle = pas.genre === "controle";
  return (
    <div
      className={`pas-noeud ${controle ? "pas-controle" : ""} ${pas.genre === "conclusion" ? "pas-conclusion" : ""} ${
        ouvert ? "ouvert" : ""
      } ${dernier ? "dernier" : ""} ${pas.verdict ? `p-${pas.verdict}` : ""}`}
      style={{ width: LARGEUR, height: controle ? H_CONTROLE : H_PRINCIPAL }}
      title="Cliquez pour lire ce pas en entier"
    >
      <Handle type="target" position={Position.Left} />
      <span className="filet" />
      <div className="pas-haut">
        <span className="pas-ordre">{pas.ordre}</span>
        <span className="pas-genre">
          {GENRE_LIBELLE[pas.genre]}
          {pas.numeroControle ? ` ${pas.numeroControle}` : ""}
        </span>
        {pas.verdict && <span className="pas-jeton"><Jeton verdict={pas.verdict} /></span>}
      </div>
      <div className="pas-titre">{pas.titre}</div>
      {pas.constat && <div className="pas-constat">{pas.constat}</div>}
      {!pas.constat && pas.deduction && <div className="pas-constat pas-sans">{pas.deduction}</div>}
      {pas.outil && <div className="pas-outil">{pas.outil}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { pas: CartePas };

/** Les colonnes présentes, dans l'ordre, et le x de chacune. */
function colonnes(pas: PasRaisonnement[]): Map<PasRaisonnement["genre"], number> {
  const ordre: PasRaisonnement["genre"][] = [
    "affirmation",
    "reference",
    "requete",
    "source",
    "controle",
    "contradiction",
    "conclusion",
  ];
  const presentes = ordre.filter((g) => pas.some((p) => p.genre === g));
  return new Map(presentes.map((g, i) => [g, i * COL]));
}

export function FilRaisonnement({
  pas,
  cle,
  pasOuvert,
  onOuvrir,
}: {
  pas: PasRaisonnement[];
  /** Change quand on passe à une autre affirmation : le fil se rejoue. */
  cle: string;
  pasOuvert: string | null;
  onOuvrir: (id: string | null) => void;
}) {
  const [visibles, setVisibles] = useState(0);
  const minuteur = useRef<number[]>([]);

  const derouler = () => {
    minuteur.current.forEach(clearTimeout);
    minuteur.current = [];
    setVisibles(0);
    // Les quatre contrôles se succèdent vite : ils se font en parallèle, et le
    // dessin doit le dire.
    let cumul = 260;
    pas.forEach((p, i) => {
      cumul += p.genre === "controle" ? 230 : 520;
      minuteur.current.push(
        window.setTimeout(() => setVisibles(i + 1), cumul),
      );
    });
  };

  useEffect(() => {
    derouler();
    return () => minuteur.current.forEach(clearTimeout);
    // On rejoue à chaque changement d'affirmation, pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  const toutAfficher = () => {
    minuteur.current.forEach(clearTimeout);
    minuteur.current = [];
    setVisibles(pas.length);
  };

  const x = useMemo(() => colonnes(pas), [pas]);
  const controles = useMemo(() => pas.filter((p) => p.genre === "controle"), [pas]);
  const hauteurBande = controles.length * H_CONTROLE + (controles.length - 1) * ECART_CONTROLE;
  const yPrincipal = Math.max(0, hauteurBande / 2 - H_PRINCIPAL / 2);

  const nodes = useMemo<Node[]>(() => {
    let rangControle = 0;
    return pas
      .filter((p) => p.ordre <= visibles)
      .map((p) => {
        const estControle = p.genre === "controle";
        const y = estControle ? rangControle++ * (H_CONTROLE + ECART_CONTROLE) : yPrincipal;
        return {
          id: p.id,
          type: "pas" as const,
          position: { x: x.get(p.genre) ?? 0, y },
          draggable: false,
          data: { pas: p, ouvert: pasOuvert === p.id, dernier: p.ordre === visibles && visibles < pas.length },
        } satisfies PasNode;
      });
  }, [pas, visibles, x, yPrincipal, pasOuvert]);

  const edges = useMemo<Edge[]>(() => {
    const vus = new Set(pas.filter((p) => p.ordre <= visibles).map((p) => p.id));
    const premierControle = controles[0];
    const avantControles = pas.filter((p) => p.genre !== "controle" && p.ordre < (premierControle?.ordre ?? 99)).at(-1);
    const apresControles = pas.find((p) => p.genre === "contradiction" || p.genre === "conclusion");

    const lien = (source: string, target: string): Edge | null => {
      if (!vus.has(source) || !vus.has(target)) return null;
      const cible = pas.find((p) => p.id === target)!;
      const couleur = cible.verdict ? `var(--${cible.verdict})` : "#9aa3b2";
      return {
        id: `${source}->${target}`,
        source,
        target,
        type: "smoothstep",
        animated: cible.ordre === visibles && visibles < pas.length,
        style: { stroke: couleur, strokeWidth: 2, opacity: 0.75 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: couleur },
      };
    };

    const liens: (Edge | null)[] = [];
    // La chaîne avant les contrôles.
    const chaine = pas.filter((p) => p.genre !== "controle" && p.genre !== "contradiction" && p.genre !== "conclusion");
    chaine.forEach((p, i) => {
      if (i > 0) liens.push(lien(chaine[i - 1].id, p.id));
    });
    // L'éventail vers les quatre contrôles, puis le retour vers la suite.
    if (avantControles) controles.forEach((c) => liens.push(lien(avantControles.id, c.id)));
    if (apresControles) {
      if (controles.length) controles.forEach((c) => liens.push(lien(c.id, apresControles.id)));
      else if (avantControles) liens.push(lien(avantControles.id, apresControles.id));
    }
    // La contradiction mène à la conclusion.
    const contradiction = pas.find((p) => p.genre === "contradiction");
    const conclusion = pas.find((p) => p.genre === "conclusion");
    if (contradiction && conclusion) liens.push(lien(contradiction.id, conclusion.id));

    return liens.filter(Boolean) as Edge[];
  }, [pas, visibles, controles]);

  return (
    <div className="flux fil">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onOuvrir((n.data as DonneesPas).pas.id)}
        onPaneClick={() => onOuvrir(null)}
        minZoom={0.3}
        maxZoom={1.4}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#ddd6c7" />
        <Controls showInteractive={false} position="bottom-right" />
        <Suiveur visibles={visibles} total={pas.length} />
        <Panel position="top-left">
          <div className="fil-barre">
            <div className="fil-compte">
              Pas <b>{Math.min(visibles, pas.length)}</b> sur {pas.length}
            </div>
            <div className="fil-jauge">
              <span style={{ width: `${(Math.min(visibles, pas.length) / pas.length) * 100}%` }} />
            </div>
            <button className="bouton sm" onClick={derouler}>
              ↻ Rejouer
            </button>
            {visibles < pas.length && (
              <button className="bouton sm" onClick={toutAfficher}>
                Tout afficher
              </button>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/** Garde le pas qui vient d'apparaître dans le champ de vision. */
function Suiveur({ visibles, total }: { visibles: number; total: number }) {
  const flow = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => {
      flow.fitView({ padding: 0.16, duration: visibles <= 1 ? 0 : 420 });
    }, 40);
    return () => clearTimeout(t);
  }, [visibles, total, flow]);
  return null;
}

/** La couleur d'un verdict, pour les bordures du fil. */
export const COULEUR: Record<Verdict, string> = {
  vert: "var(--vert)",
  orange: "var(--orange)",
  rouge: "var(--rouge)",
  gris: "var(--gris)",
};
