# Sillora DJ 0.22.0 — repères d’arrangement et préparation

Les changements durables de niveau, de graves et de densité spectrale deviennent des **repères d’arrangement**. Ils apparaissent sur les ondes du PC et de Remote. Le panneau **ANALYSE → STRUCTURE** permet d’aller à un repère et d’y poser IN ou OUT, avec priorité aux corrections manuelles.

![Préparation des repères dans l’application exécutée](images/arrangement-022.png)

- Comparaison des mesures de part et d’autre d’un changement, rejet des accents isolés, confiance et espacement des repères. Un groove uniforme n’est pas découpé artificiellement.
- Les régions automatiques peuvent privilégier un repère proche ; le relais du score tient compte de sa position et réserve l’audio nécessaire avant EOF.
- Les transitions courtes quantifient le départ selon la phase de leur relais. Les temps des repères conservent leur précision complète pour éviter un saut d’une mesure par arrondi.
- Les commandes d’un panneau d’analyse devenu obsolète ne modifient pas une piste chargée ensuite sur la même platine.
- Les corrections de tempo ½, ×2 et Tap sont mémorisées comme grille manuelle et actualisent la carte.
- Une carte enregistrée avec faible confiance n’est pas réutilisée après correction de la grille.
- Cache des régions versionné 2. Les préparations restent associées au SHA-256 des octets audio, indépendamment des versions d’analyse. Les données peuvent être réanalysées sans perdre les corrections ; une préparation identifiant un autre contenu est rejetée.

## Limite musicale importante

Ces repères décrivent des **changements mesurés**, pas des voix, refrains, buildups ou drops reconnus. Une grille peu fiable conserve le repli énergétique existant.

Sur les deux MP3 de la recette, les tempos 110 et 98 BPM sont retrouvés, mais les scores de stabilité restent insuffisants pour produire automatiquement une carte fiable. Les essais de préparation corrigent explicitement la grille avec les commandes de l’application. Ils ne démontrent donc pas une reconnaissance automatique des phrases sur ces titres.

Les quatre rendus de régions utilisent eux aussi une grille explicitement acceptée pour le banc. Deux passages se calent sur un repère mesuré ; les deux autres utilisent le repli énergétique. Le relais réellement exécuté suit le point planifié dans les quatre cas. Aucun jugement de préférence d’écoute n’est déduit de ces mesures.

## Recettes

**282 tests automatisés réussis**. Huit scénarios natifs de préparation passent sur les deux MP3 : corrections de grille, IN/OUT sans remplacer la source en lecture, navigation, deux thèmes et deux largeurs, Remote, piste remplacée et migration du catalogue sans repli localStorage ni lecture automatique. Quatre rendus de 26 s, Whoosh et automatique dans les deux sens, passent avec les régions planifiées et le profil Rythme.

```powershell
npm test
npm run test:arrangement:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm --arrangement "piste-A.mp3" "piste-B.mp3"
```

Pour la seconde recette, choisir des morceaux de plus de 52 s avec un changement durable proche de la sortie. `--arrangement` accepte explicitement les grilles du banc et calcule les régions ; sans cette option, la matrice conserve ses repères manuels de comparaison. Les résultats des lancements successifs remplacent `.runtime/transition-proof/results` : les conserver séparément pour comparer.

Les autres recettes bibliothèque, continuité/audio, Standard/Rythme et PC/Remote restent décrites dans [INSTALLATION.md](INSTALLATION.md). Les fichiers musicaux, profils privés et rendus personnels restent hors du dépôt.

## Distribution

**60 cas natifs passent depuis le code embarqué dans `app.asar`** : 16 cas acoustiques, quatre de profil PC/Remote, neuf rendus Standard, neuf Rythme, huit de préparation/migration, quatre rendus de régions, six de bibliothèque et quatre de continuité/audio. Les 140 fichiers applicatifs correspondent aux sources testées. Les ressources natives contrôlées correspondent aux ressources préparées.

Un premier délai d’attente sur le chargement prioritaire du banc bibliothèque n’a pas été reproduit pendant trois recettes complètes instrumentées, sans changement du code exécuté. Sa cause reste non confirmée ; les essais de charge et de longues sessions restent ouverts. Les rapports conservent cet échec initial et les reprises, sans le qualifier de défaut corrigé.

Les exécutables Windows x64 sont construits, avec version et copyright Gaerisson vérifiés. Installateur et portable embarquent le même contenu ; l’archive commune de 7 215 fichiers passe le contrôle d’intégrité. L’installation sur le profil personnel n’a pas été exécutée. Les binaires sont remis séparément du dépôt source.

| Exécutable | SHA-256 |
| :--- | :--- |
| Sillora-DJ-Setup-0.22.0.exe | `393729ec18cc8b44a6f3f892eba3f1c940a3cd9e5cf81224b8e909213b7b4add` |
| Sillora-DJ-0.22.0-Windows.exe | `30374e94d3977f99189054e2f0823fe925b89b35072ac026d760cd19410196e0` |

La fiabilité automatique de toutes les grilles, la reconnaissance sémantique des phrases et voix, la refonte UI complète et les autres exigences partielles du registre restent ouvertes. [Architecture](ARRANGEMENT-0.22.md) · [Suivi de l’audit](AUDIT-SUIVI.md).
