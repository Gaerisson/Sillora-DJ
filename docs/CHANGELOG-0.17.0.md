# 0.17.0 — Continuité et préparation audio

Ce premier lot de la refonte traite la préparation et le transport. La nouvelle planification musicale complète et les nouveaux modes restent à développer.

## Automix et transport

- Surveillance Automix isolée dans un composant dédié. La prochaine transition est armée jusqu'à six secondes avant OUT ; les sources, filtres et niveaux restent programmés sur l'horloge audio.
- Une pause ne relance plus automatiquement le set. Une fin de fichier naturelle est identifiée séparément et permet de reprendre le titre suivant sans rejouer le précédent.
- L'annulation d'un passage encore programmé arrête aussi sa source entrante, pour toutes les familles d'effets.
- Le point OUT affiché tient compte de l'attente du maintien de hauteur, sans décaler le repère musical.
- Les captures de boucle immédiates gardent le curseur exact. La quantification utilise le prochain temps ou sous-temps ; Maj + clic sur Boucle force la capture immédiate.
- Boucles ¼ et ½ temps ajoutées. La sortie d'une boucle après une rampe de tempo rétablit une position continue.
- Tremolo reste disponible manuellement et quitte les choix automatiques.

## Import et analyses

- Le décodage rend le titre lisible sans attendre l'analyse musicale complète.
- Automix démarre avec le premier titre décodé, puis reçoit les titres suivants pendant l'import du dossier.
- Un chargement explicite sur une platine peut passer pendant l'import en cours. Les demandes du même fichier sont regroupées.
- Une seule analyse worker fonctionne à la fois. Le chargement d'une platine peut interrompre une analyse moins prioritaire ; celle-ci reprend ensuite.
- Le cache persistant utilise un SHA-256 du contenu encodé et les versions des analyses. Une analyse identique peut être réutilisée après renommage du fichier.
- États d'analyse dans la bibliothèque. Les ondes Remote sont invalidées à la fin de l'analyse et reçoivent les nouvelles données.
- Normalisation progressive à l'arrivée des résultats d'analyse, indépendante des volumes manuels.

## Interface et Remote

- Panneau Régie masqué par défaut ; son affichage est mémorisé, sans colonne vide.
- Copie du lien Remote par le presse-papiers natif de Windows, avec repli manuel si la copie échoue.
- Compte à rebours d'un passage programmé avant son début audible.
- Les métadonnées des fenêtres séparées ne sérialisent plus les images de pochette à chaque image d'animation.

## Validation

- 213 tests automatisés réussis après les modifications.
- Essais Electron avec deux MP3 réels : premier titre joué pendant l'import du second, analyse en arrière-plan, cache réutilisé, OUT programmé avant une interface volontairement bloquée, copie native et boucles Remote.
- Trois rendus Web Audio hors temps réel, avec maintien de hauteur et tempo commun 110 → 98 BPM : échange de graves, filtre et Whoosh. Mesures de crête inférieures à 1, aucun échantillon non fini et aucune fenêtre silencieuse de 50 ms dans la zone du passage. Ces mesures ne valident pas la qualité musicale de tous les styles.

## Limites restantes

La découverte immédiate de toute la collection dans la table, l'annulation/reprise complète d'un import, la réanalyse manuelle, l'analyse des phrases et des drops, les préparations automatiques de stems, les mesures d'underrun, les nouveaux modes et les mises à jour automatiques restent à traiter. Les boucles utilisent les sources natives ; leurs raccords ne bénéficient pas encore de microfondus dédiés. Une analyse préemptée recommence son calcul, puis réutilise son résultat en cache une fois terminée.
