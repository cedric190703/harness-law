# Saul — harness juridique local

L’application reçoit une mission et ses pièces, exécute Claude Code ou Mistral Vibe avec le skill `skills/cross-document-review` de la branche `youssef/bench-revue`, contrôle les sorties et permet de relire le livrable section par section avec ses preuves.

## Démarrage

Depuis la racine du dépôt :

```sh
python3 -m venv .venv
.venv/bin/pip install -r saul/app/scripts/harness/requirements.txt
cd saul/app
bun install --frozen-lockfile
bun run dev --hostname 127.0.0.1
```

Ouvrir http://127.0.0.1:3000. Installer et authentifier au préalable le CLI du fournisseur choisi. La page « Skills et agents » vérifie la présence des exécutables ; elle ne garantit pas que leur authentification est valide. Le bouton de découverte prépare deux pièces fictives ; l’analyse utilise réellement le fournisseur et consomme le budget saisi.

`bun run check` lance lint, types et tests. `bun run build`, puis `bun run start --hostname 127.0.0.1` servent la version compilée. Exécuter ces commandes depuis `saul/app` et conserver le dépôt complet, car le serveur appelle les scripts du skill à sa racine. L’ancien parcours de vérification des sources officielles reste disponible sur `/verification` avec sa configuration existante.

## Paramètres facultatifs

| Variable | Valeur par défaut | Utilité |
| --- | --- | --- |
| `LEGAL_DATA_DIR` | `saul/app/.harness-data` | Stockage local des projets et missions ; utiliser un chemin absolu pour le déplacer |
| `LEGAL_PYTHON` | `.venv/bin/python` à la racine, sinon `python3` | Python disposant des dépendances d’extraction et d’export |
| `LEGAL_CLAUDE_BIN` | `~/.local/bin/claude`, sinon `claude` dans le PATH | CLI Claude Code |
| `LEGAL_VIBE_BIN` | `~/.local/bin/vibe`, sinon `vibe` dans le PATH | CLI Mistral Vibe |

Les identifiants du fournisseur sont ceux du CLI local. Les documents restent stockés localement, mais leur contenu est transmis au fournisseur choisi pendant l’analyse. Ne jamais commiter les données client, les journaux de mission ou les identifiants.

## Parcours

1. Créer un projet, joindre des PDF, DOCX, TXT, Markdown ou CSV, puis saisir la mission dans la conversation. Limites : 100 pièces par projet, 20 Mo par fichier, 50 Mo par requête.
2. Choisir Claude Code ou Mistral Vibe et le budget maximal. Le serveur extrait les pièces, prépare les candidats et transmet le skill au CLI.
3. Suivre les messages, appels d’outils et contrôles. Un contrôle en échec déclenche au plus une correction. Le bouton d’arrêt interrompt le processus ; une nouvelle mission conserve l’historique des exécutions et repart des pièces du projet.
4. Explorer le graphe : étapes du skill, outils observés, pièces, citations, constats et sections. Les cartes se déplacent et affichent un aperçu. Le bouton « Plein écran » agrandit le canvas (sortie par Échap), « Vue d’ensemble » montre tout le parcours et « Lecture 100 % » permet de lire un bloc. Sélectionner un nœud le recentre et ouvre ses détails : sources, citations, comparaison, recommandations, événements et liens navigables, selon les données disponibles. Le graphe s’exporte en JSON ; depuis une section, l’export conserve uniquement sa provenance.
5. Ouvrir le livrable puis cliquer une section. Seuls ses ancêtres documentaires sont affichés ; les étapes communes et outils sont dépliables. Télécharger le Word structuré et l’Excel comprenant les constats, preuves, sections et pièces.

## Contrôles et traçabilité

- Le serveur appelle les scripts **originaux** `extract_text.py`, `check.py candidates`, `check.py ledger`, `ledger_to_report.py` et `check.py report`. Le skill est copié par mission avec son empreinte SHA256 ; les pièces sont également copiées et empreintées.
- Le CLI produit un registre `ledger.jsonl` et un document structuré `draft.json`. Le serveur vérifie leurs liens, la couverture des écarts, la présence exacte des citations dans les extraits et l’intégrité des pièces. Les extraits sont recalculés après l’agent avant le contrôle.
- Les exports ne deviennent téléchargeables qu’après les contrôles. Le Word, le viewer et l’Excel proviennent des mêmes sections et du même registre. Le résultat demeure un brouillon soumis à relecture juridique.
- Le graphe représente la provenance explicite et les opérations observées, pas le raisonnement interne du modèle. Les liens section–constats sont déclarés par l’agent et contrôlés par identifiants ; la justesse de leur interprétation reste à relire. Les étapes sémantiques non attestées indépendamment sont signalées comme telles.
- Les événements conservés excluent les blocs de raisonnement privé. Les sorties d’outils et textes peuvent contenir les pièces : protéger le répertoire de données et ses sauvegardes.

## Limites de cette version

Application locale mono-utilisateur, sans authentification d’équipe ni isolation système complète. Les routes refusent les hôtes distants et les mutations d’une autre origine. Le processus Node doit rester actif : ce moteur ne convient pas à une fonction serverless. Un redémarrage marque les missions en cours comme interrompues ; il faut les relancer. Deux missions simultanées au maximum, une par projet.

Les CLIs ont des outils de lecture/écriture autorisés, sans shell ni contournement global des permissions. Cela ne constitue pas une sandbox OS. Un déploiement d’équipe nécessite notamment un worker isolé, une file durable, une authentification et un stockage protégé.

L’extraction n’inclut pas d’OCR. Pour les PDF et DOCX, la pagination et les éléments hors corps ne sont pas garantis : l’interface affiche des ancrages textuels et les limites, sans inventer de numéro de page. Une pièce illisible bloque la mission. Les doublons binaires sont signalés mais conservés au registre. Le tri juridique des versions, les avenants et les exclusions dépendent des constats de l’agent. Une nouvelle consigne lance une nouvelle revue des pièces ; elle ne reprend pas automatiquement le contexte conversationnel du CLI précédent.

Le budget est transmis au CLI et borne les deux tentatives (moitié du budget par tentative si le coût n’est pas exposé). Le coût affiché vient du fournisseur, lorsqu’il le communique.

## Validation réalisée

- 44 tests passent, ainsi que lint, TypeScript et compilation de production.
- Test réel Claude Code sur deux documents fictifs : quatre constats, six sections, correction automatique d’une référence documentaire incorrecte, contrôles finaux acceptés, Word et Excel générés. Coût déclaré par le CLI : 1,2541265 USD.
- Parcours navigateur : dashboard, projet persistant, graphe, sélection d’une seule section, téléchargement et absence de débordement mobile.
- Vibe : arguments vérifiés sur le CLI installé et normalisation des événements testée ; pas de mission juridique complète exécutée avec ce fournisseur.

Les tests unitaires ne certifient ni l’exhaustivité d’un audit juridique ni la qualité des conclusions sur un dossier réel.
