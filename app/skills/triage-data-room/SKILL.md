---
name: triage-data-room
description: "À employer avant tout dépouillement, dès qu'une data room est ouverte. Classe chaque fichier d'un lot documentaire imposé — doublon, version tronquée, brouillon non signé, avenant, illisible — et établit la couverture : ce qui a été lu, ce qui ne l'a pas été, et pourquoi. Ne s'applique pas à l'analyse du contenu, qui relève de extraction-ancree."
---

# Triage d'une data room

Un juriste ne choisit pas l'arborescence qu'on lui impose. Il reçoit des noms de
fichiers qui ne veulent rien dire, le même contrat deux fois dont une version
amputée, un brouillon rangé à côté de l'original, et un scan illisible.

**La faute à ne jamais commettre : écarter un document sans que le juriste
puisse contester le motif en une seconde.** Un tri silencieux est pire qu'une
absence de tri, parce qu'il donne une fausse impression de complétude.

## Étape 1 — Ouvrir chaque fichier, sans exception

Pour chaque fichier, établir : son nom, son dossier, sa taille, son empreinte
(SHA-256) et **s'il est lisible**. Trois cas, et trois seulement :

- **lisible** : du texte en est sorti ;
- **à reconnaître** : c'est une image ou un PDF sans couche de texte ; il faut
  une reconnaissance de caractères ;
- **illisible** : le fichier est corrompu, vide, ou d'un format non pris en
  charge.

Dans les deux derniers cas, écrire le motif **en français, destiné au rapport**.
« Le fichier porte l'extension .pdf mais n'en est pas un : son en-tête est
absent » est un motif. « Erreur de parsing » n'en est pas un.

## Étape 2 — Attribuer un rôle

| Rôle | Quand | Ce qu'on en fait |
|---|---|---|
| **retenu** | Document signé, complet, dans le périmètre | Dépouillé clause par clause |
| **avenant** | Il modifie un autre document | Dépouillé, **et rattaché à son contrat** |
| **écarté** | Doublon, version tronquée, brouillon non signé | Gardé au dossier avec son motif |
| **illisible** | Rien n'a pu en être tiré | Compté dans la couverture, jamais oublié |
| **périmètre** | La liste de demandes | Sert à dire ce qui manque |
| **réponses** | Les réponses du vendeur | Affirmations à éprouver, pas source de faits |

Chercher les marques de brouillon **dans le nom du fichier et dans son en-tête
seulement**. Un contrat peut parfaitement parler d'un « projet » en son corps
sans en être un : chercher partout produit des faux positifs, et un faux positif
sur ce tri fait disparaître un document signé du rapport.

Même règle pour les avenants : le mot ne compte que dans le nom ou le titre. Une
mise en demeure qui *cite* l'avenant n° 2 n'est pas un avenant.

## Étape 3 — Les deux formes de doublon

**Le doublon strict** se reconnaît à l'empreinte : contenu identique au bit près.
Garder le premier, écarter les autres en nommant celui qu'on garde.

**La version tronquée est le cas dangereux.** Deux fichiers dont l'un commence
exactement comme l'autre mais s'arrête plus tôt. Celui qui est amputé peut avoir
perdu précisément la clause qui compte — et il porte souvent le nom le plus
rassurant (« contrat signé FINAL v2 »).

Quand on en écarte un, **nommer les articles perdus** : « le début est identique,
mais ce fichier s'arrête plus tôt et il manque les articles 14, 19 ». C'est ce qui
permet au juriste de vérifier que le tri l'a protégé au lieu de le priver.

## Étape 4 — Rattacher chaque avenant à son contrat

Un engagement de volume de 4 200 tonnes au contrat devient 5 600 tonnes après
avenant. **Lire le contrat sans son avenant conduit à un rapport faux.**

Retrouver le contrat d'origine par ce que l'avenant dit lui-même : la date qu'il
cite, à défaut les parties qu'il nomme. Jamais par une ressemblance de nom de
fichier. Si le contrat d'origine est absent de la data room, le dire : « avenant
dont le contrat d'origine n'a pas été retrouvé » est un constat en soi.

## Étape 5 — Établir la couverture

Produire quatre chiffres, et les placer **avant** la liste des documents :

1. combien de documents ont été dépouillés, sur combien de versés ;
2. combien sont illisibles — c'est un trou dans l'audit ;
3. combien ont été écartés, chacun avec son motif ;
4. combien de lignes de la liste de demandes restent sans réponse.

La somme des documents classés doit égaler le nombre de fichiers versés. Un
fichier qui échappe au compte est un fichier dont personne ne répond.

## Ce que le harnais vérifie mécaniquement

- chaque document écarté ou illisible porte un motif non vide ;
- la somme des rôles égale le nombre de fichiers ;
- aucun document illisible ou écarté n'apparaît comme source d'un constat.
