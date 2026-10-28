# Sillora DJ — suivi de la refonte

État au 27 octobre 2026. Version de départ : 0.16.1. Premier lot : 0.17.0.

## Objectif

Améliorer en priorité le résultat audio et la continuité de lecture. Préserver les fonctions existantes. La présence d'une commande dans l'interface ne vaut pas validation de son comportement.

## Audit initial

- Electron héberge un studio Web Audio. Les transitions programment leurs AudioParams sur `AudioContext.currentTime` ; la surveillance Automix reste dans `app.js`, toutes les 150 ms.
- Les sources sont des AudioBufferSource avec maintien de hauteur SoundTouch, effets et stems sur des bus distincts. La position affichée est intégrée dans le moteur.
- L'import est séquentiel et attend décodage, analyse worker, cache et métadonnées avant d'afficher le dossier. Un titre prioritaire ne peut pas devancer cet import.
- Le cache IndexedDB existe, mais sa clé utilise nom/taille/date/version plutôt que le contenu du fichier.
- Les boucles natives et leur position affichée sont gérées séparément. Une rampe de tempo n'est pas rebassée lors de la sortie d'une boucle.
- La copie du lien Remote dépend uniquement du presse-papiers navigateur.
- Dernier résultat enregistré avant refonte : 200 tests réussis. Aucun nouveau résultat d'écoute n'est revendiqué à ce stade.

## Plan et dépendances

1. **Fiabilité** : isoler la surveillance Automix, préparer avant OUT, programmer l'audio en avance, traiter fin de fichier/pause/retard ; corriger boucles et transport. Mesurer et tester ces cas.
2. **Bibliothèque** : séparer découverte, décodage et analyse ; prioriser lecture/prochain titre ; cache persistant validé par contenu ; exposer les états.
3. **Automix** : approfondir planification musicale, repères, tempo et échanges de fréquences. Comparer les rendus sur fichiers réels avant validation perceptive.
4. **Audio avancé** : préparation stems, scratch vinyle/onde, sidechain et mesures stéréo réelles.
5. **Interface** : modules, micro masqué par défaut, ondes, vinyles, visuels externes et Remote. Corriger le presse-papiers natif dans un lot séparé.
6. **Distribution** : playlists, mises à jour vérifiées, migrations et essais de longues sessions.

## Réalisé dans le premier lot

- Surveillance Automix dédiée, préparation jusqu'à six secondes avant OUT et exécution programmée sur l'horloge audio.
- Distinction pause / fin naturelle ; reprise du prochain titre sans relancer l'ancien après EOF.
- Annulation des sources entrantes programmées, y compris pour EQ, filtres et échos.
- Captures de boucle immédiates ou quantifiées, tailles ¼ et ½, continuité de position à la sortie d'une boucle après une rampe de tempo.
- Décodage et analyse découplés ; démarrage du premier titre pendant l'import du dossier ; chargement prioritaire possible pendant cet import.
- File d'analyses worker, promotion des titres chargés, préemption et reprise des travaux moins prioritaires.
- Cache IndexedDB fondé sur le contenu SHA-256 et les versions des analyses.
- États d'analyse dans la bibliothèque et invalidation des ondes Remote à l'arrivée des résultats.
- Normalisation appliquée progressivement lorsque l'analyse du titre en lecture se termine, sans toucher au volume manuel.
- Régie masquée par défaut et affichage mémorisé ; presse-papiers natif pour le lien Remote.
- Tremolo retiré des choix automatiques, outil manuel préservé.

## Vérifications du lot

- 213 tests automatisés réussis.
- Essais Electron sur les deux MP3 fournis : lecture pendant l'import, analyse différée, cache, OUT armé avant blocage volontaire de l'interface, Régie et copie du lien, boucles Remote. La latence observée est une mesure de cette machine, pas une garantie réseau.
- Trois rendus réels de 14 secondes (EQ, filtre, Whoosh), tempo 110 → 98 BPM et maintien de hauteur actif : aucun échantillon non fini, aucune crête à 1, aucune fenêtre silencieuse de 50 ms dans le passage mesuré.
- La comparaison d'écoute avec les vidéos n'est pas validée dans ce lot.
- Une régression d'initialisation et un verrouillage des boutons A/B pendant l'import ont été détectés par les essais Electron et corrigés avant livraison.

## Livraison du premier lot

La distribution Windows 0.17.0 est construite et vérifiée : installateur et portable embarquent le même contenu ; l'archive de 7 215 fichiers passe son contrôle d'intégrité. Les 14 fichiers de code modifiés présents dans le paquet correspondent aux sources testées. L'installation sur le profil utilisateur n'a pas été effectuée automatiquement.

Les 191 fichiers du dépôt publiés avec le premier lot ont été comparés aux sources locales. Voir [CHANGELOG-0.17.0.md](docs/CHANGELOG-0.17.0.md).

## Prochain lot

Terminer la bibliothèque (découverte immédiate dans la table, annulation/reprise, réanalyse), puis approfondir le planificateur musical et comparer les transitions aux références audio/vidéo. Les phases audio avancé, interface et distribution restent dans le plan ci-dessus.

## Limites et validations restantes

- Les cas OUT, annulation et fin naturelle sont couverts ; les essais de longues sessions et de ressources manquantes restent à étendre.
- Les vidéos et rendus fournis devront être inspectés pour la refonte perceptive ; cette inspection n'a pas été refaite dans ce lot.
- L'accélération GPU, les nouveaux modes, la détection de drops et les mises à jour automatiques ne sont pas livrés.
- Les essais sur entrées micro simulées ne remplacent pas une validation acoustique dans la salle.
- Le décodage de tout un dossier reste progressif : sa table complète n'apparaît pas encore avant le décodage, même si le navigateur affiche déjà les fichiers.
- Annulation/reprise d'import, réanalyse manuelle et microfondus de raccords de boucle restent à réaliser.

## Travaux de documentation réalisés

Le README GitHub présente les fonctions actuelles, les limites et les six phases prévues. Il ne constitue pas une livraison de la refonte de l'application.

## Revue complète du cahier des charges — 28 octobre 2026

Les 20 sections ont été examinées contre le code 0.17.0 et les preuves disponibles : **333 éléments de listes et 41 exigences transversales**, soit **374 points**. Le registre distingue 95 points couverts avec preuve ciblée, 162 partiels, 91 à développer et 26 à valider. Ce sont des états par exigence ; ce décompte ne mesure pas un pourcentage d'achèvement du produit.

- [Audit point par point](docs/AUDIT-REFONTE.md), avec référence au code, constat et critère de validation.
- [Proposition de refonte produit/UI](docs/REFONTE-UI.md), architecture des écrans, composants partagés, dépendances et recette de migration.
- [Maquette navigable](design/refonte/index.html) : Studio, Automix, Préparation, Régie, Visuels, Remote, Sources et réglages. Le registre de l'audit y est filtrable.

La baseline de **213 tests** a été réexécutée avec succès. La maquette a été contrôlée dans Electron sur cinq tailles (1440×900, 1280×800, 1024×768, 768×1024, 390×844), avec tests des vues, thèmes, recherche/tri/favoris, chargement illustratif, états micro partagés, réglages et filtres du registre. Aucun débordement horizontal n'a été relevé. Les contrôles restent des interactions de maquette, pas des tests DSP.

Écarts majeurs confirmés : grille constante et structure énergétique non sémantique, secours avant EOF incomplet, absence de scratch sur l'onde, VU master non séparé L/R, préparation/reprise de bibliothèque incomplète, manque de playlists et d'updates. La comparaison d'écoute avec les vidéos reste à faire.

La version audio **0.17.0 est inchangée** par cette proposition. Les nouvelles fonctions montrées dans la maquette restent à implémenter et à brancher sur des états/mesures réels, par lots documentés dans la proposition. Une interface affichée ne vaut pas une fonction livrée.
