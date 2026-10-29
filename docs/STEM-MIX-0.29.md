# Mixer les stems — 0.29

Après préparation, activer les stems de la platine pour disposer des faders et des boutons **M / S**. Ils contrôlent le graphe audio réel sur le PC et Remote.

- **M** coupe un groupe sans modifier son fader. Le fader reste réglable ; le rétablissement utilise sa nouvelle valeur.
- **S** isole les groupes sélectionnés. Plusieurs solos peuvent être combinés ; un groupe coupé reste muet même s’il est en solo.
- Instrumental, Acappella et Tout rétablir appliquent simultanément leurs niveaux et retirent les mutes/solos. Sur Remote, un preset utilise une seule commande.

Les gains suivent une rampe de 20 ms. Les commandes ne remplacent pas la source en lecture ; l’horloge, la boucle et le tempo continuent. Les faders affichent leur valeur conservée ; les groupes inaudibles sont atténués visuellement. Les états arrivent aussi sur Remote, avec l’identité de piste pour refuser une commande obsolète.

Les réglages appartiennent au titre chargé et sont conservés lors d’une nouvelle préparation de ce même objet. Ce lot n’ajoute pas leur sauvegarde complète entre sessions. Les boutons restent désactivés tant que les stems ne sont pas prêts/activés. Les queues d’effets déjà émises peuvent continuer à décroître.

**Scratch :** la prise utilise encore le mix original. Au relâchement, le moteur rétablit les faders et les mutes/solos de la lecture par stems ; l’indication près du disque précise ce comportement. Ce lot ne rend pas le moteur de scratch multicanal.

La recette emploie un résultat neuronal réel de huit secondes, déjà vérifié en 0.27, et contrôle à nouveau ses empreintes, ses horloges et sa lecture via le service/Worker de production. Le résultat de séparation est réutilisé, sans nouvelle inférence ni qualité d’isolation revendiquée. [Recette et limites](CHANGELOG-0.29.0.md).
