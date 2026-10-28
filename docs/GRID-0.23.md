# Fiabilité de grille — lot F

## Problème reproduit

Le score de stabilité multipliait la précision des attaques par leur nombre rapporté à tous les temps du fichier. Sur les deux MP3 de référence, la couverture est d’environ 35 % et 22 %, mais les attaques retenues ont un écart de 12 et 6 ms et les tempos locaux restent proches de 110 et 98 BPM. Ce calcul confondait précision temporelle et densité des événements détectés.

## Travail livré

- [x] Séparer stabilité temporelle, couverture et quantité d’observations dans un module pur `rhythm-evidence.mjs`.
- [x] Contrôler le contraste entre la pulsation/contretemps et les phases décalées d’un quart de temps, ainsi que le nombre et l’étendue des observations. Un bruit dense ou une poignée d’accents ne doit pas recevoir une grille fiable.
- [x] Garder la pénalisation des variations de tempo, versionner les analyses et conserver les corrections manuelles.
- [x] Afficher couverture et observations dans le panneau existant ; vérifier les repères et transitions sur les deux fichiers sans correction manuelle de grille.
- [x] Terminer la recette de distribution et consigner ses empreintes.

## Choix d’implémentation

La recherche actuelle du BPM et de la phase est conservée. Le nouveau module consomme ses pics, les observations ajustées, l’écart temporel, la corrélation et la dispersion des tempos locaux. Il ne refait pas de passe sur le PCM.

La confiance combine précision, périodicité et contraste de phase, avec un support minimal en nombre d’attaques et en durée. La couverture reste une mesure distincte et visible. La stabilité mesure la précision des observations, pénalisée par la dérive et l’insuffisance de support. Les fichiers incertains conservent le repli ; les seuils d’activation de la grille ne sont pas abaissés.

Le support global réduit aussi la confiance si les observations sont concentrées dans une courte partie du morceau. Une intro régulière de 19,5 s dans un fichier de 120 s conserve sa précision locale, mais ne suffit pas à rendre la grille globale fiable. Le seuil d’activation reste 0,65 pour la confiance et la stabilité.

L’analyse passe en version 3. Les anciens résultats sont recalculés ; les corrections restent rattachées au digest audio, indépendamment de la version du cache. Le cache natif conserve séparément écart temporel, couverture, nombre d’observations, contraste, étendue et variation locale de tempo.

## Résultats sur les fichiers réels

Comparaison à 44,1 kHz sur les mêmes octets ; le BPM et la recherche de phase ne changent pas.

| Référence | BPM | Stabilité avant → après | Confiance tempo après | Couverture | Écart des attaques | Repères automatiques |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 110 | 43 % → 81 % | 83 % | 35 % | 12 ms | 5 |
| B | 98 | 30 % → 90 % | 96 % | 22 % | 6 ms | 4 |

La grille affichée utilise le minimum de confiance et stabilité : **81 % et 90 %**. Ces scores sont des indices de décision internes, pas une probabilité certifiée de justesse. La couverture indique les temps associés à une attaque forte retenue ; elle ne mesure pas le nombre de temps joués par l’artiste.

La recette native importe les deux MP3 sans `manualGrid` ni confiance forcée. Elle contrôle les cartes automatiques, les mesures du panneau d’analyse, les badges de Remote à 390 px et le rechargement depuis le cache sans lecture automatique. Le décodage natif retient 162 et 87 observations, avec les mêmes scores arrondis et cinq/quatre repères.

La matrice `--automatic-grid` rend Whoosh et automatique dans les deux directions, avec maintien de hauteur Rythme. Elle vérifie la confiance réellement calculée et le relais prévu/exécuté. Deux passages suivent un repère de sortie mesuré ; deux conservent le repli énergétique. Aucun IN/OUT ni grille manuelle n’est injecté dans ces quatre rendus.

## Non-régression et limites

**296 tests passent.** Les nouveaux cas couvrent rythme avec pauses, attaques rares mais cohérentes, accentuation uniforme ambiguë, événements aléatoires, observations trop rares/concentrées, silence, dérive de tempo, invariance au gain, cache et état Remote. La relecture par l’auteur a ajouté le cas de l’intro dense trop courte, reproduit avant la correction du support global.

Trois autres fichiers locaux ont été sondés, sans grille de référence certifiée : un produit une carte et deux restent incertains. Ce contrôle exploratoire ne prouve ni la justesse de tous les BPM, ni une précision universelle. Les fichiers audio, noms privés et profils restent hors du dépôt. Voir les [mesures anonymisées](GRID-MEASURES-0.23.json) et les [notes de version](CHANGELOG-0.23.0.md).

La reconnaissance des phrases, voix et drops, la grille à tempo variable et la refonte UI complète restent hors de ce lot. Aucun résultat de confiance n’est une certification de qualité d’écoute.

La distribution est contrôlée : **68 cas natifs** passent depuis le code embarqué, dont les quatre cas de grille automatique PC/Remote/cache et les quatre rendus sans correction manuelle. Les 142 sources applicatives correspondent au paquet ; installateur et portable ont le même contenu, avec intégrité de 7 215 fichiers validée. L’installation sur le profil personnel n’est pas exécutée. [Empreintes](CHANGELOG-0.23.0.md#distribution).
