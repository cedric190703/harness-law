// Le journal des agents.
//
// Il répond à une question que le juriste se pose en permanence : qu'est-ce que
// la machine a fait, dans quel ordre, et sur quelles pièces ? Chaque entrée
// nomme son acteur, dit son action, et porte les pièces qu'elle a touchées.
//
// Les pièces touchées servent deux fois : au journal en direct, et au schéma du
// parcours — une ligne par pièce, un point par passage. Une pièce dont la ligne
// reste vide n'a jamais été ouverte, et cela se voit d'un coup d'œil.

/** Les acteurs, dans l'ordre où ils interviennent. */
export const ACTEURS = [
  { id: "Trieur", quoi: "ouvre chaque fichier, écarte les doublons et les brouillons" },
  { id: "Lecteur", quoi: "lit les scans par reconnaissance de caractères" },
  { id: "Cadreur", quoi: "confronte ce qui est arrivé à la liste de demandes" },
  { id: "Chercheur", quoi: "cherche, pièce par pièce, les clauses que l'audit doit relever" },
  { id: "Règles", quoi: "vérifie chaque passage mot pour mot et établit le constat" },
  { id: "Droit", quoi: "contrôle le texte officiel sur Légifrance et Judilibre" },
  { id: "Contradicteur", quoi: "éprouve les réponses du vendeur contre les pièces" },
  { id: "Rédacteur", quoi: "rédige et traduit au contrat de cession" },
];

/** Crée un journal. `surEntree` sert à diffuser en direct pendant un passage. */
export function journal(surEntree = () => {}) {
  const entrees = [];
  return {
    entrees,
    /**
     * Consigne une action.
     *
     * `pistes` porte les identifiants des pièces touchées. On y met aussi deux
     * lignes qui ne sont pas des pièces — « droit » et « rapport » — pour que le
     * schéma montre aussi ce qui sort de la data room.
     */
    dire(acteur, action, { detail = null, pistes = [], constat = null, outil = null } = {}) {
      const e = { t: new Date().toISOString(), acteur, action, detail, pistes, constat, outil };
      entrees.push(e);
      surEntree(e);
      return e;
    },
  };
}

/** Les acteurs qui tirent quelque chose d'une pièce, par opposition à l'ouvrir. */
const EXPLOITANTS = new Set(["Chercheur", "Règles", "Contradicteur", "Cadreur"]);

/**
 * Le schéma du parcours : une ligne par pièce, un point par passage.
 *
 * Deux états bien distincts, et c'est toute la valeur du schéma :
 *
 *   — **ouverte** : le Trieur l'a lue. Toutes le sont, par construction.
 *   — **exploitée** : une recherche y a trouvé quelque chose, ou un constat en
 *     est sorti.
 *
 * Une pièce ouverte mais jamais exploitée est l'information que les outils
 * d'extraction taisent : elle a été lue, et elle n'a rien donné. Le juriste doit
 * pouvoir se demander si c'est normal.
 */
export function parcours(entrees, documents) {
  // Les fichiers d'audit vivent sur disque et survivent aux changements de code.
  // Un journal d'une version antérieure n'a ni acteur ni pistes : on le lit sans
  // s'arrêter plutôt que de refuser d'ouvrir le dossier.
  const lues = (entrees ?? []).filter((e) => e && typeof e === "object").map((e) => ({
    t: e.t ?? e.a ?? new Date(0).toISOString(),
    acteur: e.acteur ?? "Visa",
    action: e.action ?? e.etape ?? "action",
    detail: e.detail ?? null,
    pistes: Array.isArray(e.pistes) ? e.pistes : [],
    constat: e.constat ?? null,
  }));
  const lignes = [
    ...documents.map((d) => ({ id: d.id, nom: d.nom, role: d.role, piece: true })),
    { id: "droit", nom: "Légifrance et Judilibre", role: "externe", piece: false },
    { id: "rapport", nom: "Le rapport", role: "sortie", piece: false },
  ];
  const ouvertes = new Set(lues.flatMap((e) => e.pistes));
  const exploitees = new Set(lues.filter((e) => EXPLOITANTS.has(e.acteur)).flatMap((e) => e.pistes));
  return {
    lignes: lignes.map((l) => ({
      ...l,
      ouverte: ouvertes.has(l.id),
      exploitee: exploitees.has(l.id),
    })),
    pas: lues.map((e, i) => ({
      rang: i,
      t: e.t,
      acteur: e.acteur,
      action: e.action,
      detail: e.detail,
      constat: e.constat,
      exploite: EXPLOITANTS.has(e.acteur),
      pistes: e.pistes.length ? e.pistes : ["rapport"],
    })),
    /** Lues, et dont rien n'a été tiré. */
    sansSuite: lignes
      .filter((l) => l.piece && ouvertes.has(l.id) && !exploitees.has(l.id))
      .map((l) => ({ id: l.id, nom: l.nom, role: l.role })),
  };
}
