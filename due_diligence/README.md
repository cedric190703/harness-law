# Revue de due diligence

Adaptation locale du tableau de concordance et de la revue HTML de `youssef/bench-revue`. La revue confronte un **constat rédigé** à son **passage source**, documente le choix des pièces et produit les livrables depuis un registre commun.

## Livrables

- **Revue HTML** : recherche, filtres de validation, texte corrigible, extrait et contexte, choix de la source, liste des pièces, questions vendeur et nouveaux versements.
- **Rapport Word** : synthèse tabulaire des risques, fiches par constat avec citations et localisations, questions vendeur, registre des pièces et limites. En-têtes répétés et lignes de tableau conservées ensemble.
- **Classeur Excel** : tables filtrables Risques, Pièces, Questions vendeur et Preuves ; onglet Périmètre, lignes d’en-tête figées. Identifiants communs au Word et à la revue.
- **Registre JSON** : données, empreintes, passages vérifiés et états. Il contient du texte des pièces et doit bénéficier de la même protection que la data room.

## Démonstration sur le jeu fourni

Python 3.10+ ; exécuter depuis la racine. Avec `uv` :

```bash
# L’archive existe dans main si elle n’est pas présente dans votre copie de la branche.
git show main:due_dil_data-room.zip > /tmp/due_dil_data-room.zip
python3 -m due_diligence.demo --archive /tmp/due_dil_data-room.zip --out due_diligence/demo
uv run --with-requirements due_diligence/requirements.txt python -m due_diligence.server \
  --room due_diligence/demo/pieces --case due_diligence/demo/dossier.json \
  --out due_diligence/output/demo
```

Ouvrir **http://127.0.0.1:8765**. Corriger le texte, renseigner le relecteur, valider et cliquer sur **Enregistrer et actualiser les exports**. Le dossier JSON, le Word et l’Excel sont mis à jour. Les corrections en cours masquent les anciens liens d’export pour éviter de télécharger une version périmée. Le serveur écoute uniquement sur l’interface locale ; aucun document n’est envoyé à un service externe.

Le jeu de démonstration comporte 13 pièces et **3 constats préparés**, datés du 8 janvier 2025. Les autres pièces sont explicitement non consultées. Ce n’est ni un audit complet ni un résultat de modèle benchmarké.

Alternative sans serveur :

```bash
uv run --with-requirements due_diligence/requirements.txt python -m due_diligence.review \
  --room due_diligence/demo/pieces --case due_diligence/demo/dossier.json \
  --out due_diligence/output/demo --office
```

Ouvrir `revue.html` directement. Dans ce mode, les corrections sont téléchargées en `dossier-revu.json` ; relancer avec `--case dossier-revu.json` pour actualiser les livrables. Sans `--office`, la revue HTML fonctionne sans les dépendances Office (sauf extraction PDF/DOCX).

## Nouveau dossier ou nouveau versement

`--room` est le répertoire de pièces original, parcouru récursivement sans renommage. Le dossier de travail `--case` suit le format de l’exemple généré. Pour préparer un dossier avec un agent, utiliser [le protocole](agent-protocol.md). Les constats sont fournis par l’agent ou le juriste ; aucun appel de modèle n’est caché dans l’outil.

Chaque preuve contient `path`, `sha256`, `clause`, `quote`, et soit `page` (PDF), soit `line_start` et `line_end` (TXT/CSV/DOCX extrait). La comparaison normalise uniquement les espaces, pas les mots ni la ponctuation. Une preuve invalide reste visible avec son erreur ; le CLI renvoie le code **2**, et la validation est bloquée dans la revue.

Les décisions documentaires sont explicites :

```json
{
  "documents": {
    "03 Contrats/avenant.txt": {
      "decision": "retenue",
      "reason": "Avenant rattaché au contrat après lecture des parties et de l’objet",
      "sha256": "empreinte SHA256 du fichier",
      "parent": "03 Contrats/contrat.txt"
    },
    "03 Contrats/projet.txt": {
      "decision": "exclue",
      "reason": "Projet non signé confirmé après lecture",
      "sha256": "empreinte SHA256 du fichier"
    }
  }
}
```

Un nom contenant « signed » ou « final » n’établit pas une signature. Seuls les doublons binaires sont écartés automatiquement ; un projet non signé doit faire l’objet d’une décision motivée. L’interface affiche ces décisions ; leur saisie se fait dans le dossier JSON.

Pour comparer un versement :

```bash
uv run --with-requirements due_diligence/requirements.txt python -m due_diligence.review \
  --room /chemin/data-room --case /chemin/dossier.json \
  --previous /chemin/version-precedente/review.json --out /chemin/nouvelle-version --office
```

Toute modification d’une source invalide ses preuves via l’empreinte. Tout ajout, retrait ou changement de pièce force conservativement la reprise des validations, y compris si les citations restent identiques : une nouvelle pièce peut contredire une conclusion précédente. Conserver les versions dans des répertoires distincts pour l’historique ; le serveur actualise le dossier courant. Une consultation est une déclaration de l’auteur du registre, jamais déduite du succès de l’extraction.

## Vérifications

```bash
uv run --with-requirements due_diligence/requirements.txt python -m unittest discover -s due_diligence/tests -v
```

Cas couverts : citations et localisations fausses, sources modifiées, nouveaux versements, doublons, homonymes, extraction partielle, liens symboliques, exclusions, auteur de validation, références croisées et exports. Les données sources sont échappées dans HTML ; les chaînes Excel restent du texte, même lorsqu’elles commencent par `=`.

## Limites

Pas d’OCR, de vérification de signature, de connexion à une data room distante ni d’authentification multi-utilisateur. L’extraction DOCX ne connaît pas les pages originales et n’inclut pas nécessairement les zones de texte, commentaires ou notes : contrôle de l’original nécessaire. Une page PDF avec du texte peut encore contenir des images non lues. Aucune déduction de complétude juridique n’est faite à partir du nombre de documents extraits ou cités. Les réponses vendeur sont enregistrées comme déclarations à recouper.

Le benchmark Harvey existant est conservé. Cette adaptation ne fournit pas de nouveau score Harvey ; mesurer séparément le taux de preuves correctement ancrées, les pièces non consultées signalées, les risques manqués sur une grille indépendante et le temps de validation du juriste.
