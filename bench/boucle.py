#!/usr/bin/env python3
"""La boucle de Visa : juger le livrable d'un agent, puis le relancer pour qu'il corrige lui-même, jusqu'à ce que
le vérificateur ne trouve plus de problème bloquant (2 tours de correction au plus). Visa ne réécrit rien : il
trouve les problèmes et donne les preuves (bench/verifier.py), l'agent corrige.

  # Claude Code : relance isolée, comme bench/externe.py, à partir d'un lancement déjà fait
  python3 bench/boucle.py harvey-labs/results/<tâche>/claude-code-sonnet-base/<horodatage> --tours 2

  # Legora : rien n'est relancé ; la revue à coller dans Legora est écrite dans le dossier du lancement
  python3 bench/boucle.py harvey-labs/results/<tâche>/legora-base/<horodatage> --source legora
  # puis, livrable corrigé téléchargé :
  python3 bench/externe.py importer <tâche> --source legora --condition boucle --fichier <livrable>

Le résultat Claude Code est rangé en <tâche>/claude-code-<modèle>-boucle/<horodatage>/ : output/ (le livrable
final), tours/tour-N/ (livrable et revue de chaque tour), boucle.json (l'historique), puis noté comme les autres.
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
import externe  # noqa: E402
import run as banc  # noqa: E402
import verifier  # noqa: E402

JUGES = ["claude-code-opus-5-5@max", "codex-gpt-5.5@high"]
CORRECTION = ("Un vérificateur indépendant a relu ton livrable (revue-visa.md). Corrige le livrable en conséquence : "
              "ajoute ce qui manque, corrige ce qui est faux, garde ce qui est juste. Même nom de fichier.\n\n"
              "Ton livrable actuel est dans output/ et la revue est revue-visa.md, à la racine de l'espace. "
              "Garde la langue et le format du livrable.")


def lancer(t: dict, precedent: Path, revue: Path, modele: str, skills: list[str], delai: int, journal_texte: Path) -> dict:
    """Un lancement Claude Code isolé, comme externe.claude_code : espace propre, mêmes interdits, même détection de
    contamination, même archivage illisible. L'espace contient en plus le livrable précédent et la revue."""
    horodatage = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    espace = externe.ESPACES / f"{horodatage}-{t['nom'].split('/')[-1]}-boucle"
    shutil.copytree(t["documents"], espace / "documents")
    (espace / "output").mkdir(parents=True)
    for f in precedent.iterdir():
        if f.is_file():
            shutil.copy2(f, espace / "output" / f.name)
    shutil.copy2(revue, espace / "revue-visa.md")
    prompt_systeme = externe.PREAMBULE + externe.manuels(skills, espace)
    documents = sorted(f.relative_to(t["documents"]).as_posix() for f in t["documents"].rglob("*") if f.is_file())

    env = banc.load_env()
    env.pop("ANTHROPIC_API_KEY", None)  # l'abonnement, pas l'API
    (espace / "tmp").mkdir()
    env.update({"TMPDIR": str(espace / "tmp"), "WORKSPACE_DIR": str(espace),
                "DOCUMENTS_DIR": str(espace / "documents"), "OUTPUT_DIR": str(espace / "output")})
    reglages = {"permissions": {"deny": ["Read(//Users/**/orca/**)", "Bash(*task.json*)", "Bash(*harvey-labs*)",
                                         "WebFetch", "WebSearch"]}, **externe.ISOLEMENT}
    consigne = f"{t['consigne']}\n\n{CORRECTION}"
    cmd = ["claude", "-p", consigne, "--model", modele, "--append-system-prompt", prompt_systeme,
           "--output-format", "stream-json", "--verbose", "--no-session-persistence",
           "--strict-mcp-config", "--mcp-config", '{"mcpServers": {}}', "--settings", json.dumps(reglages),
           "--disallowedTools", "WebFetch", "WebSearch", "--permission-mode", "bypassPermissions",
           "--setting-sources", "project", "--disable-slash-commands"]
    debut = time.time()
    flux_brut = espace / "flux.jsonl"
    with flux_brut.open("w") as sortie, journal_texte.open("a") as err:
        try:
            code = subprocess.run(cmd, cwd=espace, env=env, stdout=sortie, stderr=err, timeout=delai * 60).returncode
        except subprocess.TimeoutExpired:  # on garde ce qui a été fait jusque-là
            code = "délai dépassé"
    flux = [json.loads(l) for l in flux_brut.read_text().splitlines() if l.strip().startswith("{")]
    if code not in (0, "délai dépassé") and not any(m.get("type") == "result" for m in flux):
        sys.exit(f"Claude Code a échoué (code {code}) : voir {journal_texte}.")
    journal, metriques = externe.convertir(flux, documents)
    if code == "délai dépassé":
        metriques.update({"finish_reason": f"délai dépassé ({delai} min)", "wall_clock_seconds": round(time.time() - debut, 1)})
    appels = json.dumps([e for e in journal if e["role"] == "assistant"], ensure_ascii=False)
    hors_espace = (appels.replace(str(espace), "ESPACE")
                   .replace(f"lab-claude-code-espaces-{espace.name}", "ESPACE-SORTIES"))
    contamine = any(mot in hors_espace for mot in externe.INTERDITS) or externe.BASE.name in hors_espace
    metriques["a_utilise_tmp"] = bool(re.search(r"(?<![\w.\-])/tmp\b", hors_espace))
    sorties = [f for f in (espace / "output").iterdir() if f.is_file()]
    for sorties_cc in (Path.home() / ".claude" / "projects").glob(f"*lab-claude-code-espaces-{espace.name}*"):
        shutil.rmtree(sorties_cc, ignore_errors=True)
    return {"espace": espace, "sorties": sorties, "journal": journal, "metriques": metriques, "contamine": contamine}


def archiver(espace: Path) -> Path:
    archive = externe.ARCHIVES / espace.name
    archive.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(espace), archive)
    os.chmod(archive, 0)  # illisible pour les lancements suivants ; chmod 700 pour le rouvrir
    return archive


def resume(r: dict) -> dict:
    return {"tour": r.get("tour"), "bloquants": r["bloquants"], "par_categorie": r["bloquants_par_categorie"],
            "mineurs": r["mineurs"], "elements": r["stats_concordance"]["elements"], "secondes": r["secondes"],
            "cout_usd": r["cout_usd"], "jetons": r["jetons"]}


def claude_code(a, depart: Path, run_depart: str) -> None:
    nom_tache = "/".join(run_depart.split("/")[:2])
    t = externe.tache(nom_tache)
    config = json.loads((depart / "config.json").read_text())
    modele = a.model or config.get("model", "claude-code/sonnet").split("/")[-1]
    skills = config.get("skills") or banc.BASE_SKILLS
    if a.reprendre:  # une boucle interrompue (coupure réseau…) : on repart de ses tours déjà faits
        dossier = Path(a.reprendre).resolve()
        run_id = dossier.relative_to((banc.LAB / "results").resolve()).as_posix()
    else:
        horodatage = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        run_id = f"{nom_tache}/claude-code-{modele}-boucle/{horodatage}"
        dossier = banc.LAB / "results" / run_id
    journal_texte = banc.ROOT / "bench" / "logs" / (run_id.replace("/", "__") + ".log")
    journal_texte.parent.mkdir(parents=True, exist_ok=True)
    debut = time.time()

    # Tour 0 : la revue du livrable de départ (refaite si absente ou demandée).
    tour0 = dossier / "tours" / "tour-0"
    if not (tour0 / "output").exists():
        shutil.copytree(depart / "output", tour0 / "output")
    if (tour0 / "revue-visa.json").exists():
        revue = json.loads((tour0 / "revue-visa.json").read_text())
    elif (depart / "revue-visa.json").exists() and not a.refaire:  # déjà jugé : on reprend cette revue
        for nom in ("revue-visa.md", "revue-visa.json", "revue-legora.txt"):
            shutil.copy2(depart / nom, tour0 / nom)
        revue = json.loads((tour0 / "revue-visa.json").read_text())
    else:
        revue = verifier.verifier(tour0, a.modele_verif, tour=0)
    historique = [{**resume(revue), "depart": run_depart}]
    print(f"Tour 0 ({run_depart}) : {revue['bloquants']} bloquants {revue['bloquants_par_categorie']}", flush=True)

    tours, contamine = [], False
    precedent = tour0
    for n in range(1, a.tours + 1):
        ici = dossier / "tours" / f"tour-{n}"
        if (ici / "metrics.json").exists():  # tour déjà fait (reprise)
            r = {"journal": [json.loads(l) for l in (ici / "transcript.jsonl").read_text().splitlines() if l.strip()],
                 "metriques": json.loads((ici / "metrics.json").read_text())}
            r["contamine"] = bool(r["metriques"].get("contamine"))
            tours.append(r)
            if r["contamine"]:
                contamine = True
                break
            revue = (json.loads((ici / "revue-visa.json").read_text()) if (ici / "revue-visa.json").exists()
                     else verifier.verifier(ici, a.modele_verif, tour=n))
            historique.append({**resume(revue), "agent_secondes": r["metriques"].get("wall_clock_seconds"),
                               "agent_cout_usd": r["metriques"].get("cout_estime_usd")})
            print(f"Tour {n} (repris) : {revue['bloquants']} bloquants {revue['bloquants_par_categorie']}", flush=True)
            precedent = ici
            continue
        if revue["bloquants"] == 0:
            break
        print(f"Tour {n} : Claude Code ({modele}) corrige…", flush=True)
        r = lancer(t, precedent / "output", precedent / "revue-visa.md", modele, skills, a.delai, journal_texte)
        (ici / "output").mkdir(parents=True)
        for f in r["sorties"]:
            shutil.copy2(f, ici / "output" / f.name)
        (ici / "transcript.jsonl").write_text("".join(json.dumps({**e, "tour": n}, ensure_ascii=False) + "\n" for e in r["journal"]))
        r["metriques"]["espace"] = str(archiver(r["espace"]))
        r["metriques"]["contamine"] = r["contamine"]
        (ici / "metrics.json").write_text(json.dumps(r["metriques"], indent=2, ensure_ascii=False))
        tours.append(r)
        if r["contamine"]:
            contamine = True
            print(f"Tour {n} contaminé : la boucle s'arrête, le lancement ne compte pas.", flush=True)
            break
        revue = verifier.verifier(ici, a.modele_verif, tour=n)
        historique.append({**resume(revue), "agent_secondes": r["metriques"].get("wall_clock_seconds"),
                           "agent_cout_usd": r["metriques"].get("cout_estime_usd")})
        print(f"Tour {n} : {revue['bloquants']} bloquants {revue['bloquants_par_categorie']}", flush=True)
        precedent = ici

    # Le livrable final, le journal et les chiffres de toute la boucle.
    (dossier / "output").mkdir(exist_ok=True)
    for f in (precedent / "output").iterdir():
        if f.is_file():
            shutil.copy2(f, dossier / "output" / f.name)
    for nom in ("revue-visa.md", "revue-visa.json"):
        if (precedent / nom).exists():
            shutil.copy2(precedent / nom, dossier / nom)
    (dossier / "transcript.jsonl").write_text("".join(
        json.dumps({**e, "tour": i + 1}, ensure_ascii=False) + "\n" for i, r in enumerate(tours) for e in r["journal"]))
    somme = lambda cle: sum((r["metriques"].get(cle) or 0) for r in tours)  # noqa: E731
    lus = sorted({d for r in tours for d in r["metriques"].get("documents_read_list", [])})
    metriques = {
        "model": f"claude-code/{modele}", "depart": run_depart, "tours_de_correction": len(tours),
        "turn_count": somme("turn_count"), "input_tokens": somme("input_tokens"), "output_tokens": somme("output_tokens"),
        "total_tokens": somme("total_tokens"), "wall_clock_seconds": round(somme("wall_clock_seconds"), 1),
        "cout_estime_usd": round(somme("cout_estime_usd"), 4),
        "verificateur_secondes": round(sum(h["secondes"] for h in historique), 1),
        "verificateur_cout_usd": round(sum(h["cout_usd"] for h in historique), 4),
        "finish_reason": tours[-1]["metriques"].get("finish_reason") if tours else "rien à corriger",
        "documents_read_list": lus, "documents_read": len(lus),
        "ne_compte_pas": "a touché à task.json, à harvey-labs ou au dossier d'un autre lancement" if contamine else None,
    }
    (dossier / "metrics.json").write_text(json.dumps(metriques, indent=2, ensure_ascii=False))
    (dossier / "config.json").write_text(json.dumps({"model": f"claude-code/{modele}", "skills": skills, "source": "claude-code",
                                                     "condition": "boucle", "depart": run_depart,
                                                     "verificateur": a.modele_verif}, indent=2))
    (dossier / "boucle.json").write_text(json.dumps({"depart": run_depart, "historique": historique}, indent=2, ensure_ascii=False))
    print(f"Boucle rangée : {dossier}", flush=True)
    raison = metriques["ne_compte_pas"] or ""
    scores = {} if contamine or a.pas_noter else externe.noter(run_id, nom_tache, a.judges, banc.load_env(), journal_texte)
    externe.consigner(run_id, nom_tache, f"claude-code-{modele}", "boucle", a.judges, scores, metriques, debut,
                      journal_texte, raison)


def legora(a, depart: Path) -> None:
    if a.refaire or not (depart / "revue-visa.json").exists():
        verifier.verifier(depart, a.modele_verif)
    revue = json.loads((depart / "revue-visa.json").read_text())
    print(f"{revue['bloquants']} bloquants {revue['bloquants_par_categorie']}, {revue['mineurs']} mineurs.\n"
          f"Texte à coller dans Legora : {depart / 'revue-legora.txt'}\n"
          f"Revue complète : {depart / 'revue-visa.md'}\n"
          f"Ensuite : python3 bench/externe.py importer {revue['tache']} --source legora --condition boucle --fichier <livrable corrigé>")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("lancement", help="dossier du lancement de départ (avec output/) ou run_id")
    p.add_argument("--tours", type=int, default=2, help="tours de correction au plus")
    p.add_argument("--source", default="claude-code", choices=["claude-code", "legora"])
    p.add_argument("--model", help="modèle de Claude Code (par défaut celui du lancement de départ)")
    p.add_argument("--modele-verif", default=verifier.MODELE, help="le relecteur Mistral")
    p.add_argument("--delai", type=int, default=45, help="minutes par tour avant d'abandonner")
    p.add_argument("--judges", nargs="+", default=JUGES)
    p.add_argument("--pas-noter", action="store_true")
    p.add_argument("--refaire", action="store_true", help="refaire la revue du lancement de départ même si elle existe")
    p.add_argument("--reprendre", help="dossier d'une boucle interrompue (…/claude-code-<modèle>-boucle/<horodatage>)")
    a = p.parse_args()
    depart = Path(a.lancement)
    if not depart.exists():
        depart = banc.LAB / "results" / a.lancement.strip("/").removeprefix("results/")
    depart = depart.resolve()
    run_depart = depart.relative_to((banc.LAB / "results").resolve()).as_posix()
    (legora if a.source == "legora" else lambda a, d: claude_code(a, d, run_depart))(a, depart)


if __name__ == "__main__":
    main()
