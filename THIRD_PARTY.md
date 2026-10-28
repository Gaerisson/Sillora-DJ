# Dépendances et attributions

© 2026 Gaerisson pour le code et les éléments originaux de Sillora DJ. La publication du dépôt n’accorde pas à elle seule une licence générale de réutilisation du projet.

Les dépendances conservent leurs licences et notices dans la distribution :

- Electron / Node.js : licences MIT et notices Chromium / dépendances incluses.
- SoundTouchJS Audio Worklet 2.1.1 : MPL-2.0, sources originales, licence et notices conservées sous `public/vendor/soundtouch`. Le module généré `sillora-processor.js` ajoute un adaptateur de constructeur Gaerisson aux sources originales ; il est reconstruit par `scripts/vendor-audio.mjs` à partir du paquet épinglé et de `public/keylock-processor-extension.js`. Les profils sont définis dans `public/keylock-profiles.mjs`.
- QR Code Generator : MIT, source et notices sous public/vendor/qrcode.
- music-metadata : MIT, licence dans ses dépendances de production.
- Python : PSF, notices dans le runtime.
- PyTorch / torchaudio : licences BSD et notices tierces dans le runtime.
- Demucs 4.0.1 / htdemucs : [sources officielles](https://github.com/facebookresearch/demucs), MIT.
- yt-dlp 2026.10.21 : [sources et distribution officielles](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.21). Le binaire Windows et ses composants conservent leurs licences, notamment GPLv3+, avec LICENSE et THIRD_PARTY_LICENSES dans resources/media.

Les scripts conservent sommes de contrôle et notices des ressources préparées. Les musiques, enregistrements et vidéos personnels de développement ne font pas partie du dépôt.
