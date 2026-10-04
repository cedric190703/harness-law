#!/usr/bin/env python3
"""Contrôle mécanique du registre, des constats et du rapport — à relancer jusqu'à « OK ».

  python controle.py                          # registre + constats
  python controle.py rapport <livrable.md>    # le rapport reprend-il tous les constats ?

Vérifie que chaque pièce a un statut, que chaque extrait existe mot pour mot dans sa pièce (et à
la page annoncée), que chaque constat a sa source, sa gravité et sa recommandation, que chaque
croisement obligatoire et chaque rubrique lue ont au moins une ligne, et que chaque signal
important de l'inventaire a été traité.
"""
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

import commun as c

SIGNAUX_A_TRAITER = ("projet ou version non signée", "avenant ou annexe", "acte sans aucune mention de signature",
                     "même texte que", "autre version du même document")
SANS_PIECE = {"", "aucune", "aucun", "absente", "absent", "neant", "-"}


def verifier_extrait(textes: dict, piece: dict, extrait: str, localisation: str, quoi: str, erreurs: list) -> None:
    mots = len(str(extrait).split())
    if mots < 3:
        erreurs.append(f"{quoi} : extrait trop court ou absent — recopie 5 à 40 mots de {piece['id']}")
        return
    if mots > 80:
        erreurs.append(f"{quoi} : extrait de {mots} mots — garde le passage décisif (40 mots au plus)")
    if piece["id"] not in textes:
        textes[piece["id"]] = c.texte_de(piece)
    texte = textes[piece["id"]]
    if texte is None:
        erreurs.append(f"{quoi} : pas de texte extrait pour {piece['id']} — relance inventaire.py")
        return
    resultat, detail = texte.chercher(extrait)
    if resultat == "approché":
        erreurs.append(f"{quoi} : extrait inexact dans {piece['id']} — texte réel : « {detail} »")
    elif resultat == "absent":
        erreurs.append(f"{quoi} : extrait introuvable dans {piece['id']} ({piece['nom']}) : « {str(extrait)[:90]} »")
    else:
        annoncee = re.search(r"\bp(?:age|\.)?\s*(\d+)\b", c.cle(localisation))
        trouvee = re.search(r"page (\d+)", detail)
        if annoncee and trouvee and annoncee.group(1) != trouvee.group(1):
            erreurs.append(f"{quoi} : l'extrait est en page {trouvee.group(1)} de {piece['id']}, pas en page {annoncee.group(1)}")


def controler() -> int:
    pieces = c.lire_registre()
    erreurs, avertissements = [], []
    sans_statut = [p for p in pieces if p.get("statut") not in c.STATUTS]
    if sans_statut:
        erreurs.append(f"{len(sans_statut)} pièce(s) sans statut : {', '.join(p['id'] for p in sans_statut[:40])}"
                       + (" …" if len(sans_statut) > 40 else "") + " — lis-les (lire.py) puis registre.py")
    for p in pieces:
        if p.get("statut") == "lue" and len(str(p.get("fiche", "")).split()) < 6:
            erreurs.append(f"{p['id']} lue sans fiche de lecture")
        if p.get("statut") in ("écartée", "illisible") and len(str(p.get("raison", "")).split()) < 2:
            erreurs.append(f"{p['id']} {p['statut']} sans raison")

    constats, erreurs_json = c.lire_jsonl(c.CONSTATS)
    erreurs += erreurs_json
    if not constats:
        erreurs.append(f"aucun constat dans {c.CONSTATS}")
    for ident, n in Counter(k.get("id") for k in constats).items():
        if n > 1:
            erreurs.append(f"l'identifiant {ident} est utilisé {n} fois")
    textes, cites, rubriques_couvertes, croisements = {}, set(), set(), Counter()
    for k in constats:
        quoi = str(k.get("id") or f"constats.jsonl ligne {k['_ligne']}")
        nature = c.choix(k.get("nature") or "anomalie", c.NATURES)
        if nature is None:
            erreurs.append(f"{quoi} : nature « {k.get('nature')} » — anomalie, absence ou conforme")
            continue
        if not k.get("theme"):
            erreurs.append(f"{quoi} : thème manquant")
        if nature != "conforme":
            if c.choix(k.get("gravite"), c.GRAVITES) is None:
                erreurs.append(f"{quoi} : gravité « {k.get('gravite')} » — critique, élevée, moyenne ou faible")
            if c.choix(k.get("outil"), c.OUTILS) is None:
                erreurs.append(f"{quoi} : outil « {k.get('outil')} » — {', '.join(c.OUTILS)}")
            if len(str(k.get("recommandation", "")).split()) < 6:
                erreurs.append(f"{quoi} : recommandation absente ou trop vague pour le contrat de cession")
        if len(str(k.get("constat", "")).split()) < 6:
            erreurs.append(f"{quoi} : le champ constat doit expliquer le problème (ou la vérification faite)")
        croises = k.get("croisement") or []
        for croisement in [croises] if isinstance(croises, str) else croises:
            code = str(croisement).strip().upper()[:2]
            if code in c.CROISEMENTS:
                croisements[code] += 1
            else:
                erreurs.append(f"{quoi} : croisement « {croisement} » inconnu — {', '.join(c.CROISEMENTS)}")
        if k.get("rubrique"):
            rubriques_couvertes.add(c.cle(k["rubrique"]))
        if nature == "absence" and c.cle(k.get("piece")) in SANS_PIECE:
            if not k.get("rubrique"):
                erreurs.append(f"{quoi} : absence sans pièce citante — indique au moins la rubrique concernée")
        else:
            piece = c.resoudre(pieces, k.get("piece"))
            if piece is None:
                erreurs.append(f"{quoi} : pièce « {k.get('piece')} » inconnue du registre")
            else:
                cites.add(piece["id"])
                rubriques_couvertes.add(c.cle(piece["rubrique"]))
                if piece.get("statut") != "lue":
                    erreurs.append(f"{quoi} : cite {piece['id']}, dont le statut est « {piece.get('statut') or 'vide'} » et non « lue »")
                if not str(k.get("localisation", "")).strip():
                    erreurs.append(f"{quoi} : localisation manquante (page, article, clause, feuille et ligne)")
                verifier_extrait(textes, piece, k.get("extrait", ""), str(k.get("localisation", "")), quoi, erreurs)
        liees = k.get("liees") or []
        for n, liee in enumerate(liees if isinstance(liees, list) else [liees], 1):
            nom = liee.get("piece") if isinstance(liee, dict) else liee
            piece = c.resoudre(pieces, nom)
            if piece is None:
                erreurs.append(f"{quoi} : pièce liée « {nom} » inconnue du registre")
                continue
            cites.add(piece["id"])
            rubriques_couvertes.add(c.cle(piece["rubrique"]))
            if isinstance(liee, dict) and liee.get("extrait"):
                verifier_extrait(textes, piece, liee["extrait"], str(liee.get("localisation", "")), f"{quoi} (liée {n})", erreurs)

    for code, sujet in c.CROISEMENTS.items():
        if not croisements[code]:
            erreurs.append(f"croisement {code} non fait ({sujet}) — ajoute ses constats, ou une ligne « conforme » qui dit ce qui a été vérifié")
    for rubrique in sorted({p["rubrique"] for p in pieces if p.get("statut") == "lue"}):
        if not any(c.cle(rubrique).startswith(r) for r in rubriques_couvertes):
            erreurs.append(f"rubrique sans aucun constat : {rubrique} — au moins une ligne (anomalie, absence ou conforme)")
    for p in pieces:
        importants = [s for s in p.get("signaux", []) if s.startswith(SIGNAUX_A_TRAITER)]
        if importants and p.get("statut") == "lue" and p["id"] not in cites:
            erreurs.append(f"{p['id']} signal non traité : {importants[0][:110]} — cite la pièce dans un constat "
                           "(anomalie, absence ou conforme) ou écarte-la avec sa raison")

    statuts = Counter(p.get("statut") or "sans statut" for p in pieces)
    natures = Counter(c.choix(k.get("nature") or "anomalie", c.NATURES) for k in constats)
    gravites = Counter(c.choix(k.get("gravite"), c.GRAVITES) for k in constats
                       if c.choix(k.get("nature") or "anomalie", c.NATURES) != "conforme")
    print(f"Registre : {len(pieces)} pièces — " + ", ".join(f"{s} {n}" for s, n in statuts.most_common()))
    print(f"Constats : {len(constats)}" + (" — " + ", ".join(f"{s} {n}" for s, n in natures.items() if s)
                                           + " ; " + ", ".join(f"{g} {gravites[g]}" for g in c.GRAVITES if gravites[g])
                                           if constats else ""))
    print("Croisements : " + "  ".join(f"{code} {croisements[code]}" for code in c.CROISEMENTS))
    for titre, liste in (("ERREURS", erreurs), ("AVERTISSEMENTS", avertissements)):
        if liste:
            print(f"\n{titre} ({len(liste)})")
            for ligne in liste[:70]:
                print(f"  - {ligne}")
            if len(liste) > 70:
                print(f"  … {len(liste) - 70} de plus — corrige ceux-ci et relance")
    print(f"\nCONTRÔLE OK — rédige le rapport : python {c.SCRIPTS}/rapport.py" if not erreurs
          else "\nCONTRÔLE NON OK — corrige puis relance.")
    return 0 if not erreurs else 1


def controler_rapport(livrable: Path) -> int:
    if not livrable.exists():
        print(f"{livrable} n'existe pas")
        return 1
    if livrable.suffix.lower() == ".docx":
        texte = subprocess.run(["pandoc", str(livrable), "-t", "plain", "--wrap=none"], capture_output=True, text=True).stdout
    else:
        texte = livrable.read_text(encoding="utf-8", errors="replace")
    norme = c.normaliser(texte)
    pieces = c.lire_registre()
    constats, erreurs = c.lire_jsonl(c.CONSTATS)
    for k in constats:
        if c.choix(k.get("nature") or "anomalie", c.NATURES) == "conforme":
            continue
        debut = " ".join(c.normaliser(k.get("extrait", "")).split()[:8])
        if str(k.get("id", "")).lower() not in norme and not (debut and debut in norme):
            erreurs.append(f"{k.get('id')} ({k.get('gravite')}, {str(k.get('theme'))[:60]}) absent du rapport")
    for p in pieces:
        if p.get("statut") != "lue" and p["id"].lower() not in norme and c.normaliser(p["nom"]) not in norme:
            erreurs.append(f"{p['id']} ({p.get('statut') or 'sans statut'}) n'apparaît pas dans la section des pièces non lues ou écartées")
    corpus = " \n ".join(t.norme for t in (c.texte_de(p) for p in pieces) if t)
    for citation in re.findall(r"«\s*([^»]{15,}?)\s*»|“([^”]{15,}?)”|\"([^\"\n]{15,}?)\"", texte):
        citation = next(x for x in citation if x)
        morceaux = [m.strip() for m in re.split(r"\[?\s*\.\.\.\s*\]?", c.normaliser(citation)) if len(m.split()) >= 3]
        if morceaux and len(citation.split()) >= 4 and not all(m in corpus for m in morceaux):
            erreurs.append(f"citation introuvable dans les pièces : « {citation[:100]} » — recopie-la depuis la pièce ou retire les guillemets")
    if "<!-- À RÉDIGER" in texte:
        erreurs.append("il reste des passages « À RÉDIGER » : rédige la synthèse et retire ces commentaires")
    for titre, motif in (("une synthèse", r"synthese"), ("la section des pièces non lues ou écartées", r"non lues|ecartees"),
                         ("des gravités", r"critique|elevee"), ("des recommandations", r"recommand")):
        if not re.search(motif, c.cle(texte)):
            erreurs.append(f"le rapport n'a pas {titre}")
    print(f"Rapport : {livrable.name}, {len(texte.split())} mots ; {len(constats)} constats au dossier.")
    if erreurs:
        print(f"\nÉCARTS ({len(erreurs)})")
        for ligne in erreurs[:70]:
            print(f"  - {ligne}")
        print("\nRAPPORT NON OK — corrige, relance, puis relis la consigne phrase par phrase.")
        return 1
    print("\nRAPPORT OK — relis la consigne phrase par phrase avant de terminer.")
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == ["rapport"]:
        if len(sys.argv) < 3:
            raise SystemExit("usage : python controle.py rapport <livrable>")
        sys.exit(controler_rapport(Path(sys.argv[2])))
    sys.exit(controler())
