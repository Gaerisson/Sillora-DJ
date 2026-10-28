# Transitions — moteur 0.20

Les passages EQ, Relais harmonique, filtre, Whoosh et Echo Out partagent maintenant une partition exprimée en temps. Elle définit le relais des graves, les courbes de volume, le filtre, la capture d’écho et les étapes affichées. Le moteur convertit cette partition vers l’horloge audio ; l’interface ne déclenche pas les effets par ses timers.

## Déroulement

| Passage de 16 temps | Relais | Construction |
| :--- | :--- | :--- |
| EQ / Relais harmonique | Temps 8 | Entrée progressive des médiums/aigus ; échange des graves sur un temps, courbes complémentaires en amplitude. Le relais harmonique conserve son écho discret. |
| Filtre / Whoosh | Temps 12 | Le groove sortant reste présent pendant la préparation. Le filtre monte pendant le croisement, le nouveau titre atteint son niveau au relais ; le souffle reste dosé. |
| Echo Out | Temps 12 | Capture des dernières pulsations, croisement court autour du relais, puis répétitions amorties sur le nouveau titre. |

Les passages plus courts ou bornés par la fin du fichier adaptent ces repères. Pour huit temps ou plus, le relais est placé sur une frontière de mesure de la grille retenue. Cette grille est mesurée ou corrigée manuellement : une frontière de mesure ne prouve pas une frontière de phrase musicale.

## Tempos différents

Avec **Sync** et **Tempo progressif**, les deux platines suivent le même tempo puis le morceau entrant retrouve sa vitesse native. Volumes, filtre et écho utilisent la même intégrale de tempo. Les calculs de place disponible avant EOF et les repères dessinés sur l’onde utilisent la durée réellement parcourue dans chaque fichier.

Le mode musical ne rejette plus une synchronisation valide uniquement parce que les tonalités sont éloignées : il peut choisir un filtre ou un écho, limiter le chevauchement des mélodies et relayer les graves. Une mesure de tempo insuffisante ou un écart trop grand conserve le repli sans morphing. Les choix manuels restent disponibles.

Les repères IN/OUT manuels sont prioritaires. La courbe du laboratoire et le marqueur **RELAIS** sur l’onde reprennent la partition effectivement prévue ; les étapes sont recalculées lorsque le passage doit être raccourci.

## Recette

```powershell
npm test
npm run test:transitions:windows -- "piste-A.mp3" "piste-B.mp3"
```

La recette Windows utilise deux fichiers locaux distincts de plus de 52 s, le moteur de production, le maintien de hauteur et `OfflineAudioContext` natif. Elle génère des rendus de 26 s, avec six secondes de contexte avant la transition. Elle mesure crêtes, valeurs non finies, fenêtres silencieuses de 50 ms et alignement des horloges du transport ; elle vérifie aussi la poursuite du titre entrant à sa vitesse native. Les fichiers et rapports sont générés dans `.runtime/transition-proof/results` et ne sont pas publiés avec les sources.

## Périmètre restant

La partition partagée couvre les familles ci-dessus. Les autres effets conservent leurs traitements existants. Les courbes de tempo restent linéaires ; la détection de phrases, voix, buildups et drops, la grille à tempo variable et les courbes entièrement éditables restent à développer.

Les mesures de phase du transport ne mesurent pas à elles seules le décalage acoustique introduit par le time-stretch. Les scores de grille peuvent rester faibles sur de vrais morceaux. Les rendus permettent une comparaison d’écoute ; les mesures techniques ne certifient pas une équivalence perceptive avec une référence.
