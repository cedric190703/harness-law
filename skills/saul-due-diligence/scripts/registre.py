#!/usr/bin/env python3
"""Saisir le statut et la fiche de lecture des pièces, et suivre l'avancement.

  python registre.py <<'EOF'
  P012 | lue | Contrat de prêt senior du 12/03/2024, signé ; 5 M€ ; levier maximal 3,0x ; exigibilité anticipée si changement de contrôle
  P014 | écartée | doublon exact de P013
  P020 | illisible | scan sans texte, original vérifié
  EOF
  python registre.py etat          # avancement par rubrique, pièces sans statut

Une ligne par pièce : identifiant (ou nom de fichier) | statut | fiche (si lue) ou raison.
Statuts : lue (fiche obligatoire : nature, parties, date, signée ou non, montants, clauses
sensibles, renvois à d'autres pièces), écartée (raison obligatoire), illisible (raison obligatoire).
"""
import sys
from collections import defaultdict

import commun as c

ALIAS = {"lue": "lue", "lu": "lue", "read": "lue", "ecartee": "écartée", "ecarte": "écartée", "ecartees": "écartée",
         "illisible": "illisible", "illisibles": "illisible"}


def saisir(texte: str) -> int:
    erreurs, faites = [], 0
    with c.verrou():
        pieces = c.lire_registre()
        for n, ligne in enumerate(texte.splitlines(), 1):
            if not ligne.strip() or ligne.lstrip().startswith("#"):
                continue
            parties = [x.strip() for x in ligne.split("|", 2)]
            if len(parties) < 3:
                erreurs.append(f"ligne {n} : il faut « pièce | statut | fiche ou raison » — {ligne[:80]}")
                continue
            ident, statut, note = parties
            piece = c.resoudre(pieces, ident)
            statut_brut = statut.split("(")[0]
            statut = ALIAS.get(c.cle(statut_brut).strip())
            if piece is None:
                erreurs.append(f"ligne {n} : pièce inconnue « {ident} »")
            elif statut is None:
                erreurs.append(f"ligne {n} : statut « {statut_brut.strip()} » — choisir lue, écartée ou illisible")
            elif statut == "lue" and len(note.split()) < 6:
                erreurs.append(f"ligne {n} : {piece['id']} lue — la fiche doit dire ce que contient la pièce (6 mots au moins)")
            elif statut != "lue" and len(note.split()) < 2:
                erreurs.append(f"ligne {n} : {piece['id']} {statut} — donne la raison")
            else:
                piece["statut"] = statut
                piece["fiche" if statut == "lue" else "raison"] = note
                faites += 1
        c.ecrire_registre(pieces)
    print(f"{faites} pièce(s) mises à jour.")
    for erreur in erreurs:
        print(f"  ERREUR {erreur}")
    reste = [p for p in pieces if not p["statut"]]
    print(f"Reste {len(reste)} pièce(s) sans statut" + (f" : {', '.join(p['id'] for p in reste[:30])}"
                                                        + (" …" if len(reste) > 30 else "") if reste else "."))
    return 1 if erreurs else 0


def etat() -> int:
    pieces = c.lire_registre()
    rubriques = defaultdict(list)
    for p in pieces:
        rubriques[p["rubrique"]].append(p)
    print(f"{'rubrique':55} {'pièces':>6} {'lues':>5} {'écart.':>6} {'illis.':>6} {'à faire':>7}")
    for rubrique, groupe in rubriques.items():
        compte = defaultdict(int)
        for p in groupe:
            compte[p["statut"] or "à faire"] += 1
        print(f"{rubrique[:55]:55} {len(groupe):>6} {compte['lue']:>5} {compte['écartée']:>6} "
              f"{compte['illisible']:>6} {compte['à faire']:>7}")
    reste = [p for p in pieces if not p["statut"]]
    for p in reste[:40]:
        print(f"  à faire : {p['id']} {p['piece']}" + (" (affichée, fiche manquante)" if p.get("affichee") else ""))
    print(f"\n{len(pieces) - len(reste)}/{len(pieces)} pièces ont un statut.")
    return 0 if not reste else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["etat"]:
        sys.exit(etat())
    if sys.stdin.isatty():
        raise SystemExit(__doc__)
    sys.exit(saisir(sys.stdin.read()))
