# Boucles et Slip Roll — 0.35

Les platines proposent **¼, ½, 1, 2, 4, 8, 16 et 32 temps**, sur PC et Remote. Le choix de taille suit la boucle active. Changer sa taille pendant la lecture la redimensionne en gardant son origine et le même flux audio ; une expansion conserve le point courant, tandis qu’une réduction déjà dépassée recale au début. À la fin du fichier, la réserve disponible borne la boucle.

- **Boucle** : répète le passage capturé ; la désactivation poursuit la lecture depuis le point courant de ce passage.
- **Slip Roll** : répète temporairement un passage et conserve une horloge de continuation. La fin du Roll rejoint cette horloge, avec les changements de vitesse et les courbes de tempo intervenus entre-temps.

Sur PC, **Sur la mesure** garde la capture quantifiée ; **Maj + clic** capture immédiatement. Remote pilote le moteur du PC. Les contrôles se redimensionnent dans les deux thèmes testés, aux largeurs Windows 1080/1440 et Remote 390.

## Raccords audio

Les limites de boucle sont arrondies à l’échantillon. Un AudioWorklet applique de courts fondus de quatre millisecondes autour des raccords, avec une durée bornée pour les petites boucles. Il suit la vitesse native de la source et continue de travailler lorsque l’interface attend. La lecture hors boucle conserve ses échantillons ; le maintien de secours existant garde son propre traitement. Le gain commun préserve le routage des huit canaux de stems.

Le retour d’un Roll conserve l’ancien flux audible pendant l’amorçage du nouveau processeur de hauteur, puis les raccorde brièvement. Une pause ou un remplacement annule aussi ce flux retenu. Un Roll ayant dépassé la fin du titre se termine sans relancer son début.

La latence du maintien de hauteur demeure : les profils Standard et Rythme sont décrits dans [les mesures Key Lock](KEYLOCK-0.21.md). Les vitesses du raccord suivent le playbackRate par bloc défini par la [spécification Web Audio](https://www.w3.org/TR/webaudio-1.1/#AudioBufferSourceNode).

![Contrôles de boucle sur les platines](images/loop-controls-035.png)

## Mesures et portée

431 tests unitaires, 32 scénarios natifs source et 30 depuis le paquet Windows passent. Sur les signaux de raccord volontairement discontinus, le saut maximal passe de 0.900 à 0.000266. Les bancs couvrent 44,1/48 kHz, des variations de vitesse, un redimensionnement en lecture et huit canaux.

Sur les deux fichiers musicaux, les retours du Roll rejoignent l’horloge prévue et ne présentent aucune fenêtre de 50 ms sous le seuil RMS 0,0001 autour du raccord. Les comparatifs 0.34 montrent environ une seconde d’erreur d’horloge et des fenêtres sous ce seuil ; ces observations de transport et d’énergie restent distinctes d’un jugement musical. Le chemin testé isole la voix et le maintien de hauteur ; les recettes de continuité et de transitions vérifient séparément le programme complet.

Le banc de stems emploie huit canaux construits pour contrôler le routage et le fondu commun. Les tests ne constituent pas une mesure de séparation neuronale, une longue session ou une validation perceptive générale. [Mesures détaillées](LOOP-MEASURES-0.35.json) · [Recette et distribution](CHANGELOG-0.35.0.md).
