# Limite de tempo et propositions — 0.31

**Transition Lab → Écart max** propose 3, 5, 8, 12, 16 ou 20 %. La valeur initiale reste 20 %. Le réglage est conservé au redémarrage et pilotable depuis Remote.

Un écart de 100 à 112 BPM vaut 12 % dans les deux sens. Lorsque Tempo progressif est actif, le moteur accepte la synchronisation dans la limite choisie et conserve les contrôles de confiance des grilles. Sans Tempo progressif, la synchronisation fixe conserve son plafond plus prudent : 5,5 % en Auto, 8,5 % avec un style explicite, ou une limite utilisateur plus basse.

Si la limite est dépassée, Auto utilise un relais au tempo naturel et l’aperçu en indique la raison. Le réglage ne force pas la synchronisation d’un tempo inconnu ou d’une grille automatique insuffisante. En Auto musical, les équivalences de pulsation ×½/×2 sont évaluées avec la même limite ; un style délibéré conserve la grille native.

## Choix du prochain titre

En mode **Titres compatibles**, les candidats dont le beatmatch est possible passent avant les candidats hors limite. Les grilles fiables passent avant les grilles estimées encore acceptées. Tempo, clé et énergie départagent ensuite les titres de la même catégorie. Les cartes affichent **Beatmatch** ou **Tempo naturel** avec leur explication ; le score interne n’est plus affiché comme un pourcentage de qualité musicale.

Le tri Compatible de la bibliothèque, les propositions PC/Remote, le choix automatique dans le dossier et l’organisation de la file utilisent cette politique. Le calcul prend le BPM actuel de la platine après modification de sa vitesse. Le BPM natif du catalogue reste conservé.

**Ordre du dossier** et **Aléatoire** conservent leur fonctionnement. Une file déjà organisée ou un titre déjà préparé reste prioritaire. Changer la limite renouvelle les propositions, sans remplacer un morceau chargé ni réécrire un passage engagé. Pour choisir une autre piste du dossier, utiliser la commande de proposition suivante ; pour réorganiser la file, utiliser sa commande d’organisation.

Ce classement évalue une possibilité technique de synchronisation. Il ne garantit pas la justesse des grilles estimées, des phrases ou de la combinaison des voix. Le choix du style et les corrections de préparation restent utiles.

[Mesures et périmètre](CHANGELOG-0.31.0.md) · [Audit](AUDIT-SUIVI.md)
