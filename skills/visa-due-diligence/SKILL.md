---
name: visa-due-diligence
description: "À utiliser dès que la tâche demande de revoir une data room, ou l'ensemble des pièces d'une société, pour une acquisition, un investissement ou un financement : due diligence juridique, rapport de red flags, points d'attention, questions au vendeur. C'est la méthode d'un conseil d'acquéreur exigeant : inventaire de toutes les pièces, lecture intégrale rubrique par rubrique, croisements obligatoires entre rubriques, chaque constat relié à un extrait vérifié mot pour mot, et la liste de ce qui n'a pas été lu. Ne s'applique pas à la comparaison de deux documents entre eux (cross-document-review) ni à la rédaction sans pièces."
---

# Due diligence d'une data room (méthode Visa)

Un rapport de due diligence se juge sur ce qu'il a raté. Les agents lisent d'ordinaire moins de 1 % d'une data room et cherchent par mots-clés : ils ratent le consentement de changement de contrôle qui n'est nulle part, la preuve de propriété qui manque, la contradiction entre deux pièces. Cette méthode garantit trois choses : **chaque pièce a un sort** (lue, écartée et pourquoi, illisible), **chaque red flag est relié à un extrait vérifié par script**, **chaque croisement obligatoire est fait**. Suis les étapes dans l'ordre.

**Trois règles passent avant tout :** (1) le livrable demandé doit exister dans `$OUTPUT_DIR` avant la fin ; (2) si une commande échoue deux fois, passe à l'étape suivante (seuls les scripts nommés ici existent) ; (3) tout l'état de travail est dans des fichiers sous `$WORKSPACE_DIR/dd/` : après une perte de contexte, relis `dd/registre.jsonl` (les fiches) et `dd/constats.jsonl`, pas les pièces.

Les scripts sont dans `$WORKSPACE_DIR/skills/visa-due-diligence/scripts/` (écris toujours le chemin complet : les variables du shell ne survivent pas d'un appel à l'autre).

## Étape 1 — Inventaire

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/inventaire.py
```

Il extrait le texte de chaque pièce (PDF, tableurs, Word… ; repères « === Page n === », lignes « L12: » pour les tableurs), écrit `dd/registre.jsonl` (rubrique, nom, format, taille, empreinte SHA-256, statut à remplir) et signale : doublons exacts (déjà écartés), même texte dans deux fichiers, textes quasi identiques (avec leurs différences : lis-les, c'est là que se cachent les écarts entre pièces d'une série), autres versions, projets ou pièces non signées, avenants à rattacher à leur contrat principal, pièces illisibles.

Puis, avant de lire : identifie la cible, le client (l'acquéreur, sauf consigne contraire), l'opération et sa date. Chaque signal appelle une décision : un projet se lit (s'il n'existe pas de version signée, c'est un constat) ; un avenant dont le contrat principal manque, c'est une absence à signaler ; un acte sans signature, à vérifier.

## Étape 2 — Lecture intégrale, rubrique par rubrique

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/lire.py 01      # puis lire.py --suite jusqu'à « Fin de la sélection »
```

- **Lis toutes les pièces, en entier, dans l'ordre des rubriques.** Ne remplace jamais la lecture par des recherches de mots-clés : ce qui manque ou se contredit ne se trouve qu'en lisant. Chaque appel affiche environ 20 000 caractères : une data room de 150 pièces se lit en une dizaine d'appels, ne t'arrête pas en route. `lire.py --reste` affiche tout ce qui n'a pas encore de statut.
- **Après chaque rubrique, une fiche par pièce**, en une commande :

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/registre.py <<'EOF'
P012 | lue | Contrat de prêt senior du 12/03/2024, signé ; 5 M€ sur 6 ans ; levier maximal 3,0x ; exigibilité anticipée si changement de contrôle (art. 22)
P014 | écartée | doublon de P013 en version non signée
EOF
```

  La fiche dit : nature, parties, date, signée ou non, montants et durées, clauses sensibles (changement de contrôle, cession, exclusivité, non-concurrence, résiliation, garanties, plafonds), pièces auxquelles elle renvoie. Ce sont tes notes pour les croisements.
- **Puis les constats de la rubrique**, ajoutés à `dd/constats.jsonl` (une ligne JSON par constat ; dans les textes, des « » plutôt que des guillemets droits) :

```bash
cat >> $WORKSPACE_DIR/dd/constats.jsonl <<'EOF'
{"id": "C-007", "nature": "anomalie", "theme": "Résiliation possible du contrat client n°1 au changement de contrôle", "gravite": "critique", "piece": "P031", "localisation": "page 4, article 15.2", "extrait": "en cas de changement de contrôle du Fournisseur, le Client pourra résilier", "liees": [{"piece": "P044", "localisation": "feuille « Clients », ligne 3", "extrait": "Client 1 | 4 200 000 | 18 %"}], "constat": "Premier client (18 % du CA) résiliable sans indemnité à la cession ; aucun accord du client dans la data room.", "calcul": "", "outil": "condition suspensive", "recommandation": "Condition suspensive : renonciation écrite du client à sa faculté de résiliation, obtenue avant la réalisation.", "croisement": ["C2"]}
EOF
```

  - `nature` : `anomalie` (red flag), `absence` (une pièce ou une preuve qui devrait exister et n'est pas là), `conforme` (vérification faite, rien à signaler : elle prouve que tu as regardé).
  - `extrait` : **copié mot pour mot** de la pièce, 5 à 40 mots, le passage décisif (« […] » pour sauter un passage ; casse, espaces et guillemets ne comptent pas) ; `localisation` : page, article ou clause, ou feuille et ligne pour un tableur. Chaque ligne, même `conforme`, cite sa pièce et son extrait ; les pièces liées (`liees`) portent aussi le leur.
  - `gravite` : **critique** (peut empêcher l'opération ou en changer le prix : consentement requis absent, défaut de financement, litige majeur non provisionné, propriété d'un actif clé non prouvée), **élevée** (exposition significative à couvrir dans le contrat), **moyenne** (à négocier ou à régulariser), **faible** (formel).
  - `outil` et `recommandation`, pour le contrat de cession : `garantie spécifique` (risque identifié et chiffrable), `condition suspensive` (à lever avant la réalisation : consentement, waiver, mainlevée), `ajustement de prix` (passif certain, chiffre surévalué), `indemnité`, `déclaration` (faire déclarer et garantir par le vendeur ce qui reste incertain), `séquestre`, `autre`. Une recommandation précise, pas « à vérifier ».

Ce qu'on cherche dans chaque rubrique : société et capital (statuts, titres, pactes, agrément, préemption, titres donnant accès au capital, pouvoirs), comptes (réserves des commissaires aux comptes, provisions, engagements hors bilan), financements (covenants, défauts, waivers, sûretés, exigibilité anticipée, changement de contrôle), litiges et précontentieux, contrats importants (changement de contrôle, intuitu personae, exclusivité, non-concurrence, résiliation, dépendance), immobilier, données et informatique (incidents, transferts, sous-traitants), propriété intellectuelle (titres, cessions de droits par salariés et prestataires, oppositions, licences libres), assurances, réglementation et conformité, environnement, social, fiscal, déclarations et attestations du vendeur.

## Étape 3 — Croisements obligatoires

Chacun doit avoir au moins une ligne dans `constats.jsonl` avec `"croisement": ["Cn"]` (red flag, absence, ou `conforme` qui dit ce qui a été vérifié et sur quelles pièces) :

- **C1** déclarations et attestations du vendeur contre les pièces : chaque « il n'existe aucun litige / aucune sûreté / aucun autre financement » est confronté aux registres, procédures, inscriptions et tableaux.
- **C2** chaque contrat important contre changement de contrôle, cession, exclusivité, résiliation ; pour chaque consentement requis, la preuve qu'il est obtenu (sinon : absence).
- **C3** financements : covenants recalculés à partir des chiffres, waivers et leurs conditions, sûretés inscrites contre sûretés déclarées.
- **C4** litiges, contrôles, risques sociaux, fiscaux, réglementaires et environnementaux contre provisions, hors-bilan et assurances.
- **C5** propriété des actifs clés : titres de PI, cessions de droits, logiciels, marques, immobilier.
- **C6** capital : table de capitalisation contre statuts, procès-verbaux et titres donnant accès au capital.
- **C7** chiffres refaits par script : `python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/tableaux.py` pour les totaux des tableurs, puis `python` (openpyxl, pandas) pour les ratios et pour tout chiffre cité dans deux pièces ; mets le calcul dans `calcul`.

Pour croiser, pars des fiches et cherche dans tout le texte : `grep -rn -i "<partie, montant, date>" $WORKSPACE_DIR/dd/texte/`. **Les absences** sont le cœur du travail : contrat principal d'un avenant, accord d'un cocontractant, version signée d'un projet, preuve de propriété, annexe ou pièce citée mais absente. Une absence cite la pièce qui la rend nécessaire (`piece`, `extrait`) ; si aucune ne la mentionne, mets `"piece": "aucune"` et la `rubrique`.

## Étape 4 — Contrôle mécanique, à répéter jusqu'à ce qu'il soit propre

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/controle.py
```

Il vérifie que chaque pièce a un statut et une fiche, que chaque extrait existe mot pour mot dans sa pièce et à la page annoncée (sinon il montre le texte réel à recopier), que chaque constat a sa source, sa gravité et sa recommandation, que chaque croisement et chaque rubrique ont leur ligne, et que chaque signal important de l'inventaire est traité. Corrige (avec `edit` ou un court script `python` qui réécrit la ligne), relance, jusqu'à `CONTRÔLE OK`.

## Étape 5 — Le rapport, tiré des fichiers

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/rapport.py --titre "Rapport de red flags — <société cible>"
```

Il écrit `dd/rapport.md` : synthèse chiffrée et tableau des red flags par gravité, détail par rubrique (pièce, localisation, extrait, pièces liées, analyse, recommandation), croisements effectués, pièces non lues ou écartées et pourquoi, méthode. **Rédige la synthèse** à la place du commentaire « À RÉDIGER » : la conclusion pour le client (signer, signer sous conditions, ne pas signer en l'état), puis les 3 à 5 points qui pèsent sur le prix et la structure, avec leur traitement dans le contrat. Garde le détail tel quel ; ne cite entre guillemets que du texte des pièces. Copie le fichier sous le nom exact demandé dans `$OUTPUT_DIR` (pour un .docx : `python $WORKSPACE_DIR/skills/docx/scripts/generate_from_md.py dd/rapport.md $OUTPUT_DIR/<livrable>.docx`), puis :

```bash
python $WORKSPACE_DIR/skills/visa-due-diligence/scripts/controle.py rapport $OUTPUT_DIR/<livrable>
```

Il vérifie que chaque red flag est dans le rapport, que chaque citation existe dans les pièces et que chaque pièce non lue est expliquée. Corrige jusqu'à `RAPPORT OK`, puis relis la consigne phrase par phrase (langue, nom du fichier, éléments demandés pour chaque red flag) avant de terminer.
