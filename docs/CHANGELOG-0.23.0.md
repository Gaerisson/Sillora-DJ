# Sillora DJ 0.23.0 — grille automatique et mesures lisibles

L’analyse distinguait mal la régularité des attaques et leur densité : les pauses et les temps sans attaque forte abaissaient directement la stabilité. La 0.23 sépare ces mesures. Sur les deux MP3 de référence, Automix obtient désormais une grille exploitable et des repères d’arrangement **sans correction manuelle**.

![Analyse automatique dans le paquet Windows 0.23](images/grid-023.png)

## Ce qui change

- Stabilité temporelle séparée de la couverture des attaques ; contrôles de contraste de phase, de quantité et d’étendue des observations. Une courte intro régulière ne valide pas la totalité du fichier.
- Pénalisation de la variation de tempo conservée, seuils d’activation inchangés. Une texture ambiguë garde le repli prudent.
- Dans **ANALYSE**, la stabilité est accompagnée du nombre d’attaques et de leur couverture. Remote reçoit les mêmes mesures et distingue grille automatique, manuelle, en attente et incertaine.
- Analyse version 3 et cache natif des nouvelles mesures. Les préparations manuelles restent liées au contenu audio lors du recalcul.
- Nouvelle recette Windows `test:grid:windows` et matrice musicale `--automatic-grid`. Les anciens bancs de comparaison à grille explicitement acceptée restent disponibles et identifiés comme tels.
- En cas d’échec du banc bibliothèque, le rapport conserve davantage de contexte de chargement. Cela ne constitue pas une correction annoncée du délai isolé observé en 0.22.

## Résultats et portée

**296 tests automatisés passent.** Sur les mêmes fichiers décodés à 44,1 kHz, les tempos restent 110 et 98 BPM ; la stabilité passe de 43/30 % à 81/90 %, avec 35/22 % de couverture et 12/6 ms d’écart des attaques retenues. Les cartes contiennent cinq et quatre repères. Ces pourcentages sont des scores internes, pas une précision statistique certifiée.

Quatre rendus de 26 s utilisent les grilles automatiques et les régions réellement calculées : Whoosh et automatique, dans les deux directions, profil Rythme. Le relais exécuté rejoint le point planifié ; deux rendus utilisent un repère mesuré, deux le repli énergétique. Les fichiers musicaux et les profils de test ne sont pas publiés. Les [relevés anonymisés](GRID-MEASURES-0.23.json) conservent les scores, les points de passage et les empreintes des sources exécutées.

Trois autres morceaux locaux constituent seulement un contrôle exploratoire, sans grille de référence certifiée. La détection des phrases, voix et drops, la reconstruction d’une grille à tempo variable, la qualité d’écoute sur toute une collection et la refonte complète de la console restent ouvertes.

## Reproduire

```powershell
npm test
npm run test:grid:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm --automatic-grid "piste-A.mp3" "piste-B.mp3"
```

Utiliser deux morceaux distincts de plus de 52 s avec rythme stable et changement durable près de la sortie. Le banc refuse de présenter une grille incertaine comme un cas automatique validé. Les rapports sont dans `.runtime/grid-proof/results` et `.runtime/transition-proof/results` ; les lancements suivants les remplacent. Les profils isolés ne modifient pas le profil installé.

## Distribution

**68 cas natifs passent depuis le code embarqué dans `app.asar`** : six bibliothèque, 16 acoustiques, quatre profil PC/Remote, neuf rendus Standard, neuf Rythme, huit préparation/migration, quatre rendus de régions à grille acceptée, quatre grille automatique PC/Remote/cache, quatre rendus sans correction manuelle et quatre continuité/audio. Cela comprend 26 rendus musicaux de transitions. Les ressources natives contrôlées correspondent aux ressources préparées.

Les deux exécutables Windows x64 sont construits : nom, version et copyright Gaerisson vérifiés. Ils embarquent le même contenu ; l’archive commune de 7 215 fichiers passe son contrôle d’intégrité, et les 142 sources applicatives correspondent au code embarqué. L’installation sur le profil personnel n’est pas exécutée. Les binaires sont remis séparément du dépôt source.

Le passage bibliothèque de cette version réussit. Le délai isolé observé en 0.22 reste sans cause confirmée ; aucun correctif de ce délai n’est annoncé. Les rapports d’échec disposent désormais de davantage de contexte.

| Exécutable | SHA-256 |
| :--- | :--- |
| Sillora-DJ-Setup-0.23.0.exe | `ce1d9a287e3e4a42643cbb4a238ab94c60dac7777c9a04f0f686acde7a4801ae` |
| Sillora-DJ-0.23.0-Windows.exe | `1061da45c64aa90b1f22b6b537c2742200357eff2414d98eee236780f77ee4ac` |

[Diagnostic et fonctionnement](GRID-0.23.md) · [Suivi de l’audit](AUDIT-SUIVI.md) · [Recettes Windows](INSTALLATION.md).
