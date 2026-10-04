"""Outils partagés : emplacements de travail, registre, normalisation des textes, recherche d'extraits."""
import bisect
import fcntl
import json
import os
import re
import unicodedata
from contextlib import contextmanager
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ESPACE = Path(os.environ.get("WORKSPACE_DIR", ".")).resolve()
DOCUMENTS = Path(os.environ.get("DOCUMENTS_DIR") or ESPACE / "documents")
DD = ESPACE / "dd"
TEXTE = DD / "texte"
REGISTRE = DD / "registre.jsonl"
CONSTATS = DD / "constats.jsonl"

STATUTS = ("lue", "écartée", "illisible")
NATURES = ("anomalie", "absence", "conforme")
GRAVITES = ("critique", "élevée", "moyenne", "faible")
OUTILS = ("garantie spécifique", "condition suspensive", "ajustement de prix", "indemnité", "déclaration",
          "séquestre", "autre")
CROISEMENTS = {
    "C1": "déclarations et attestations du vendeur contre les pièces (litiges, sûretés, financements, sinistres, conformité)",
    "C2": "contrats importants contre changement de contrôle, cession, exclusivité, résiliation, et preuve des consentements",
    "C3": "financements : covenants recalculés, waivers, sûretés inscrites contre déclarées, exigibilité anticipée",
    "C4": "risques (litiges, social, fiscal, réglementaire, environnement) contre provisions, hors-bilan et assurances",
    "C5": "propriété des actifs : titres et cessions de droits (PI, logiciels, marques), immobilier, matériels",
    "C6": "capital et gouvernance : table de capitalisation contre statuts, procès-verbaux, titres donnant accès au capital",
    "C7": "chiffres refaits par script : totaux, ratios, écarts d'un même chiffre entre deux pièces (tableaux.py)",
}

MARQUE = re.compile(r"^=== (Page|Feuille) (.+?) ===$")
LIGNE_TABLEUR = re.compile(r"^L(\d+): ")
_SIGNES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'", "“": '"', "”": '"', "«": '"', "»": '"',
                         "–": "-", "—": "-", "−": "-", "­": ""})


def cle(texte) -> str:
    """Minuscules sans accents, pour comparer des libellés (« Élevée » = « elevee »)."""
    texte = unicodedata.normalize("NFD", str(texte or "").strip().lower())
    return "".join(ch for ch in texte if not unicodedata.combining(ch))


def choix(valeur, options) -> str | None:
    return next((o for o in options if cle(o) == cle(valeur)), None)


def normaliser(texte: str) -> str:
    """Forme comparable d'un texte : espaces, guillemets, apostrophes et casse neutralisés."""
    texte = unicodedata.normalize("NFKC", str(texte)).translate(_SIGNES).lower()
    texte = re.sub(r"[\"'|*`]", " ", texte)
    return re.sub(r"\s+", " ", texte).strip()


def lire_jsonl(chemin: Path) -> tuple[list[dict], list[str]]:
    lignes, erreurs = [], []
    if not chemin.exists():
        return lignes, erreurs
    for n, brut in enumerate(chemin.read_text(encoding="utf-8").splitlines(), 1):
        if not brut.strip():
            continue
        try:
            ligne = json.loads(brut)
        except json.JSONDecodeError as exc:
            erreurs.append(f"{chemin.name} ligne {n} : JSON invalide ({exc.msg}) — corrige cette ligne")
            continue
        if isinstance(ligne, dict):
            ligne["_ligne"] = n
            lignes.append(ligne)
    return lignes, erreurs


def lire_registre() -> list[dict]:
    if not REGISTRE.exists():
        raise SystemExit(f"{REGISTRE} n'existe pas — lance d'abord inventaire.py")
    return lire_jsonl(REGISTRE)[0]


def ecrire_registre(pieces: list[dict]) -> None:
    provisoire = REGISTRE.with_suffix(".tmp")
    provisoire.write_text("".join(json.dumps({k: v for k, v in p.items() if not k.startswith("_")},
                                             ensure_ascii=False) + "\n" for p in pieces), encoding="utf-8")
    provisoire.replace(REGISTRE)


@contextmanager
def verrou():
    """Un seul écrivain à la fois sur le registre."""
    DD.mkdir(parents=True, exist_ok=True)
    with (DD / ".verrou").open("w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def resoudre(pieces: list[dict], nom) -> dict | None:
    """Une pièce par son id (P012), son chemin, son nom de fichier ou le chemin de son texte."""
    nom = unicodedata.normalize("NFC", str(nom or "").strip())
    if not nom:
        return None
    for prefixe in ("$DOCUMENTS_DIR/", "documents/", str(DOCUMENTS) + "/", "dd/texte/", str(TEXTE) + "/"):
        nom = nom.removeprefix(prefixe)
    if nom.endswith(".txt") and Path(nom[:-4]).suffix:
        nom = nom[:-4]  # le texte extrait d'une pièce : « x.pdf.txt » désigne « x.pdf »
    for test in (lambda p: p["id"].lower() == nom.lower(), lambda p: p["piece"] == nom,
                 lambda p: p["nom"].lower() == Path(nom).name.lower(),
                 lambda p: Path(p["nom"]).stem.lower() == Path(nom).stem.lower()):
        trouves = [p for p in pieces if test(p)]
        if len(trouves) == 1:
            return trouves[0]
    return None


class Texte:
    """Le texte extrait d'une pièce, normalisé, avec la page (ou feuille et ligne) de chaque passage."""

    def __init__(self, chemin: Path):
        self.debuts, self.lieux, self.bruts, morceaux = [], [], [], []
        lieu, position = "", 0
        for brut in chemin.read_text(encoding="utf-8", errors="replace").splitlines():
            marque = MARQUE.match(brut.strip())
            if marque:
                lieu = f"page {marque.group(2)}" if marque.group(1) == "Page" else f"feuille « {marque.group(2)} »"
                continue
            norme = normaliser(brut)
            if not norme:
                continue
            ligne = LIGNE_TABLEUR.match(brut)
            self.debuts.append(position)
            self.lieux.append(f"{lieu}, ligne {ligne.group(1)}" if ligne and lieu else lieu)
            self.bruts.append(brut.strip())
            morceaux.append(norme)
            position += len(norme) + 1
        self.norme = " ".join(morceaux)

    def index(self, position: int) -> int:
        return max(bisect.bisect_right(self.debuts, position) - 1, 0)

    def chercher(self, extrait: str) -> tuple[str, str]:
        """("exact", lieu) | ("approché", passage réel à recopier) | ("absent", "").

        Un extrait coupé par « [...] » ou « ... » est cherché morceau par morceau, dans l'ordre.
        """
        morceaux = [m.strip() for m in re.split(r"\[?\s*\.\.\.\s*\]?", normaliser(extrait)) if m.strip()]
        if not morceaux:
            return "absent", ""
        depart, premier = 0, None
        for morceau in morceaux:
            position = self.norme.find(morceau, depart)
            if position < 0:
                return self.approche(morceau)
            premier = position if premier is None else premier
            depart = position + len(morceau)
        return "exact", self.lieux[self.index(premier)] if self.lieux else ""

    def approche(self, morceau: str) -> tuple[str, str]:
        mots_extrait = cle(morceau).split()  # sans accents : une faute d'accent doit quand même trouver le passage
        if len(mots_extrait) < 3:
            return "absent", ""
        triplets = {tuple(mots_extrait[i:i + 3]) for i in range(len(mots_extrait) - 2)}
        mots = cle(self.norme).split()
        meilleur, debut = 0, -1
        for i in range(len(mots) - 2):
            if tuple(mots[i:i + 3]) in triplets:
                fenetre = mots[i:i + len(mots_extrait) + 3]
                score = len(triplets & {tuple(fenetre[j:j + 3]) for j in range(len(fenetre) - 2)})
                if score > meilleur:
                    meilleur, debut = score, i
        if debut < 0 or meilleur / len(triplets) < 0.5:
            return "absent", ""
        position = len(" ".join(mots[:debut])) + (1 if debut else 0)
        fin = position + len(" ".join(mots[debut:debut + len(mots_extrait)]))
        lignes = self.bruts[self.index(position):self.index(fin) + 1]
        return "approché", " ".join(" ".join(lignes).split())[:400]


def texte_de(piece: dict) -> Texte | None:
    chemin = ESPACE / piece.get("texte", "")
    return Texte(chemin) if piece.get("texte") and chemin.is_file() else None
