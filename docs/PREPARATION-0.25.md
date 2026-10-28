# Préparer la grille d’un morceau

Dans une platine chargée, ouvrir **Analyse**. Le panneau **Grille rythmique** agit sur le morceau d’origine ; son BPM est indépendant du curseur de vitesse de la platine.

## Repérer les impacts

- **Lecture / Pause** pilote la platine réelle. Aucun métronome n’est ajouté au programme.
- L’onde détaillée affiche une, quatre ou seize mesures, avec les temps numérotés de 1 à 4. Cliquer ou glisser déplace la lecture. La vue globale permet d’atteindre une autre partie du morceau.
- **Suivre** garde le curseur dans la fenêtre. Les flèches déplacent seulement la fenêtre d’observation ; elles désactivent le suivi.

## Corriger et appliquer

Placer le curseur sur un premier temps puis choisir **1er temps au curseur**. Le décalage affine la grille par pas de 1, 5 ou 20 ms. Les boutons **−1 temps / +1 temps** déplacent la phase de la mesure sans changer le tempo.

Le champ BPM conserve le temps de grille le plus proche du curseur lors du changement de tempo. Vérifier ensuite le début et la fin du morceau : un bon calage local ne suffit pas à prouver une grille globale.

**Calibrer entre deux impacts** demande deux positions et le nombre d’intervalles rythmiques qui les sépare. Par exemple, deux impacts distants de 32 temps sur 16 secondes donnent 120 BPM. Le premier repère devient aussi le premier temps de mesure ; il doit donc être choisi comme tel. Le calcul est une correction manuelle, pas une nouvelle détection automatique.

Les modifications restent en **brouillon** jusqu’à **Appliquer**. Elles ne changent pas la vitesse du son. L’application annule un Automix en cours, met à jour la carte et les régions automatiques, mais conserve les IN/OUT définis manuellement, les Hot Cues et la source audio en lecture.

**Recharger** abandonne le brouillon et relit la grille enregistrée. **Analyse d’origine** affiche les mesures automatiques en aperçu ; il faut appliquer pour supprimer la correction manuelle. Une analyse incertaine retrouve alors son statut incertain.

## Persistance et protection

La préparation est associée au contenu du fichier dans le catalogue natif. Elle survit au redémarrage et aux changements de version du cache. Un remplacement de piste interdit les actions de l’ancien panneau. Une modification de grille provenant d’une autre commande impose de recharger le brouillon.

La fermeture libère les gestes et l’animation du panneau. Une réouverture immédiate ne doit pas arrêter le nouveau dessin des ondes.

## Portée

Cette version prépare une grille **à tempo constant**. Elle n’ajoute ni carte de tempo variable, ni reconnaissance de voix, phrases ou drops. La préparation complète n’est pas encore exposée dans Remote ; ses commandes de BPM et premier temps utilisent le même moteur.

Les 99 mesures du corpus précédent ne sont pas réétiquetées comme correctes. Ce panneau facilite leur vérification manuelle ; il ne constitue pas à lui seul un jeu de références annoté ni une amélioration certifiée de la qualité des transitions.
