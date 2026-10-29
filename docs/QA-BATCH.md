# Recettes Windows regroupées

Le lanceur commun permet d’exécuter plusieurs recettes indépendantes en parallèle et de réserver ensuite la machine aux mesures sensibles à la charge.

```powershell
npm run test:batch:windows -- --plan recettes.json --jobs 2 --output .runtime/batch-proof
```

Exemple de plan (remplacer les fichiers par ses musiques locales) :

```json
{"recipes":[
  {"name":"unit","script":"@unit","args":[],"exclusive":false},
  {"name":"interface","script":"qa-workspace-windows.cjs","args":["piste-A.mp3","piste-B.mp3"],"exclusive":false,"count":12},
  {"name":"audio","script":"qa-audio-continuity.cjs","args":["piste-A.mp3","piste-B.mp3"],"exclusive":true,"count":4}
]}
```

Utiliser un nom technique sans accents pour chaque recette. Les arguments sont transmis directement au processus, sans shell. Chaque recette reçoit son propre dossier de résultats et profil Electron. Le plan peut contenir des chemins privés : le garder hors du dépôt.

Le nombre de processus simultanés est borné de 1 à 4 ; deux est le défaut. Les recettes non exclusives démarrent d’abord. Les recettes Electron partagent par défaut la ressource `electron-ui` et passent une à la fois : sur le PC de test, deux consoles simultanées ont provoqué des erreurs de capture et des commandes expirées. La suite `@unit` tourne en parallèle avec une console, avec deux fichiers de tests Node simultanés. Des ressources explicites permettent d’autres plans lorsque le matériel le supporte. Une recette exclusive attend leur fin et tourne seule parmi les recettes du lanceur. Celui-ci ne contrôle pas les autres logiciels du PC. Les recettes audio, rendus et mesures de bibliothèque doivent rester exclusives. Un échec arrête les nouveaux départs, en attendant les processus déjà engagés.

`--phase parallel` ou `--phase exclusive` sépare les deux étapes. `--root chemin/app.asar` teste le code du paquet Windows en conservant les scripts de recette du dépôt. La phase courante peut réussir alors que le rapport global reste incomplet.

Une relance dans le même dossier réutilise un résultat réussi seulement si le runtime, la recette, ses arguments, sa politique/count et l’empreinte du rapport correspondent. Un nouveau runtime impose une nouvelle recette. Le rapport `batch-report.json` indique précisément les cas réutilisés ; cela ne constitue pas une nouvelle exécution. Les logs et rapports restent locaux.

## Compilation plus rapide

```powershell
npm run pack:installer:fast
```

Ce mode demande le niveau de compression 1 au builder installé, via son option prévue `ELECTRON_BUILDER_COMPRESSION_LEVEL`. Le mode normal reste disponible avec `npm run pack:installer`. Une valeur explicite de la variable d’environnement reste prioritaire. Les sources et ressources embarquées ne changent pas ; le fichier est plus volumineux. Comparer le contenu, les ressources et l’intégrité des deux exécutables après construction. Le niveau de compression n’agit pas sur le son ni sur les modèles.
