# Ondes interactives — 0.24

## Commandes livrées

Chaque platine propose **Déplacer / Scratch** au-dessus de son onde détaillée. Déplacer garde la navigation absolue. Scratch saisit la tête audio à sa position actuelle : le clic ne saute pas vers un autre endroit du titre. Glisser vers la droite revient en arrière ; glisser vers la gauche avance. Le mode s’applique aussi à l’onde verticale de la même platine. L’aperçu global et la vue Automix restent des outils de navigation.

La sensibilité de l’onde se règle à ½×, 1×, 1,5× ou 2×, indépendamment du vinyle. Mode et sensibilité sont conservés par platine, séparément sur le PC et sur chaque navigateur Remote. Le calcul du geste conserve le titre, la sensibilité et l’échelle capturés au départ. L’affichage continue de suivre la tête audio réelle.

Le son passe par le vrai lecteur bidirectionnel AudioWorklet existant. Au relâchement, une platine en pause reste en pause ; une platine en lecture reprend depuis la tête effectivement rendue, avec son tempo. Le scratch utilise le mix original et reprend le dosage des stems ensuite, comme le vinyle. Il quitte la boucle active et interrompt un passage Automix.

## Remote

Le téléphone utilise des cibles audio absolues, regroupées en première/dernière commande quand une réponse est encore attendue. Il ne rejoue pas une accumulation de petits déplacements après le geste. Un maintien périodique conserve la prise tant que la main reste immobile. Le son reste produit sur le PC ; le réseau conserve sa propre latence.

Chaque prise possède un identifiant, en plus de l’identité du titre. Une commande ancienne ne peut déplacer ni terminer une prise plus récente sur le même titre. Le retour du démarrage conserve la position réellement saisie dans le moteur. La génération de l’identifiant fonctionne également sur l’origine HTTP du réseau local.

Après mise à jour du studio, recharger l’onglet Remote pour utiliser les nouvelles commandes de prise.

Le contrôle de session et le délai de secours évitent qu’une commande différée termine une session locale plus récente. Une perte de connexion peut libérer le geste ; elle ne constitue pas une liaison de scratch à latence garantie. Les contrôleurs matériels et les réglages complets d’inertie/vitesse du vinyle restent ouverts.

## Vérification

Les tests couvrent le clic sans saut, les deux directions, le relâchement avant initialisation, les commandes regroupées, le remplacement d’un titre, l’annulation, la perte de focus, les bornes et les réglages. Trois défauts Remote détectés en revue ont d’abord été reproduits : perte de la position dans l’accusé de réception, absence d’identité de prise et maintien immobile sans intervalle valide.

Les dix scénarios natifs passent depuis les sources et depuis le paquet, sur deux MP3 puis deux Opus du corpus : déplacement, vrai signal de scratch mesuré, reprise de lecture/tempo, onde verticale, relâchement rapide, remplacement pendant préparation, deux thèmes à 1440/480 px, téléphone appairé, maintien immobile en lecture et persistance. La recette attend le rendu du compositeur avant de capturer après redimensionnement ; les éventuelles reprises de capture sont consignées séparément des contrôles fonctionnels.

```powershell
npm run test:gestures:windows -- "piste-A.mp3" "piste-B.mp3"
```

Les profils sont isolés dans `.runtime/wave-gesture-proof`. Cette recette ne mesure ni la latence matérielle complète, ni les pertes de blocs sur de longues sessions. Le libellé non sélectionné de Remote atteint un contraste mesuré de 6,27 sur Porcelaine, après correction du repli de couleur du thème. Le contrôle de distribution est consigné dans les [notes 0.24](CHANGELOG-0.24.0.md).
