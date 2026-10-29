# Stems : préparation et ressources — 0.27

Dans les commandes avancées d’une platine, ouvrir **Stems → Réglages**. La séparation locale prépare quatre groupes stéréo : batterie, basse, instruments et voix. Le moteur Python CPU et le modèle htdemucs sont embarqués dans les distributions Windows complètes.

![Réglages de préparation](images/stems-027.png)

## Choisir les budgets

| Réglage | Choix | Défaut |
| :--- | :--- | :--- |
| CPU | 1, 2, jusqu’à 4 threads Torch | 2 |
| Stems décodés par morceau | 256, 512, 1 024 Mio | 512 Mio |
| Temps maximum du calcul natif | 30, 90, 180 minutes | 90 minutes |

Le moteur garde un cœur logique disponible si la machine en possède plusieurs. « Jusqu’à 4 » peut donc employer moins de quatre threads. Ce réglage borne les threads de calcul Torch/BLAS ; il ne garantit pas un pourcentage CPU global. Le modèle, le morceau original et les copies temporaires demandent de la mémoire supplémentaire : **le budget affiché ne plafonne pas toute la RAM du processus**.

Les limites s’appliquent avant la copie du PCM : mono/stéréo de 22,05 à 96 kHz, huit minutes au maximum, WAV d’entrée limité à 256 Mio et stems décodés dans le budget choisi. À 48 kHz, quatre minutes de stems occupent environ 352 Mio ; un budget de 256 Mio les refuse. Le message indique la mémoire nécessaire. Un budget de temps dépassé arrête le processus et laisse la piste originale disponible.

Les choix sont mémorisés sur le PC et partagés avec Remote. Ils concernent la prochaine préparation. Une seule séparation native s’exécute à la fois. Les imports de fond attendent pendant la préparation ; les demandes explicites de lecture restent prioritaires.

## Pendant le calcul

L’encodage WAV et les enveloppes RMS passent dans un Worker dédié. Les transferts de canaux et l’assemblage du tampon huit canaux avancent par blocs, avec rendus de contrôle entre les blocs. Le programme audio continue sur sa source existante. Le panneau montre les étapes disponibles ; les pourcentages du calcul viennent du moteur et ne constituent pas une estimation du temps restant.

**Annuler la préparation** reste accessible dans Réglages après remplacement de la platine. Remote peut également annuler un calcul survivant à un rechargement de l’interface. Le verrou n’est libéré qu’après la fin du processus. Une annulation pendant le démarrage IPC conserve son identifiant pour arrêter le bon travail. Les quatre stems ne remplacent l’ancien résultat qu’une fois leur préparation complète et leur identité audio vérifiées.

## Cache et lecture

Le cache v2 utilise le SHA-256 du WAV d’entrée et un manifeste atomique avec format, durée, modèle et SHA-256 de chaque stem. Un fichier absent ou altéré provoque un nouveau calcul. Le chargement valide à nouveau l’empreinte ; un échec conserve les stems déjà utilisables. Les anciens caches v1 restent sur disque et ne sont pas réutilisés.

Les niveaux existants sont conservés lors d’une nouvelle préparation. Activer les stems de la platine pour les doser. Leur tampon décodé compte dans le budget de cache de la bibliothèque ; un titre hors platines et hors préparation peut être libéré, en conservant ses métadonnées et son cache disque. Les titres protégés peuvent dépasser ce budget souple. Aucune limite ni purge automatique du cache disque n’est ajoutée dans ce lot.

## Mesures et portée

La [recette 0.27](CHANGELOG-0.27.0.md) et les [mesures anonymisées](STEMS-MEASURES-0.27.json) distinguent une séparation réelle de huit secondes, un encodage de 180 secondes et les régressions de l’application. L’algorithme de séparation reste inchangé. Les tests de reconstruction contrôlent les horloges et la somme numérique ; ils ne mesurent pas la qualité perceptive de l’isolation. Sur ce PC à quatre cœurs logiques, la préparation de huit secondes a pris environ 276 s pendant la compression de la distribution. Le plus grand écart entre deux images a été de 150 ms ; la lecture contrôlée est restée active, sans échantillon non fini. Cette mesure sous charge n’est pas une estimation pour les autres PC. Le calcul CPU peut être très lent. Les morceaux complets et les longues sessions restent à valider.
