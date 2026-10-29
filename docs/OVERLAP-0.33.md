# Réduire le chevauchement — 0.33

Dans **DJ dynamique**, avec le profil **Mix musical**, ouvrir **Réglages du passage** et activer **Limiter le chevauchement**. L’option est active par défaut, mémorisée sur le PC et pilotable par Remote. Elle suit Sync BPM et ne modifie pas le passage déjà armé.

Le moteur mesure les zones source et cible réellement jouées, en secondes du fichier d’origine. Il pondère la densité spectrale par la durée couverte, puis recalcule cette mesure au déclenchement, après le calage, l’arrivée sur repère et le raccourcissement de Next. Une mesure insuffisamment couverte reste inconnue.

Quand les deux zones sont chargées et que le relais n’est pas déjà court, le score réduit le chevauchement direct à deux temps au plus. Un relais de graves conserve les basses entrantes disponibles et ajoute un passe-haut, un écho bref et un souffle modérés par **Intensité FX**. À zéro, cette protection n’ajoute ni souffle, ni balayage du filtre, ni écho ; le relais court reste actif. Le tempo continue son évolution commune jusqu’à la vitesse native du prochain morceau.

Le relais choisi, les repères préparés et la durée ne sont pas déplacés par la protection. Un changement de tempo supérieur à 8 % conserve au moins seize temps de progression lorsque cette durée a été demandée ; une demande plus courte et Next gardent leur priorité. Le moteur borne toujours le passage à la réserve audio disponible.

Le témoin **A / B** indique l’occupation spectrale des deux fenêtres. Ce ne sont ni des probabilités de présence vocale ni une note de qualité. La protection reste limitée à Auto musical avec grille et tempo commun utilisables. Les styles explicites, les stems séparés et les replis ne sont pas réécrits ; un relais déjà court le reste.

![Réglages PC et mesure A/B](images/overlap-protection-033.png)

## Vérification

404 tests unitaires, 25 scénarios natifs source et 19 depuis le paquet Windows passent. Douze rendus couvrent quatre titres réels, les deux sens, l’activation/désactivation et Next. Sur le passage MP3 98 → 110 BPM chargé, le chevauchement passe de 16 à 2 temps, sans modifier les points ni les 9,23 secondes de progression ; Next utilise un temps de chevauchement. Les autres passages peuvent conserver leur partition.

Les rendus ne présentent ni échantillon non fini, ni saturation, ni fenêtre silencieuse de 50 ms pendant le passage. Les horloges restent en phase. Le jugement musical sur une collection plus large, la reconnaissance des phrases/voix et les longues sessions restent ouverts. [Mesures](OVERLAP-MEASURES-0.33.json) · [Recette et distribution](CHANGELOG-0.33.0.md).
