# Sillora DJ 0.25.0 — préparation de grille

Le panneau Analyse ajoute une préparation visuelle : zoom de l’onde, navigation, premier temps au curseur, décalage de 1/5/20 ms, phase de mesure et calibration du BPM entre deux impacts. Le brouillon reste séparé du son et des données enregistrées jusqu’à son application. [Mode d’emploi](PREPARATION-0.25.md).

![Éditeur de grille dans le paquet Windows](images/preparation-025.png)

## Comportement et corrections

- BPM du fichier distinct de la vitesse de la platine ; le changement de BPM dans l’éditeur conserve le temps le plus proche du curseur.
- Application commune aux commandes de grille : carte et IN/OUT automatiques recalculés ; repères manuels, Hot Cues et source en lecture conservés. Un Automix en cours est annulé.
- Retour à l’analyse mesurée sans conserver un faux statut manuel. Le résultat automatique original reste disponible.
- Brouillon invalidé si la grille ou la piste change ; persistance par contenu contrôlée après redémarrage sans le secours localStorage.
- Animation et gestes libérés à la fermeture. Une course à la réouverture immédiate, révélée par les captures, a été corrigée et couverte par une vérification du dessin effectif.
- Version du diagnostic HTTP issue du paquet, pour rester cohérente avec le lanceur natif et son contrôle de réutilisation du studio.

## Recette exécutée

**322 tests automatisés passent.** La relecture de ce lot est faite par l’auteur ; aucune revue indépendante n’est déclarée.

**54 cas natifs passent depuis le code final embarqué :**

| Périmètre | Cas |
| :--- | ---: |
| Éditeur sur deux MP3 et deux Opus | 18 |
| Structure, IN/OUT et migration de préparation | 8 |
| Gestes d’onde et Remote | 10 |
| Bibliothèque, import et cache | 6 |
| Continuité audio et Remote | 4 |
| Rendus automatiques sans correction de grille | 8 |

Les recettes de préparation utilisent le preload et le catalogue natifs, le worker d’analyse et des entrées souris sur la vue globale. Deux thèmes à 1440 et 480 px sont vérifiés, avec contrôle de débordement et du dessin des ondes après réouverture. Les calibrations du banc ont des positions imposées pour tester le calcul ; elles ne constituent pas une annotation musicale humaine.

Les huit rendus rejouent les deux MP3 puis deux paires Opus du corpus : une grille sortante incertaine et un écart de tempo nécessitant le morphing, dans les deux sens. Les grilles automatiques ne sont pas remplacées par des valeurs manuelles. Ces contrôles vérifient le transport, les signaux finis et les passages prévus ; ils ne certifient pas une qualité d’écoute.

Le premier essai bibliothèque a dépassé le seuil d’affichage de 1,5 seconde pendant la compression du paquet. Le seuil n’est pas modifié ; une reprise après la construction passe. Le rapport initial est conservé, la cause exacte n’est pas attribuée et la réactivité sous charge reste à approfondir.

## Distribution

Les **148 sources applicatives** sont comparées à **app.asar**. Ressources de stems et d’import embarquées vérifiées, nom/version/copyright des exécutables contrôlés. Installateur et portable contiennent le même paquet ; l’archive commune passe le contrôle d’intégrité de **7 215 fichiers**. L’installation sur le profil personnel n’est pas exécutée.

| Fichier | Octets | SHA-256 |
| :--- | ---: | :--- |
| Sillora-DJ-Setup-0.25.0.exe | 289780193 | `6da34f9497b9372b934b21698e3c10e9c8abfa30c3a9d4ee77ccb50e78f4afc7` |
| Sillora-DJ-0.25.0-Windows.exe | 289538202 | `d9d12db8d4535c6fbf13b3816896c8e90302833a5859ef6d4cb3b2eab0b78433` |

Les binaires sont préparés localement ; ils ne sont pas publiés dans GitHub Releases. Les captures et les sources du lot sont publiées sans fichiers musicaux ni profils de test.

## Limites conservées

Grille constante seulement. Aucun nouveau taux de justesse n’est attribué aux 99 morceaux précédents : les 66 grilles incertaines restent à vérifier. Ni carte de tempo variable, ni phrases/voix/drops sémantiques, ni intégration complète de la maquette. L’éditeur complet reste sur le PC ; Remote conserve ses commandes de BPM et premier temps. Les longues sessions, les budgets stems et la validation acoustique micro restent ouverts dans le [suivi de l’audit](AUDIT-SUIVI.md).
