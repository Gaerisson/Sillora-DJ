# Sillora DJ 0.24.0 — gestes d’onde et essais élargis

**Déplacer / Scratch** devient un choix explicite sur les ondes détaillées et verticales du PC, ainsi que sur Remote. Une sensibilité propre à l’onde est mémorisée par platine. Le scratch saisit la tête actuelle sans saut au clic et reprend selon l’état de lecture précédent.

- Cibles absolues regroupées sur Remote, position réelle conservée au démarrage et identité propre à chaque prise.
- Un ancien geste ne peut agir sur une prise plus récente. Le maintien immobile est contrôlé et reste actif jusqu’au relâchement normal.
- Les commandes d’onde obsolètes et les déplacements encore en attente sont abandonnés après destruction/remplacement.
- Le zoom de l’onde ne modifie pas sa sensibilité. L’aperçu global reste destiné à la navigation.
- Les libellés du contrôle partagé héritent de la couleur du thème sur Remote ; le bouton non sélectionné reste lisible en Porcelaine.
- Correctif de passage automatique programmé : un morphing ne force plus un départ quantifié sur une grille sortante incertaine, au détriment du point énergétique annoncé.
- Nouvelles recettes Windows pour les gestes et le corpus, et mode `--survey` pour les transitions sans grille ni régions manuelles, y compris le repli.

**313 tests automatisés passent.** La revue indépendante a vérifié les corrections Remote et la cohérence du relais programmé. **50 cas natifs passent depuis le code embarqué** : dix scénarios de gestes sur les deux MP3, les mêmes dix sur deux Opus du corpus, quatre rendus sur les références, 16 sur les huit nouvelles paires, six bibliothèque et quatre continuité/audio. Le contraste du contrôle Remote est mesuré à 6,27 sur Porcelaine. Aucune installation n’est effectuée sur le profil personnel.

## Corpus élargi

Les 99 fichiers du dossier de contrôle ont été analysés sans erreur. Le moteur accepte 33 grilles et en garde 66 comme incertaines ; 31 fichiers produisent des repères. Ces chiffres décrivent les décisions de l’algorithme, pas sa justesse statistique. Huit nouvelles paires couvrent des tempos proches/éloignés et des grilles fiables/incertaines. Les 16 rendus de 42 s passent depuis le paquet sans correction manuelle : relais conforme au plan, poursuite du titre entrant au tempo natif, aucun échantillon non fini/saturé ni fenêtre silencieuse de 50 ms dans le passage contrôlé. Cela ne certifie pas la justesse musicale des grilles. Les relevés sont publiés dans [CORPUS-MEASURES-0.24.json](CORPUS-MEASURES-0.24.json).

[Gestes et fonctionnement](GESTURES-0.24.md) · [Corpus, défaut révélé et limites](CORPUS-0.24.md) · [Suivi de l’audit](AUDIT-SUIVI.md).

## Distribution

Les exécutables Windows x64 sont construits, avec nom Sillora DJ, version 0.24.0 et copyright Gaerisson vérifiés. Les 145 sources applicatives correspondent au contenu embarqué. Installateur et portable ont le même contenu ; l’archive commune de 7 215 fichiers passe le contrôle d’intégrité. L’installation sur le profil personnel n’est pas exécutée. Les binaires sont remis séparément du dépôt source.

| Exécutable | SHA-256 |
| :--- | :--- |
| Sillora-DJ-Setup-0.24.0.exe | `e0633518ca94b97b9e1452134b1683487f3bcff9b3b9e6e02fcbb813ef6c1543` |
| Sillora-DJ-0.24.0-Windows.exe | `4de99c9b40fca34e458df666cc0e389d19125b5fdac315b5970578a65ffe8196` |

La reconnaissance des phrases/voix/drops, la validation annotée des grilles et tonalités, les sessions prolongées, les réglages avancés du scratch, la régie acoustique et le branchement complet de la refonte restent ouverts.
