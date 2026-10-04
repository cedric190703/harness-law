> Règles d'origine du dépôt `legal-hack`, regroupé ici le 4 octobre 2026. Les skills `/commencer` et `/livrer` n'ont pas été repris : suis les règles du dépôt harness-law.

# Visa — règles pour les agents (Claude, Codex…)

Ce dépôt est partagé par toute l'équipe du hackathon, y compris des personnes
qui ne codent pas. Elles te parlent en français courant ; c'est toi qui
t'occupes de git.

## Le projet

- Visa vérifie chaque phrase d'une réponse d'IA juridique sur le texte officiel
  (Légifrance, Judilibre) et garde la preuve. Le brief : `visa/.context/brief.md`.
- Le code est dans `visa/app/` (Next.js 16 + Bun). Lis `visa/app/AGENTS.md` avant de
  toucher au code Next.js.

## La règle d'or : jamais directement sur `main`

`main`, c'est la version qui marche, celle de la démo. On n'y écrit jamais
directement : tout passe par une branche et une Pull Request.

1. **Avant la première modification**, si tu es sur `main` : mets `main` à
   jour (`git pull`) puis crée une branche `prenom/sujet`, par exemple
   `sarah/memo-demo`. Le prénom est celui de la personne qui te parle (demande-le
   si `git config user.name` ne le donne pas). Sujet en 2 à 4 mots, minuscules,
   tirets. Le skill `/commencer` fait ça.
2. **Une branche = un sujet.** Nouveau sujet : retour sur `main` à jour, nouvelle
   branche.
3. **Avant de proposer** : `cd visa/app && bun run check` doit passer (style, types,
   tests). Si ça casse, répare avant d'envoyer.
4. **Livrer** = commit, push, Pull Request vers `main`. La vérification
   automatique tourne sur la PR ; on ne fusionne que quand elle est verte.
   Le skill `/livrer` fait tout ça.
5. Jamais de `git push --force` sur `main`, jamais de `--no-verify`, jamais de
   réécriture de l'historique d'une branche qui n'est pas la tienne.

## Ne jamais commiter

- une clé ou un secret : les clés Mistral et PISTE vont dans `visa/app/.env.local`,
  qui n'est jamais versionné ;
- un vrai document client ;
- `node_modules/`, `.next/`, `visa/app/.cache/`.

## Parler à l'équipe

- Français courant, court. Pas de jargon git : « ton changement est sur ta
  branche », « la vérification est verte », « c'est dans la version principale ».
- Si la vérification est rouge, dis en une phrase ce qui casse, puis répare.
- Si ton changement entre en conflit avec celui de quelqu'un d'autre sur le même
  texte ou le même comportement, ne choisis pas à sa place : montre les deux
  versions et demande.

## Commandes

```bash
cd visa/app
bun install
cp .env.example .env.local   # puis remplir les clés
bun dev                      # http://localhost:3000
bun run check                # style + types + tests
bun run build
```
