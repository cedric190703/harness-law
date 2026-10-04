# harness-law — Saul

**Saul est la couche de vérification de l'IA juridique.** Chaque affirmation d'une réponse d'IA est rattachée à sa preuve : un extrait retrouvé mot pour mot, par script, dans le texte officiel ou dans les pièces du dossier. Règle unique : pas de preuve, pas de vert.

## Le dépôt

| Dossier | Contenu |
|---|---|
| [`saul/app`](saul/app/README.md) | L'application. **Espace de travail** (`/`) : projets, pièces, mission confiée à Claude Code ou Mistral Vibe avec le skill de revue croisée, graphe du parcours, livrables Word et Excel. **Vérifier une réponse d'IA** (`/verification`) : chaque phrase contrôlée sur Légifrance et Judilibre (existence, version à la date des faits, rang, contenu), puis la boucle qui renvoie les erreurs à l'IA auteure et revérifie sa correction. Les deux écrans sont reliés. |
| [`skills/cross-document-review`](skills/cross-document-review/SKILL.md) | Skill de revue croisée (registre aller-retour, citations vérifiées par script). Utilisé par l'application et par le banc d'essai. |
| [`skills/verifier-sources`](skills/verifier-sources/SKILL.md) | Skill Claude Code : carte HTML des sources d'une réponse d'IA. Disponible dans Claude Code via `.claude/skills`. |
| [`skills/saul-due-diligence`](skills/saul-due-diligence/SKILL.md) | Skill de due diligence sur une data room : inventaire, registre de couverture, extrait vérifié pour chaque red flag. |
| [`bench`](bench/README.md) | Banc d'essai : Harvey Legal Agent Bench avec et sans Saul, boucle juger puis corriger, deux juges, pages de revue. |
| [`paper`](paper/saul-paper.pdf) | Le papier de recherche et la revue de littérature. |
| `saul/.context` | Rapports des preuves : jeu de test français, ContractNLI. |
| [`recherches`](recherches) | Recherches du hackathon : marché, concurrents, API officielles. |

## Lancer l'application

```sh
python3 -m venv .venv
.venv/bin/pip install -r saul/app/scripts/harness/requirements.txt
cd saul/app
cp .env.example .env.local   # clés Mistral et PISTE pour /verification
bun install --frozen-lockfile
bun run dev --hostname 127.0.0.1
```

Ouvrir http://127.0.0.1:3000. `bun run check` lance style, types et tests. Détails : [`saul/app/README.md`](saul/app/README.md).

Ne jamais commiter de clé (`.env.local`), de vrai document client ni de journal de mission.

La vérification automatique **Protection des secrets** contrôle les fichiers privés
et l'historique Git. Voir [SECURITY.md](SECURITY.md) pour les commandes locales et
la procédure en cas de fuite. Les documents de benchmarks tiers conservent leurs
[mentions d'origine](THIRD_PARTY_NOTICES.md).
