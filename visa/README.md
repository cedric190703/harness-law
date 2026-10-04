# Visa

> « Vu l'article… » : le visa est la liste des textes en tête d'un jugement.

**Visa vérifie chaque phrase d'une réponse d'IA juridique sur le texte officiel,
et garde la preuve.** Hackathon LLM x Law Paris #2 (Stanford Law + Mistral AI),
4 octobre 2026. Le plan complet : [`.context/brief.md`](.context/brief.md).

## Proposer un changement (tout le monde, même sans coder)

La version principale (`main`) est protégée : on n'y écrit jamais directement.
Chacun travaille sur **sa branche**, puis propose son changement. Une
vérification automatique tourne ; quand elle est verte ✅, on fusionne.

### Avec Claude Code (le plus simple)

```bash
git clone <lien du dépôt>
cd harness-law
claude
```

1. Dis ce que tu veux, en français : « je veux réécrire le mémo de démo »,
   « ajoute une alerte quand la date des faits manque ». Claude crée ta branche
   tout seul (ou tape `/commencer memo de démo`).
2. Quand c'est bon, tape **`/livrer`** : Claude vérifie, envoie, ouvre la
   proposition, attend le ✅ et fusionne.

### Depuis le site GitHub (pour un texte, une virgule)

1. Ouvre le fichier sur GitHub, clique sur le crayon ✏️.
2. Modifie, puis **Commit changes…**
3. Choisis **« Create a new branch for this commit and start a pull request »**,
   nomme la branche `prenom/sujet` (ex. `sarah/memo-demo`), puis
   **Propose changes** → **Create pull request**.
4. Attends le ✅ vert en bas de la page, puis **Squash and merge**.

Si la vérification est rouge ❌ : demande à Claude « pourquoi ma proposition
est rouge ? » ou préviens Youssef.

## Lancer l'app en local

Il faut [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
cd visa/app
bun install
cp .env.example .env.local   # puis colle les clés (demande-les à Youssef)
bun dev                      # → http://localhost:3000
```

`bun run check` lance les mêmes vérifications que GitHub (style, types, tests).

## Où sont les choses

| Dossier | Contenu |
|---|---|
| `visa/app/src/lib/` | le moteur : découpe, sources officielles, juge, hiérarchie des normes |
| `visa/app/src/components/` | l'interface |
| `visa/app/src/demo/` | le mémo piégé de la démo |
| `visa/.context/` | le brief et les recherches |
| `AGENTS.md` | les règles que suivent Claude et les autres IA dans ce dépôt |
