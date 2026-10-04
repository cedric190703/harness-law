#!/usr/bin/env python3
"""Tableau de bord du banc d'essai : une seule page HTML autonome, à relancer quand de nouveaux résultats arrivent.

  python3 bench/tableau.py        # écrit bench/tableau/index.html et affiche son chemin

Pour chaque tâche × agent × condition (sans / avec notre méthode), la page garde le lancement le plus récent
qui est noté et qui compte. Les autres sont listés à part, avec la raison.

Seules les tâches de mise au point (TACHES_COUVERTES) montrent leur grille, les raisonnements du juge, les pièces
et les livrables. Les autres tâches, dont celles de test (bench/split*.json), ne montrent que leurs scores
globaux : lire leur grille fausserait la mesure. Le script refuse d'écrire la page si une grille hors de cette
liste s'y retrouve.
"""
import email
import json
import posixpath
import re
import shutil
import subprocess
import sys
import zipfile
from collections import Counter
from datetime import datetime
from email import policy
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
LAB = ROOT / "harvey-labs"
RESULTATS = LAB / "results"
TACHES = LAB / "tasks"
SORTIE = ROOT / "bench" / "tableau" / "index.html"

# Les seules tâches dont on a le droit d'afficher la grille (mise au point de la méthode).
TACHES_COUVERTES = (
    "corporate-ma/compare-closing-checklist-against-ma-agreement",
    "corporate-ma/review-disclosure-schedules-against-representations-for-completeness",
    "corporate-ma/compare-closing-docs",
)
TITRES = {
    "corporate-ma/compare-closing-checklist-against-ma-agreement":
        "Liste de closing contre le contrat de cession d'actifs",
    "corporate-ma/review-disclosure-schedules-against-representations-for-completeness":
        "Annexes de divulgation contre les déclarations et garanties",
    "corporate-ma/compare-closing-docs":
        "Documents de closing contre les exigences du contrat de cession d'actions",
}
DOMAINES = {"corporate-ma": "M&A", "banking-finance": "Banque et financement"}
AGENTS = {  # l'ordre des colonnes ; un agent inconnu s'ajoute à la fin
    "claude-code-sonnet": ("Claude Code (Sonnet 5.5)", "Claude Code"),
    "legora": ("Legora", "Legora"),
    "mistral-medium-3.5-high": ("Mistral Medium 3.5", "Mistral"),
}
IGNORES = ("codestral-",)
CONDITIONS = {"base": "sans", "skill": "avec"}
JUGE_PRINCIPAL = "claude-code-opus-5-5@max"
JUGES = {
    "claude-code-opus-5-5@max": "Claude Opus 5.5 (effort max)",
    "claude-code-opus": "Claude Opus 5.5",
    "claude-code-sonnet": "Claude Sonnet 5.5",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "gpt-5.5": "GPT-5.5",
    "codex-gpt-5.5@high": "GPT-5.5 via Codex (effort high)",
}
OUTILS = {"read": "lire", "bash": "commande", "write": "écrire", "edit": "modifier", "grep": "chercher",
          "glob": "lister", "finish": "terminer", "todowrite": "plan", "task": "sous-agent", "agent": "sous-agent",
          "skill": "méthode", "notebookedit": "modifier"}
LIMITE_PIECE = 150_000
LIMITE_LIVRABLE = 200_000
MOIS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
        "novembre", "décembre")
MOIS_COURTS = ("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def lire_json(fichier: Path) -> dict:
    try:
        valeur = json.loads(fichier.read_text())
        return valeur if isinstance(valeur, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def taches_de_test() -> set[str]:
    test: set[str] = set()
    for fichier in (ROOT / "bench").glob("split*.json"):
        test.update(lire_json(fichier).get("test", []))
    return test


def nom_juge(modele: str) -> str:
    if modele in JUGES:
        return JUGES[modele]
    base, _, effort = modele.partition("@")
    effort = f" (effort {effort})" if effort else ""
    if "mistral-large" in base:
        return "Mistral Large" + effort
    if base.startswith("codex-"):
        return base.removeprefix("codex-").replace("gpt", "GPT") + " via Codex" + effort
    return modele


def nom_agent(agent: str) -> tuple[str, str]:
    if agent in AGENTS:
        return AGENTS[agent]
    if agent.startswith("claude-code-"):
        return f"Claude Code ({agent.removeprefix('claude-code-').capitalize()})", "Claude Code"
    joli = agent.replace("-", " ").capitalize()
    return joli, joli


def date_lisible(horodatage: str) -> str:
    try:
        d = datetime.strptime(horodatage[:15], "%Y%m%d-%H%M%S")
    except ValueError:
        return horodatage
    return f"{d.day} {MOIS_COURTS[d.month - 1]} {d.year}, {d:%H:%M}"


# ---------- les notes ----------

def notes(dossier: Path) -> list[dict]:
    """La note la plus récente de chaque juge, le juge principal en premier."""
    sources = list((lire_json(dossier / "scores_dual.json").get("per_judge") or {}).values())
    sources += [lire_json(f) for f in sorted(dossier.glob("scores*.json")) if f.name != "scores_dual.json"]
    par_juge: dict[str, dict] = {}
    for s in sources:
        if not isinstance(s, dict) or not s.get("n_criteria"):
            continue
        juge = s.get("judge_model") or "juge inconnu"
        if juge not in par_juge or (s.get("scored_at") or "") > (par_juge[juge].get("scored_at") or ""):
            par_juge[juge] = s
    return sorted(par_juge.values(), key=lambda s: (s.get("judge_model") != JUGE_PRINCIPAL,
                                                     "opus" not in (s.get("judge_model") or ""),
                                                     s.get("scored_at") or ""))


def lancements() -> list[dict]:
    trouves = []
    for dossier in sorted(RESULTATS.glob("*/*/*/*")):
        if not dossier.is_dir():
            continue
        agent, _, condition = dossier.parent.name.rpartition("-")
        if condition not in CONDITIONS or not agent or agent.startswith(IGNORES):
            continue
        metriques = lire_json(dossier / "metrics.json")
        juges = notes(dossier)
        ecart = None
        if metriques.get("ne_compte_pas"):
            ecart = f"ne compte pas : {metriques['ne_compte_pas']}"
        elif not juges:
            ecart = "non noté"
        elif juges[0].get("n_grading_errors"):
            ecart = f"erreurs de notation ({juges[0]['n_grading_errors']} critère(s) non noté(s))"
        trouves.append({"dossier": dossier, "tache": f"{dossier.parts[-4]}/{dossier.parts[-3]}", "agent": agent,
                        "condition": condition, "horodatage": dossier.name, "metriques": metriques,
                        "juges": juges, "ecart": ecart})
    return trouves


def choisir(tous: list[dict]) -> tuple[list[dict], list[dict]]:
    """Le plus récent lancement valable de chaque tâche × agent × condition ; les autres avec leur raison."""
    groupes: dict[tuple, list[dict]] = {}
    for run in tous:
        groupes.setdefault((run["tache"], run["agent"], run["condition"]), []).append(run)
    retenus, ecartes = [], []
    for runs in groupes.values():
        runs.sort(key=lambda r: r["horodatage"])
        valables = [r for r in runs if r["ecart"] is None]
        garde = valables[-1] if valables else None
        if garde:
            retenus.append(garde)
        for r in runs:
            if r is garde:
                continue
            raison = r["ecart"] or f"remplacé par le lancement du {date_lisible(garde['horodatage'])}"
            ecartes.append({**r, "ecart": raison})
    return retenus, ecartes


def resume_juges(run: dict, avec_grille: bool) -> list[dict]:
    resume = []
    for s in run["juges"]:
        j = {"modele": s.get("judge_model"), "nom": nom_juge(s.get("judge_model") or ""), "n": s.get("n_passed"),
             "N": s.get("n_criteria"), "ok": bool(s.get("all_pass")), "erreurs": s.get("n_grading_errors") or 0}
        if avec_grille:
            criteres = s.get("criteria_results") or []
            j["verdicts"] = {c.get("id"): c.get("verdict") for c in criteres}
            j["raisons"] = {c.get("id"): c.get("reasoning") or "" for c in criteres}
        resume.append(j)
    return resume


# ---------- les textes : pièces et livrables réduits à des blocs simples ----------
# Un bloc : ["h", niveau, texte] titre · ["p", texte, style] paragraphe (style "", "b" gras, "q" retrait, "n" note)
# · ["l", profondeur, texte] puce · ["t", lignes, lignes_entete] tableau · ["c", texte] texte brut.

class VersBlocs(HTMLParser):
    """Le HTML de pandoc réduit à des blocs : la page les affiche en texte, sans jamais injecter de HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocs: list = []
        self.morceaux: list[str] = []
        self.gras = 0
        self.car_gras = 0
        self.genre: str | None = None
        self.niveau = 0
        self.listes = 0
        self.retrait = 0
        self.tableaux: list[dict] = []
        self.ignorer = 0

    def _texte(self) -> str:
        texte = "".join(self.morceaux)
        texte = re.sub(r"[ \t\r\f\v]+", " ", texte)
        return re.sub(r" *\n *", "\n", texte).strip()

    def _vider(self) -> None:
        texte, total = self._texte(), len("".join(self.morceaux).strip())
        if texte:
            if self.genre and self.genre[0] == "h":
                self.blocs.append(["h", self.niveau, texte])
            elif self.genre == "li":
                self.blocs.append(["l", max(self.listes, 1), texte])
            elif self.genre == "pre":
                self.blocs.append(["c", "".join(self.morceaux).strip("\n")])
            else:
                classes = (["b"] if total and self.car_gras >= total * 0.9 else []) + (["q"] if self.retrait else [])
                self.blocs.append(["p", texte, " ".join(classes)])
        self.morceaux, self.car_gras, self.genre = [], 0, None

    def handle_starttag(self, tag, attrs):
        cellule = self.tableaux and self.tableaux[-1]["cellule"] is not None
        if tag in ("script", "style"):
            self.ignorer += 1
        elif tag == "br":
            (self.tableaux[-1]["cellule"] if cellule else self.morceaux).append("\n")
        elif tag in ("strong", "b"):
            self.gras += 1
        elif cellule and tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
            self.tableaux[-1]["cellule"].append("\n")
        elif tag in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre", "div"):
            if tag == "p" and self.genre == "li" and not self.morceaux:
                return
            self._vider()
            self.genre = tag if tag != "div" else None
            self.niveau = int(tag[1]) if tag[0] == "h" and len(tag) == 2 else 0
        elif tag in ("ul", "ol"):
            self._vider()
            self.listes += 1
        elif tag == "blockquote":
            self._vider()
            self.retrait += 1
        elif tag == "table":
            self._vider()
            self.tableaux.append({"lignes": [], "entete": 0, "ligne": None, "cellule": None, "th": False})
        elif tag == "tr" and self.tableaux:
            self.tableaux[-1].update(ligne=[], th=False)
        elif tag in ("td", "th") and self.tableaux:
            self.tableaux[-1]["cellule"] = []
            self.tableaux[-1]["th"] |= tag == "th"

    def handle_endtag(self, tag):
        t = self.tableaux[-1] if self.tableaux else None
        if tag in ("script", "style"):
            self.ignorer = max(0, self.ignorer - 1)
        elif tag in ("strong", "b"):
            self.gras = max(0, self.gras - 1)
        elif t and tag in ("td", "th") and t["cellule"] is not None:
            texte = re.sub(r"[ \t\r\f\v]+", " ", "".join(t["cellule"]))
            texte = re.sub(r"\s*\n\s*", "\n", texte).strip()
            if t["ligne"] is not None:
                t["ligne"].append(texte)
            t["cellule"] = None
        elif t and tag == "tr" and t["ligne"] is not None:
            if any(t["ligne"]):
                t["lignes"].append(t["ligne"])
                if t["th"] and len(t["lignes"]) == t["entete"] + 1:
                    t["entete"] += 1
            t["ligne"] = None
        elif tag == "table" and t:
            self.tableaux.pop()
            if t["lignes"]:
                self.blocs.append(["t", t["lignes"], t["entete"]])
        elif t and t["cellule"] is not None:
            return
        elif tag in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre"):
            self._vider()
        elif tag in ("ul", "ol"):
            self._vider()
            self.listes = max(0, self.listes - 1)
        elif tag == "blockquote":
            self._vider()
            self.retrait = max(0, self.retrait - 1)

    def handle_data(self, data):
        if self.ignorer:
            return
        if self.tableaux and self.tableaux[-1]["cellule"] is not None:
            self.tableaux[-1]["cellule"].append(data)
            return
        if self.genre is None and not data.strip():
            return
        self.morceaux.append(data)
        if self.gras:
            self.car_gras += len(data.strip())

    def resultat(self) -> list:
        self._vider()
        return self.blocs


def blocs_html(html: str) -> list:
    lecteur = VersBlocs()
    lecteur.feed(html)
    lecteur.close()
    return lecteur.resultat()


def nombre(v: str) -> str:
    try:
        x = float(v)
    except ValueError:
        return v
    return str(int(x)) if x.is_integer() and abs(x) < 1e15 else format(x, ".10g")


def colonne(ref: str) -> int:
    lettres = re.match(r"[A-Z]+", ref or "")
    n = 0
    for c in lettres.group(0) if lettres else "":
        n = n * 26 + ord(c) - 64
    return n - 1


def blocs_xlsx(fichier: Path) -> list:
    blocs = []
    with zipfile.ZipFile(fichier) as z:
        noms = set(z.namelist())
        partages = []
        if "xl/sharedStrings.xml" in noms:
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{NS}si"):
                partages.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
        liens = {r.get("Id"): r.get("Target", "") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        for feuille in ET.fromstring(z.read("xl/workbook.xml")).iter(f"{NS}sheet"):
            cible = liens.get(feuille.get(f"{NS_REL}id"), "")
            chemin = cible.lstrip("/") if cible.startswith("/") else posixpath.normpath("xl/" + cible)
            if chemin not in noms:
                continue
            lignes = []
            for rang in ET.fromstring(z.read(chemin)).iter(f"{NS}row"):
                cellules: dict[int, str] = {}
                for i, c in enumerate(rang.findall(f"{NS}c")):
                    genre, v = c.get("t"), c.findtext(f"{NS}v") or ""
                    if genre == "s":
                        v = partages[int(v)] if v.isdigit() and int(v) < len(partages) else v
                    elif genre == "inlineStr":
                        v = "".join(t.text or "" for t in c.iter(f"{NS}t"))
                    elif genre != "str":
                        v = nombre(v)
                    col = colonne(c.get("r", "")) if c.get("r") else i
                    cellules[col if col >= 0 else i] = v.strip()
                if any(cellules.values()):
                    lignes.append([cellules.get(k, "") for k in range(max(cellules) + 1)])
            if lignes:
                largeur = max(len(l) for l in lignes)
                blocs.append(["h", 3, f"Feuille « {feuille.get('name')} »"])
                blocs.append(["t", [l + [""] * (largeur - len(l)) for l in lignes], 1])
    return blocs


def blocs_eml(fichier: Path) -> list:
    message = email.message_from_bytes(fichier.read_bytes(), policy=policy.default)
    blocs = [["p", f"{nom} : {' '.join(str(message[cle]).split())}", "b"]
             for cle, nom in (("From", "De"), ("To", "À"), ("Cc", "Cc"), ("Date", "Date"), ("Subject", "Objet"))
             if message[cle]]
    corps = message.get_body(preferencelist=("plain", "html"))
    if corps is not None:
        contenu = corps.get_content()
        if corps.get_content_type() == "text/html":
            blocs += blocs_html(contenu)
        else:
            blocs += [["p", para.strip(), ""] for para in re.split(r"\n\s*\n", contenu) if para.strip()]
    jointes = [p.get_filename() for p in message.iter_attachments() if p.get_filename()]
    if jointes:
        blocs.append(["p", "Pièces jointes : " + ", ".join(jointes), "n"])
    return blocs


def blocs_fichier(fichier: Path, limite: int) -> list:
    suffixe = fichier.suffix.lower()
    try:
        if suffixe == ".xlsx":
            blocs = blocs_xlsx(fichier)
        elif suffixe == ".eml":
            blocs = blocs_eml(fichier)
        elif suffixe in (".txt", ".csv", ".json"):
            blocs = [["c", fichier.read_text(errors="replace")]]
        elif suffixe in (".docx", ".pptx", ".odt", ".rtf", ".md", ".html", ".htm") and shutil.which("pandoc"):
            p = subprocess.run(["pandoc", str(fichier), "-t", "html", "--wrap=none"], capture_output=True, text=True)
            blocs = blocs_html(p.stdout) if p.returncode == 0 else [["p", f"Conversion impossible : {p.stderr[:200]}", "n"]]
        else:
            blocs = [["p", f"Aperçu non disponible pour un fichier {suffixe or 'sans extension'}.", "n"]]
    except (OSError, zipfile.BadZipFile, ET.ParseError, KeyError, ValueError) as erreur:
        blocs = [["p", f"Lecture impossible : {erreur}", "n"]]
    return couper(blocs, limite)


def longueur(bloc: list) -> int:
    if bloc[0] == "t":
        return sum(len(c) for ligne in bloc[1] for c in ligne)
    return len(bloc[2] if bloc[0] in ("h", "l") else bloc[1])


def couper(blocs: list, limite: int) -> list:
    total, garde = 0, []
    for bloc in blocs:
        total += longueur(bloc)
        if total > limite:
            garde.append(["p", f"… texte coupé ici : la page montre au plus {limite:,} caractères par fichier."
                          .replace(",", " "), "n"])
            break
        garde.append(bloc)
    return garde


# ---------- le parcours de l'agent ----------

def arguments(brut) -> dict:
    if isinstance(brut, dict):
        return brut
    try:
        valeur = json.loads(brut or "{}")
        return valeur if isinstance(valeur, dict) else {"brut": str(valeur)}
    except json.JSONDecodeError:
        return {"brut": str(brut)}


def nettoyer(texte: str, taille: int = 160) -> str:
    texte = re.sub(r"/Users/[^\s'\"]*?/espaces/[^/\s'\"]+/", "", str(texte))
    texte = re.sub(r"\$(WORKSPACE_DIR|PWD|DOCUMENTS_DIR|OUTPUT_DIR)/|/workspace/", "", texte)
    texte = re.sub(r"^cd \S+\s*(;|&&)\s*", "", texte)
    texte = " ".join(texte.split())
    return texte if len(texte) <= taille else texte[: taille - 1] + "…"


def cible(outil: str, args: dict) -> str:
    if outil in ("read", "write", "edit", "notebookedit"):
        return nettoyer(args.get("file_path") or args.get("path") or args.get("notebook_path") or "")
    if outil == "bash":
        return nettoyer(args.get("command", ""))
    if outil == "grep":
        return f"« {args.get('pattern', '')} »" + (f" dans {nettoyer(args['path'])}" if args.get("path") else "")
    if outil == "glob":
        return nettoyer(args.get("pattern", ""))
    if outil == "finish":
        return nettoyer(args.get("summary", ""))
    if outil in ("task", "agent"):
        return nettoyer(args.get("description") or args.get("prompt") or "")
    if outil == "todowrite":
        return f"{len(args.get('todos') or [])} étapes"
    if outil == "skill":
        return nettoyer(args.get("skill") or args.get("name") or "")
    return nettoyer(json.dumps(args, ensure_ascii=False))


def parcours(run: dict, pieces: list[str]) -> dict:
    metriques, journal = run["metriques"], run["dossier"] / "transcript.jsonl"
    lignes = []
    if journal.exists():
        for ligne in journal.read_text(errors="replace").splitlines():
            try:
                lignes.append(json.loads(ligne))
            except json.JSONDecodeError:
                continue
    actions, lues, fin = [], set(metriques.get("documents_read_list") or []) & set(pieces), ""
    for e in lignes:
        if e.get("role") != "assistant":
            continue
        fin = e.get("text") or fin
        for appel in e.get("tool_calls") or []:
            nom = (appel.get("name") or "?").lower()
            args = arguments(appel.get("arguments"))
            actions.append([e.get("turn"), OUTILS.get(nom, nom), cible(nom, args)])
            if nom == "finish":
                fin = args.get("summary") or fin
            if nom in ("read", "bash", "grep"):
                vu = json.dumps(args, ensure_ascii=False)
                lues.update(p for p in pieces if p in vu)
    if not actions:
        manuel = metriques.get("source") == "import manuel" or run["agent"] == "legora"
        return {"disponible": False,
                "raison": "Journal non disponible (outil web)." if manuel else "Journal non disponible pour ce lancement."}
    jetons = metriques.get("total_tokens") or ((metriques.get("input_tokens") or 0) + (metriques.get("output_tokens") or 0))
    return {"disponible": True, "tours": metriques.get("turn_count"), "secondes": metriques.get("wall_clock_seconds"),
            "jetons": jetons or None, "cout": metriques.get("cout_estime_usd"),
            "tmp": metriques.get("a_utilise_tmp"), "fin": (fin or metriques.get("finish_summary") or "")[:4000],
            "lues": [p for p in pieces if p in lues], "jamais": [p for p in pieces if p not in lues],
            "actions": actions}


def livrables(dossier: Path) -> list[dict]:
    sortie = dossier / "output"
    fichiers = sorted(f for f in sortie.iterdir() if f.is_file() and not f.name.startswith(".")) if sortie.exists() else []
    return [{"nom": f.name, "taille": f.stat().st_size, "blocs": blocs_fichier(f, LIMITE_LIVRABLE)} for f in fichiers]


# ---------- l'assemblage ----------

def description_run(run: dict, couverte: bool, pieces: list[str]) -> dict:
    nom, court = nom_agent(run["agent"])
    d = {"id": f"{run['tache']}/{run['agent']}-{run['condition']}/{run['horodatage']}", "agent": run["agent"],
         "agentNom": nom, "agentCourt": court, "cond": CONDITIONS[run["condition"]],
         "horodatage": run["horodatage"], "date": date_lisible(run["horodatage"]),
         "juges": resume_juges(run, couverte)}
    if couverte:
        d["livrables"] = livrables(run["dossier"])
        d["parcours"] = parcours(run, pieces)
    return d


def donnees() -> dict:
    tous = lancements()
    retenus, ecartes = choisir(tous)
    test = taches_de_test()
    agents = [a for a in AGENTS] + sorted({r["agent"] for r in tous} - set(AGENTS))
    taches_vues = list(TACHES_COUVERTES) + sorted({r["tache"] for r in retenus} - set(TACHES_COUVERTES))
    taches = []
    for tache in taches_vues:
        definition = lire_json(TACHES / tache / "task.json")
        couverte = tache in TACHES_COUVERTES
        dossier_pieces = TACHES / tache / (definition.get("docs_dir") or "documents")
        fichiers = sorted(f for f in dossier_pieces.iterdir() if f.is_file() and not f.name.startswith(".")) \
            if dossier_pieces.exists() else []
        noms = [f.name for f in fichiers]
        runs = sorted((r for r in retenus if r["tache"] == tache), key=lambda r: (
            agents.index(r["agent"]) if r["agent"] in agents else 99, r["condition"]))
        t = {"id": tache, "titre": TITRES.get(tache) or definition.get("title") or tache,
             "titreOriginal": definition.get("title") or "", "domaine": DOMAINES.get(tache.split("/")[0], tache.split("/")[0]),
             "nPieces": len(fichiers), "nCriteres": len(definition.get("criteria") or []),
             "couverte": couverte, "test": tache in test,
             "nonRetenus": {f"{r['agent']}|{CONDITIONS[r['condition']]}": r["ecart"]
                            for r in sorted(ecartes, key=lambda r: r["horodatage"]) if r["tache"] == tache},
             "runs": [description_run(r, couverte, noms) for r in runs]}
        if couverte:
            t["consigne"] = definition.get("instructions") or ""
            t["livrablesAttendus"] = list(definition.get("deliverables") or {})
            t["criteres"] = [{"id": c.get("id"), "titre": c.get("title") or "", "regle": c.get("match_criteria") or ""}
                             for c in definition.get("criteria") or []]
            t["pieces"] = [{"nom": f.name, "taille": f.stat().st_size, "blocs": blocs_fichier(f, LIMITE_PIECE)}
                           for f in fichiers]
        taches.append(t)
    compte = Counter(j["nom"] for t in taches for r in t["runs"] for j in r["juges"][:1])
    seconds = Counter(j["nom"] for t in taches for r in t["runs"] for j in r["juges"][1:])
    maintenant = datetime.now()
    return {
        "genere": f"{maintenant.day} {MOIS[maintenant.month - 1]} {maintenant.year} à {maintenant:%H:%M}",
        "agents": [{"id": a, "nom": nom_agent(a)[0]} for a in agents],
        "jugePrincipal": compte.most_common(1)[0][0] if compte else nom_juge(JUGE_PRINCIPAL),
        "juges": [{"nom": n, "lancements": k} for n, k in compte.most_common()],
        "secondsJuges": [{"nom": n, "lancements": k} for n, k in seconds.most_common()],
        "taches": taches,
        "ecartes": [{"tache": TITRES.get(r["tache"]) or r["tache"], "agent": nom_agent(r["agent"])[0],
                     "cond": CONDITIONS[r["condition"]], "date": date_lisible(r["horodatage"]),
                     "horodatage": r["horodatage"], "raison": r["ecart"]}
                    for r in sorted(ecartes, key=lambda r: r["horodatage"], reverse=True)],
    }


def textes(valeur):
    if isinstance(valeur, str):
        yield valeur
    elif isinstance(valeur, dict):
        for v in valeur.values():
            yield from textes(v)
    elif isinstance(valeur, list):
        for v in valeur:
            yield from textes(v)


def verifier_grilles(data: dict) -> None:
    """Aucune grille hors des tâches couvertes ne doit se retrouver dans la page."""
    extraits = []
    candidates = {f"{d.parts[-2]}/{d.parts[-1]}" for d in RESULTATS.glob("*/*") if d.is_dir()} | taches_de_test()
    for tache in sorted(candidates - set(TACHES_COUVERTES)):
        for c in lire_json(TACHES / tache / "task.json").get("criteria") or []:
            extraits += [s for s in (c.get("title") or "", (c.get("match_criteria") or "")[:80]) if len(s) >= 30]
    tout = "\n".join(textes(data))
    fuites = [e for e in extraits if e in tout]
    if fuites:
        sys.exit(f"Arrêt : {len(fuites)} critère(s) d'une tâche non couverte dans la page, par exemple « {fuites[0][:80]} ».")


def main() -> None:
    if not shutil.which("pandoc"):
        print("pandoc est introuvable : les .docx ne seront pas convertis.", file=sys.stderr)
    data = donnees()
    verifier_grilles(data)
    brut = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    brut = brut.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(GABARIT.replace("__DONNEES__", brut), encoding="utf-8")
    taille = SORTIE.stat().st_size
    print(f"{SORTIE}  ({taille / 1e6:.1f} Mo)")
    if taille > 16e6:
        print("Attention : la page dépasse 16 Mo, elle ne pourra pas être publiée.", file=sys.stderr)


GABARIT = r"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Banc d'essai Visa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap">
<style>
/* Mise en page : un dossier de revue en une colonne (76rem au plus) : le tableau des scores d'abord,
   puis le détail de la tâche choisie en quatre blocs A à D, puis le contexte et la liste des écartés. */
:root {
  --fond: #f3f5f8;
  --feuille: #ffffff;
  --encre: #18212d;
  --gris: #586374;
  --filet: #d6dce5;
  --filet-fort: #aeb8c6;
  --accent: #2446a6;
  --accent-doux: #e7edfa;
  --ok: #16714a;
  --ok-fond: #e0f1e7;
  --ko: #ab3226;
  --ko-fond: #f8e3e0;
  --surligne: #ffe07a;
  --f-titre: "Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --f-texte: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --f-chiffre: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #0f1319; --feuille: #161c24; --encre: #e3e8ef; --gris: #9aa5b5; --filet: #29323e;
    --filet-fort: #46515f; --accent: #91b0ff; --accent-doux: #1b2740; --ok: #62cd95; --ok-fond: #11301f;
    --ko: #f08c7f; --ko-fond: #3a1c19; --surligne: #7d6512; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --fond: #0f1319; --feuille: #161c24; --encre: #e3e8ef; --gris: #9aa5b5; --filet: #29323e;
  --filet-fort: #46515f; --accent: #91b0ff; --accent-doux: #1b2740; --ok: #62cd95; --ok-fond: #11301f;
  --ko: #f08c7f; --ko-fond: #3a1c19; --surligne: #7d6512; color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--encre); font: 400 15px/1.55 var(--f-texte); }
table { border-collapse: collapse; font: inherit; color: inherit; }
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
mark { background: var(--surligne); color: var(--encre); border-radius: 2px; }
code, .mono { font-family: var(--f-chiffre); font-size: 0.86em; }
.page { max-width: 76rem; margin: 0 auto; padding-inline: 16px; padding-block: 28px 48px;
  display: flex; flex-direction: column; gap: 40px; }
@media (min-width: 720px) { .page { padding-inline: 32px; padding-block: 40px 64px; } }
h1, h2 { font-family: var(--f-titre); font-weight: 600; text-wrap: balance; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: clamp(2rem, 5vw, 2.75rem); line-height: 1.1; }
h2 { font-size: 1.6rem; line-height: 1.2; }
h3 { font-size: 1.05rem; font-weight: 600; margin: 0; display: flex; gap: 10px; align-items: baseline; }
p { margin: 0; }
.surtitre { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--gris); }
.aide { color: var(--gris); font-size: 0.875rem; }
.section { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* En-tête */
.tete { display: flex; flex-direction: column; gap: 12px; }
.chapo { font-size: 1.06rem; max-width: 64ch; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 10px 28px; margin: 6px 0 0;
  padding-top: 14px; border-top: 1px solid var(--filet); }
.meta div { min-width: 0; }
.meta dt { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gris); }
.meta dd { margin: 2px 0 0; font-size: 0.92rem; }

/* Conteneurs qui défilent tout seuls */
.defile { overflow-x: auto; min-width: 0; -webkit-overflow-scrolling: touch; }
.cadre { background: var(--feuille); border: 1px solid var(--filet); border-radius: 6px; }

/* Le tableau des scores */
.score { width: 100%; font-size: 0.875rem; }
.score th, .score td { padding: 10px 12px; border-bottom: 1px solid var(--filet); text-align: left; vertical-align: top; }
.score thead th { font-size: 0.75rem; font-weight: 600; color: var(--gris); background: var(--feuille); white-space: nowrap; }
.score thead tr:first-child th.agent { color: var(--encre); font-size: 0.84rem; border-left: 1px solid var(--filet); }
.score thead .cond { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.68rem; }
.score .gauche { border-left: 1px solid var(--filet); }
.score tbody tr { cursor: pointer; }
.score tbody tr:hover > * { background: var(--fond); }
.score tbody tr[aria-selected="true"] > * { background: var(--accent-doux); }
.score .col-tache { position: sticky; left: 0; z-index: 1; background: var(--feuille); min-width: 13rem; max-width: 22rem; }
.score thead .col-tache { z-index: 2; }
.score tfoot td, .score tfoot th { background: var(--feuille); font-size: 0.8rem; color: var(--gris); border-bottom: 0; }
.nom-tache { font-weight: 600; color: var(--encre); }
.nom-tache button { all: unset; cursor: pointer; }
.nom-tache button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sous-tache { color: var(--gris); font-size: 0.78rem; margin-top: 2px; }
.cellule { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; min-width: 6.5rem; }
.ligne-score { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.frac { font-family: var(--f-chiffre); font-weight: 600; font-size: 1rem; font-variant-numeric: tabular-nums; }
.tampon { font: 600 0.62rem/1 var(--f-texte); letter-spacing: 0.09em; text-transform: uppercase;
  padding: 3px 5px 2px; border: 1.5px solid currentColor; border-radius: 3px; white-space: nowrap; }
.tampon.ok { color: var(--ok); background: var(--ok-fond); }
.tampon.ko { color: var(--ko); background: var(--ko-fond); }
.ecart { font-family: var(--f-chiffre); font-size: 0.78rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.ecart.plus { color: var(--ok); }
.ecart.moins { color: var(--ko); }
.ecart.nul { color: var(--gris); }
.note-cel { font-size: 0.74rem; color: var(--gris); line-height: 1.35; }
.vide { color: var(--gris); font-size: 0.8rem; font-style: italic; }
.legende { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 0.8rem; color: var(--gris); }

/* Le détail d'une tâche */
.detail { background: var(--feuille); border: 1px solid var(--filet); border-radius: 8px; padding: 20px 16px;
  display: flex; flex-direction: column; gap: 32px; min-width: 0; }
@media (min-width: 720px) { .detail { padding: 28px 32px; } }
.detail-tete { display: flex; flex-direction: column; gap: 6px; }
.bloc { display: flex; flex-direction: column; gap: 14px; padding-top: 22px; border-top: 1px solid var(--filet); min-width: 0; }
.lettre { font-family: var(--f-chiffre); font-size: 0.75rem; font-weight: 600; color: var(--accent);
  border: 1.5px solid var(--accent); border-radius: 50%; width: 1.6rem; height: 1.6rem; flex: none;
  display: inline-flex; align-items: center; justify-content: center; transform: translateY(-1px); }
.etiquette { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gris); }
.consigne { margin: 0; padding: 14px 16px; background: var(--fond); border-left: 3px solid var(--filet-fort);
  white-space: pre-wrap; max-width: 75ch; font-size: 0.95rem; }
.outils { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }
.recherche { flex: 1 1 16rem; max-width: 26rem; padding: 8px 12px; border: 1px solid var(--filet-fort);
  border-radius: 6px; background: var(--feuille); min-width: 0; }
.compte { font-size: 0.82rem; color: var(--gris); font-variant-numeric: tabular-nums; }
.pieces { display: flex; flex-direction: column; border: 1px solid var(--filet); border-radius: 6px; }
.piece + .piece { border-top: 1px solid var(--filet); }
.piece > summary { cursor: pointer; padding: 10px 14px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; list-style: none; }
.piece > summary::-webkit-details-marker { display: none; }
.piece > summary::before { content: "▸"; color: var(--gris); width: 1ch; }
.piece[open] > summary::before { content: "▾"; }
.piece > summary .mono { font-weight: 500; overflow-wrap: anywhere; }
.trouve { font-size: 0.75rem; font-weight: 600; color: var(--accent); }
.texte-doc { padding: 4px 16px 16px; max-height: 70vh; overflow: auto; font-size: 0.86rem; line-height: 1.55;
  display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.texte-doc > * { flex-shrink: 0; }
.texte-doc p { white-space: pre-line; overflow-wrap: anywhere; max-width: 90ch; }
.texte-doc p.b { font-weight: 600; }
.texte-doc p.q { padding-left: 18px; }
.texte-doc p.n { color: var(--gris); font-style: italic; }
.texte-doc p.l { padding-left: calc(var(--d, 1) * 16px); text-indent: -12px; }
.texte-doc h4, .texte-doc h5, .texte-doc h6 { margin: 10px 0 0; font-size: 0.95rem; }
.texte-doc h4 { font-size: 1.05rem; }
.texte-doc pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font-family: var(--f-chiffre); font-size: 0.8rem; }
.texte-doc table { font-size: 0.8rem; }
.texte-doc td, .texte-doc th { border: 1px solid var(--filet); padding: 4px 8px; vertical-align: top; text-align: left;
  white-space: pre-line; min-width: 6rem; max-width: 28rem; }
.texte-doc th { background: var(--fond); font-weight: 600; }

/* La grille, critère par critère */
.filtres { display: inline-flex; border: 1px solid var(--filet-fort); border-radius: 6px; overflow: hidden; flex-wrap: wrap; }
.filtres button { border: 0; background: var(--feuille); padding: 7px 12px; cursor: pointer; font-size: 0.84rem; }
.filtres button + button { border-left: 1px solid var(--filet-fort); }
.filtres button[aria-pressed="true"] { background: var(--accent); color: var(--feuille); font-weight: 600; }
.grille { font-size: 0.84rem; width: 100%; }
.grille th, .grille td { padding: 8px 10px; border-bottom: 1px solid var(--filet); text-align: left; vertical-align: top; }
.grille thead th { font-size: 0.74rem; color: var(--gris); font-weight: 600; white-space: nowrap; vertical-align: bottom; }
.grille thead .frac { font-size: 0.78rem; color: var(--encre); }
.grille .col-crit { position: sticky; left: 0; background: var(--feuille); min-width: 15rem; max-width: 34rem; z-index: 1; }
.grille tbody tr.crit { cursor: pointer; }
.grille tbody tr.crit:hover > * { background: var(--fond); }
.grille tbody tr.crit[aria-expanded="true"] > * { background: var(--accent-doux); }
.grille .id { font-family: var(--f-chiffre); font-size: 0.74rem; color: var(--gris); margin-right: 6px; }
.grille td.marque { text-align: center; white-space: nowrap; font-size: 1rem; }
.v-pass { color: var(--ok); font-weight: 600; }
.v-fail { color: var(--ko); font-weight: 600; }
.v-rien { color: var(--gris); }
.marque span + span { margin-left: 6px; }
.raisons-cel { padding: 0 !important; background: var(--fond); }
.cadre-grille { container-type: inline-size; }
.raisons { position: sticky; left: 0; width: min(100%, calc(100vw - 34px)); width: 100cqw; padding: 14px;
  display: flex; flex-direction: column; gap: 12px; }
.regle { font-size: 0.86rem; max-width: 80ch; }
.cartes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); gap: 10px; align-items: start; }
.carte { background: var(--feuille); border: 1px solid var(--filet); border-radius: 6px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.carte-tete { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font-size: 0.8rem; font-weight: 600; }
.carte p { font-size: 0.84rem; white-space: pre-line; overflow-wrap: anywhere; }

/* Les livrables côte à côte */
.duo { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 900px) { .duo { grid-template-columns: 1fr 1fr; } }
.volet { border: 1px solid var(--filet); border-radius: 6px; display: flex; flex-direction: column; min-width: 0; }
.volet-tete { padding: 10px 12px; border-bottom: 1px solid var(--filet); display: flex; flex-direction: column; gap: 6px; }
.volet-tete select { width: 100%; padding: 6px 8px; border: 1px solid var(--filet-fort); border-radius: 6px; background: var(--feuille); }
.volet .texte-doc { padding-top: 12px; }

/* Le parcours */
.chiffres { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 12px 20px; margin: 0; }
.chiffres dt { font-size: 0.72rem; color: var(--gris); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.chiffres dd { margin: 2px 0 0; font-family: var(--f-chiffre); font-size: 1.05rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.choix { padding: 6px 8px; border: 1px solid var(--filet-fort); border-radius: 6px; background: var(--feuille); max-width: 100%; }
.actions { margin: 0; padding: 0; list-style: none; font-size: 0.82rem; max-height: 60vh; overflow: auto;
  border: 1px solid var(--filet); border-radius: 6px; }
.actions li { display: grid; grid-template-columns: 3.2rem 6.5rem minmax(0, 1fr); gap: 8px; padding: 5px 10px; border-bottom: 1px solid var(--filet); }
.actions li:last-child { border-bottom: 0; }
.actions .tour { color: var(--gris); font-family: var(--f-chiffre); font-size: 0.76rem; }
.actions .outil { font-weight: 600; }
.actions .quoi { font-family: var(--f-chiffre); font-size: 0.76rem; overflow-wrap: anywhere; }
details.pli > summary { cursor: pointer; color: var(--accent); font-weight: 500; font-size: 0.9rem; padding: 4px 0; }
.texte-court { max-width: 75ch; font-size: 0.92rem; }
.liste-pieces { margin: 0; padding-left: 18px; font-size: 0.88rem; }

/* Contexte */
.pourquoi ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 78ch; }
.ecartes-table { font-size: 0.82rem; width: 100%; }
.ecartes-table th, .ecartes-table td { padding: 7px 10px; border-bottom: 1px solid var(--filet); text-align: left; vertical-align: top; }
.ecartes-table th { color: var(--gris); font-size: 0.74rem; font-weight: 600; }
.pied { border-top: 1px solid var(--filet); padding-top: 16px; color: var(--gris); font-size: 0.85rem; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

<div class="page">
  <header class="tete">
    <p class="surtitre">Hackathon juridique · Legal Agent Bench de Harvey</p>
    <h1>Banc d'essai Visa</h1>
    <p class="chapo">On mesure si notre méthode de vérification, le tableau de concordance, aide des agents d'IA à réussir des tâches juridiques de fusions-acquisitions. Chaque agent fait chaque tâche deux fois : sans puis avec la méthode, sur les mêmes pièces et la même consigne. Un juge note le livrable critère par critère, avec la grille officielle de Harvey.</p>
    <dl class="meta">
      <div><dt>Juge</dt><dd id="juges"></dd></div>
      <div><dt>Règle</dt><dd>Une tâche n'est réussie que si tous ses critères passent.</dd></div>
      <div><dt>Lancements</dt><dd id="nb-lancements"></dd></div>
      <div><dt>Page générée le</dt><dd id="genere"></dd></div>
    </dl>
  </header>

  <section class="section" aria-labelledby="titre-resultats">
    <h2 id="titre-resultats">Résultats par tâche</h2>
    <p class="aide">Chaque case donne le nombre de critères réussis. Cliquez sur une tâche pour voir ce qu'on donne à l'agent, comment il est noté et ce qu'il rend.</p>
    <div class="defile cadre"><table class="score" id="score"></table></div>
    <div class="legende">
      <span><span class="tampon ok">réussie</span> tous les critères passent</span>
      <span><span class="tampon ko">ratée</span> au moins un critère manque</span>
      <span><span class="ecart plus">+3</span> écart avec « sans », en critères</span>
    </div>
  </section>

  <section class="detail" id="detail" aria-label="Détail de la tâche choisie"></section>

  <section class="section pourquoi" aria-labelledby="titre-pourquoi">
    <h2 id="titre-pourquoi">Pourquoi Claude réussit ici alors qu'il est à 10-20 % au classement de Harvey</h2>
    <ul>
      <li>Le classement public (Vals AI, 1er octobre 2026) note chaque modèle sur des tâches cachées, avec un score par domaine. En M&amp;A, les meilleurs modèles réussissent 1 tâche sur 5 (20 %) ; Claude Fable 5 aussi ; Sonnet 5.5 0 %. Ici, c'est une seule tâche publique, courte (2 pièces) : sans doute parmi les plus faciles.</li>
      <li>Les modèles réussissent déjà 92 à 96 % des critères un par un en M&amp;A : l'échec vient d'un ou deux oublis. Sur une tâche courte, zéro oubli est possible.</li>
      <li>L'outil compte autant que le modèle : le classement fait tourner les modèles dans le harnais de Harvey (7 outils). Claude Code a ses propres outils (Python, relecture, plan). Harvey a mesuré lui-même des écarts de 24,6 % à 42,5 % selon l'outil en due diligence.</li>
      <li>Le juge compte : le classement utilise deux juges (GPT-5.5 et Claude Sonnet 4.6) ; nous, Claude Opus 5.5, et GPT-5.5 (via Codex) en contre-vérification sur le premier cas, la même paire de familles que le classement. Un juge Claude pourrait être indulgent avec Claude : la colonne du second juge permet de le voir.</li>
      <li>Les tâches publiques sont en ligne depuis mai 2026 : un modèle récent a pu les voir à l'entraînement. Non vérifiable.</li>
      <li>Ce qui compte pour nous : même tâche, même juge, sans contre avec notre méthode. Le chiffre final viendra de 7 tâches de test jamais regardées.</li>
    </ul>
  </section>

  <section class="section" aria-labelledby="titre-ecartes">
    <details class="pli" id="ecartes">
      <summary id="titre-ecartes"></summary>
      <p class="aide" style="margin: 8px 0 10px">Ces lancements ne sont pas dans le tableau. On garde, pour chaque tâche, agent et condition, le plus récent qui est noté et qui compte.</p>
      <div class="defile cadre"><table class="ecartes-table" id="ecartes-table"></table></div>
    </details>
  </section>

  <footer class="pied">
    Pour mettre la page à jour avec les nouveaux résultats : <code>python3 bench/tableau.py</code>, depuis la racine du dépôt. Elle est réécrite dans <code>bench/tableau/index.html</code>.
  </footer>
</div>

<script type="application/json" id="donnees">__DONNEES__</script>
<script>
"use strict";
const D = JSON.parse(document.getElementById("donnees").textContent);
const COND = ["sans", "avec"];

function el(tag, attrs, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const ko = (o) => (o < 1024 ? `${o} o` : `${Math.round(o / 1024)} ko`);
function duree(s) {
  if (s == null) return "—";
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m ? `${m} min ${String(r).padStart(2, "0")} s` : `${r} s`;
}
const millier = (n) => (n == null ? "—" : n.toLocaleString("fr-FR"));
function ecartTexte(d) { return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0"; }
function principal(run) { return run.juges[0]; }

/* ---------- recherche et surlignage ---------- */
function motif(q) {
  q = (q || "").trim();
  if (q.length < 2) return null;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
}
function surligne(texte, re, compte) {
  if (!re) return document.createTextNode(texte);
  const frag = document.createDocumentFragment();
  let i = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(texte))) {
    if (m.index > i) frag.append(texte.slice(i, m.index));
    frag.append(el("mark", null, m[0]));
    compte.n++;
    i = m.index + m[0].length;
  }
  if (i < texte.length) frag.append(texte.slice(i));
  return frag;
}
function texteDe(blocs) {
  return blocs.map((b) => (b[0] === "t" ? b[1].map((l) => l.join(" ")).join("\n") : b[0] === "h" || b[0] === "l" ? b[2] : b[1])).join("\n");
}
function compter(texte, re) {
  if (!re) return 0;
  re.lastIndex = 0;
  return (texte.match(re) || []).length;
}
function rendreBlocs(blocs, re, compte) {
  const frag = document.createDocumentFragment();
  for (const b of blocs) {
    if (b[0] === "h") frag.append(el(`h${Math.min(6, 3 + b[1])}`, null, surligne(b[2], re, compte)));
    else if (b[0] === "p") frag.append(el("p", { class: b[2] || null }, surligne(b[1], re, compte)));
    else if (b[0] === "l") frag.append(el("p", { class: "l", style: `--d:${b[1]}` }, "• ", surligne(b[2], re, compte)));
    else if (b[0] === "c") frag.append(el("pre", null, surligne(b[1], re, compte)));
    else if (b[0] === "t") {
      const corps = b[1].map((ligne, i) =>
        el("tr", null, ligne.map((c) => el(i < b[2] ? "th" : "td", null, surligne(c, re, compte)))));
      frag.append(el("div", { class: "defile" }, el("table", null, el("tbody", null, corps))));
    }
  }
  return frag;
}
function attendre(fn, ms = 180) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- en-tête ---------- */
function nomsJuges() {
  const parts = D.juges.map((j) => `${j.nom} (${pluriel(j.lancements, "lancement", "lancements")})`);
  if (D.secondsJuges.length) parts.push(...D.secondsJuges.map((j) => `${j.nom} en second juge (${pluriel(j.lancements, "lancement", "lancements")})`));
  return parts.length ? parts.join(" ; ") : "aucun lancement noté pour l'instant";
}
document.getElementById("juges").textContent = nomsJuges();
document.getElementById("genere").textContent = D.genere;
const nbRetenus = D.taches.reduce((s, t) => s + t.runs.length, 0);
document.getElementById("nb-lancements").textContent =
  `${pluriel(nbRetenus, "retenu", "retenus")} dans le tableau, ${pluriel(D.ecartes.length, "écarté", "écartés")} (liste en bas de page)`;

/* ---------- le tableau des scores ---------- */
function trouverRun(t, agent, cond) { return t.runs.find((r) => r.agent === agent && r.cond === cond); }
function celluleScore(t, agent, cond) {
  const run = trouverRun(t, agent, cond);
  const td = el("td", { class: cond === "sans" ? "gauche" : null });
  if (!run) {
    const raison = t.nonRetenus[`${agent}|${cond}`];
    td.append(el("span", { class: "vide" }, raison ? `lancé, ${raison}` : "pas encore lancé"));
    return td;
  }
  const j = principal(run);
  const box = el("div", { class: "cellule" });
  const ligne = el("div", { class: "ligne-score" },
    el("span", { class: "frac" }, `${j.n}/${j.N}`),
    el("span", { class: `tampon ${j.ok ? "ok" : "ko"}` }, j.ok ? "réussie" : "ratée"));
  box.append(ligne);
  if (cond === "avec") {
    const sans = trouverRun(t, agent, "sans");
    if (sans) {
      const d = j.n - principal(sans).n;
      ligne.append(el("span", { class: `ecart ${d > 0 ? "plus" : d < 0 ? "moins" : "nul"}`, title: `Écart avec « sans » : ${ecartTexte(d)} critère(s)` }, ecartTexte(d)));
      if (principal(sans).nom !== j.nom) box.append(el("span", { class: "note-cel" }, "juges différents entre sans et avec"));
    }
  }
  for (const autre of run.juges.slice(1)) box.append(el("span", { class: "note-cel" }, `2e juge, ${autre.nom} : ${autre.n}/${autre.N}`));
  if (j.nom !== D.jugePrincipal) box.append(el("span", { class: "note-cel" }, `noté par ${j.nom}`));
  td.append(box);
  return td;
}
let tacheChoisie = null;
function construireScore() {
  const table = document.getElementById("score");
  const h1 = el("tr", null, el("th", { class: "col-tache", rowspan: 2, scope: "col" }, "Tâche"),
    D.agents.map((a) => el("th", { class: "agent", colspan: 2, scope: "colgroup" }, a.nom)));
  const h2 = el("tr", null, D.agents.map((a) => COND.map((c) =>
    el("th", { class: `cond${c === "sans" ? " gauche" : ""}`, scope: "col" }, `${c} la méthode`))));
  const corps = D.taches.map((t) => {
    const sous = [t.domaine, pluriel(t.nPieces, "pièce", "pièces"), pluriel(t.nCriteres, "critère", "critères")];
    if (t.test) sous.push("tâche de test : scores seuls");
    else if (!t.couverte) sous.push("scores seuls");
    const tr = el("tr", { "data-tache": t.id, "aria-selected": "false" },
      el("th", { class: "col-tache", scope: "row" },
        el("div", { class: "nom-tache" }, el("button", { type: "button", onclick: () => choisir(t.id, true) }, t.titre)),
        el("div", { class: "sous-tache" }, sous.join(" · "))),
      D.agents.map((a) => COND.map((c) => celluleScore(t, a.id, c))));
    tr.addEventListener("click", (e) => { if (!e.target.closest("button")) choisir(t.id, true); });
    return tr;
  });
  const pied = el("tr", null, el("th", { class: "col-tache", scope: "row" }, "Tâches réussies"),
    D.agents.map((a) => COND.map((c) => {
      const runs = D.taches.map((t) => trouverRun(t, a.id, c)).filter(Boolean);
      const ok = runs.filter((r) => principal(r).ok).length;
      return el("td", { class: c === "sans" ? "gauche" : null }, runs.length ? el("span", { class: "frac" }, `${ok}/${runs.length}`) : "—");
    })));
  table.append(el("thead", null, h1, h2), el("tbody", null, corps), el("tfoot", null, pied));
}

/* ---------- le détail d'une tâche ---------- */
function libelleRun(r) { const j = principal(r); return `${r.agentNom} · ${r.cond} la méthode · ${j.n}/${j.N}`; }

function blocPieces(t) {
  const bloc = el("div", { class: "bloc" }, el("h3", null, el("span", { class: "lettre" }, "A"), "Ce qu'on donne à l'agent"));
  bloc.append(el("p", { class: "etiquette" }, "La consigne, mot pour mot"), el("blockquote", { class: "consigne" }, t.consigne));
  bloc.append(el("p", { class: "texte-court" },
    `Livrable attendu : ${t.livrablesAttendus.join(", ") || "non précisé"}. Avec notre méthode, l'agent reçoit en plus le manuel de la méthode ; les pièces et la consigne sont les mêmes.`));
  const champ = el("input", { type: "search", class: "recherche", id: `cherche-pieces`, placeholder: "Chercher dans les pièces", "aria-label": "Chercher dans les pièces" });
  const total = el("span", { class: "compte" });
  bloc.append(el("p", { class: "etiquette" }, `Les pièces (${t.pieces.length})`), el("div", { class: "outils" }, champ, total));
  const liste = el("div", { class: "pieces" });
  const textes = t.pieces.map((p) => texteDe(p.blocs));
  const items = t.pieces.map((p, i) => {
    const trouve = el("span", { class: "trouve" });
    const corps = el("div", { class: "texte-doc" });
    const d = el("details", { class: "piece" },
      el("summary", null, el("span", { class: "mono" }, p.nom), el("span", { class: "compte" }, ko(p.taille)), trouve), corps);
    d.addEventListener("toggle", () => { if (d.open) remplir(); });
    function remplir() { corps.replaceChildren(rendreBlocs(p.blocs, motif(champ.value), { n: 0 })); }
    return { d, trouve, remplir, i };
  });
  liste.append(...items.map((x) => x.d));
  bloc.append(liste);
  const maj = attendre(() => {
    const re = motif(champ.value);
    let somme = 0;
    for (const x of items) {
      const n = compter(textes[x.i], re);
      somme += n;
      x.trouve.textContent = re ? (n ? pluriel(n, "résultat", "résultats") : "aucun résultat") : "";
      if (re && n && !x.d.open) x.d.open = true;
      else if (x.d.open) x.remplir();
    }
    total.textContent = re ? `${pluriel(somme, "résultat", "résultats")} dans les pièces` : "";
  });
  champ.addEventListener("input", maj);
  return bloc;
}

function marque(v, juge) {
  const txt = v === "pass" ? "✓" : v === "fail" ? "✗" : "·";
  const quoi = v === "pass" ? "accepté" : v === "fail" ? "refusé" : "non noté";
  return el("span", { class: v === "pass" ? "v-pass" : v === "fail" ? "v-fail" : "v-rien", title: `${juge} : ${quoi}`, "aria-label": `${juge} : ${quoi}` }, txt);
}
function blocGrille(t) {
  const bloc = el("div", { class: "bloc" }, el("h3", null, el("span", { class: "lettre" }, "B"), "Comment c'est noté, critère par critère"));
  if (!t.runs.length) {
    bloc.append(el("p", { class: "aide" }, "Aucun lancement noté pour l'instant. Voici la grille complète."));
  }
  const verdicts = (c) => t.runs.flatMap((r) => r.juges.map((j) => j.verdicts[c.id] || null));
  const desaccord = (c) => new Set(verdicts(c).filter(Boolean)).size > 1;
  const rateTous = (c) => { const v = verdicts(c).filter(Boolean); return v.length > 0 && v.every((x) => x === "fail"); };
  const filtres = [
    ["desaccord", "Les lancements ne sont pas d'accord", desaccord],
    ["tous", "Tous les critères", () => true],
    ["rates", "Ratés par tous", rateTous],
  ];
  const nb = Object.fromEntries(filtres.map(([k, , f]) => [k, t.criteres.filter(f).length]));
  let filtre = t.runs.length && nb.desaccord ? "desaccord" : "tous";
  const doubles = t.runs.filter((r) => r.juges.length > 1);
  const noms = (k) => [...new Set(doubles.map((r) => r.juges[k].nom))].join(" ou ");
  const aide = el("p", { class: "aide" },
    "✓ le juge accepte le critère, ✗ il le refuse. Cliquez sur un critère pour lire le raisonnement du juge pour chaque lancement.",
    doubles.length ? ` Quand deux juges ont noté, la première marque est celle de ${noms(0)}, la seconde celle de ${noms(1)}.` : "");
  const boutons = el("div", { class: "filtres", role: "group", "aria-label": "Filtrer les critères" });
  const table = el("table", { class: "grille" });
  const vide = el("p", { class: "aide" });
  function dessiner() {
    for (const b of boutons.children) b.setAttribute("aria-pressed", String(b.dataset.f === filtre));
    const f = filtres.find((x) => x[0] === filtre)[2];
    const lignes = t.criteres.filter(f);
    vide.textContent = lignes.length ? "" : filtre === "desaccord"
      ? "Aucun désaccord : tous les lancements ont la même note sur chaque critère."
      : "Aucun critère raté par tous les lancements.";
    const tete = el("tr", null, el("th", { class: "col-crit", scope: "col" }, `Critère (${lignes.length} sur ${t.criteres.length})`),
      t.runs.map((r) => el("th", { scope: "col" }, el("div", null, r.agentCourt), el("div", null, `${r.cond}`),
        el("div", null, r.juges.map((j, i) => el("span", { class: "frac", title: j.nom }, `${i ? " · " : ""}${j.n}/${j.N}`))))));
    const corps = el("tbody");
    for (const c of lignes) {
      const tr = el("tr", { class: "crit", tabindex: 0, "aria-expanded": "false" },
        el("td", { class: "col-crit" }, el("span", { class: "id" }, c.id), c.titre),
        t.runs.map((r) => el("td", { class: "marque" }, r.juges.map((j) => marque(j.verdicts[c.id], j.nom)))));
      let ouvert = null;
      const basculer = () => {
        if (ouvert) { ouvert.remove(); ouvert = null; tr.setAttribute("aria-expanded", "false"); return; }
        const cartes = el("div", { class: "cartes" }, t.runs.flatMap((r) => r.juges.map((j) => {
          const v = j.verdicts[c.id];
          return el("div", { class: "carte" },
            el("div", { class: "carte-tete" }, el("span", null, `${r.agentNom} · ${r.cond}`),
              el("span", { class: v === "pass" ? "v-pass" : v === "fail" ? "v-fail" : "v-rien" }, v === "pass" ? "✓ accepté" : v === "fail" ? "✗ refusé" : "non noté")),
            el("div", { class: "note-cel" }, `Juge : ${j.nom}`),
            el("p", null, j.raisons[c.id] || "Pas de raisonnement enregistré."));
        })));
        const contenu = el("div", { class: "raisons" },
          el("p", { class: "regle" }, el("strong", null, `${c.id} · ${c.titre}`)),
          el("p", { class: "regle" }, el("span", { class: "etiquette" }, "Règle de la grille "), c.regle),
          t.runs.length ? cartes : el("p", { class: "aide" }, "Pas encore de raisonnement : aucun lancement noté."));
        ouvert = el("tr", null, el("td", { class: "raisons-cel", colspan: t.runs.length + 1 }, contenu));
        tr.after(ouvert);
        tr.setAttribute("aria-expanded", "true");
      };
      tr.addEventListener("click", basculer);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); } });
      corps.append(tr);
    }
    table.replaceChildren(el("thead", null, tete), corps);
  }
  for (const [k, nom] of filtres) {
    boutons.append(el("button", { type: "button", "data-f": k, onclick: () => { filtre = k; dessiner(); } }, `${nom} (${nb[k]})`));
  }
  dessiner();
  bloc.append(aide, el("div", { class: "outils" }, boutons), vide, el("div", { class: "defile cadre cadre-grille" }, table));
  return bloc;
}

function blocLivrables(t) {
  const bloc = el("div", { class: "bloc" }, el("h3", null, el("span", { class: "lettre" }, "C"), "Ce que l'agent rend"));
  if (!t.runs.length) { bloc.append(el("p", { class: "aide" }, "Aucun lancement noté pour l'instant.")); return bloc; }
  const champ = el("input", { type: "search", class: "recherche", id: "cherche-livrables", placeholder: "Chercher dans les deux livrables", "aria-label": "Chercher dans les deux livrables" });
  bloc.append(el("p", { class: "aide" }, "Choisissez deux lancements pour comparer leurs livrables, convertis en texte."), el("div", { class: "outils" }, champ));
  const paire = t.runs.find((r) => r.cond === "sans" && trouverRun(t, r.agent, "avec"));
  const defauts = paire ? [paire, trouverRun(t, paire.agent, "avec")] : [t.runs[0], t.runs[1] || t.runs[0]];
  const volets = defauts.map((defaut, k) => {
    const choix = el("select", { id: `livrable-${k}`, "aria-label": k ? "Lancement de droite" : "Lancement de gauche" },
      t.runs.map((r) => el("option", { value: r.id, selected: r === defaut }, libelleRun(r))));
    const compte = el("span", { class: "compte" });
    const corps = el("div", { class: "texte-doc" });
    const v = el("div", { class: "volet" }, el("div", { class: "volet-tete" }, choix, compte), corps);
    function remplir() {
      const r = t.runs.find((x) => x.id === choix.value);
      const re = motif(champ.value), c = { n: 0 };
      const frag = document.createDocumentFragment();
      if (!r.livrables.length) frag.append(el("p", { class: "n" }, "Aucun livrable dans le dossier de sortie."));
      for (const f of r.livrables) {
        frag.append(el("p", { class: "etiquette" }, `${f.nom} · ${ko(f.taille)}`), rendreBlocs(f.blocs, re, c));
      }
      corps.replaceChildren(frag);
      compte.textContent = re ? pluriel(c.n, "résultat", "résultats") : r.livrables.map((f) => f.nom).join(", ");
    }
    choix.addEventListener("change", remplir);
    remplir();
    return { v, remplir };
  });
  champ.addEventListener("input", attendre(() => volets.forEach((x) => x.remplir())));
  bloc.append(el("div", { class: "duo" }, volets.map((x) => x.v)));
  return bloc;
}

function blocParcours(t) {
  const bloc = el("div", { class: "bloc" }, el("h3", null, el("span", { class: "lettre" }, "D"), "Comment l'agent a travaillé"));
  if (!t.runs.length) { bloc.append(el("p", { class: "aide" }, "Aucun lancement noté pour l'instant.")); return bloc; }
  const choix = el("select", { class: "choix", id: "parcours-choix", "aria-label": "Lancement" },
    t.runs.map((r) => el("option", { value: r.id }, libelleRun(r))));
  const zone = el("div", { class: "section" });
  function remplir() {
    const r = t.runs.find((x) => x.id === choix.value), p = r.parcours;
    if (!p.disponible) { zone.replaceChildren(el("p", { class: "aide" }, p.raison)); return; }
    const parOutil = {};
    for (const a of p.actions) parOutil[a[1]] = (parOutil[a[1]] || 0) + 1;
    const detailOutils = Object.entries(parOutil).sort((a, b) => b[1] - a[1]).map(([o, n]) => `${o} ${n}`).join(" · ");
    const chiffres = el("dl", { class: "chiffres" },
      [["Tours", millier(p.tours)], ["Durée", duree(p.secondes)], ["Actions", millier(p.actions.length)],
       ["Pièces lues", `${p.lues.length}/${p.lues.length + p.jamais.length}`], ["Jetons", millier(p.jetons)],
       ...(p.cout != null ? [["Coût estimé", `${p.cout.toFixed(2).replace(".", ",")} $`]] : [])]
        .map(([k, v]) => el("div", null, el("dt", null, k), el("dd", null, v))));
    const items = [chiffres, el("p", { class: "aide" }, `Actions par outil : ${detailOutils}.`)];
    items.push(el("p", { class: "texte-court" }, p.jamais.length
      ? `Pièces jamais ouvertes : ${p.jamais.join(", ")}.` : "L'agent a ouvert toutes les pièces."));
    if (p.tmp != null) items.push(el("p", { class: "texte-court" }, p.tmp ? "L'agent a écrit dans un dossier temporaire hors de son espace." : "L'agent est resté dans son espace de travail."));
    if (p.fin) items.push(el("p", { class: "etiquette" }, "Ce que l'agent dit à la fin"), el("blockquote", { class: "consigne" }, p.fin));
    const liste = el("ol", { class: "actions" }, p.actions.map((a) =>
      el("li", null, el("span", { class: "tour" }, `tour ${a[0] ?? "?"}`), el("span", { class: "outil" }, a[1]), el("span", { class: "quoi" }, a[2] || "—"))));
    items.push(el("details", { class: "pli" }, el("summary", null, `Voir les ${p.actions.length} actions, dans l'ordre`), liste));
    zone.replaceChildren(...items);
  }
  choix.addEventListener("change", remplir);
  remplir();
  bloc.append(el("div", { class: "outils" }, el("label", { for: "parcours-choix", class: "etiquette" }, "Lancement"), choix), zone);
  return bloc;
}

function choisir(id, defiler) {
  const t = D.taches.find((x) => x.id === id);
  if (!t) return;
  tacheChoisie = id;
  for (const tr of document.querySelectorAll("#score tbody tr")) tr.setAttribute("aria-selected", String(tr.dataset.tache === id));
  const zone = document.getElementById("detail");
  const sous = [t.titreOriginal, t.domaine, pluriel(t.nPieces, "pièce", "pièces"), pluriel(t.nCriteres, "critère", "critères")].filter(Boolean);
  const tete = el("div", { class: "detail-tete" }, el("p", { class: "surtitre" }, "Détail de la tâche"), el("h2", null, t.titre),
    el("p", { class: "aide" }, sous.join(" · ")));
  if (!t.couverte) {
    const msg = t.test
      ? "Tâche de test : on n'affiche que ses scores globaux. Lire sa grille ou ses livrables fausserait la mesure finale."
      : "Tâche hors mise au point : on n'affiche que ses scores globaux, pour ne pas lire sa grille.";
    const liste = el("ul", { class: "liste-pieces" }, t.runs.map((r) =>
      el("li", null, `${libelleRun(r)} · ${principal(r).ok ? "réussie" : "ratée"} · noté par ${principal(r).nom} · ${r.date}`)));
    zone.replaceChildren(tete, el("p", { class: "texte-court" }, msg), liste);
  } else {
    zone.replaceChildren(tete, blocPieces(t), blocGrille(t), blocLivrables(t), blocParcours(t));
  }
  if (defiler) zone.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/* ---------- les écartés ---------- */
function construireEcartes() {
  document.getElementById("titre-ecartes").textContent = `Lancements écartés (${D.ecartes.length})`;
  const table = document.getElementById("ecartes-table");
  table.append(el("thead", null, el("tr", null, ["Tâche", "Agent", "Condition", "Lancement", "Raison"].map((h) => el("th", { scope: "col" }, h)))),
    el("tbody", null, D.ecartes.map((e) => el("tr", null,
      el("td", null, e.tache), el("td", null, e.agent), el("td", null, `${e.cond} la méthode`),
      el("td", null, el("span", { title: e.horodatage }, e.date)), el("td", null, e.raison)))));
}

construireScore();
construireEcartes();
const premiere = D.taches.find((t) => t.couverte && t.runs.length) || D.taches[0];
if (premiere) choisir(premiere.id, false);
</script>
"""


if __name__ == "__main__":
    main()
