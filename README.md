<p align="center"><img src="docs/images/sillora-banner.svg" alt="Sillora DJ — Le mix, dans son mouvement. Par Gaerisson." width="100%"></p>

<p align="center"><strong>Console DJ &amp; régie live pour Windows</strong><br>Deux platines, Automix musical, stems et télécommande Web.</p>

<p align="center"><a href="#le-studio">Découvrir</a> · <a href="docs/SCREENSHOTS.md">Galerie</a> · <a href="#prise-en-main">Prise en main</a> · <a href="docs/INSTALLATION.md">Installation &amp; build</a> · <a href="docs/CHANGELOG-0.16.1.md">Nouveautés</a></p>

![Sillora DJ avec deux titres chargés, leurs pochettes et leurs ondes RGB](docs/images/studio.jpg)

## Le studio

**Sillora DJ** réunit le mixage d’une collection locale et la gestion d’une petite régie dans une même application. Développé par **Gaerisson**, le projet prend la suite de Gaerisson DJ Studio et de Sillage Studio.

| Mixer | Préparer et diffuser |
| :--- | :--- |
| Deux platines, pochettes et ondes RGB déroulantes | Bibliothèque par dossiers, favoris et tri BPM / clé |
| Scratch à la souris, Hot Cues, boucles et beat jump | Suggestions dans le dossier du set et file Automix |
| 27 choix de transition, filtres, échos et textures | Variation commune du tempo pendant les passages |
| Sidechain léger activable et réduction visible | Quatre entrées micro / ligne et autoduck configurable |
| Stems voix, batterie, basse et instruments | Gate, compresseur, EQ, limiteur et filtres anti-larsen |
| Sampler huit pads et enregistrement du programme | Remote Web, visuels et fenêtres média séparées |

### Un passage construit autour de la musique

L’Automix utilise le tempo mesuré, la grille, l’énergie, la tonalité estimée et les derniers effets pour proposer le passage suivant. Le tempo progressif fait évoluer les deux platines ensemble, puis laisse le titre entrant à sa vitesse native. **Mixer maintenant** déclenche le relais sans attendre une sortie lointaine.

Le bouton **PUMP** ajoute un sidechain discret sur les attaques graves de la musique. Son dosage, son relâchement et sa détection restent réglables ; le micro conserve son propre traitement.

[Comprendre l’Automix](docs/AUTOMIX-0.16.md) · [Les familles de transitions](docs/TRANSITIONS-0.16.md)

## Une interface à votre couleur

<table><tr><td width="50%"><img src="docs/images/porcelain.jpg" alt="Thème clair Porcelaine"><br><strong>Porcelaine</strong> — la même console en clair.</td><td width="50%"><img src="docs/images/automix.jpg" alt="Programme et prochain titre en vue Automix"><br><strong>Automix</strong> — préparer le prochain passage.</td></tr></table>

Pseudo, logo, couleurs, motifs et intensité des visuels se règlent dans **Signature**. Les fenêtres Visuels, Média et Son peuvent s’ouvrir séparément.

### Le contrôle reste à portée de main

<table><tr><td width="75%"><img src="docs/images/remote.jpg" alt="Console Web sur ordinateur"><br><strong>Remote Web</strong> — platines, bibliothèque, sampler et régie.</td><td width="25%"><img src="docs/images/remote-mobile.jpg" alt="Télécommande sur téléphone"><br><strong>Mobile</strong> — le son continue de sortir du PC.</td></tr></table>

Captures de l’application exécutée avec des fichiers audio réels. Les fichiers musicaux et réglages personnels ne sont pas distribués. [Voir la galerie](docs/SCREENSHOTS.md).

## Prise en main

1. Ouvrir **Dossiers** ou **Importer des morceaux**.
2. Charger un titre sur chaque platine, ou choisir **Automix ici** dans un dossier.
3. Sélectionner un passage dans **Transition Lab**, puis **Mixer maintenant**.
4. Ouvrir **Master** pour le sidechain, **Micros / ligne** pour la régie et **Remote** pour l’appairage sur le réseau local.

Le build produit `Sillora-DJ-Setup-0.16.1.exe` et `Sillora-DJ-0.16.1-Windows.exe`. **Les binaires ne sont pas encore publiés dans GitHub Releases.** Pour démarrer depuis les sources :

```powershell
npm ci
npm run vendor:audio
npm start
```

Node.js 24 est utilisé pour le développement. `npm run dev` démarre le lecteur dans le navigateur ; les fichiers natifs, imports et stems utilisent Electron. [Installation et construction Windows](docs/INSTALLATION.md).

## État du projet

Version **0.16.1**, Windows x64, Electron et Web Audio. La suite locale compte **200 tests réussis**. Les vérifications fonctionnelles couvrent les vrais fichiers audio, le sidechain, Remote, les pochettes, le sampler et les entrées micro simulées.

- BPM, tonalités et repères IN/OUT : estimations modifiables.
- Stems précalculés sur CPU ; runtime et modèle embarqués dans les distributions préparées, hors du dépôt source.
- YouTube et SoundCloud : import de liens publics compatibles ; catalogue abonné SoundCloud Go+ non intégré.
- ASIO, MIDI et préécoute casque séparée non proposés dans cette version. Les réglages anti-larsen dépendent de la salle.

## Documentation et contributions

[Installation](docs/INSTALLATION.md) · [Galerie](docs/SCREENSHOTS.md) · [Identité visuelle](docs/BRAND.md) · [Historique](docs/CHANGELOG-0.16.1.md) · [Données & réseau](docs/PRIVACY.md) · [Dépendances](THIRD_PARTY.md)

Un bug, une transition à améliorer ou une idée ? [Ouvrir une issue](https://github.com/Gaerisson/gaerisson-dj-studio/issues/new/choose) ou consulter [le guide de contribution](CONTRIBUTING.md).

---

**Sillora DJ — par Gaerisson.** © 2026 Gaerisson. Les dépendances conservent leurs licences respectives. Le dépôt conserve son adresse historique `gaerisson-dj-studio`.
