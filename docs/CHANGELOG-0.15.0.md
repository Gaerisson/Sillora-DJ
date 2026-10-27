# Version 0.15.0

Les passages Whoosh entre les deux fichiers de test restaient auparavant à 110 et 98 BPM : la limite de synchronisation empêchait leur rapprochement. **Tempo progressif** autorise maintenant jusqu’à 20 % d’écart pour faire évoluer les deux platines sur un tempo commun, puis laisser le titre entrant à sa vitesse native. La tonalité est conservée avec SoundTouch quand le moteur est disponible. Sync désactivée conserve les vitesses naturelles.

La durée intègre la variation du tempo : 16 temps entre 110 et 98 BPM durent environ 9,231 secondes. Le bouton Suivant utilise aussi ce calcul. L’entrée quantifiée partage le numéro du temps dans la mesure sortante, même si Suivant démarre sur le deuxième ou troisième temps. Les IN manuels restent respectés. Annuler préserve les positions et vitesses effectivement atteintes.

Le Whoosh rassemble un passe-haut progressif, un souffle montant, un retour dosé des graves entrants et une courte descente. Son relais, les courbes de volume et l’écho suivent la même horloge musicale. Les répétitions suivent les divisions de cette horloge pendant la rampe. Les effets EQ et rythmiques emploient également cette progression. Les presets Whoosh, High-pass et DJ dynamique activent Tempo progressif ; il reste désactivable.

En automatique musical, des BPM mesurés suffisamment confiants peuvent déclencher ce Whoosh même si la grille est encore estimée. L’interface le signale : cela ne certifie pas les premiers temps acoustiques. Un tempo peu fiable, un écart excessif ou un conflit harmonique identifié conserve le relais au tempo naturel. Le premier temps, le BPM et les repères restent corrigeables.

Les platines affichent désormais une onde globale et un détail déroulant de 8, 16 ou 32 temps, à tête de lecture fixe. Glissement et clavier déplacent réellement l’audio ; les zones avant/après le morceau restent vides. Ondes RGB continues par couches, repères de boucles, marqueurs, contrastes Porcelaine, espacement et contrôles ont été revus. Le détail utilise 16 384 pics et 8 192 valeurs par bande, calculés depuis l’audio ; les pics stéréo conservent même une attaque brève ou en opposition de phase. Les anciennes analyses reçoivent ce détail sans remplacer leurs corrections manuelles. Une correction de grille CSS rétablit les deux platines côte à côte sur petit écran.

La console Web utilise le même dessin d’onde, affiche la variation de BPM et prédit les positions par l’intégrale de la rampe plutôt qu’à vitesse constante. L’audio continue de sortir du PC.

## Validation

- 183 tests automatisés réussis : intégration des tempos, phase de Suivant, durée musicale, annulation, divisions d’écho, prédiction Remote, transitoires et régressions existantes.
- Rendus stéréo de deux MP3 réels dans les deux sens, avec le moteur de production et SoundTouch : Whoosh 110→98, Whoosh 98→110 et High-pass 110→98. Les contrôles vérifient les horloges, l’arrivée au tempo natif, l’absence d’écrêtage, de valeurs non finies et de fenêtres silencieuses de 50 ms.
- Vérifications Electron de la bibliothèque, des pochettes, des gestes sur ondes, de Remote, du sampler, de l’entrée micro simulée et des mises en page. Aucun micro physique utilisé pour ces essais.

Les essais audio contrôlent les horloges, les crêtes et la continuité ; ils ne remplacent pas une évaluation musicale sur le répertoire utilisé. Les enregistrements personnels restent hors du dépôt.

Les fonctions SoundCloud restent limitées à l’import d’un lien public compatible ; le catalogue abonné Go+ n’est pas intégré. Les stems CPU sont embarqués et précalculés ; ils ne sont pas instantanés. Les filtres anti-larsen nécessitent un réglage adapté à la salle. Le paquet n’ajoute ni ASIO, ni préécoute casque séparée, ni MIDI.
