# Recherches — LLM x Law Hackathon Paris #2 (4 octobre 2026)

Ce qu'on a appris le matin du hackathon, avant de coder. Chaque fichier sépare ce qui est **vérifié** (avec sa source) de ce qui est **supposé**.

| Fichier | Contenu |
|---|---|
| [01-hackathon.md](01-hackathon.md) | L'événement (organisateurs, partenaires, thème) et Jus Mundi |
| [02-legora-harvey.md](02-legora-harvey.md) | Ce que les avocats reprochent à Legora et Harvey, ce qui leur manque |
| [03-marche-francais.md](03-marche-francais.md) | Hector AI, les outils français, ce que vivent les petits cabinets, les règles du CNB |
| [04-verification-et-due-diligence.md](04-verification-et-due-diligence.md) | Hallucinations (chiffres, affaires), outils de vérification, données ouvertes, due diligence IA |
| [05-api-legifrance-judilibre.md](05-api-legifrance-judilibre.md) | Comment interroger Légifrance et Judilibre (accès, appels utiles, pièges) |
| [06-idee-visa.md](06-idee-visa.md) | L'idée retenue le matin : Visa, la démo, les cas à tester |

## Ce qui est ressorti de la réunion d'équipe

- **Le problème du juriste M&A** : dans une data room (iManage), il faut lire tous les documents pour trouver les risques (fiscal, social…). C'est très long.
- **Le besoin du juriste « données »** : passer du texte non structuré à des données structurées, repérer les données personnelles, anonymiser. Surtout : **traçabilité et explicabilité** de bout en bout, pour savoir d'où vient chaque information.
- **Le constat côté tech** : on ne sait pas comment l'agent raisonne, ni d'où viennent ses sources. La hiérarchie des normes n'est pas respectée. Il y a de la place pour un spécialiste de la **vérification** : agents juges, contrôle des sources.
- **La règle** : si Claude le fait en une seule demande, ça n'a pas de valeur. Il faut un vrai outillage autour du modèle (un *harness*).
- **Deux pistes** : (1) un cerveau juridique, (2) le test et la vérification.

## En 6 phrases

1. Le thème imposé du hackathon est l'**IA de confiance** (*trustworthy AI integration*). Il est organisé par Stanford Law et Mistral AI, avec Legora, Hector AI et Jus Mundi comme partenaires.
2. Le n°1 des reproches des avocats à l'IA, ce sont les **erreurs** (46 % selon l'enquête CNB 2025). Pourtant 64 % utilisent ChatGPT.
3. Les **citations inventées** arrivent devant les juges : 2 145 décisions recensées dans le monde, dont 14 en France.
4. Aucun outil trouvé ne vérifie, en droit français, qu'une source est **en vigueur à la date des faits** ni son **rang dans la hiérarchie des normes**.
5. Depuis mars 2026, le CNB demande de **documenter et tracer** les usages de l'IA. Aucun outil ne fournit ce journal.
6. Legora et Harvey vendent aux gros cabinets. Les **27 000 avocats seuls** (36 % de la profession) sont mal servis.
