#!/usr/bin/env python3
"""Noter un rapport de red flags fait sur la data room Orionis, avec la grille tirée du corrigé scellé.

  harvey-labs/.venv/bin/python bench/noter_maison.py harvey-labs/results/maison/orionis/<config>/<horodatage>
  harvey-labs/.venv/bin/python bench/noter_maison.py <lancement> --judges claude-code-opus-5-5@max
  harvey-labs/.venv/bin/python bench/noter_maison.py <lancement> --sans-juges     # preuves et couverture seules

Trois mesures sur <lancement>/output/rapport-red-flags.md, écrites dans <lancement>/scores_maison.json :
- rappel : pour chaque anomalie de la grille, chaque juge dit si le rapport l'identifie (trouvé / partiel / raté)
  et s'il cite la bonne pièce. Un appel par anomalie et par juge, avec le rapport entier. Les juges passent par
  les abonnements Claude Code et Codex, isolés comme ceux du benchmark (claude_code_verdict, codex_verdict) ;
- preuves : la part des extraits entre guillemets (« », "", “”) retrouvés mot pour mot dans le texte d'une pièce,
  après normalisation des espaces, de la casse et de la typographie (apostrophes, tirets, puces, espaces insécables) ;
  une cellule Excel compte sous sa valeur brute ou affichée (40 % pour 0.4). Un extrait coupé par […] doit avoir
  tous ses morceaux dans la même pièce. Moins de 3 mots ou un nom de fichier : pas un extrait ;
- couverture : le nombre de pièces distinctes citées par leur nom de fichier (avec ou sans numéro, extension,
  accents ou tirets bas), sur toutes les pièces de la data room.

La grille reste hors du dépôt (~/lab-claude-code/orionis/notation/grille.json). scores_maison.json ne désigne
les anomalies que par leur id et leur rubrique ; le raisonnement des juges, qui paraphrase la grille, va dans
~/lab-claude-code/orionis/notation/verdicts/ (lisible par Youssef seul).
"""
import argparse
import json
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "bench"))
sys.path.insert(0, str(RACINE / "harvey-labs"))  # lab_core, pour le parseur JSON des juges
from lab import claude_code_verdict, codex_verdict  # noqa: E402

ORIONIS = Path.home() / "lab-claude-code" / "orionis"
NOTATION = ORIONIS / "notation"
JUGES = ["claude-code-opus-5-5@max", "codex-gpt-5.5@high"]
VERDICTS = ("trouvé", "partiel", "raté")
POIDS = {"trouvé": 1.0, "partiel": 0.5, "raté": 0.0}
MOTS_MIN = 3
SCHEMA = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string"},
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "piece_citee_correcte": {"type": "boolean"},
    },
    "required": ["reasoning", "verdict", "piece_citee_correcte"],
    "additionalProperties": False,
}

CONSIGNE = """Tu notes un rapport de due diligence (red flags) rédigé sur la data room fictive d'une société française.
L'auteur de la data room y a caché des anomalies volontaires. On te donne l'une d'elles, puis le rapport entier.

Dis si le rapport identifie cette anomalie :
- « trouvé » : le rapport relève le fait essentiel de l'anomalie, même en d'autres termes, et le présente comme un
  problème, un risque ou un point à traiter ;
- « partiel » : le rapport touche le sujet mais manque l'essentiel (le chiffre, la date ou l'écart qui fait l'anomalie
  est absent ou faux), ou il le mentionne sans le présenter comme un problème ;
- « raté » : le rapport n'en parle pas, en parle seulement en termes génériques qui vaudraient pour n'importe quelle
  société, ou le présente comme conforme.

Dis aussi si le rapport, à propos de cette anomalie, cite au moins une des pièces attendues (par son nom de fichier
ou par un intitulé qui la désigne sans ambiguïté). Si le verdict est « raté », c'est false.

Ne juge que ce que dit le rapport : ni sa forme, ni la gravité qu'il attribue.

## Anomalie {id} ({rubrique})

Constat attendu : {constat}

Pièces attendues :
{pieces}

## Rapport

<rapport>
{rapport}
</rapport>

Réponds uniquement en JSON : {{"reasoning": "<2 à 4 phrases en français>", "verdict": "trouvé" | "partiel" | "raté", \
"piece_citee_correcte": true | false}}
"""


def sans_accents(texte: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texte) if not unicodedata.combining(c))


def normaliser(texte: str) -> str:
    texte = unicodedata.normalize("NFKC", texte).lower()
    texte = re.sub(r"[’‘ʼ`´]", "'", texte)
    texte = re.sub(r"[‐‑‒–—―]", "-", texte)
    texte = texte.replace("•", " ")  # un agent qui cite deux puces à la suite enlève les puces
    return re.sub(r"\s+", " ", texte).strip()


def pieces(dataroom: Path) -> list[Path]:
    return sorted(p for p in dataroom.rglob("*") if p.is_file() and not p.name.startswith((".", "~$")))


def nombre(v: float) -> str:
    texte = repr(round(v, 9))
    return texte[:-2] if texte.endswith(".0") else texte


def textes_xlsx(chemin: Path) -> list[str]:
    """Deux lectures cellule par cellule : la valeur brute (openpyxl, pandas) et la valeur affichée
    (pourcentages, flottants arrondis), car les agents citent l'une ou l'autre."""
    import openpyxl

    classeur = openpyxl.load_workbook(chemin, data_only=True, read_only=True)
    brut, affiche = [], []
    for feuille in classeur.worksheets:
        brut.append(feuille.title)
        affiche.append(feuille.title)
        for rangee in feuille.iter_rows():
            cellules, vues = [], []
            for cellule in rangee:
                v = getattr(cellule, "value", None)
                if v is None:
                    continue
                if isinstance(v, datetime) and (v.hour, v.minute, v.second) == (0, 0, 0):
                    v = v.date()
                cellules.append(str(v))
                if isinstance(v, float) and "%" in (getattr(cellule, "number_format", "") or ""):
                    vues.append(f"{nombre(v * 100)} %")
                else:
                    vues.append(nombre(v) if isinstance(v, float) else str(v))
            if cellules:
                brut.append(" | ".join(cellules))
                affiche.append(" | ".join(vues))
    classeur.close()
    return ["\n".join(brut), "\n".join(affiche)]


def textes_pieces(dataroom: Path, refaire: bool = False) -> dict[str, list[str]]:
    """Le texte de chaque pièce (pdftotext dans l'ordre de lecture et en mise en page, xlsx cellule par cellule),
    mis en cache dans notation/textes.json."""
    cache = NOTATION / "textes.json"
    if cache.exists() and not refaire:
        textes = json.loads(cache.read_text())
        if len(textes) == len(pieces(dataroom)):
            return textes
    textes = {}
    for p in pieces(dataroom):
        cle = unicodedata.normalize("NFC", str(p.relative_to(dataroom)))
        if p.suffix.lower() == ".pdf":
            textes[cle] = [subprocess.run(["pdftotext", "-enc", "UTF-8", *mode, str(p), "-"], capture_output=True,
                                          text=True, check=True).stdout for mode in ([], ["-layout"])]
        elif p.suffix.lower() == ".xlsx":
            textes[cle] = textes_xlsx(p)
        else:
            textes[cle] = [p.read_text(errors="ignore")]
    NOTATION.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(textes, ensure_ascii=False))
    return textes


def extraits(rapport: str) -> list[str]:
    trouves = re.findall(r"«([^«»]{1,3000})»", rapport) + re.findall(r"“([^“”]{1,3000})”", rapport)
    reste = re.sub(r"«[^«»]{1,3000}»|“[^“”]{1,3000}”", " ", rapport)
    trouves += re.findall(r'"([^"\n]{1,3000})"', reste)
    return [e.strip() for e in trouves]


def verifier_preuves(rapport: str, textes: dict[str, list[str]]) -> dict:
    corpus = {cle: [normaliser(t) for t in versions] for cle, versions in textes.items()}
    retrouves, introuvables, courts, references = [], [], 0, 0
    for extrait in extraits(rapport):
        if re.search(r"\.(pdf|xlsx|docx|md)\b", extrait, re.I):  # un nom de pièce entre guillemets, pas un extrait
            references += 1
            continue
        morceaux = [normaliser(m).strip(" .,;:!?") for m in re.split(r"\[\s*(?:…|\.\.\.)\s*\]|\(\s*(?:…|\.\.\.)\s*\)|…|\.\.\.", extrait)]
        morceaux = [m for m in morceaux if re.search(r"\w", m)]
        if sum(len(re.findall(r"\w+", m)) for m in morceaux) < MOTS_MIN:
            courts += 1
            continue
        source = next((cle for cle, versions in corpus.items()
                       if any(all(m in v for m in morceaux) for v in versions)), None)
        (retrouves if source else introuvables).append({"extrait": extrait, **({"piece": source} if source else {})})
    total = len(retrouves) + len(introuvables)
    return {"extraits": total, "verifies": len(retrouves), "part": round(len(retrouves) / total, 3) if total else None,
            "trop_courts_ignores": courts, "noms_de_pieces_ignores": references, "introuvables": [e["extrait"] for e in introuvables]}


def cle_piece(nom: str) -> str:
    return re.sub(r"[\s_\-]+", " ", sans_accents(nom).lower()).strip()


def pieces_citees(rapport: str, noms: list[str]) -> list[str]:
    """Les pièces citées par leur nom de fichier, sans numéro ni extension s'il le faut. Quand un nom est contenu
    dans un nom plus long cité au même endroit, seule la pièce au nom le plus long compte."""
    texte = cle_piece(unicodedata.normalize("NFC", rapport))
    portees = {}
    for nom in noms:
        cle = cle_piece(re.sub(r"^\d+_", "", Path(nom).stem))
        portees[nom] = [m.span() for m in re.finditer(rf"(?<![a-z0-9]){re.escape(cle)}(?![a-z0-9])", texte)]
    citees = []
    for nom, spans in portees.items():
        autres = [s for n, ss in portees.items() if n != nom for s in ss]
        if any(not any(a[0] <= d and f <= a[1] and a != (d, f) for a in autres) for d, f in spans):
            citees.append(nom)
    return sorted(citees)


def verdict_normalise(reponse: dict) -> dict:
    brut = sans_accents(str(reponse.get("verdict", "")).strip().lower())
    verdict = next((v for v in VERDICTS if sans_accents(v) == brut), None)
    if verdict is None:
        raise ValueError(f"verdict inconnu : {reponse.get('verdict')!r}")
    return {"verdict": verdict, "piece_citee_correcte": bool(reponse.get("piece_citee_correcte")) and verdict != "raté",
            "reasoning": str(reponse.get("reasoning", ""))}


def juger(juge: str, anomalie: dict, rapport: str) -> dict:
    prompt = CONSIGNE.format(id=anomalie["id"], rubrique=anomalie["rubrique"], constat=anomalie["constat_attendu"],
                             pieces="\n".join(f"- {p}" for p in anomalie["pieces"]), rapport=rapport)
    appel = codex_verdict if juge.startswith("codex") else claude_code_verdict
    try:
        return verdict_normalise(appel(juge, prompt, SCHEMA))
    except Exception as exc:
        print(f"[noter] {juge} sur {anomalie['id']} : {exc}", file=sys.stderr, flush=True)
        return {"verdict": "erreur", "piece_citee_correcte": None, "reasoning": f"{type(exc).__name__}: {exc}"[:500]}


def rappel(verdicts: list[dict]) -> dict:
    notes = [v for v in verdicts if v["verdict"] in VERDICTS]
    compte = {v: sum(n["verdict"] == v for n in notes) for v in VERDICTS}
    n = len(notes)
    return {**compte, "erreurs": len(verdicts) - n, "notees": n,
            "rappel_strict": round(compte["trouvé"] / n, 3) if n else None,
            "rappel_pondere": round(sum(POIDS[v["verdict"]] for v in notes) / n, 3) if n else None,
            "piece_correcte": sum(bool(v["piece_citee_correcte"]) for v in notes)}


def accord(grille: list[dict], resultats: dict, juges: list[str]) -> dict | None:
    if len(juges) < 2:
        return None
    a, b = juges[:2]
    paires = [(resultats[(x["id"], a)]["verdict"], resultats[(x["id"], b)]["verdict"]) for x in grille]
    paires = [(u, v) for u, v in paires if u in VERDICTS and v in VERDICTS]
    if not paires:
        return {"comparees": 0}
    identiques = sum(u == v for u, v in paires)
    vu = sum((u == "raté") == (v == "raté") for u, v in paires)
    return {"juges": [a, b], "comparees": len(paires), "identiques": identiques,
            "taux_identique": round(identiques / len(paires), 3),
            "taux_vu_ou_rate": round(vu / len(paires), 3),
            "desaccords": [x["id"] for x in grille
                           if resultats[(x["id"], a)]["verdict"] != resultats[(x["id"], b)]["verdict"]]}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("lancement", type=Path, help="dossier du lancement (contient output/rapport-red-flags.md)")
    p.add_argument("--judges", nargs="+", default=JUGES)
    p.add_argument("--sans-juges", action="store_true", help="preuves et couverture seulement")
    p.add_argument("--grille", type=Path, default=NOTATION / "grille.json")
    p.add_argument("--dataroom", type=Path, default=ORIONIS / "dataroom")
    p.add_argument("--rapport", default="output/rapport-red-flags.md", help="chemin du livrable dans le lancement")
    p.add_argument("--refaire-textes", action="store_true", help="réextraire le texte des pièces")
    a = p.parse_args()

    lancement = a.lancement.resolve()
    rapport = (lancement / a.rapport).read_text()
    grille = json.loads(a.grille.read_text())["anomalies"]
    juges = [] if a.sans_juges else a.judges
    noms = [unicodedata.normalize("NFC", str(x.relative_to(a.dataroom))) for x in pieces(a.dataroom)]
    textes = textes_pieces(a.dataroom, a.refaire_textes)

    resultats = {}
    if juges:
        print(f"[noter] {len(grille)} anomalies x {len(juges)} juges…", file=sys.stderr, flush=True)
        with ThreadPoolExecutor(max_workers=4 * len(juges)) as pool:
            futurs = {(x["id"], j): pool.submit(juger, j, x, rapport) for x in grille for j in juges}
            resultats = {cle: f.result() for cle, f in futurs.items()}

    preuves = verifier_preuves(rapport, textes)
    citees = pieces_citees(rapport, [Path(n).name for n in noms])
    rubriques = sorted({x["rubrique"] for x in grille})
    scores = {
        "lancement": f"{lancement.parent.name}/{lancement.name}",
        "note_le": datetime.now().isoformat(timespec="seconds"),
        "grille": {"anomalies": len(grille), "par_rubrique": {r: sum(x["rubrique"] == r for x in grille) for r in rubriques}},
        "juges": juges,
        "rappel": {j: {**rappel([resultats[(x["id"], j)] for x in grille]),
                       "par_rubrique": {r: rappel([resultats[(x["id"], j)] for x in grille if x["rubrique"] == r])
                                        for r in rubriques}} for j in juges},
        "accord_juges": accord(grille, resultats, juges),
        "preuves": preuves,
        "couverture": {"pieces_citees": len(citees), "total": len(noms), "part": round(len(citees) / len(noms), 3),
                       "liste": citees},
        "detail": [{"id": x["id"], "rubrique": x["rubrique"],
                    **{j: {k: resultats[(x["id"], j)][k] for k in ("verdict", "piece_citee_correcte")} for j in juges}}
                   for x in grille],
    }
    (lancement / "scores_maison.json").write_text(json.dumps(scores, ensure_ascii=False, indent=2))

    if juges:
        dossier = NOTATION / "verdicts"
        dossier.mkdir(parents=True, exist_ok=True)
        dossier.chmod(0o700)
        prive = dossier / f"{lancement.parent.name}__{lancement.name}.json"
        prive.write_text(json.dumps({"lancement": scores["lancement"], "grille": str(a.grille),
                                     "verdicts": {f"{i}|{j}": v for (i, j), v in resultats.items()}},
                                    ensure_ascii=False, indent=2))
        prive.chmod(0o600)

    for j in juges:
        r = scores["rappel"][j]
        print(f"{j} : {r['trouvé']} trouvé, {r['partiel']} partiel, {r['raté']} raté"
              + (f", {r['erreurs']} erreur(s)" if r["erreurs"] else "")
              + f" (rappel strict {r['rappel_strict']}, pondéré {r['rappel_pondere']}, bonne pièce {r['piece_correcte']})")
    if scores["accord_juges"] and scores["accord_juges"].get("comparees"):
        print(f"accord des juges : {scores['accord_juges']['identiques']}/{scores['accord_juges']['comparees']}")
    print(f"preuves : {preuves['verifies']}/{preuves['extraits']} extraits retrouvés mot pour mot "
          f"({preuves['trop_courts_ignores']} trop courts ignorés)")
    print(f"couverture : {len(citees)}/{len(noms)} pièces citées")
    print(f"→ {lancement / 'scores_maison.json'}")


if __name__ == "__main__":
    main()
