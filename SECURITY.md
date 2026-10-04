# Secrets et données privées

Ne jamais versionner de clé API, mot de passe, fichier d'authentification,
document client réel ou journal contenant les pièces d'une mission.
Les fichiers `.env.example` contiennent uniquement des noms de variables et
des valeurs d'exemple publiques. Les clés de développement restent dans
`.env.local` et les identifiants de déploiement hors du dépôt.

La vérification **Protection des secrets** examine les fichiers suivis et
l'historique Git disponible à chaque push et Pull Request. Gitleaks masque
les valeurs détectées dans sa sortie. Une alerte doit être résolue avant fusion.
Les exclusions Git seules ne suffisent pas à protéger un fichier déjà suivi.

Vérification locale, avec [Gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1 :

```sh
python3 scripts/check-private-files.py
gitleaks git . --log-opts=--all --redact=100 --ignore-gitleaks-allow --max-archive-depth 4
```

Si un secret est publié, le révoquer ou le renouveler chez son fournisseur :
supprimer la ligne dans un nouveau commit ne le retire pas de l'historique.
Prévenir un mainteneur en privé, sans copier le secret dans une issue,
un commentaire ou une Pull Request publique. Toute purge d'historique doit
être coordonnée avec les propriétaires des branches.

Ces contrôles réduisent le risque de fuite ; ils ne remplacent pas la revue
des fichiers, de leur provenance et des droits de redistribution.
