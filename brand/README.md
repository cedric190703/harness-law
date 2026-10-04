# Saul — la marque

- `guide.html` : le guide de marque (ouvrir dans un navigateur). Il est fabriqué par `python3 brand/build.py` à partir de `guide.template.html`.
- `saul.css` : les couleurs, la typo et les pastilles de verdict, à importer dans le chat.
- `saul/` : Saul en entier (`saul-*.svg`) et en avatar (`avatar-*.svg`), un fichier par état : repos, lecture, verifie, objection, date, nonverifie. Fabriqués par `python3 brand/saul.py`.

La règle : l'interface est en noir et blanc, la couleur veut dire « verdict ». Sans preuve, rien n'est vert.
