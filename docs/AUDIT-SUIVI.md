# Suivi de l’audit — Sillora DJ 0.19.0

Mise à jour du 28 octobre 2026. Le [registre initial de 374 points](AUDIT-REFONTE.md) reste une photographie de la 0.17.0. Ce suivi décrit les évolutions effectivement testées depuis cette base. Il ne requalifie pas les autres sections et ne mesure pas un pourcentage d’achèvement.

## Lots réalisés

| Lot | Application modifiée | Preuves et périmètre |
| :--- | :--- | :--- |
| A · 0.18.0 | Mesures stéréo réelles, continuité pendant une préparation tardive, déconnexion Remote | 225 tests ; quatre scénarios Electron/audio. [Détail et limites](CHANGELOG-0.18.0.md) |
| B · 0.19.0 | Catalogue immédiat, import prioritaire et reprenable, cache natif, réanalyse, pagination | 246 tests ; six scénarios bibliothèque et quatre scénarios audio/Remote sous Electron. [Détail et recette](CHANGELOG-0.19.0.md) |

V = couvert dans le périmètre décrit ; P = partiel ; A = à développer ; T = à valider. Les preuves ci-dessous sont les sources et recettes de la 0.19.0. Les tests d’une file simulant 1 000 références utilisent les octets de deux vrais MP3 ; ils ne représentent pas une collection de 1 000 titres distincts analysés intégralement.

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

## Prochain travail prioritaire

1. Automix musical : séparer clairement le plan de transition de son exécution, traiter les phrases et les tempos différents, mesurer puis comparer les rendus sur les références fournies. Les nouveaux modes et la qualité perceptive restent ouverts.
2. Préparation audio : stems hors du thread interface, budgets de calcul et tests de ressources manquantes/longues sessions.
3. Brancher progressivement la [refonte UI](REFONTE-UI.md) sur les états réels. La maquette navigable utilise toujours des données illustratives ; sa présence ne signifie pas que la nouvelle console est intégrée.
4. Poursuivre les sections restantes du registre, notamment scratch waveform, playlists, mises à jour et validation acoustique micro.

Chaque prochain lot devra apporter son code exécuté, sa recette et ses limites avant de changer les états correspondants.
