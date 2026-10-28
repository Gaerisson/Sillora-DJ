# Installer et développer Sillora DJ

## Distribution Windows

Le build produit `Sillora-DJ-Setup-0.24.0.exe` et `Sillora-DJ-0.24.0-Windows.exe`. Fermer le studio avant une mise à jour. Les binaires ne sont pas encore disponibles dans GitHub Releases.

La version portable extrait ses dépendances au lancement et peut mettre davantage de temps à démarrer. Les préférences utilisent le profil historique ; le changement de nom ne crée pas une nouvelle bibliothèque.

## Depuis les sources

Prérequis : Node.js 24 et npm. Depuis la racine :

```powershell
npm ci
npm run vendor:audio
npm start

# Lecteur navigateur, sans les services natifs Electron
npm run dev

# Suite automatisée
npm test
```

## Construire les exécutables

La construction utilise electron-builder et demande les runtimes de média et de séparation préparés localement :

```powershell
npm run vendor:media

# Runtime Python CPU prêt avec torch 2.5.1+cpu, torchaudio et demucs 4.0.1
$env:GAERISSON_STEMS_SOURCE = 'D:\tools\demucs-cpu'
$env:GAERISSON_STEMS_MODEL = 'D:\models\955717e8-8726e21a.th'
npm run vendor:stems

npm run pack:installer
```

Le modèle officiel htdemucs est vérifié avec le préfixe SHA256 `8726e21a`. Le build refuse les ressources absentes. Les modèles, runtimes et sorties générées ne sont pas versionnés ; les distributions préparées les embarquent pour éviter un téléchargement au premier usage.

`release/` contient les résultats. [Dépendances et licences](../THIRD_PARTY.md).

## Recettes Windows isolées

Avec deux morceaux distincts de plus de 52 s :

```powershell
npm run test:transitions:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm "piste-A.mp3" "piste-B.mp3"
npm run test:library:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:audio:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:keylock:windows
npm run test:keylock-ui:windows -- "piste-A.mp3"
npm run test:arrangement:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm --arrangement "piste-A.mp3" "piste-B.mp3"
npm run test:grid:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm --automatic-grid "piste-A.mp3" "piste-B.mp3"
npm run test:gestures:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:corpus:windows -- "dossier-musical"
npm run test:transitions:windows -- --rhythm --survey "piste-A.opus" "piste-B.opus"
```

Rapports, rendus et profils de test sont générés dans `.runtime/transition-proof`, `.runtime/library-proof`, `.runtime/audio-proof`, `.runtime/keylock-proof`, `.runtime/keylock-ui-proof` et `.runtime/arrangement-proof`. Les recettes ne touchent pas au profil installé. Le banc bibliothèque simule 1 000 références à partir des deux fichiers ; il ne mesure pas 1 000 décodages de musiques distinctes. Le banc Key Lock utilise des pulsations synthétiques sans fichier musical ; son complément UI vérifie un vrai MP3 et la commande Remote par IPC.

Le banc de préparation utilise les commandes réelles de correction de grille et simule une migration du catalogue. La matrice `--arrangement` accepte explicitement les grilles mesurées pour vérifier les régions et leur relais ; elle ne certifie pas leur estimation automatique. Choisir des titres avec changement durable près de la sortie. [Périmètre et limites](CHANGELOG-0.22.0.md).

La recette `test:grid:windows` importe au contraire les fichiers sans correction de grille, contrôle les mesures PC/Remote et leur restauration depuis le cache natif. Ses résultats sont dans `.runtime/grid-proof/results`. La matrice `--automatic-grid` utilise également les seules grilles automatiques pour quatre rendus Whoosh/automatique, dans les deux directions ; elle exige un rythme stable et au moins un repère de sortie exploité. Ces contraintes définissent le banc, pas la prise en charge de toute une collection. [Diagnostic et limites 0.23](GRID-0.23.md).

Les gestes utilisent `.runtime/wave-gesture-proof`, avec profils isolés. Le corpus écrit ses analyses dans `.runtime/corpus-proof/results` ; ses rapports locaux contiennent les noms/chemins des fichiers testés et restent hors du dépôt. `--survey` accepte des grilles incertaines et contrôle le repli sans imposer une synchronisation. Deux rendus automatiques de 42 s sont produits, dans les deux sens, sans corrections manuelles des régions/grilles. [Périmètre 0.24](CORPUS-0.24.md).
