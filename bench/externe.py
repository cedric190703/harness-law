#!/usr/bin/env python3
"""Faire une tâche du benchmark de Harvey hors de son harnais, puis la noter comme les autres.

  # Claude Code avec l'abonnement, dans un profil isolé (sans réglages perso, sans MCP, sans internet)
  python3 bench/externe.py claude-code corporate-ma/compare-closing-checklist-against-ma-agreement
  python3 bench/externe.py claude-code <tâche> --skill --model opus

  # Une tâche maison : un dossier avec consigne.md, documents (lien vers les pièces) et livrables.txt
  python3 bench/externe.py claude-code --dossier-tache bench/taches-maison/orionis --pas-noter
  python3 bench/externe.py claude-code --dossier-tache bench/taches-maison/orionis --skill-nom visa-due-diligence

  # Un livrable fait à la main dans un autre outil (Legora sur le web…)
  python3 bench/externe.py preparer <tâche>        # dossier à téléverser + consigne à coller
  python3 bench/externe.py importer <tâche> --source legora --fichier ~/Downloads/rapport.docx

Chaque passage devient un lancement harvey-labs/results/<tâche>/<source>-<condition>/<horodatage>/,
noté par le même juge que les autres, ajouté à bench/results.jsonl et visible dans bench/revue.py.

Claude Code ne voit que les pièces et la consigne, jamais task.json (qui contient la grille).
Un lancement qui touche à task.json ou à harvey-labs est marqué « contaminé » et ne compte pas.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run as banc  # noqa: E402  (load_env, ROOT, LAB, RESULTS, SKILL, BASE_SKILLS)

BASE = Path.home() / "lab-claude-code"
PROFIL = BASE / "config"
ESPACES = BASE / "espaces"
ARCHIVES = BASE / "archives"
A_TELEVERSER = BASE / "a-televerser"
JUGE = "claude-code-opus-5-5@max"  # Opus 5.5, effort max, via l abonnement Claude Code (bench/lab.py)
OUTILS = {"Read": "read", "Bash": "bash", "Grep": "grep", "Glob": "glob", "Write": "write", "Edit": "edit"}
INTERDITS = ("task.json", "harvey-labs", "/orca/")
# Les instructions et la mémoire perso de Youssef ne doivent pas biaiser l'agent (vérifié le 04/10/2026).
ISOLEMENT = {"claudeMdExcludes": [str(Path.home() / ".claude" / "CLAUDE.md"), str(Path.home() / ".claude" / "**" / "*.md")],
             "autoMemoryEnabled": False}

PREAMBULE = """You are an AI agent executing a task provided by the user within a workspace.

## Workspace layout

The current directory is the workspace ($WORKSPACE_DIR). It contains:
- `documents/` ($DOCUMENTS_DIR): the task documents. Read-only.
- `output/` ($OUTPUT_DIR): put every deliverable here, with the exact file name the task asks for.
- `skills/<name>/scripts/`: scripts of the skill manuals below.

Work only inside this workspace. For scratch files use `./tmp` (never `/tmp` or any path outside this
workspace). There is no grading rubric here: do not look for one outside the workspace. Do not use the internet.

## Tool conventions

- To read .docx, .xlsx, .pptx or .pdf files, convert them to text first (for example
  `pandoc documents/x.docx -t plain --wrap=none`, or the skill scripts). pandoc and python-docx are installed.
- Use the file-type skill manuals below to produce binary deliverables (.docx, .xlsx, .pptx).
- When all deliverables are in `output/`, stop and give a brief summary of what you produced.

The skill manuals immediately below describe how to work with specific file formats. Read them
before tackling the task.
"""


def tache(nom: str) -> dict:
    dossier = banc.LAB / "tasks" / nom
    config = json.loads((dossier / "task.json").read_text())
    documents = dossier / (config.get("docs_dir") or "documents")
    return {"nom": nom, "consigne": config["instructions"], "livrables": list(config.get("deliverables", {})),
            "documents": documents.resolve()}


def tache_maison(dossier: str) -> dict:
    """Une tâche hors Harvey : consigne.md, documents (lien vers les pièces, ou fichier qui donne leur chemin),
    livrables.txt (un nom par ligne). Ses lancements vont dans results/maison/<nom du dossier>/."""
    dossier = Path(dossier).expanduser()
    documents = dossier / "documents"
    if documents.is_file():
        documents = Path(documents.read_text().strip()).expanduser()
    livrables = dossier / "livrables.txt"
    return {"nom": f"maison/{dossier.resolve().name}", "consigne": (dossier / "consigne.md").read_text().strip(),
            "livrables": [l.strip() for l in livrables.read_text().splitlines() if l.strip()] if livrables.exists() else [],
            "documents": documents.resolve()}


def manuels(skills: list[str], espace: Path) -> str:
    """Les mêmes manuels que le harnais de Harvey, et leurs scripts copiés dans l'espace."""
    textes = []
    for nom in skills:
        nos_skills = banc.ROOT / "skills" / nom
        source = nos_skills if nos_skills.is_dir() else banc.LAB / "lab_core" / "harness" / "skills" / nom
        textes.append(f"\n\n## Skill: {nom}\n\n{(source / 'SKILL.md').read_text()}")
        if (source / "scripts").exists():
            shutil.copytree(source / "scripts", espace / "skills" / nom / "scripts", dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns("__pycache__"))
    return "".join(textes)


def contenu(bloc) -> str:
    if isinstance(bloc, str):
        return bloc
    if isinstance(bloc, list):
        return "\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in bloc)
    return str(bloc)


def convertir(flux: list[dict], documents: list[str]) -> tuple[list[dict], dict]:
    """Le journal de Claude Code (stream-json) au format du journal de Harvey, et ses chiffres."""
    journal, tour, outil_de = [], 0, {}
    lus, final = set(), {}
    for m in flux:
        if m.get("type") == "assistant":
            tour += 1
            blocs = m.get("message", {}).get("content", [])
            texte = "\n".join(b.get("text", "") for b in blocs if b.get("type") == "text") or None
            appels = []
            for b in blocs:
                if b.get("type") == "tool_use":
                    nom = OUTILS.get(b["name"], b["name"].lower())
                    entree = b.get("input", {})
                    outil_de[b["id"]] = (nom, entree)
                    appels.append({"id": b["id"], "name": nom, "arguments": json.dumps(entree, ensure_ascii=False)})
                    vu = json.dumps(entree, ensure_ascii=False)
                    lus.update(d for d in documents if d in vu or Path(d).stem in vu)
            journal.append({"turn": tour, "role": "assistant", "text": texte, "tool_calls": appels or None})
        elif m.get("type") == "user":
            for b in m.get("message", {}).get("content", []) if isinstance(m.get("message", {}).get("content"), list) else []:
                if b.get("type") == "tool_result":
                    nom, entree = outil_de.get(b.get("tool_use_id"), ("?", {}))
                    journal.append({"turn": tour, "role": "tool", "tool_call_id": b.get("tool_use_id"), "tool_name": nom,
                                    "arguments": json.dumps(entree, ensure_ascii=False), "result": contenu(b.get("content"))[:200000]})
        elif m.get("type") == "result":
            final = m
    usage = final.get("usage", {})
    entree = sum(usage.get(k, 0) or 0 for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    metriques = {
        "turn_count": tour, "input_tokens": entree, "output_tokens": usage.get("output_tokens", 0),
        "total_tokens": entree + (usage.get("output_tokens", 0) or 0),
        "wall_clock_seconds": round((final.get("duration_ms") or 0) / 1000, 1),
        "finish_reason": final.get("subtype"), "finish_summary": (final.get("result") or "")[:400],
        "cout_estime_usd": final.get("total_cost_usd"),
        "documents_read_list": sorted(lus), "documents_read": len(lus), "total_documents": len(documents),
        "documents_skipped_list": [d for d in documents if d not in lus], "documents_skipped": len(documents) - len(lus),
    }
    return journal, metriques


def noter(run_id: str, nom_tache: str, juges: list[str], env: dict, journal: Path) -> dict:
    cmd = ["uv", "run", "python", str(banc.ROOT / "bench" / "lab.py"), "eval", "--run-id", run_id, "--task", nom_tache,
           "--judges", *juges]
    with journal.open("a") as fh:
        subprocess.run(cmd, cwd=banc.LAB, env=env, stdout=fh, stderr=subprocess.STDOUT)
    dossier = banc.LAB / "results" / run_id
    fichier = next((dossier / n for n in ("scores_dual.json", "scores.json") if (dossier / n).exists()), None)
    return json.loads(fichier.read_text()) if fichier else {}


def consigner(run_id: str, nom_tache: str, modele: str, condition: str, juges: list[str], scores: dict,
              metriques: dict, debut: float, journal: Path, ne_compte_pas: str = "") -> None:
    ligne = {
        "at": datetime.now().isoformat(timespec="seconds"), "model": modele, "effort": None, "tool_choice": None,
        "condition": condition, "task": nom_tache, "run_id": run_id, "judges": juges, "agent_ok": True,
        "graded": bool(scores) and not ne_compte_pas, "all_pass": scores.get("all_pass"), "score": scores.get("score"),
        "n_criteria": scores.get("n_criteria"), "n_passed": scores.get("n_passed"),
        "input_tokens": metriques.get("input_tokens"), "output_tokens": metriques.get("output_tokens"),
        "turns": metriques.get("turn_count"), "finish_reason": metriques.get("finish_reason"),
        "agent_seconds": metriques.get("wall_clock_seconds"), "total_seconds": round(time.time() - debut, 1),
        "log": str(journal.relative_to(banc.ROOT)), "ne_compte_pas": ne_compte_pas or None,
    }
    with banc.RESULTS.open("a") as fh:
        fh.write(json.dumps(ligne) + "\n")
    score = f"{scores.get('n_passed')}/{scores.get('n_criteria')} critères" if scores else "non noté"
    print(f"[{condition}] {nom_tache} : {score}" + (f" — ne compte pas : {ne_compte_pas}" if ne_compte_pas else ""))


def claude_code(a) -> None:
    if not (a.tache or a.dossier_tache):
        sys.exit("Indique une tâche de Harvey ou --dossier-tache <dossier>.")
    t = tache_maison(a.dossier_tache) if a.dossier_tache else tache(a.tache)
    avec_skill = a.skill or bool(a.skill_nom)
    condition = "skill" if avec_skill else "base"
    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    run_id = f"{t['nom']}/claude-code-{a.model}-{condition}/{horodatage}"
    espace = ESPACES / f"{horodatage}-{t['nom'].split('/')[-1]}-{condition}"
    shutil.copytree(t["documents"], espace / "documents")
    (espace / "output").mkdir(parents=True)
    skills = banc.BASE_SKILLS + ([a.skill_nom or banc.SKILL] if avec_skill else [])
    prompt_systeme = PREAMBULE + manuels(skills, espace)
    documents = sorted(f.relative_to(t["documents"]).as_posix() for f in t["documents"].rglob("*") if f.is_file())

    env = banc.load_env()
    env.pop("ANTHROPIC_API_KEY", None)  # l'abonnement, pas l'API
    # L'agent testé ne doit pas se croire sous-session de notre équipe (messagerie, jeton) ni recevoir nos interruptions.
    for cle in [k for k in env if k.startswith(("CLAUDE_CODE_", "ORCA_")) or k in ("CLAUDECODE", "CLAUDE_PID", "AI_AGENT")]:
        env.pop(cle)
    (espace / "tmp").mkdir()
    env.update({"TMPDIR": str(espace / "tmp"), "WORKSPACE_DIR": str(espace),
                "DOCUMENTS_DIR": str(espace / "documents"), "OUTPUT_DIR": str(espace / "output")})
    reglages = {"permissions": {"deny": ["Read(//Users/**/orca/**)", "Bash(*task.json*)", "Bash(*harvey-labs*)",
                                         "WebFetch", "WebSearch"]}}
    if not a.profil_perso:
        reglages.update(ISOLEMENT)
    interdits = list(INTERDITS)
    if a.dossier_tache:  # ce qui est rangé à côté des pièces (corrigé, grille) est hors d'atteinte
        source = t["documents"].parent
        voisins = [v.name for v in source.iterdir() if v.resolve() != t["documents"]]
        reglages["permissions"]["deny"] += [f"Read(/{source}/**)"] + [f"Bash(*{v}/*)" for v in voisins]
        interdits += [str(source)] + [f"{source.name}/{v}" for v in voisins] + [f"{v}/" for v in voisins]
    # Le prompt système passe par un fichier : dans la ligne de commande, il contient « soffice » (manuel docx)
    # et le « pkill -f soffice » d'un agent voisin tuait ce lancement (SIGTERM, code 143).
    fichier_prompt = BASE / "prompts" / f"{espace.name}.md"
    fichier_prompt.parent.mkdir(parents=True, exist_ok=True)
    fichier_prompt.write_text(prompt_systeme)
    cmd = ["claude", "-p", t["consigne"], "--model", a.model, "--append-system-prompt-file", str(fichier_prompt),
           "--output-format", "stream-json", "--verbose", "--no-session-persistence",
           "--strict-mcp-config", "--mcp-config", '{"mcpServers": {}}', "--settings", json.dumps(reglages),
           "--disallowedTools", "WebFetch", "WebSearch", "--permission-mode", "bypassPermissions"]
    if not a.profil_perso:
        cmd += ["--setting-sources", "project", "--disable-slash-commands"]
    journal_texte = banc.ROOT / "bench" / "logs" / (run_id.replace("/", "__") + ".log")
    journal_texte.parent.mkdir(parents=True, exist_ok=True)
    print(f"Claude Code ({a.model}, {condition}{', ' + skills[-1] if avec_skill else ''}) sur {t['nom']}… "
          f"espace : {espace}", flush=True)
    debut = time.time()
    flux_brut = espace / "flux.jsonl"
    with flux_brut.open("w") as sortie, journal_texte.open("w") as err:
        try:
            code = subprocess.run(cmd, cwd=espace, env=env, stdout=sortie, stderr=err, timeout=a.delai * 60).returncode
        except subprocess.TimeoutExpired:  # on garde ce qui a été fait jusque-là
            code = "délai dépassé"
    fichier_prompt.unlink(missing_ok=True)
    flux = [json.loads(l) for l in flux_brut.read_text().splitlines() if l.strip().startswith("{")]
    if code not in (0, "délai dépassé") and not any(m.get("type") == "result" for m in flux):
        sys.exit(f"Claude Code a échoué (code {code}) : voir {journal_texte}. Profil connecté ? "
                 f"CLAUDE_CONFIG_DIR={PROFIL} claude, puis /login")

    journal, metriques = convertir(flux, documents)
    if code == "délai dépassé":
        metriques.update({"finish_reason": f"délai dépassé ({a.delai} min)", "wall_clock_seconds": round(time.time() - debut, 1)})
    init = next((m for m in flux if m.get("type") == "system" and m.get("subtype") == "init"), {})
    metriques["chargement"] = {k: init.get(k) for k in ("model", "tools", "mcp_servers", "skills", "plugins", "slash_commands")}
    appels = json.dumps([e for e in journal if e["role"] == "assistant"], ensure_ascii=False)
    # Des repères, pas des chaînes vides (« ESPACE/tmp » n'est pas « /tmp ») ; ses propres sorties rangées par
    # Claude Code dans ~/.claude/projects/…-espaces-<espace> ne comptent pas comme le dossier d'un autre lancement.
    hors_espace = (appels.replace(str(espace), "ESPACE")
                   .replace(f"lab-claude-code-espaces-{espace.name}", "ESPACE-SORTIES"))
    # « lab-claude-code » hors de l'espace : un autre lancement, ses sorties dans ~/.claude/projects, ou le corrigé
    contamine = any(mot in hors_espace for mot in interdits) or BASE.name in hors_espace
    metriques["a_utilise_tmp"] = bool(re.search(r"(?<![\w.\-])/tmp\b", hors_espace))  # le vrai /tmp, pas ESPACE/tmp ni ../tmp
    raison = ("a touché à task.json, à harvey-labs, au corrigé ou au dossier d'un autre lancement" if contamine
              else "profil perso (réglages et CLAUDE.md chargés)" if a.profil_perso else "")
    metriques.update({"model": f"claude-code/{a.model}", "ne_compte_pas": raison or None})
    dossier = banc.LAB / "results" / run_id
    (dossier / "output").mkdir(parents=True)
    for f in (espace / "output").iterdir():
        if f.is_file():
            shutil.copy2(f, dossier / "output" / f.name)
    (dossier / "transcript.jsonl").write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in journal))
    (dossier / "metrics.json").write_text(json.dumps(metriques, indent=2, ensure_ascii=False))
    (dossier / "config.json").write_text(json.dumps({"model": f"claude-code/{a.model}", "skills": skills,
                                                     "source": "claude-code", "espace": str(ARCHIVES / espace.name)}, indent=2))
    # Claude Code range les grosses sorties hors de l'espace (~/.claude/projects/<chemin en tirets>) : on les efface.
    for sorties in (Path.home() / ".claude" / "projects").glob(f"*lab-claude-code-espaces-{espace.name}*"):
        shutil.rmtree(sorties, ignore_errors=True)
    archive = ARCHIVES / espace.name
    archive.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(espace), archive)
    os.chmod(archive, 0)  # illisible pour les lancements suivants ; chmod 700 pour le rouvrir
    scores = {} if contamine or a.pas_noter else noter(run_id, t["nom"], a.judges, banc.load_env(), journal_texte)
    consigner(run_id, t["nom"], f"claude-code-{a.model}", condition, a.judges, scores, metriques, debut, journal_texte, raison)


def preparer(a) -> None:
    t = tache(a.tache)
    dossier = A_TELEVERSER / a.tache.split("/")[-1]
    if dossier.exists():
        shutil.rmtree(dossier)
    shutil.copytree(t["documents"], dossier / "documents")
    (dossier / "CONSIGNE.md").write_text(t["consigne"] + "\n")
    print(f"""Dossier prêt : {dossier}
1. Dans l'outil (Legora…), crée un projet et téléverse tout le dossier documents/.
2. Colle la consigne de CONSIGNE.md, telle quelle, sans rien ajouter.
3. Télécharge le livrable, nommé exactement : {', '.join(t['livrables'])}
4. python3 bench/externe.py importer {a.tache} --source legora --fichier <le fichier téléchargé>""")


def importer(a) -> None:
    t = tache(a.tache)
    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    run_id = f"{a.tache}/{a.source}-{a.condition}/{horodatage}"
    dossier = banc.LAB / "results" / run_id
    (dossier / "output").mkdir(parents=True)
    fichiers = [Path(f).expanduser() for f in a.fichier]
    for f in fichiers:
        nom = t["livrables"][0] if len(fichiers) == 1 and len(t["livrables"]) == 1 else f.name
        shutil.copy2(f, dossier / "output" / nom)
    (dossier / "transcript.jsonl").write_text("")
    metriques = {"model": a.source, "source": "import manuel", "total_documents": len(list(t["documents"].iterdir()))}
    (dossier / "metrics.json").write_text(json.dumps(metriques, indent=2))
    (dossier / "config.json").write_text(json.dumps({"model": a.source, "source": "import manuel"}, indent=2))
    journal = banc.ROOT / "bench" / "logs" / (run_id.replace("/", "__") + ".log")
    journal.parent.mkdir(parents=True, exist_ok=True)
    journal.write_text("")
    debut = time.time()
    scores = noter(run_id, a.tache, a.judges, banc.load_env(), journal)
    consigner(run_id, a.tache, a.source, a.condition, a.judges, scores, metriques, debut, journal)


def renoter(a) -> None:
    for run_id in a.run_ids:
        run_id = run_id.strip("/").removeprefix("results/")
        tache_nom = "/".join(run_id.split("/")[:2])
        journal = banc.ROOT / "bench" / "logs" / (run_id.replace("/", "__") + ".log")
        journal.parent.mkdir(parents=True, exist_ok=True)
        scores = noter(run_id, tache_nom, a.judges, banc.load_env(), journal)
        print(f"{run_id} : " + (scores.get("summary") or "non noté, voir " + str(journal)))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sous = p.add_subparsers(dest="commande", required=True)
    cc = sous.add_parser("claude-code", help="lance Claude Code (abonnement) sur une tâche")
    cc.add_argument("tache", nargs="?", help="tâche de Harvey (ou --dossier-tache)")
    cc.add_argument("--dossier-tache", help="tâche maison : dossier avec consigne.md, documents et livrables.txt")
    cc.add_argument("--skill", action="store_true", help="avec notre skill")
    cc.add_argument("--skill-nom", help=f"lequel de nos skills (dossier skills/) ; implique --skill ; défaut {banc.SKILL}")
    cc.add_argument("--model", default="sonnet", help="sonnet, opus, fable…")
    cc.add_argument("--delai", type=int, default=60, help="minutes avant d'abandonner")
    cc.add_argument("--judges", nargs="+", default=[JUGE])
    cc.add_argument("--profil-perso", action="store_true", help="essai de tuyauterie avec ton profil normal (ne compte pas)")
    cc.add_argument("--pas-noter", action="store_true", help="lance l'agent seulement ; noter plus tard avec la commande noter")
    no = sous.add_parser("noter", help="note (ou renote) des lancements déjà faits")
    no.add_argument("run_ids", nargs="+", help="ex. corporate-ma/<tâche>/claude-code-sonnet-base/<horodatage>")
    no.add_argument("--judges", nargs="+", default=[JUGE])
    pr = sous.add_parser("preparer", help="prépare le dossier à téléverser dans un autre outil")
    pr.add_argument("tache")
    im = sous.add_parser("importer", help="note un livrable produit dans un autre outil")
    im.add_argument("tache")
    im.add_argument("--source", required=True, help="ex. legora")
    im.add_argument("--fichier", nargs="+", required=True)
    im.add_argument("--condition", default="base", choices=["base", "skill", "boucle"])
    im.add_argument("--judges", nargs="+", default=[JUGE])
    a = p.parse_args()
    {"claude-code": claude_code, "preparer": preparer, "importer": importer, "noter": renoter}[a.commande](a)


if __name__ == "__main__":
    main()
