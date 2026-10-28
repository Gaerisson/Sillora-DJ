# Maintien de hauteur — profil Rythme

## Intention et choix

Le tempo affiché peut être parfaitement aligné alors que le time-stretch déplace légèrement les attaques. Le relevé initial sur pulsations isolées donne jusqu’à 13 ms d’écart entre platines, avec environ 131 ms de latence du traitement à 44,1 kHz. Le chemin sans time-stretch est aligné à la résolution de mesure de 1 ms.

Le réglage **Standard** conserve le traitement actuel. Une option **Rythme** utilise une fenêtre de 48 ms, une recherche de 12 ms et un recouvrement de 8 ms, avec recherche complète. Sur le banc exploratoire, elle donne environ 59 ms de latence et au plus 5 ms d’écart de corrélation entre pulsations. Ce sont des mesures de ce signal synthétique, pas une garantie sur toute musique.

Choix d’implémentation : appliquer le profil dans le constructeur du processeur, avant le premier bloc. Une correction constante de position ne traite pas la variation des attaques. L’envoi de paramètres par message asynchrone peut arriver après les premiers blocs et désaccorder le traitement et sa calibration ; cette approche est écartée. L’adaptateur synchrone réutilise le DSP livré et conserve ses sources, notices et licence.

Le profil est mémorisé. Son changement est autorisé lorsque les platines sont arrêtées et qu’aucun démarrage, scratch ou passage n’est en cours. La calibration et le processeur utilisent le même profil. Un lancement demandé pendant la calibration attend sa fin ; il peut toujours être annulé. Les entrées micro ne sont pas interrompues.

## Plan de réalisation

- [x] Contrat natif en échec puis réussi : le profil Rythme est réellement appliqué et sa latence mesurée est inférieure à 80 ms sur le banc.
- [x] Profils validés dans `public/keylock-profiles.mjs`, processeur adapté par `scripts/vendor-audio.mjs`, wrapper `public/keylock-node.mjs`.
- [x] Calibration et création des voix intégrées dans `public/engine.js`, tests de changement au repos, d’attente/annulation et d’erreurs.
- [x] Sélection et latence mesurée dans le studio et Remote, persistance et commandes validées.
- [x] Mesures acoustiques à 44,1/48 kHz, changements de tempo dans les deux sens et rendus sur vrais MP3 avec les deux profils.
- [x] Recettes de régression, revue de code, suivi de l’audit et paquet Windows vérifié.

Le profil Standard reste la référence de non-régression. La reconnaissance des phrases et des voix, les pilotes matériels et la qualité perceptive de tous les styles ne sont pas validés par ce banc. Le profil plus court est une option, car le compromis entre précision des attaques et timbre doit aussi être jugé à l’écoute.

## Reproduction et sécurité des commandes

`npm run test:keylock:windows` rend 16 cas sans musique personnelle. Les critères portent sur le signal prélevé après le traitement : pas d’échantillon non fini, pas de saturation, maintien de hauteur disponible, corrélation et différence d’attaques bornées. [Relevés du banc](KEYLOCK-MEASURES-0.21.json).

`npm run test:keylock-ui:windows -- "piste.mp3"` utilise le moteur, le preload et le chemin IPC réels. Il contrôle le réglage accessible dans Régie → Master, le verrouillage pendant la lecture du MP3, la commande du téléphone et la mémorisation après rechargement, sans lecture automatique.

La revue a reproduit une course d’annulation pendant la calibration. Le moteur contrôle désormais la génération de la demande et l’identité des sources après les opérations asynchrones. Une source plus récente lancée manuellement est préservée. Les opérations de préparation propres à la transition ne s’annulent pas elles-mêmes ; les commandes utilisateur continuent d’annuler le passage.

Le nouveau sélecteur utilise les couleurs du thème. Un défaut de contraste en Porcelaine a été reproduit puis corrigé ; les deux thèmes ont été contrôlés avec les commandes de l’application.

## Rendus musicaux

Les deux profils passent chacun neuf rendus de 26 s sur deux MP3 distincts. Whoosh, filtre et automatique sont exercés dans les deux directions 110 → 98 et 98 → 110 BPM ; EQ, Echo Out et relais harmonique complètent chaque matrice. Aucun échantillon non fini, aucune saturation ni fenêtre silencieuse de 50 ms n’est relevé dans les passages mesurés. Le titre entrant continue à sa vitesse native. Ces critères vérifient le fonctionnement du signal et du transport, pas la préférence d’écoute.

La recette est relançable avec `npm run test:transitions:windows -- "piste-A.mp3" "piste-B.mp3"` pour Standard. Ajouter `--rhythm` avant les deux chemins pour Rythme, comme dans les [commandes de validation](CHANGELOG-0.21.0.md). Le second lancement remplace les résultats de la première exécution dans `.runtime/transition-proof/results` ; les conserver séparément pour une comparaison.

Les 261 tests automatisés et les 48 scénarios natifs passent. Les 48 scénarios sont exécutés depuis le code embarqué dans `app.asar`, comparé aux 136 fichiers applicatifs locaux. Les exécutables partagent le même contenu et leur archive passe le contrôle d’intégrité. [Empreintes et limites de la distribution](CHANGELOG-0.21.0.md).
