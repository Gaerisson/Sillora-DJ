# Installer et développer Sillora DJ

## Distribution Windows

Le build produit `Sillora-DJ-Setup-0.17.0.exe` et `Sillora-DJ-0.17.0-Windows.exe`. Fermer le studio avant une mise à jour. Les binaires ne sont pas encore disponibles dans GitHub Releases.

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
