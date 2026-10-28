# Sillora DJ 0.20.0 — transitions sur une partition commune

Les transitions EQ, relais harmonique, filtre, Whoosh et Echo Out partagent le même repère de relais. Le groove sortant reste présent pendant la préparation d’une montée filtrée ; le titre entrant atteint son niveau sur le relais, puis poursuit sa lecture. Le filtre et le souffle accompagnent ce mouvement.

- Relais des graves sur une frontière de mesure pour les passages de huit temps ou plus ; courbes complémentaires en amplitude et dosage des médiums/aigus.
- Capture d’écho autour des dernières pulsations, répétitions amorties et maintien de l’écho discret du relais harmonique.
- Variation commune de tempo dans les deux directions, effets sur la même intégrale et retour du titre entrant à sa vitesse native.
- Calcul de place avant EOF par vitesse moyenne du morphing. Les IN/OUT manuels restent prioritaires.
- Le mode musical peut conserver une synchronisation valide entre tonalités éloignées, avec filtre/écho et chevauchement limité. Un tempo insuffisamment fiable garde le repli prudent.
- Aperçu des volumes et marqueur **RELAIS** cohérents avec le plan exécuté. Les étapes sur les ondes suivent le temps natif du fichier, y compris pendant le morphing.
- Remote sert les nouvelles dépendances de l’onde ; son graphe de modules fait l’objet d’un test de régression.

[Fonctionnement et limites](TRANSITIONS-0.20.md) · [Suivi point par point](AUDIT-SUIVI.md).

## Validation

**254 tests automatisés réussis**, neuf rendus natifs de 26 s sur deux vrais MP3, six scénarios de bibliothèque et quatre audio/Remote. Le maintien de hauteur est actif dans les neuf rendus. Whoosh, filtre et automatique sont testés en 110 → 98 et 98 → 110 BPM ; EQ, Echo Out et relais harmonique complètent la matrice.

Les neuf passages mesurés n’ont ni échantillon non fini, ni saturation, ni fenêtre silencieuse de 50 ms. Le titre entrant poursuit sa lecture à sa vitesse native. Les horloges du transport restent alignées pendant les rampes ; ce n’est pas une mesure du décalage acoustique du time-stretch.

Une comparaison avec le paquet 0.19 utilise les mêmes morceaux et repères manuels pour Whoosh dans les deux sens, EQ et Echo Out. Elle confirme une modification du signal ; elle ne constitue pas une validation de qualité d’écoute. Les fichiers musicaux, rendus et données personnelles restent hors du dépôt.

La revue indépendante a détecté la disparition de l’écho du relais harmonique pendant la migration vers la partition. Le test ciblé a reproduit le défaut, puis passé après restauration de cet écho. La recette native le vérifie également. Le banc bibliothèque attend le bouton de pause visible avant de le déclencher, puisque le catalogue apparaît avant l’initialisation de l’import.

```powershell
npm test
npm run test:transitions:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:library:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:audio:windows -- "piste-A.mp3" "piste-B.mp3"
```

Deux fichiers distincts de plus de 52 s sont nécessaires. Les profils et résultats sont isolés dans `.runtime/`. La recette de bibliothèque simule 1 000 références à partir des deux fichiers ; elle ne représente pas l’analyse de 1 000 musiques différentes.

## Distribution et travail restant

Les exécutables Windows x64 `Sillora-DJ-Setup-0.20.0.exe` et `Sillora-DJ-0.20.0-Windows.exe` sont construits. Ils embarquent le même contenu ; l’archive de 7 215 fichiers passe son contrôle d’intégrité. Les 130 fichiers applicatifs correspondent aux sources testées. Les six scénarios bibliothèque, les neuf rendus de transitions et les quatre audio/Remote passent aussi depuis le code inclus dans `app.asar`. Les ressources embarquées vérifiées correspondent aux ressources préparées. L’installation sur le profil personnel n’a pas été exécutée.

| Exécutable | SHA-256 |
| :--- | :--- |
| Sillora-DJ-Setup-0.20.0.exe | `27b58ef83db5f98c47b9251bb79145513f896e8045240a64e38ccaf4da6c506d` |
| Sillora-DJ-0.20.0-Windows.exe | `971af57ce0c2c752401baa6d693785f8cf4f296e0b3c866032cb84738f55654e` |

Cette version ne livre pas la reconnaissance des phrases, voix, buildups et drops, une grille à tempo variable ou des courbes de tempo entièrement éditables. La qualité perceptive reste à juger sur les extraits. Les autres styles conservent leurs traitements existants. Le branchement complet de la maquette UI et les autres points ouverts de l’audit restent à réaliser.
