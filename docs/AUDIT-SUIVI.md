# Suivi de l’audit — Sillora DJ 0.22.0

Mise à jour du 28 octobre 2026. Le [registre initial de 374 points](AUDIT-REFONTE.md) reste une photographie de la 0.17.0. Ce suivi décrit les évolutions effectivement testées depuis cette base. Il ne requalifie pas les autres sections et ne mesure pas un pourcentage d’achèvement.

## Lots réalisés

| Lot | Application modifiée | Preuves et périmètre |
| :--- | :--- | :--- |
| A · 0.18.0 | Mesures stéréo réelles, continuité pendant une préparation tardive, déconnexion Remote | 225 tests ; quatre scénarios Electron/audio. [Détail et limites](CHANGELOG-0.18.0.md) |
| B · 0.19.0 | Catalogue immédiat, import prioritaire et reprenable, cache natif, réanalyse, pagination | 246 tests ; six scénarios bibliothèque et quatre scénarios audio/Remote sous Electron. [Détail et recette](CHANGELOG-0.19.0.md) |
| C · 0.20.0 | Partition commune des transitions, relais des graves, variation de tempo et repères cohérents | 254 tests ; neuf rendus avec maintien de hauteur, six scénarios bibliothèque et quatre audio/Remote. [Déroulement et limites](TRANSITIONS-0.20.md) |
| D · 0.21.0 | Mesure acoustique après Key Lock, profil Rythme optionnel et réglage partagé PC/Remote | 261 tests ; 48 scénarios depuis le paquet : 16 cas acoustiques, quatre UI/IPC, 18 rendus musicaux, six bibliothèque, quatre audio/Remote. [Mesures et architecture](KEYLOCK-0.21.md) |
| E · 0.22.0 | Repères d’arrangement, préparation et relais avec phase conservée ; migration des préparations par digest | 282 tests ; 60 cas natifs depuis le paquet, dont huit de préparation et quatre rendus de régions. [Architecture et limites](ARRANGEMENT-0.22.md) |

V = couvert dans le périmètre décrit ; P = partiel ; A = à développer ; T = à valider. Les preuves ci-dessous sont les sources et recettes des versions indiquées. Les tests d’une file simulant 1 000 références utilisent les octets de deux vrais MP3 ; ils ne représentent pas une collection de 1 000 titres distincts analysés intégralement.

## Section 4 — bibliothèque et analyses

| Référence | État actuel | Résultat et preuve ciblée |
| :--- | :---: | :--- |
| R4.1-01 | V | Les références découvertes sont visibles avant le décodage ; 100 lignes montées par page. `library-imports.mjs`, `app.js`, recette Windows bibliothèque n° 1. |
| R4.1-02 | V | Découverte, lecture/décodage et analyse ont des files et états distincts. Tests `library-imports` et `analysis-queue`. |
| R4.1-03 | V | Le premier titre peut être utilisé sans attendre tout le lot ; une demande A/B explicite passe devant le fond. Recette n° 1. |
| R4.1-04 | V | Worker d’analyse en arrière-plan, préemption et pause du fond pendant transition ou scratch. Tests `analysis-queue`. |
| R4.1-05 | V | Les titres déjà prêts restent utilisables pendant le reste de l’import. Recettes n° 1–2. |
| R4.1-06 | P | Pause, annulation et reprise des références Windows autorisées, sans lecture automatique au redémarrage. Le travail natif déjà engagé termine avant abandon du résultat ; fichiers glissés/navigateur à resélectionner. Recettes n° 2–3. |
| R4.2-01 | V | Platines chargées et demandes explicites : priorité 0. Tests de file et recette n° 1. |
| R4.2-02 | V | Prochain titre : priorité 5, puis priorité de platine une fois chargé. Tests de priorités dynamiques. |
| R4.2-03 | V | Reste de la file Automix : priorité 10. `app.js`, `analysis-queue.mjs`. |
| R4.2-04 | V | Titres affichés : priorité 20 ; réanalyse manuelle conservée comme demande explicite. Tests de file. |
| R4.2-05 | V | Travaux déjà demandés du dossier consulté : priorité 35. La navigation seule ne déclenche pas de décodage. |
| R4.2-06 | V | Reste de la bibliothèque : priorité 50. Préemption et reprise testées. |
| R4.3-01 | V | SHA-256 des octets encodés, versions d’analyse et validation des références Windows avant lecture. Tests `analysis-store`, `library-index`. |
| R4.3-02 | V | BPM conservé dans le cache d’analyse. Tests de sérialisation et cache. |
| R4.3-03 | V | Tonalité conservée ; une correction manuelle reste prioritaire. Recette n° 4. |
| R4.3-04 | P | Grille et corrections conservées ; la reconstruction d’une grille à tempo variable manque toujours. |
| R4.3-05 | P | Repères IN/OUT calculés par énergie ou corrigés manuellement ; validation musicale des points toujours ouverte. |
| R4.3-06 | P | Structure énergétique conservée ; identification sémantique des phrases, voix et drops absente. |
| R4.3-07 | V | Énergie et enveloppes sérialisées dans le cache natif. Tests `analysis-store`. |
| R4.3-08 | V | Ondes précalculées sauvegardées, cache natif gzip puis IndexedDB en repli. Tests de cache. |
| R4.3-09 | V | Cues, favoris, grille, tonalité et régions manuelles conservés lors de la réanalyse, du redémarrage et associés au contenu connu. Tests `library-imports`, `library-index` et recette n° 4. |
| R4.3-10 | P | Cache stems existant, mais pas de gestionnaire unifié ni d’optimisation complète de sa préparation. |
| R4.3-11 | V | Clés et résultats versionnés ; cache incompatible ou corrompu ignoré. Tests `analysis-store`. |
| R4.4-01 | P | Navigation et table paginées ; la réponse native attend encore les métadonnées du dossier et reste plafonnée à 2 000 entrées. |
| R4.4-02 | A | Pas d’analyse audio passive par simple consultation d’un dossier. Import, chargement ou réanalyse explicite nécessaires. |
| R4.4-03 | P | Actualisation du dossier actif ; pas de surveillance récursive globale de la collection. |
| R4.4-04 | P | Rafraîchissement manuel ou toutes les 15 s quand le dossier est visible et disponible. Recette n° 6 ; aucun watcher global. |
| R4.4-05 | V | Progression, états, pause, reprise, annulation et mémoire des originaux visibles. Recettes n° 1–3. |
| R4.4-06 | V | Réanalyse par titre sans remplacer la source en lecture, ni effacer les corrections. Recette n° 4. |
| R4.4-07 | V | États distincts : découvert, en attente, décodage, analyse, prêt, indisponible/erreur ; Remote reçoit la disponibilité. |
| X4-01 | P | Priorités dynamiques, un décodage à la fois, pause du fond selon l’activité audio et budget PCM souple. Pas de mesure réelle de charge CPU/GPU ni d’ordonnanceur stems unifié. |
| X4-02 | P | Catalogue natif et analyses compressées, limite de cache et invalidation par contenu/version ; gestion globale des gros objets/stems encore incomplète. |

## Conditions et limites de la recette

- Six scénarios du banc `test:library:windows` : catalogue initial de 1 000 références, priorité de chargement, annulation pendant lecture, reprise avec nouveaux tokens et autre port serveur, réanalyse préservant la source, récupération du PCM et rafraîchissement du dossier sans lecture audio.
- Quatre scénarios du banc `test:audio:windows` : lecture des MP3 et mesures réelles, Remote appairé, comparaison AudioWorklet, rendu de continuité de 12 s. Aucun silence de 50 ms ni échantillon non fini dans le passage mesuré ; ce n’est pas une comparaison d’écoute des styles de transition.
- Cache natif : 500 résultats ou 128 Mio. Budget des originaux décodés : 384 Mio, souple ; platines et ressources stems actives protégées. Ce chiffre ne limite pas la mémoire totale du processus.
- Les références et checkpoints natifs ne dépendent plus du port localhost. Les fichiers navigateur restent soumis à une nouvelle sélection après fermeture ; les pochettes conservent leur cache historique distinct.
- Les rapports locaux générés contiennent les mesures détaillées. Les musiques et données personnelles ne sont pas distribuées avec le dépôt.
- Les dix scénarios passent également depuis le code inclus dans `app.asar`. Les 129 fichiers applicatifs correspondent aux sources testées ; l’archive commune aux deux exécutables passe son contrôle d’intégrité. Empreintes dans les [notes de version](CHANGELOG-0.19.0.md). L’installation sur le profil personnel n’a pas été exécutée.

## Section 3 — points revus dans le lot C

Cette mise à jour vise les familles EQ, relais harmonique, filtre, Whoosh et Echo Out. Les autres états de la section 3 conservent le périmètre du registre initial.

| Référence | État actuel | Résultat et limite |
| :--- | :---: | :--- |
| R3.constats-02, R3.constats-03, R3.constats-06 | T | Construction des volumes/filtres remaniée et rendus comparables générés. La qualité musicale et l’équivalence perceptive avec les références ne sont pas certifiées par les mesures. |
| R3.constats-04 | P | Variation commune mesurée dans les rendus ; l’appréciation de sa dynamique reste à valider à l’écoute. |
| R3.3.D-01 | V | Rendus avec maintien de hauteur et variation commune 110 → 98 et 98 → 110 BPM. `qa-transitions-windows.cjs`. |
| R3.2-04, R3.1-12, R3.1-13 | P | Place réservée en secondes natives à partir du nombre de temps pendant le morphing ; IN/OUT manuels conservés. La pertinence sémantique des repères reste ouverte. Tests `transition-score`. |
| R3.2-05 | P | Durée bornée par l’audio disponible à vitesse moyenne, puis partition adaptée à la durée réellement exécutée. Pas de détection de phrases. |
| R3.2-06, R3.3.D-06 | P | Tonalités éloignées : choix d’un filtre/écho avec chevauchement limité, sans rejeter un tempo commun valide. Le repli sans morphing reste actif si le tempo est incertain. Tests `automatic-fx` et `transition-score`. |
| R3.2-08 | V | Partition en temps séparée de son ordonnanceur AudioParam ; mêmes repères pour volumes, graves, filtre, capture d’écho et étapes. `transition-score.mjs`. |
| R3.2-09, R3.constats-05 | P | Effets programmés sur l’horloge audio ; phase du transport vérifiée pendant les rampes. Les décalages acoustiques du time-stretch et les underruns ne sont pas couverts par cette mesure. |
| R3.2-10, R3.6-04 | V | Les rendus contrôlent la poursuite du titre entrant à sa vitesse native après le passage, dans le périmètre des fichiers et choix testés. |
| R3.3.A-03 | V | Courbes complémentaires à puissance constante, dans les deux directions. Tests `transition-score` et `engine`. |
| R3.3.A-04, R3.3.B-02, R3.3.B-04 | V | Relais des graves commun, courbes complémentaires en amplitude et automation EQ. Les boosts de médiums ne sont plus nécessaires à ce relais. |
| R3.3.A-02, R3.3.B-03 | A | La grille place le relais sur une mesure ; elle n’identifie pas encore une véritable frontière de phrase musicale. |
| R3.3.B-05 | P | Courbes internes partagées et trim existant ; édition intégrale des courbes non livrée. |
| R3.3.C-04, R3.3.C-05 | P | Le groove sortant reste présent avant la montée filtrée ; le titre entrant atteint son niveau au relais. Aucun détecteur de buildup/drop. |
| R3.3.C-01, R3.3.C-07 | A | Pas de reconnaissance sémantique ni de calage garanti sur un drop détecté. |
| R3.3.D-02 | T | Maintien de hauteur activé dans les rendus ; la qualité perceptive doit être jugée sur les extraits. |
| R3.3.D-03 | A | Pas de sélecteur de courbes d’accélération/décélération ; la rampe commune reste linéaire. |
| R3.3.D-04 | P | Intégrale commune et divisions d’écho cohérentes ; fiabilité limitée par l’estimation des beats des morceaux. |
| R3.3.E-01, R3.3.E-02, R3.3.E-03, R3.3.E-04 | V | Capture des dernières pulsations, feedback borné, filtre et queue d’écho programmés. L’écho discret du relais harmonique est conservé et testé. |
| R3.3.E-05 | T | Aucun silence de 50 ms ni saturation sur les rendus mesurés ; cela ne certifie pas une impression de niveau homogène sur toute une collection. |
| R3.7-03, R3.7-08, R3.7-09 | V | Prévisualisation, étapes et repères d’onde utilisent la partition et l’intégrale de tempo du moteur. |
| R3.7-10, X3-01 | P | Partition exécutable et aperçu de volume avec marqueur RELAIS ; éditeur complet et planificateur sémantique non livrés. |

Le banc bibliothèque attend désormais que le bouton de pause soit visible avant de le déclencher : la découverte du catalogue précède l’initialisation de l’import. Il vérifie ainsi un contrôle accessible à l’utilisateur. Remote sert et teste les nouvelles dépendances de son composant d’onde.

La recette finale du lot C passe aussi depuis `app.asar` : six scénarios bibliothèque, neuf rendus de transitions et quatre audio/Remote. Les 130 fichiers applicatifs correspondent aux sources testées ; installateur et portable ont le même contenu et leur archive passe le contrôle d’intégrité. [Empreintes et périmètre](CHANGELOG-0.20.0.md).

## Sections 2 et 3 — points revus dans le lot D

Le calage acoustique est mesuré en sortie du maintien de hauteur, en complément des horloges du lot C. Le profil Standard reste le défaut ; Rythme est un choix au repos dans Régie → Master, mémorisé et disponible sur Remote.

| Référence | État actuel | Résultat et limite |
| :--- | :---: | :--- |
| R2.1-02, R3.2-09, R3.constats-05 | P | 16 cas à 44,1/48 kHz : tempo égal, beatmatch fixe et rampes dans les deux directions, avec référence sans traitement. Écart par corrélation au plus 13 ms Standard et 5 ms Rythme sur ces pulsations ; résolution 1 ms. Pas de validation d’alignement universel, de dérive longue ou de pertes de blocs. |
| R2.1-05 | P | La latence calibrée du profil est utilisée par les voix et les positions du moteur ; les repères utilisent toujours le temps natif. Pas de campagne vidéo/audio sur tous les gestes et appareils. |
| R2.1-06, R3.3.D-02 | P | Deux profils réels, appliqués au constructeur avant traitement et mesurés par la même calibration. Environ 131–133 ms Standard et 59 ms Rythme. Le compromis de timbre et la qualité d’écoute restent à valider selon les morceaux. |
| R2.1-03, R2.1-07 | P | Réglage interdit pendant lecture, scratch, freinage, transition ou démarrage. Un lancement pendant la calibration attend sa fin et reste annulable. Échec de calibration : ancien profil conservé. Cela ne mesure pas la latence complète d’une commande ni du matériel audio. |
| R3.2-08 | V | La partition conserve le contrôle des opérations internes ; ses changements de vitesse et de boucle ne s’annulent pas eux-mêmes. Les gestes manuels gardent leur annulation. Tests de régression de transport et transitions. |

Le réglage est contrôlé par les éléments réellement accessibles de Régie → Master. Les tests PC/Remote passent par le preload et le chemin IPC de production, avec lecture d’un MP3 et redémarrage du renderer. Une course d’annulation pendant calibration/démarrage a été reproduite et corrigée sans interrompre une source manuelle plus récente. La revue ciblée ne relève plus de problème important. Le contraste du nouveau composant a été vérifié dans les deux thèmes après correction de Porcelaine.

Les relevés synthétiques sont publiés dans [KEYLOCK-MEASURES-0.21.json](KEYLOCK-MEASURES-0.21.json). Ils ne contiennent aucun fichier musical ni donnée personnelle. La recette du paquet et ses empreintes sont consignées dans les [notes 0.21.0](CHANGELOG-0.21.0.md).

Les 48 scénarios passent depuis le code embarqué. Les 136 fichiers applicatifs correspondent aux sources testées et les deux exécutables ont le même contenu, contrôlé par intégrité. L’installation sur le profil personnel reste distincte de cette recette. Ce lot ferme son plan technique ; il ne clôt pas les autres exigences partielles du registre.

## Section 3 — points revus dans le lot E

| Référence | État actuel | Résultat et limite |
| :--- | :---: | :--- |
| R3.1-03, R3.1-09 | P | Changements durables de niveau, graves et densité spectrale, avec contexte de deux mesures par côté et rejet des accents isolés. Les mesures alimentent des repères d’arrangement ; elles ne constituent pas une reconnaissance de phrases. |
| R3.1-02, R3.1-04 | P | La grille et sa confiance conditionnent la carte. Corrections ½/×2/Tap et premier temps actualisent la carte et restent manuelles. Sur les deux MP3, la stabilité automatique est insuffisante ; les recettes de structure utilisent une grille acceptée explicitement. |
| R3.1-07, R3.1-12, R3.1-13, R3.2-04 | P | Entrée proche d’un changement de groove et sortie dans les dernières mesures actives, avec réserve avant EOF. Les manuels restent prioritaires ; absence de repère fiable : repli énergétique. Deux des quatre rendus utilisent un repère, deux le repli. La pertinence à l’écoute reste à valider. |
| R3.2-08 | V | Phase du relais prise en compte dans la quantification du départ, y compris score de quatre temps. Les repères gardent leur précision complète ; régression moteur dans les deux sens de tempo. |
| R3.2-09 | P | Les quatre rendus de régions retrouvent le relais prévu dans le moteur natif. Cela ne mesure ni la qualité automatique de la grille, ni les pertes de blocs sous toutes charges. |
| R3.3.A-02, R3.3.B-03 | P | Un relais peut rejoindre un changement d’arrangement mesuré, au lieu d’une mesure régulière sans autre indice. La frontière sémantique d’une phrase n’est pas identifiée. |
| R3.7-03, R3.7-08, R3.7-09 | V | Onde RGB du panneau d’analyse, marques partagées PC/Remote et liste de préparation reliées aux données et au moteur. Navigation et IN/OUT validés ; identité de piste contrôlée avant action. |
| R3.1-08, R3.1-10, R3.1-11 | A | Aucun détecteur sémantique de buildup/drop, voix ou partie instrumentale n’est livré. |

Le panneau est contrôlé dans deux thèmes à 1440 et 480 px ; les repères sont aussi affichés sur Remote à 390 px. La revue a reproduit et permis de corriger une quantification décalant le relais, ainsi qu’une commande de panneau obsolète agissant sur une piste remplacée. Les régressions correspondantes passent.

Le cache des régions passe en version 2 ; l’identité du contenu reste son digest audio. Une migration native du catalogue, avec préparation localStorage supprimée, conserve le BPM et les IN/OUT manuels sans lecture automatique. Deux tests couvrent aussi le rapprochement entre versions et le rejet de préparations identifiant des octets différents. Les autres fonctions de bibliothèque restent dans le périmètre du lot B.

Les grilles automatiques des deux MP3 restent un écart prioritaire. Le suivi ne compte pas leur correction manuelle comme une résolution de l’estimation automatique. [Recettes, capture et distribution](CHANGELOG-0.22.0.md).

Le paquet est contrôlé : 140 sources comparées, 60 cas natifs réussis, ressources vérifiées et archive identique dans les deux exécutables, avec intégrité validée. Un délai initial du banc bibliothèque n’a pas été reproduit pendant trois recettes instrumentées ; les reprises et la cause non confirmée restent consignées, sans déclarer un défaut corrigé.

## Prochain travail prioritaire

1. Automix musical : approfondir la fiabilité de grille sur les fichiers réels, les phrases et les points de passage, puis valider les rendus à l’écoute. Les changements d’arrangement du lot E complètent les régions ; les nouveaux modes et la reconnaissance sémantique restent ouverts.
2. Préparation audio : stems hors du thread interface, budgets de calcul et tests de ressources manquantes/longues sessions.
3. Brancher progressivement la [refonte UI](REFONTE-UI.md) sur les états réels. La maquette navigable utilise toujours des données illustratives ; sa présence ne signifie pas que la nouvelle console est intégrée.
4. Poursuivre les sections restantes du registre, notamment scratch waveform, playlists, mises à jour et validation acoustique micro.

Chaque prochain lot devra apporter son code exécuté, sa recette et ses limites avant de changer les états correspondants.
