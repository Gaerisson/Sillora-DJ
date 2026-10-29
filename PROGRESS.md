# Sillora DJ — suivi de la refonte

État au 29 octobre 2026. Version de départ : 0.16.1 ; version courante : 0.32.0. Les premiers lots ci-dessous conservent leurs constats historiques.

## Objectif

Améliorer en priorité le résultat audio et la continuité de lecture. Préserver les fonctions existantes. La présence d'une commande dans l'interface ne vaut pas validation de son comportement.

Les constats et résultats des premiers lots ci-dessous sont historiques. Pour l’état courant : [suivi de l’audit](docs/AUDIT-SUIVI.md) et derniers lots en fin de document.

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

## Lot A — continuité et mesures réelles — 0.18.0

Le développement de l'application reprend après la proposition UI. Ce lot modifie le moteur et le studio exécuté ; la maquette reste distincte.

- Mesures AudioWorklet L/R indépendantes : master après limiteur et platines avant crossfader, après EQ/effets directs/volume/trim. RMS, sample peak, peak hold, clipping mémorisé et invalid samples ; aucun faux true peak ni compteur d'underruns.
- Composant de mètre partagé entre PC et Remote, valeurs du même moteur, signalement d'indisponibilité et effacement à la déconnexion. Remise à zéro locale des maintiens et compteurs avec PEAK.
- Correction d'une course Remote : les réponses de polling et de flux arrivées après déconnexion ne réactivent plus l'affichage. Vérifiée dans la télécommande appairée.
- Secours armé avant EOF pendant un import/préparation en cours : maintien court du morceau avec microfondus audio de 4 ms aux raccords, puis relais EQ court lorsque le titre suivant est prêt. Les boucles manuelles restent prioritaires ; pause/seek/rechargement/arrêt retirent le secours.
- Budget de 30 s sous surveillance du planificateur, sans réarmement permanent. L'expiration dépend encore de la reprise du planificateur si l'interface reste bloquée. Un set terminé n'est pas remis en boucle.
- Versions PC, serveur et Remote harmonisées sur 0.18.0. Les preuves de l'audit initial sont figées sur le commit de référence 0.17.0 pour conserver des lignes de code vérifiables après évolution.

Validation : **225 tests automatisés**, lecture des deux MP3 sous Electron, vraie mesure stéréo avec programme droit coupé sur Remote 390×844, rendu AudioWorklet comparé sans branche de mesure (écart maximal 0). Rendu musical de 12 s : secours au-delà de la fin initiale, relais après préparation tardive, aucune valeur non finie ni fenêtre silencieuse de 50 ms dans le passage mesuré de 0,1 à 10 s ; crête maximale inférieure à 0,937. Les essais ont aussi révélé puis permis de corriger un montage DOM incompatible avec une collection d'éléments. Les fichiers musicaux restent hors du dépôt.

Voir [les notes et limites 0.18.0](docs/CHANGELOG-0.18.0.md). La validation du paquet Windows est consignée séparément avec ses empreintes. Le branchement complet de la nouvelle interface, les analyses sémantiques, les imports reprenables, les sessions prolongées et la comparaison d'écoute des références restent ouverts.

Le banc Windows est relançable depuis les sources avec `npm run test:audio:windows -- "piste-A.mp3" "piste-B.mp3"` (deux morceaux distincts de plus de 52 s). Il génère son rapport et son rendu dans `.runtime/audio-proof/results`, sans données musicales distribuées. Il a été exécuté avec succès sur les deux fichiers fournis ; les mêmes quatre scénarios passent depuis les sources incluses dans `app.asar`.

## Lot B — bibliothèque et préparation — 0.19.0

Catalogue distinct des buffers audio, découverte avant décodage et file d’import prioritaire intégrés au studio exécuté. Les demandes de platine passent devant le fond, puis viennent le prochain titre, la file Automix, les titres affichés, le dossier consulté et le reste de la collection.

- Import avec pause, reprise, annulation et relance ; catalogue/checkpoint natif sans PCM ni tokens, références Windows revalidées au retour, aucune lecture automatique après redémarrage.
- Cache d’analyse natif compressé identifié par contenu et version, indépendant du port serveur ; IndexedDB reste un repli navigateur.
- Réanalyse manuelle préservant grille, régions, cues, tonalité et favoris, sans remplacer la source en lecture. Association des préparations au contenu connu.
- Pagination à 100 lignes dans bibliothèque et dossiers, filtre conservé à l’actualisation ; nouveaux fichiers découverts sans décodage passif.
- Budget souple de PCM original avec protection des platines et stems actifs, recharge à la demande et pause des analyses de fond pendant transition/scratch.
- Disponibilité des titres et chargements transmis à Remote.

Validation : **246 tests réussis** ; **six scénarios Electron bibliothèque** et **quatre audio/Remote**, sur deux vrais MP3. Le catalogue de 1 000 références du banc réutilise ces deux fichiers ; ce n’est pas une analyse de 1 000 titres distincts. Reprise native vérifiée avec nouveaux tokens et changement de port. La recette de réanalyse conserve la source audible et toutes les corrections testées. Les bancs sont relançables depuis les sources, avec profils isolés.

Le suivi [AUDIT-SUIVI.md](docs/AUDIT-SUIVI.md) revoit les exigences de la section 4 sans réécrire la baseline de 374 points. [Notes et limites 0.19.0](docs/CHANGELOG-0.19.0.md). La validation du paquet Windows est consignée séparément avec ses empreintes avant remise des exécutables.

Restent notamment l’indexation récursive, l’analyse passive du dossier consulté, les budgets de charge CPU/GPU et la préparation stems complète. L’appel natif en cours peut finir après annulation ; les fichiers glissés/navigateur nécessitent une nouvelle sélection au redémarrage.

## Suite du document

Priorité au planificateur musical et à la comparaison des transitions sur les références : phrases, tempo, graves, effets et points IN/OUT. La grille variable et l’identification sémantique restent ouvertes. Le branchement complet de la nouvelle UI, le scratch sur waveform, les playlists, les updates et les validations longues/acoustiques ne sont pas livrés par le lot B.

## Lot C — partition musicale et relais — 0.20.0

Partition commune en temps pour EQ, relais harmonique, filtre, Whoosh et Echo Out : relais des graves, volume, capture d’écho, filtre et étapes affichées. Le groove reste présent pendant la préparation du filtre ; le nouveau titre arrive sur le relais. Calcul de place avant EOF par vitesse moyenne pendant le morphing, et repères d’onde en temps natif du fichier.

La revue indépendante a relevé la perte de l’écho discret du relais harmonique lors de la migration vers la partition. Un test ciblé a reproduit cette absence ; le send, les réglages et le nettoyage de l’écho ont été rétablis dans la partition. Le test passe. Les essais ont aussi trouvé une dépendance statique manquante de Remote ; sa liste d’assets est corrigée et son graphe d’imports est testé.

Une première matrice de huit rendus sur les deux MP3 passe, avec maintien de hauteur, dans les deux sens pour filtre/Whoosh/automatique. Une comparaison avec le paquet 0.19 utilise les mêmes fichiers et les mêmes repères manuels ; elle mesure un signal modifié, pas une qualité d’écoute. La recette finale compte neuf rendus, avec le relais harmonique et son écho restauré. Les 254 tests, les six scénarios bibliothèque et les quatre audio/Remote passent. Distribution Windows construite et vérifiée : même contenu dans les deux exécutables, contrôle d’intégrité de 7215 fichiers, 130 sources applicatives comparées, 19 scénarios réussis depuis le paquet. L’installation sur le profil personnel n’a pas été exécutée. [Architecture et limites](docs/TRANSITIONS-0.20.md).

## Lot D — alignement acoustique — 0.21.0

- [x] Mesurer le signal après maintien de hauteur, avec une pulsation isolée par canal/platine ; comparer au chemin sans time-stretch.
- [x] Couvrir tempo identique, beatmatch fixe, accélération et ralentissement ; mesurer l’écart entre les attaques réellement rendues.
- [x] Corriger uniquement les défauts reproduits, avec test de régression avant modification du moteur.
- [x] Rejouer les recettes concernées et la suite complète, puis faire relire les changements.
- [x] Documenter les résultats et les limites dans l’audit ; distribuer une nouvelle version si le moteur change.

La mesure des horloges du transport du lot C ne prouve pas l’alignement acoustique. Les pulsations prélevées après Key Lock montrent jusqu’à 13 ms d’écart par corrélation en Standard. Le profil optionnel Rythme mesure environ 59 ms de latence de traitement et au plus 5 ms d’écart de corrélation, avec 6 ms d’écart d’attaque sur ce banc ; Standard conserve environ 131–133 ms et reste le défaut. La résolution de mesure est de 1 ms. Aucun résultat de latence matérielle, d’underruns ou de qualité perceptive universelle n’en est déduit.

Le réglage partagé PC/Remote est accessible dans Régie → Master, mémorisé et verrouillé pendant les opérations de lecture. Le profil est appliqué avant le premier bloc du processeur et la calibration utilise les mêmes paramètres. La commande Remote traverse le vrai chemin preload/IPC. Les quatre scénarios UI passent avec un MP3 réel ; les 16 mesures acoustiques et les neuf rendus de transitions Standard passent également. La suite compte 261 tests réussis.

La revue indépendante a détecté une annulation tardive qui pouvait laisser démarrer le titre entrant. Le cas a été reproduit puis corrigé, avec préservation d’une source plus récente lancée par l’utilisateur. Les opérations internes de préparation utilisent leur propre contrôle d’annulation ; la suite complète et la revue ciblée passent après correction. Le sélecteur Porcelaine a aussi été corrigé après une mesure de contraste insuffisante, puis contrôlé avec les commandes du thème.

La distribution Windows 0.21.0 est construite et vérifiée. Les 136 sources applicatives correspondent au code embarqué ; les 48 scénarios passent depuis `app.asar` : 16 mesures acoustiques, quatre PC/Remote, 18 rendus musicaux, six bibliothèque et quatre continuité/audio. Les deux exécutables embarquent le même contenu, dont l’archive de 7 215 fichiers passe le contrôle d’intégrité. Les ressources natives vérifiées correspondent aux ressources préparées. L’installation sur le profil personnel n’a pas été exécutée. [Architecture et banc reproductible](docs/KEYLOCK-0.21.md) · [Notes et empreintes](docs/CHANGELOG-0.21.0.md).

## Lot E — repères d’arrangement — 0.22.0

[Périmètre](docs/ARRANGEMENT-0.22.md) · [Plan et décisions](docs/superpowers/plans/2026-10-28-arrangement.md).

- [x] Détecteur conservateur de changements durables sur les caractéristiques mesurées, tests et persistance.
- [x] IN/OUT automatiques et relais du score sur les repères, manuel prioritaire et réserve avant EOF.
- [x] Marques PC/Remote et préparation accessible dans le panneau d’analyse exécuté.
- [x] Revue, recettes musicales natives, distribution vérifiée et audit actualisé.

Les 282 tests, les huit scénarios natifs de préparation et quatre rendus de régions passent depuis les sources. Le panneau est contrôlé en Obsidian/Porcelaine à 1440 et 480 px ; Remote affiche les repères à 390 px. La revue a permis de reproduire puis corriger un départ mal quantifié et des actions d’analyse sur une piste remplacée. La migration de cache conserve les préparations par digest ; le banc recharge les corrections du catalogue avec le repli localStorage supprimé et sans lecture automatique.

Les grilles automatiques des deux MP3 restent peu fiables : les essais de structure utilisent une correction explicite. Deux rendus suivent un repère et deux restent sur le repli énergétique. La qualité d’écoute et la reconnaissance automatique des phrases ne sont pas déclarées acquises.

Distribution 0.22.0 construite : 140 sources comparées et 60 cas natifs réussis depuis le paquet, dont 22 rendus musicaux. Les deux exécutables ont le même contenu et l’archive commune de 7 215 fichiers passe le contrôle d’intégrité. Ressources embarquées et versions vérifiées ; installation sur le profil personnel non exécutée.

Le premier passage du banc bibliothèque a expiré sur un chargement prioritaire. Trois recettes complètes instrumentées passent ensuite sans changement du code ; cause non confirmée, observation conservée avec les reprises dans les preuves. Les essais prolongés/sous charge restent ouverts. [Notes et empreintes](docs/CHANGELOG-0.22.0.md).

## Lot F — fiabilité de grille — 0.23.0

[Diagnostic et résultats](docs/GRID-0.23.md). La couverture des attaques diminuait directement le score de stabilité. Le lot sépare précision et densité, avec contrôles de contraste de phase, nombre et étendue des observations ; la variation de tempo reste pénalisée et les seuils ne sont pas abaissés.

Sur les deux MP3 de référence, les mêmes BPM 110/98 produisent maintenant des grilles automatiques de stabilité 81/90 %, avec cinq/quatre repères. Les quatre rendus Whoosh/automatique passent dans les deux sens sans grille ni régions manuelles. Deux passages suivent un repère, deux le repli énergétique ; le relais réel suit le plan. Les scores internes ne certifient ni la justesse universelle des grilles ni une préférence d’écoute.

Observations et couverture sont visibles dans ANALYSE et sur Remote, avec restauration par le cache natif version 3. Les corrections restent associées au digest du contenu. Les 296 tests passent, y compris une intro dense trop courte ajoutée lors de la relecture par l’auteur. Les deux références sont complétées par un contrôle exploratoire sur trois fichiers sans grille certifiée.

Distribution 0.23 contrôlée : 142 sources comparées, 68 cas natifs réussis dont 26 rendus musicaux, ressources et versions vérifiées. Les deux exécutables ont le même contenu, avec intégrité des 7 215 fichiers validée. L’installation sur le profil personnel n’est pas exécutée. Les phrases/voix/drops, la grille variable, les longues sessions et le branchement complet de la refonte UI restent ouverts. [Notes 0.23](docs/CHANGELOG-0.23.0.md).

## Lot G — ondes interactives et corpus — 0.24.0

Choix Déplacer/Scratch et sensibilité propre aux ondes détaillées, partagés avec la vue verticale et disponibles sur Remote. Départ à la tête actuelle, plage affichée figée, cibles absolues regroupées et conservation de l’état de lecture au relâchement. Les gestes distants possèdent leur identité ; les corrections de la réponse de démarrage et du maintien immobile sont reproduites par des tests avant modification.

Le corpus élargi analyse 99 fichiers Opus sans erreur : 33 grilles acceptées, 66 gardées incertaines, 31 cartes. Aucun taux de justesse n’en est déduit. Huit nouvelles paires couvrent des écarts et confiances différents. Un relais divergent sur grille sortante incertaine a été reproduit : le transport programmé n’arrondit plus ce départ sur une mesure estimée pendant le morphing. La revue indépendante et les tests ciblés passent.

313 tests automatisés et 50 cas natifs depuis le paquet passent : 20 gestes sur MP3/Opus, 20 rendus de transitions, six bibliothèque et quatre continuité/audio. Le paquet final comporte 145 sources comparées, les ressources et versions vérifiées et le même contenu dans les deux exécutables ; intégrité des 7 215 fichiers validée. Le contraste Remote Porcelaine est corrigé et mesuré. L’installation sur le profil personnel n’est pas exécutée. Les fichiers musicaux et profils restent hors du dépôt ; le registre de 374 points conserve sa baseline. [Gestes](docs/GESTURES-0.24.md) · [Corpus](docs/CORPUS-0.24.md).

## Lot H — préparation de grille — 0.25.0

Éditeur réel dans Analyse : zoom, suivi, navigation, décalage précis, phase de mesure, calibration entre deux impacts et brouillon avant application. Retour à l’analyse mesurée, grille et régions automatiques recalculées par le même moteur, IN/OUT manuels conservés et source en lecture inchangée. Les conflits et remplacements interdisent les actions obsolètes ; le catalogue restaure les corrections par contenu sans autoplay. Une course de fermeture/réouverture arrêtant les nouvelles ondes a été reproduite par les captures puis corrigée. Le diagnostic HTTP suit maintenant la version du paquet.

322 tests et 54 cas natifs depuis le paquet final passent. Les 148 sources, les ressources, les versions et le contenu identique des deux exécutables sont vérifiés ; intégrité de l’archive contrôlée. Recette MP3 et Opus, deux thèmes à 1440/480 px, régressions de structure, gestes/Remote, bibliothèque et huit rendus automatiques. Installation personnelle non exécutée. Relecture par l’auteur, sans revue indépendante. Aucune nouvelle annotation musicale certifiée, aucune nouvelle précision automatique revendiquée. [Mode d’emploi](docs/PREPARATION-0.25.md) · [Recette et limites](docs/CHANGELOG-0.25.0.md).

## Lot I — arrivée au relais — 0.26.0

Le titre entrant peut commencer avant un changement durable d’énergie/graves pour que ce repère arrive au relais de la partition. Deux grilles fiables, avance audible et réserve après le relais requises ; IN/OUT manuels prioritaires. Next recalcule son avance et sa phase pour la durée finale. Un passage trop court conserve le repli. Option mémorisée PC/Remote et marqueurs liés à l’identité de piste.

332 tests et 53 cas natifs passent depuis le paquet : six UI/Remote, neuf préparation, dix gestes, six bibliothèque, quatre continuité/audio et 18 rendus, dont douze comparatifs sur trois paires Opus (montée, descente, demi/double). 149 sources, ressources, métadonnées, contenu identique et intégrité des exécutables contrôlés. Installation personnelle non exécutée ; revue par l’auteur. Pas de nouvelles annotations, de précision automatique revendiquée ni de reconnaissance sémantique. [Utilisation](docs/ARRIVAL-0.26.md) · [Mesures](docs/ARRIVAL-MEASURES-0.26.json) · [Recette](docs/CHANGELOG-0.26.0.md).

## Lot J — préparation des stems — 0.27.0

WAV et enveloppes RMS en Worker, transferts/assemblage par blocs, budgets CPU/mémoire décodée/temps mémorisés et partagés PC/Remote. Une seule séparation native ; annulation accessible après remplacement ou rechargement et libération du verrou après fin du processus. Cache v2 vérifié par SHA-256 et formats/horloges, publication atomique et conservation des niveaux. Les stems comptent dans l’éviction PCM des titres inactifs ; les imports de fond attendent. Le modèle et sa qualité d’isolation ne changent pas.

345 tests et 51 cas natifs depuis le paquet passent, dont douze stems avec le modèle embarqué sur huit secondes réelles et un encodage Worker de 180 secondes synthétiques. Les 155 sources, ressources, versions et contenu identique des exécutables sont vérifiés, avec intégrité de l’archive contrôlée. Installation personnelle non exécutée ; relecture par l’auteur. Le calcul reste lent, le modèle et les copies dépassent le budget des stems décodés ; quota disque, morceaux complets et longues sessions restent ouverts. [Réglages](docs/STEMS-0.27.md) · [Mesures](docs/STEMS-MEASURES-0.27.json) · [Recette](docs/CHANGELOG-0.27.0.md).

## Lot K — espaces et travail regroupé — 0.28.0

Navigation réelle entre quatre espaces, bibliothèque redimensionnable, densité et modules mémorisés. Même moteur et source en lecture ; grille/stems et quatre entrées de régie existantes réutilisés. Le lanceur groupe les recettes, réserve la ressource UI, parallélise les tests Node et reprend seulement les résultats aux empreintes intactes. Le build rapide compresse au niveau 1 en conservant les ressources.

353 tests unitaires et 51 cas natifs depuis le paquet passent ; 24 combinaisons vues/tailles/thèmes et 158 sources comparées. Les deux exécutables ont le même contenu, ressources/versions et intégrité vérifiées. Les échecs du parallélisme initial restent documentés. Aucun nouveau DSP ni validation acoustique/longue session revendiqués. La refonte générale reste partielle. [Espaces](docs/WORKSPACES-0.28.md) · [Recettes](docs/QA-BATCH.md) · [Distribution](docs/CHANGELOG-0.28.0.md).

## Lot L — mixage et cache des stems — 0.29.0

Mute/Solo préparés PC/Remote, faders séparés et presets en une commande. Cache géré v2 avec quota, dernier accès, protection active/récente, nettoyage ciblé et politique persistante. Les données de recette participent maintenant aux empreintes et la syntaxe est vérifiée avant Electron. La mémoire de bibliothèque affiche le PCM total.

369 tests unitaires, 52 cas natifs source et 42 depuis le paquet passent. Les 162 sources, ressources et exécutables sont contrôlés. La recette recharge un résultat neuronal réel de huit secondes sans réinférence ; elle ne certifie pas une nouvelle qualité d’isolation. Les corrections de banc et du style Remote sont consignées. Scratch multicanal, sauvegarde des mutes/solos entre sessions, anticipation Automix, anciens caches/gros volumes et longues sessions restent ouverts. [Mixage](docs/STEM-MIX-0.29.md) · [Cache](docs/STEM-CACHE-0.29.md) · [Recette](docs/CHANGELOG-0.29.0.md).

## Lot M — courbes de tempo — 0.30.0

Souple, Linéaire, Anticipée et Tardive pilotent le tempo réel, les deux têtes, le score, les échos et la position Remote. Préférence persistante, aperçu et isolation du passage déjà engagé. 375 tests, 61 cas natifs source et 27 depuis le paquet, avec 24 rendus source sur quatre musiques et 12 rendus rejoués dans le paquet. 164 sources embarquées et exécutables contrôlés. La qualité d’écoute et les phrases restent à valider. [Courbes](docs/TEMPO-CURVES-0.30.md) · [Recette](docs/CHANGELOG-0.30.0.md).

## Lot N — plafond et classement — 0.31.0

Écart maximal de tempo 3 à 20 %, sauvegarde PC/Remote et même politique dans les propositions, le tri compatible et les transitions. Le classement utilise le BPM réel sans modifier le catalogue ; les choix explicites et le passage actif sont conservés. 383 tests, 32 cas natifs source et 20 depuis le paquet. Douze rendus de pulsations contrôlent la phase après maintien de hauteur sur les trois nouvelles courbes ; six rendus MP3 vérifient le repli et le morphing selon la limite. Correction de largeur CSS puis reprise des contrôles d’interface, avec DSP identique. [Utilisation](docs/TEMPO-POLICY-0.31.md) · [Recette](docs/CHANGELOG-0.31.0.md).

## Lot O — phrases préparées — 0.32.0

Annotation jusqu’à 32 points, rôles Entrée/Sortie, édition PC/Remote et marqueurs d’onde. Auto musical calcule l’avance pour atteindre le point cible et respecte une sortie préparée utilisable ; Next, IN/OUT manuels et passage actif gardent leurs priorités. 393 tests, 25 cas natifs source et 19 depuis le paquet passent, dont douze rendus sur quatre titres. Les points de test sont placés sur la grille ; reconnaissance sémantique et validation humaine restent ouvertes. [Préparation](docs/PHRASE-CUES-0.32.md) · [Recette](docs/CHANGELOG-0.32.0.md).
