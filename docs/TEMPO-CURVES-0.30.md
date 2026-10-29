# Courbes de tempo — 0.30

Dans Transition Lab, activer **Sync BPM** et **Tempo progressif**, puis choisir **Courbe tempo**. Le dessin montre la progression normalisée ; le sens réel dépend des BPM des deux morceaux.

| Courbe | Comportement |
| :--- | :--- |
| Souple | Départ et arrivée progressifs ; choix initial de l’interface. |
| Linéaire | Variation régulière pendant tout le passage. |
| Anticipée | Une plus grande partie du changement intervient au début. |
| Tardive | Une plus grande partie du changement intervient à la fin. |

La sélection est enregistrée et partagée avec Remote. Une modification pendant un passage prépare le suivant ; la courbe en cours reste intacte. Couper Sync ou Tempo progressif désactive le sélecteur sans effacer le choix.

## Effet sur le son

Les deux morceaux suivent le même tempo pendant un morphing autorisé. Le morceau entrant termine à sa vitesse naturelle ; le maintien de hauteur suit le profil Standard ou Rythme déjà choisi dans Régie. Les limites de synchronisation, la confiance des grilles et la priorité des repères manuels restent applicables. Une courbe ne force pas le beatmatch d’une paire rejetée par ces contrôles.

Les profils souple, anticipé et tardif utilisent 128 segments audio. Leur intégrale commune détermine le nombre de temps, la durée, les avances IN/OUT, le relais, les volumes/EQ/filtres pilotés par la partition et les divisions d’écho. Les marqueurs et la Remote utilisent cette même intégrale. À nombre de temps égal, anticiper ou retarder un ralentissement change sa durée en secondes.

Les courbes de tempo ne remplacent pas les styles d’effet : un Whoosh conserve son filtre, son souffle et son relais ; la courbe règle la façon dont le tempo y évolue. Le choix automatique du style continue de dépendre des deux titres. La limite de synchronisation progressive reste fixée à 20 % d’écart ; elle n’est pas encore réglable par l’utilisateur.

## Vérifier à l’écoute

Comparer les quatre courbes sur la même paire, avec le même style, le même nombre de mesures et la même intensité. Garder **Souple** pour commencer, puis essayer Anticipée si le prochain groove doit s’installer plus tôt ou Tardive pour conserver davantage le tempo de départ. Avec Next, la durée disponible est plus courte.

Le calage mathématique et les rendus numériques contrôlent les erreurs, les coupures et la saturation. Ils ne certifient pas que toute paire sonnera bien : les grilles estimées, le contenu vocal et les phrases musicales peuvent encore demander une correction.

[Suivi et résultats du lot](CHANGELOG-0.30.0.md) · [Audit](AUDIT-SUIVI.md)
