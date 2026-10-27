# Correctif 0.14.1

L’audit des demandes de la version 0.14 a révélé cinq défauts corrigés :

- Une collaboration musicale pouvait faire rejeter la pochette du bon artiste. La comparaison tient désormais compte de chaque crédit d’artiste.
- La vue Automix pouvait annoncer le morceau sortant dans « À suivre » dès que le crossfader dépassait son milieu. Elle garde maintenant le morceau entrant jusqu’à la fin du passage.
- Les ondes centrales et la grande onde Automix envoyaient plusieurs déplacements audio simultanés. Elles utilisent la même file de déplacements que les ondes des platines, avec plage et platine figées pendant le geste.
- Une pochette momentanément indisponible dans la Remote restait vide. Elle peut désormais être redemandée après une temporisation, sans multiplier les requêtes.
- La correction manuelle du BPM pouvait figer d’anciens repères IN/OUT automatiques. Le recalcul des repères reste indépendant des corrections de grille, avec conservation des marqueurs explicitement manuels.

Les 175 tests automatiques passent. L’essai Electron sur deux morceaux réels confirme les deux pochettes, la navigation sur l’onde verticale, la stabilité du prochain titre pendant la seconde moitié d’un passage, les boucles, le freinage, le sampler, la Remote et le ducking simulé.

Les limites restent explicites : IN/OUT ne détecte pas sémantiquement un refrain ou une voix ; le modèle Demucs est préparé sur CPU et peut être lent ; SoundCloud Go+ n’est pas intégré ; l’anti-larsen n’a pas été validé en salle. Les vues disponibles sont Deux platines et Automix. Le catalogue d’effets et le moteur audio restent ceux du projet.
