#!/usr/bin/env python3
"""Afficher le texte des pièces par tranches lisibles, rubrique par rubrique.

  python lire.py 03              # les pièces de la rubrique dont le nom commence par « 03 »
  python lire.py P012 P013       # ces pièces-là
  python lire.py --reste         # toutes les pièces encore sans statut
  python lire.py --suite         # la tranche suivante de l'affichage en cours

Au plus ~18 000 caractères par appel. Chaque pièce affichée jusqu'au bout est notée « affichee »
dans le registre. Les pièces écartées ou illisibles ne sont réaffichées que si on les nomme.
"""
import json
import sys

import commun as c

LIMITE = 18000
FILE = c.DD / "lecture.json"


def selection(arguments: list[str], pieces: list[dict]) -> list[dict]:
    if arguments == ["--reste"]:
        return [p for p in pieces if not p["statut"]]
    choisies = []
    for argument in arguments:
        piece = c.resoudre(pieces, argument)
        if piece:
            choisies.append(piece)
            continue
        rubrique = [p for p in pieces if c.cle(p["rubrique"]).startswith(c.cle(argument))
                    and p["statut"] not in ("écartée", "illisible")]
        if not rubrique:
            raise SystemExit(f"« {argument} » n'est ni une pièce ni le début d'un nom de rubrique")
        choisies += rubrique
    return choisies


def main() -> None:
    arguments = sys.argv[1:]
    if not arguments:
        raise SystemExit(__doc__)
    pieces = c.lire_registre()
    par_id = {p["id"]: p for p in pieces}
    if arguments == ["--suite"]:
        file = json.loads(FILE.read_text()) if FILE.exists() else []
        if not file:
            raise SystemExit("rien en attente : la sélection précédente est entièrement affichée")
    else:
        file = [[p["id"], 0] for p in selection(arguments, pieces)]
    sortie, affichees, taille = [], [], 0
    while file:
        ident, depart = file[0]
        piece = par_id[ident]
        lignes = (c.ESPACE / piece["texte"]).read_text(encoding="utf-8").splitlines()
        if depart == 0:
            volume = f"{piece['pages']} p." if "pages" in piece else f"{piece['feuilles']} feuille(s)" if "feuilles" in piece else ""
            sortie.append(f"\n##### {ident} · {piece['piece']} · {piece['format'][1:]} {volume} · {piece['mots']} mots"
                          + (f" · statut : {piece['statut']}" if piece["statut"] else ""))
            sortie += [f"      signal : {s}" for s in piece["signaux"]]
        else:
            sortie.append(f"\n##### {ident} (suite, à partir de la ligne {depart + 1})")
        fin = depart
        while fin < len(lignes) and (taille + len(lignes[fin]) < LIMITE or fin == depart):
            taille += len(lignes[fin]) + 1
            fin += 1
        sortie += lignes[depart:fin]
        if fin < len(lignes):
            file[0] = [ident, fin]
            break
        affichees.append(ident)
        file.pop(0)
        if taille >= LIMITE:
            break
    FILE.write_text(json.dumps(file))
    with c.verrou():
        pieces = c.lire_registre()
        for p in pieces:
            if p["id"] in affichees:
                p["affichee"] = True
        c.ecrire_registre(pieces)
    print("\n".join(sortie))
    if file:
        print(f"\n— Suite : python {c.SCRIPTS}/lire.py --suite ({len(file)} pièce(s) en attente)")
    else:
        print(f"\n— Fin de la sélection. Saisis maintenant une fiche par pièce (python {c.SCRIPTS}/registre.py <<'EOF' …), "
              "puis les constats de la rubrique dans dd/constats.jsonl.")


if __name__ == "__main__":
    main()
