# Essais musicaux élargis — 0.24

Le premier banc utilisait deux MP3. Il vérifiait des cas précis ; il ne suffisait pas à évaluer une collection. Le contrôle élargi utilise **99 fichiers audio locaux**, décodés intégralement à 44,1 kHz avec l’analyse de production version 3.

| Observation | Résultat | Ce que cela établit |
| :--- | ---: | :--- |
| Fichiers analysés | 99 | Le décodage et l’analyse ont terminé sur ce dossier |
| Erreurs de décodage/analyse | 0 | Aucune erreur sur les fichiers de ce passage |
| Grilles acceptées par le moteur | 33 | Confiance et stabilité franchissent les seuils internes |
| Grilles gardées incertaines | 66 | Le moteur conserve une réserve sur ces estimations |
| Fichiers avec repères d’arrangement | 31 | Une carte de changements mesurés est disponible |

**33 ne signifie pas 33 tempos certifiés justes, et 66 ne signifie pas 66 tempos faux.** Le corpus n’a pas de grille de référence annotée. Le recalage physique des premiers temps, les erreurs d’octave, la tonalité et la préférence d’écoute restent à contrôler indépendamment. Les seuils n’ont pas été abaissés pour améliorer ces chiffres. L’algorithme d’analyse reste celui de la 0.23 ; le correctif 0.24 porte sur l’exécution des passages.

## Matrice de transitions

Huit paires de fichiers distincts sont sélectionnées par critères explicites, avec deux sens de lecture : tempos proches, écart modéré, limite de la plage, écart important, tempo mesuré mais grille sortante incertaine, paire mixte, deux grilles incertaines proches et deux grilles incertaines éloignées.

Le mode `--survey` conserve les grilles et régions calculées. Il ne force ni premier temps ni confiance et ne corrige pas manuellement IN/OUT. Les rendus durent 42 s, avec le profil de maintien de hauteur Rythme. Les contrôles comparent le comportement exécuté au plan : synchronisation ou repli, morphing ou tempo naturel, relais, niveau, absence de valeurs non finies/saturation et poursuite du titre entrant. Le calage des horloges ne certifie pas celui des événements musicaux réels.

## Défaut révélé et correction

Une paire à environ 116 et 123 BPM a révélé un relais différent de celui annoncé lorsque la grille sortante était incertaine. Le plan utilisait un point énergétique non arrondi, mais le transport pouvait encore arrondir le départ sur une mesure estimée parce qu’un morphing était actif. Cela pouvait également réduire la durée disponible avant la fin.

Le transport des passages automatiques programmés ne force plus cette quantification sans grille sortante fiable. Les transitions manuelles et le bouton de passage immédiat conservent leur comportement. La régression synthétique reproduit l’écart avant correction et passe ensuite dans les deux directions de tempo ; elle complète le cas découvert sur les fichiers réels.

## Reproduire et limites

```powershell
npm run test:corpus:windows -- "dossier-musical"
npm run test:transitions:windows -- --rhythm --survey "piste-A.opus" "piste-B.opus"
```

L’analyse écrit ses mesures et ses caches dans `.runtime/corpus-proof/results`. Les rapports de ce dossier peuvent contenir les noms et chemins locaux ; ils restent hors du dépôt. La matrice de transitions utilise le dossier habituel `.runtime/transition-proof/results` et ses lancements remplacent les résultats précédents. Conserver séparément les rapports/rendus pour comparer.

Les [relevés publics](CORPUS-MEASURES-0.24.json) sont anonymisés. Les musiques, captures audio et profils personnels ne sont ni distribués avec les sources, ni publiés dans le dépôt. L’analyse des 99 fichiers n’est pas un test d’import simultané pendant une longue session, ni une validation perceptive de tous les effets. Les phrases, voix et drops ne sont pas reconnus sémantiquement.

Les 16 rendus de 42 s passent depuis le paquet, sans correction manuelle des grilles/régions. Les replis et le morphing exécutés correspondent au plan, le relais calculé est respecté et le titre entrant poursuit sa lecture au tempo natif. Les contrôles ne détectent ni saturation/valeurs non finies ni fenêtre silencieuse de 50 ms pendant le passage mesuré. La recette finale du paquet et ses rendus sont décrits dans les [notes 0.24](CHANGELOG-0.24.0.md).
