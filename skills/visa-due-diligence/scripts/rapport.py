#!/usr/bin/env python3
"""Premier jet complet du rapport de red flags, tiré du registre et des constats.

  python rapport.py [--titre "Rapport de red flags — <société cible>"] [--sortie dd/rapport.md]

Synthèse par gravité, détail par rubrique (pièce, localisation, extrait, pièces liées, analyse,
recommandation), croisements effectués, pièces non lues ou écartées et pourquoi. C'est un
brouillon : rédige la synthèse (chaque <!-- À RÉDIGER -->), copie le fichier sous le nom exact
demandé dans $OUTPUT_DIR, puis lance controle.py rapport.
"""
import argparse
from collections import Counter, defaultdict
from pathlib import Path

import commun as c

RANG = {g: i for i, g in enumerate(c.GRAVITES)}


def ligne(texte, limite: int = 600) -> str:
    texte = " ".join(str(texte or "").split())
    return texte if len(texte) <= limite else texte[: limite - 1] + "…"


def cellule(texte, limite: int = 180) -> str:
    return ligne(texte, limite).replace("|", "/")


def pluriel(mots: str, n: int) -> str:
    return mots if n < 2 or mots == "sans statut" else " ".join(m if m in ("ou", "sans") else m + "s" for m in mots.split())


def source(pieces: list[dict], nom, localisation) -> str:
    piece = c.resoudre(pieces, nom)
    nom = f"{piece['id']} `{piece['piece']}`" if piece else str(nom or "aucune pièce")
    return f"{nom}, {localisation}" if str(localisation or "").strip() else nom


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--titre", default="Rapport de red flags")
    parser.add_argument("--sortie", type=Path, default=c.DD / "rapport.md")
    args = parser.parse_args()
    pieces = c.lire_registre()
    constats, erreurs = c.lire_jsonl(c.CONSTATS)
    if erreurs:
        raise SystemExit("\n".join(erreurs) + "\nCorrige constats.jsonl (controle.py) avant le rapport.")
    nature = lambda k: c.choix(k.get("nature") or "anomalie", c.NATURES)  # noqa: E731
    gravite = lambda k: c.choix(k.get("gravite"), c.GRAVITES) or "faible"  # noqa: E731
    flags = sorted((k for k in constats if nature(k) != "conforme"), key=lambda k: (RANG[gravite(k)], str(k.get("id"))))
    compte = Counter(gravite(k) for k in flags)
    absences = sum(1 for k in flags if nature(k) == "absence")
    statuts = Counter(p.get("statut") or "sans statut" for p in pieces)

    out = [f"# {args.titre}", "", "## Synthèse", "",
           "<!-- À RÉDIGER : la conclusion pour l'acquéreur (signer, signer sous conditions, ne pas signer en l'état), "
           "puis les 3 à 5 red flags qui pèsent le plus sur le prix et la structure, avec leur traitement dans le contrat. -->", "",
           f"**{len(flags)} red flags** : " + ", ".join(f"{compte[g]} {pluriel(g, compte[g])}" for g in c.GRAVITES if compte[g])
           + f", dont {absences} {pluriel('pièce ou preuve manquante', absences)}. "
           + f"Revue de {len(pieces)} pièces : " + ", ".join(f"{n} {pluriel(s, n)}" for s, n in statuts.most_common()) + ".", "",
           "### Red flags par gravité", "",
           "| # | Gravité | Red flag | Pièce et localisation | Recommandation pour le contrat de cession |",
           "|---|---|---|---|---|"]
    for k in flags:
        out.append(f"| {cellule(k.get('id'), 12)} | {gravite(k).capitalize()} | {cellule(k.get('theme'), 90)} "
                   f"| {cellule(source(pieces, k.get('piece'), k.get('localisation')), 120)} "
                   f"| {cellule(k.get('outil'), 30)} : {cellule(k.get('recommandation'), 200)} |")
    out += ["", "## Détail par rubrique", ""]
    par_rubrique = defaultdict(list)
    for k in flags:
        piece = c.resoudre(pieces, k.get("piece"))
        par_rubrique[piece["rubrique"] if piece else str(k.get("rubrique") or "Pièces manquantes")].append(k)
    ordre = list(dict.fromkeys(p["rubrique"] for p in pieces)) + sorted(set(par_rubrique) - {p["rubrique"] for p in pieces})
    for rubrique in ordre:
        if not par_rubrique.get(rubrique):
            continue
        out += [f"### {rubrique}", ""]
        for k in par_rubrique[rubrique]:
            out += [f"#### {k.get('id')} — {cellule(k.get('theme'), 140)} ({gravite(k)})", ""]
            if nature(k) == "absence":
                out.append("- **Pièce ou preuve manquante.**")
            if k.get("extrait") or c.cle(k.get("piece")) not in ("", "aucune", "absente"):
                out.append(f"- **Pièce** : {source(pieces, k.get('piece'), k.get('localisation'))}")
            if k.get("extrait"):
                out.append(f"- **Extrait** : « {ligne(k['extrait'])} »")
            liees = k.get("liees") or []
            for liee in liees if isinstance(liees, list) else [liees]:
                if isinstance(liee, dict):
                    extrait = f" : « {ligne(liee.get('extrait'), 400)} »" if liee.get("extrait") else ""
                    out.append(f"- **Pièce liée** : {source(pieces, liee.get('piece'), liee.get('localisation'))}{extrait}")
                else:
                    out.append(f"- **Pièce liée** : {source(pieces, liee, '')}")
            out.append(f"- **Constat** : {ligne(k.get('constat'), 1500)}")
            if k.get("calcul"):
                out.append(f"- **Calcul** : {ligne(k['calcul'])}")
            out += [f"- **Recommandation ({k.get('outil')})** : {ligne(k.get('recommandation'), 1000)}", ""]

    out += ["## Croisements effectués", ""]
    for code, sujet in c.CROISEMENTS.items():
        lies = [k for k in constats if code in [str(x).strip().upper()[:2] for x in
                                                ([k["croisement"]] if isinstance(k.get("croisement"), str) else k.get("croisement") or [])]]
        rouges = [str(k.get("id")) for k in lies if nature(k) != "conforme"]
        verts = [f"{cellule(k.get('theme'), 80)} ({cellule(k.get('constat'), 220)})" for k in lies if nature(k) == "conforme"]
        out.append(f"- **{code} — {sujet}** : " + ("red flags " + ", ".join(rouges) if rouges else "aucun red flag")
                   + ("" if not verts else " ; vérifié sans anomalie : " + " ; ".join(verts)) + ".")
    out += ["", "## Pièces non lues ou écartées, et pourquoi", ""]
    autres = [p for p in pieces if p.get("statut") != "lue"]
    if autres:
        out += ["| Pièce | Rubrique | Statut | Raison |", "|---|---|---|---|"]
        out += [f"| {p['id']} `{cellule(p['nom'], 90)}` | {cellule(p['rubrique'], 60)} | {p.get('statut') or 'non lue'} "
                f"| {cellule(p.get('raison') or 'non lue faute de temps', 200)} |" for p in autres]
    else:
        out.append(f"Toutes les {len(pieces)} pièces ont été lues.")
    out += ["", "## Méthode", "",
            f"Inventaire des {len(pieces)} pièces (rubrique, format, taille, empreinte SHA-256), lecture intégrale rubrique "
            "par rubrique avec une fiche par pièce, extraits vérifiés mot pour mot par script dans la pièce citée, "
            f"{len(c.CROISEMENTS)} croisements obligatoires entre rubriques, totaux des tableurs recalculés.", ""]
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    args.sortie.write_text("\n".join(out), encoding="utf-8")
    print(f"Brouillon écrit dans {args.sortie} : {len(flags)} red flags, {len(autres)} pièces non lues ou écartées.")
    print("Rédige la synthèse (<!-- À RÉDIGER -->), copie-le sous le nom demandé dans $OUTPUT_DIR, "
          "puis : python controle.py rapport $OUTPUT_DIR/<livrable>")


if __name__ == "__main__":
    main()
