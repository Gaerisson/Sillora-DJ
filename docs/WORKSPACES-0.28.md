# Espaces et bibliothèque — 0.28

Les quatre espaces pilotent le moteur réel de la fenêtre principale. Changer d’espace conserve les sources en lecture, les boucles et les réglages. Il n’y a pas de second moteur audio.

| Espace | Usage |
| :--- | :--- |
| Studio | Platines, mixer, ondes et bibliothèque |
| Automix | Programme courant, prochain titre, commandes de relais et réglages du passage |
| Préparation | Titres réellement chargés, grille/repères et préparation/réglages des stems |
| Régie | Les quatre entrées et le master existants, sur une surface plus large |

La barre garde l’état de diffusion des entrées, l’état REC et le programme visibles. Le bouton d’état micro ouvre la Régie ; il ne coupe pas les entrées. **Régie rapide** ouvre le panneau latéral de Studio. Quitter la Régie complète rétablit le choix de panneau de Studio.

## Bibliothèque et affichage

La poignée **Hauteur de la liste**, en bas du tableau, redimensionne la liste à la souris ou au toucher. Au clavier : haut/bas par 24 pixels, Page précédente/suivante par 96 pixels, Début/Fin vers les limites. Échap annule une prise active. La hauteur affichée reste entre 160 pixels et 70 % de la hauteur de la fenêtre, dans la limite de 900 pixels. Le choix d’un grand écran reste mémorisé lorsque la fenêtre rétrécit.

**Affichage** propose Confort/Compacte pour la liste et affiche/masque les vinyles, le sampler ou la file/journal. Sans vinyle, le curseur de tempo reste accessible à l’horizontale. Ces choix n’enlèvent aucun tampon ou source audio. Rétablir l’affichage revient aux valeurs initiales. La navigation entre espaces accepte Alt + 1 à 4 et les flèches lorsque le focus se trouve sur ses boutons. Les raccourcis sont ignorés dans les champs et les dialogues.

Les préférences sont locales au PC. Elles ne commandent pas la disposition de Remote ; celui-ci garde ses commandes sur le même moteur. Après rechargement, l’affichage est restauré sans lancer de lecture.

## Portée de cette intégration

Ce lot branche une première navigation issue de la proposition UI sur les composants existants. Il ne remplace pas toutes les couches CSS ni les contrôles historiques. La bibliothèque conserve sa pagination ; le tableau étroit défile horizontalement. Le panneau Préparation ouvre le véritable éditeur de grille et les réglages de stems ; il n’ajoute pas de reconnaissance de phrases ou de voix. Le DSP des transitions, de séparation et de traitement micro reste inchangé.

La recette vérifie les tailles 1440, 1280 et 480 pixels, dans les deux thèmes, le maintien de la source pendant lecture, la poignée réelle, les préférences et les commandes Remote. La validation acoustique en salle, les longues sessions et la refonte complète restent ouvertes dans le [suivi](AUDIT-SUIVI.md).
