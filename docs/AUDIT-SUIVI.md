# Suivi de l’audit — Sillora DJ 0.20.0

Mise à jour du 28 octobre 2026. Le [registre initial de 374 points](AUDIT-REFONTE.md) reste une photographie de la 0.17.0. Ce suivi décrit les évolutions effectivement testées depuis cette base. Il ne requalifie pas les autres sections et ne mesure pas un pourcentage d’achèvement.

## Lots réalisés

| Lot | Application modifiée | Preuves et périmètre |
| :--- | :--- | :--- |
| A · 0.18.0 | Mesures stéréo réelles, continuité pendant une préparation tardive, déconnexion Remote | 225 tests ; quatre scénarios Electron/audio. [Détail et limites](CHANGELOG-0.18.0.md) |
| B · 0.19.0 | Catalogue immédiat, import prioritaire et reprenable, cache natif, réanalyse, pagination | 246 tests ; six scénarios bibliothèque et quatre scénarios audio/Remote sous Electron. [Détail et recette](CHANGELOG-0.19.0.md) |
| C · 0.20.0 | Partition commune des transitions, relais des graves, variation de tempo et repères cohérents | 254 tests ; neuf rendus avec maintien de hauteur, six scénarios bibliothèque et quatre audio/Remote. [Déroulement et limites](TRANSITIONS-0.20.md) |

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

## Prochain travail prioritaire

1. Automix musical : approfondir les phrases et les points de passage, mesurer le décalage acoustique du time-stretch, puis valider les rendus à l’écoute. Le plan commun est intégré aux familles du lot C ; les nouveaux modes et la reconnaissance sémantique restent ouverts.
2. Préparation audio : stems hors du thread interface, budgets de calcul et tests de ressources manquantes/longues sessions.
3. Brancher progressivement la [refonte UI](REFONTE-UI.md) sur les états réels. La maquette navigable utilise toujours des données illustratives ; sa présence ne signifie pas que la nouvelle console est intégrée.
4. Poursuivre les sections restantes du registre, notamment scratch waveform, playlists, mises à jour et validation acoustique micro.

Chaque prochain lot devra apporter son code exécuté, sa recette et ses limites avant de changer les états correspondants.
