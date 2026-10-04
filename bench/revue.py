#!/usr/bin/env python3
"""Revue d'une tâche du benchmark de Harvey : sans skill contre avec skill, sur une page.

  python bench/revue.py <tâche>                         # dernière paire de lancements, puis ouvre la page
  python bench/revue.py <tâche> --lancer --model M      # lance les deux conditions (bench/run.py), puis la revue
  python bench/revue.py <tâche> --model codestral-latest --base 20261004-114931 --skill 20261004-115420

La page montre : les critères gagnés et perdus, le parcours de chaque agent (ce qu'il a lu,
cherché, écrit, et quand), les livrables côte à côte, et un bouton qui copie un résumé
pour Claude. bench/revues/<tâche>/<horodatage>/revue.md contient le même résumé.

Une tâche de test (bench/split*.json) n'affiche jamais sa grille : la lire fausserait la mesure.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAB = ROOT / "harvey-labs"
SORTIE = ROOT / "bench" / "revues"
SKILL = "cross-document-review"
APERCU = 400


def taches_de_test() -> set[str]:
    test: set[str] = set()
    for fichier in (ROOT / "bench").glob("split*.json"):
        test.update(json.loads(fichier.read_text()).get("test", []))
    return test


def lancements(tache: str, modele: str | None) -> list[dict]:
    """Tous les lancements d'une tâche, du plus ancien au plus récent."""
    trouves = []
    for dossier in sorted((LAB / "results" / tache).glob("*/*/")):
        config, horodatage = dossier.parent.name, dossier.name
        condition = config.rsplit("-", 1)[-1]
        if condition not in ("base", "skill") or not (dossier / "transcript.jsonl").exists():
            continue
        modele_court = config[: -len(condition) - 1]
        if modele and not modele_court.startswith(modele.split("/")[-1]):
            continue
        trouves.append({"dossier": dossier, "condition": condition, "modele": modele_court, "horodatage": horodatage,
                        "note": fichier_scores(dossier) is not None})
    return sorted(trouves, key=lambda r: r["horodatage"])


def choisir(runs: list[dict], condition: str, prefixe: str | None) -> dict | None:
    candidats = [r for r in runs if r["condition"] == condition]
    if prefixe:
        candidats = [r for r in candidats if r["horodatage"].startswith(prefixe)]
        return candidats[-1] if candidats else None
    notes = [r for r in candidats if r["note"]]
    return (notes or candidats or [None])[-1]


def fichier_scores(dossier: Path) -> Path | None:
    for nom in ("scores_dual.json", "scores.json"):
        if (dossier / nom).exists():
            return dossier / nom
    autres = sorted(dossier.glob("scores_*.json"))
    return autres[0] if autres else None


def lire_json(fichier: Path) -> dict:
    try:
        return json.loads(fichier.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def arguments(brut) -> dict:
    if isinstance(brut, dict):
        return brut
    try:
        valeur = json.loads(brut or "{}")
        return valeur if isinstance(valeur, dict) else {"brut": str(valeur)}
    except json.JSONDecodeError:
        return {"brut": str(brut)}


def libelle(outil: str, args: dict) -> str:
    if outil == "read":
        return args.get("file_path", "")
    if outil == "grep":
        return f"« {args.get('pattern', '')} »" + (f" dans {args['path']}" if args.get("path") else "")
    if outil == "glob":
        return args.get("pattern", "")
    if outil == "bash":
        return re.sub(r"\$WORKSPACE_DIR/|/workspace/", "", args.get("command", ""))[:220]
    if outil in ("write", "edit"):
        return args.get("file_path", args.get("path", ""))
    if outil == "finish":
        return args.get("summary", "")[:220]
    return json.dumps(args, ensure_ascii=False)[:220]


def piste(outil: str, args: dict, documents: list[str]) -> list[str]:
    """Les lignes du schéma touchées par une action : les pièces citées, sinon skill, écriture ou autre."""
    texte = json.dumps(args, ensure_ascii=False)
    touches = [d for d in documents if d in texte or Path(d).stem in texte]
    if touches:
        return touches
    if SKILL in texte or re.search(r"\b(check|extract_text|sections)\.py\b", texte):
        return ["skill"]
    if outil in ("write", "edit") or "output/" in texte:
        return ["livrable"]
    return ["autre"]


def trajectoire(dossier: Path, documents: list[str]) -> dict:
    etapes, textes, par_id = [], [], {}
    for ligne in (dossier / "transcript.jsonl").read_text().splitlines():
        if not ligne.strip():
            continue
        e = json.loads(ligne)
        if e.get("role") == "assistant":
            if e.get("text"):
                textes.append({"tour": e["turn"], "texte": e["text"][:1500]})
            for appel in e.get("tool_calls") or []:
                args = arguments(appel.get("arguments"))
                etape = {"tour": e["turn"], "outil": appel["name"], "libelle": libelle(appel["name"], args),
                         "pistes": piste(appel["name"], args, documents), "taille": 0, "apercu": ""}
                par_id[appel.get("id")] = etape
                etapes.append(etape)
        elif e.get("role") == "tool":
            etape = par_id.get(e.get("tool_call_id"))
            if etape:
                resultat = e.get("result") or ""
                etape["taille"] = len(resultat)
                etape["apercu"] = resultat[:APERCU]
    return {"etapes": etapes, "textes": textes}


def livrables(dossier: Path) -> list[dict]:
    sortie = dossier / "output"
    resultat = []
    for f in sorted(sortie.iterdir()) if sortie.exists() else []:
        if not f.is_file():
            continue
        if f.suffix == ".docx" and shutil.which("pandoc"):
            p = subprocess.run(["pandoc", str(f), "-t", "gfm", "--wrap=none"], capture_output=True, text=True)
            texte = p.stdout if p.returncode == 0 else f"(conversion impossible : {p.stderr[:200]})"
        elif f.suffix in (".md", ".txt", ".csv", ".json"):
            texte = f.read_text(errors="replace")
        else:
            texte = f"({f.suffix} : aperçu non disponible, ouvrir {f})"
        resultat.append({"nom": f.name, "chemin": str(f), "taille": f.stat().st_size, "texte": texte[:80000]})
    return resultat


def dossier_documents(run: dict) -> Path:
    tache = run["dossier"].relative_to(LAB / "results").parts[:2]
    return LAB / "tasks" / Path(*tache) / "documents"


def normaliser(texte: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", texte.lower()).strip()


def texte_brut(fichier: Path) -> str:
    if fichier.suffix != ".docx" or not shutil.which("pandoc"):
        return fichier.read_text(errors="replace") if fichier.suffix in (".md", ".txt") else ""
    p = subprocess.run(["pandoc", str(fichier), "-t", "plain", "--wrap=none"], capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else ""


def copies(sorties: list[dict], documents: Path) -> list[str]:
    """Un livrable dont le début se retrouve tel quel dans une pièce est une copie, pas un travail."""
    alertes = []
    pieces = {doc.name: normaliser(texte_brut(doc)) for doc in sorted(documents.glob("*.docx"))} if documents.exists() else {}
    for livrable in sorties:
        debut = normaliser(texte_brut(Path(livrable["chemin"])))[:600]
        if len(debut) < 200:
            continue
        alertes += [f"{livrable['nom']} recopie la pièce {nom}" for nom, texte in pieces.items() if debut in texte]
    return alertes


def charger(run: dict | None, documents: list[str], montrer_grille: bool) -> dict | None:
    if run is None:
        return None
    d = run["dossier"]
    scores_f = fichier_scores(d)
    scores = lire_json(scores_f) if scores_f else {}
    metriques = lire_json(d / "metrics.json")
    config = lire_json(d / "config.json")
    criteres = scores.get("criteria_results") or []
    parcours = trajectoire(d, documents)
    lus_parcours = {p for e in parcours["etapes"] if e["outil"] in ("read", "bash", "grep") for p in e["pistes"] if p in documents}
    lus = sorted(set(metriques.get("documents_read_list") or []) | lus_parcours)
    sorties = livrables(d)
    return {
        "condition": run["condition"], "modele": run["modele"], "horodatage": run["horodatage"], "dossier": str(d),
        "skills": config.get("skills") or config.get("skill_names"),
        "note": bool(scores), "juge": scores.get("judge_model"),
        "reussis": scores.get("n_passed"), "total": scores.get("n_criteria"), "tache_reussie": scores.get("all_pass"),
        "criteres": [{"id": c.get("id"), "titre": c.get("title"), "verdict": c.get("verdict"),
                      "raison": c.get("reasoning")} for c in criteres] if montrer_grille else [],
        "tours": metriques.get("turn_count"), "jetons_entree": metriques.get("input_tokens"),
        "jetons_sortie": metriques.get("output_tokens"), "secondes": metriques.get("wall_clock_seconds"),
        "fin": metriques.get("finish_reason"), "resume_fin": metriques.get("finish_summary"),
        "lus": lus, "non_lus": [doc for doc in documents if doc not in lus],
        **parcours,
        "livrables": sorties, "copies": copies(sorties, dossier_documents(run)),
    }


def comparer(base: dict | None, skill: dict | None) -> list[dict]:
    lignes: dict[str, dict] = {}
    for cote, run in (("base", base), ("skill", skill)):
        for c in (run or {}).get("criteres", []):
            ligne = lignes.setdefault(c["id"], {"id": c["id"], "titre": c["titre"]})
            ligne[cote] = c["verdict"]
            ligne[f"raison_{cote}"] = c["raison"]
    for ligne in lignes.values():
        b, s = ligne.get("base"), ligne.get("skill")
        ligne["groupe"] = ("perdu" if b == "pass" and s == "fail" else "gagne" if b == "fail" and s == "pass"
                           else "rate" if s == "fail" or (s is None and b == "fail") else "reussi")
    return sorted(lignes.values(), key=lambda l: l["id"] or "")


def resume_markdown(r: dict) -> str:
    """Le résumé à donner à Claude : court, sans les livrables complets."""
    out = [f"# Revue — {r['tache']}", ""]
    for run in (r["base"], r["skill"]):
        if not run:
            continue
        score = f"{run['reussis']}/{run['total']} critères" if run["note"] else "non noté"
        lus = f"{len(run['lus'] or [])}/{len(r['documents'])} pièces lues"
        out.append(f"- **{run['condition']}** ({run['modele']}, {run['horodatage']}) : {score}, tâche réussie : "
                   f"{run['tache_reussie']}, {run['tours']} tours, {lus}, juge {run['juge']}, fin : {run['fin']}")
    out.append("")
    if r["test"]:
        out.append("Tâche de TEST : grille non affichée. Ne pas chercher à la deviner.")
    else:
        for groupe, titre in (("perdu", "Perdus avec le skill"), ("gagne", "Gagnés avec le skill"),
                              ("rate", "Ratés (avec le skill)")):
            lignes = [l for l in r["criteres"] if l["groupe"] == groupe]
            if lignes:
                out.append(f"## {titre} ({len(lignes)})")
                for l in lignes:
                    raison = l.get("raison_skill") or l.get("raison_base") or ""
                    out.append(f"- {l['id']} {l['titre']} — juge : {raison[:300]}")
                out.append("")
    for run in (r["base"], r["skill"]):
        if run:
            jamais = run["non_lus"]
            for alerte in run["copies"]:
                out.append(f"ALERTE {run['condition']} : {alerte} (aucun vrai travail, malgré la note).")
            out.append(f"Parcours {run['condition']} : {len(run['etapes'])} actions ; pièces jamais lues : "
                       f"{', '.join(jamais) or 'aucune'} ; livrables : {', '.join(l['nom'] for l in run['livrables']) or 'aucun'}.")
    return "\n".join(out) + "\n"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("tache", help="ex. corporate-ma/compare-closing-checklist-against-ma-agreement")
    p.add_argument("--model", help="modèle à revoir (préfixe), ex. claude-sonnet-5-5")
    p.add_argument("--base", help="horodatage (ou début) du lancement sans skill")
    p.add_argument("--skill", help="horodatage (ou début) du lancement avec skill")
    p.add_argument("--lancer", action="store_true", help="lance d'abord les deux conditions avec bench/run.py")
    p.add_argument("--effort", help="effort de raisonnement, transmis à bench/run.py")
    p.add_argument("--judges", nargs="+", help="juges, transmis à bench/run.py")
    p.add_argument("--pas-ouvrir", action="store_true")
    p.add_argument("--montrer-test", action="store_true", help="affiche la grille d'une tâche de test (fausse la mesure)")
    a = p.parse_args()

    if a.lancer:
        if not a.model:
            p.error("--lancer demande --model")
        cmd = [sys.executable, str(ROOT / "bench" / "run.py"), "--model", a.model, "--tasks", a.tache]
        cmd += ["--effort", a.effort] if a.effort else []
        cmd += ["--judges", *a.judges] if a.judges else []
        if subprocess.run(cmd, cwd=ROOT).returncode != 0:
            sys.exit("bench/run.py a échoué : voir bench/logs/")

    dossier_tache = LAB / "tasks" / a.tache
    if not dossier_tache.exists():
        sys.exit(f"Tâche introuvable : {dossier_tache}")
    documents = sorted(f.name for f in (dossier_tache / "documents").iterdir()) if (dossier_tache / "documents").exists() else []
    test = a.tache in taches_de_test()
    montrer = not test or a.montrer_test
    runs = lancements(a.tache, a.model)
    base, skill = choisir(runs, "base", a.base), choisir(runs, "skill", a.skill)
    if not base and not skill:
        sys.exit(f"Aucun lancement pour {a.tache}" + (f" avec {a.model}" if a.model else "") + ". Utilise --lancer.")

    revue = {"tache": a.tache, "test": test and not a.montrer_test, "documents": documents,
             "consigne": lire_json(dossier_tache / "task.json").get("instructions", "")[:4000],
             "base": charger(base, documents, montrer), "skill": charger(skill, documents, montrer),
             "generee": datetime.now().isoformat(timespec="seconds")}
    revue["criteres"] = comparer(revue["base"], revue["skill"])
    revue["resume"] = resume_markdown(revue)

    dossier = SORTIE / a.tache / datetime.now().strftime("%Y%m%d-%H%M%S")
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "revue.md").write_text(revue["resume"])
    gabarit = (ROOT / "bench" / "revue.html").read_text()
    donnees = json.dumps(revue, ensure_ascii=False).replace("<", "\\u003c")
    (dossier / "revue.html").write_text(gabarit.replace("__DONNEES__", donnees))
    print(revue["resume"])
    print(f"Page : {dossier / 'revue.html'}")
    if not a.pas_ouvrir:
        webbrowser.open((dossier / "revue.html").as_uri())


if __name__ == "__main__":
    main()
