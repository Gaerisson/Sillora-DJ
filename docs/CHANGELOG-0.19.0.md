# Sillora DJ 0.19.0 — bibliothèque et préparation

Le catalogue s’affiche dès la découverte des fichiers. Le décodage et les analyses continuent ensuite, avec priorité aux platines et au prochain morceau. Un chargement explicite peut devancer le reste de l’import.

## Application

- Import avec progression, pause, reprise, annulation et relance des erreurs. Reprise des références Windows autorisées après redémarrage, sans démarrer la lecture.
- Catalogue persistant dans le profil Windows, indépendant du port du serveur local. Les chemins ne sont réutilisés qu’après validation ; les tokens IPC sont renouvelés.
- Cache d’analyse natif compressé, versionné et identifié par SHA-256 du contenu, avec repli IndexedDB. Nettoyage LRU à 500 résultats ou 128 Mio.
- Réanalyse par titre sans remplacer la source qui joue. Grille, régions, tonalité, cues et favoris manuels conservés.
- Bibliothèque et dossiers paginés à 100 lignes ; recherche/tri sur le catalogue. Rafraîchissement du dossier actif préservant le filtre et découvrant les nouveaux fichiers sans décoder leur audio.
- Déchargement des originaux inutilisés avec budget souple de 384 Mio, puis récupération à la demande. Platines et stems actifs protégés.
- Suspension du travail d’analyse de fond pendant transition/scratch ; les demandes prioritaires restent éligibles. Les états de préparation sont transmis à Remote.

## Vérification reproductible

246 tests automatisés réussis. Les deux recettes Windows ont été exécutées sous Electron sur deux vrais MP3 : six scénarios bibliothèque et quatre audio/Remote. Le premier banc construit 1 000 références à partir de ces deux fichiers ; il ne mesure pas l’analyse de 1 000 musiques distinctes.

```powershell
npm test
npm run test:library:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:audio:windows -- "piste-A.mp3" "piste-B.mp3"
```

Utiliser deux titres distincts de plus de 52 secondes. Les bancs créent leurs profils isolés et leurs rapports dans `.runtime/library-proof` et `.runtime/audio-proof`. Ils ne modifient pas le profil installé. Le banc audio produit aussi un rendu de continuité de 12 s et des captures ; les musiques ne sont pas fournies.

Le banc bibliothèque vérifie découverte avant décodage, priorité A/B, annulation pendant lecture, reprise après changement de port avec nouvelles références, conservation des corrections à la réanalyse, récupération de PCM et rafraîchissement sans lecture audio. Le banc audio vérifie les mesures stéréo, Remote et la continuité de secours.

## Limites

Un appel natif déjà engagé n’est pas interrompu ; son résultat peut être abandonné après annulation. Les fichiers glissés ou choisis dans un navigateur doivent être resélectionnés après fermeture. Le budget PCM ne limite ni tous les buffers stems ni la mémoire globale.

Le navigateur de dossiers reste plafonné à 2 000 entrées par réponse et n’est pas un indexeur récursif. Il n’analyse pas passivement chaque dossier visité. Les priorités ne reposent pas sur une mesure de charge CPU/GPU.

Ce lot améliore la préparation et la continuité opérationnelle. Il n’apporte pas de nouvelle validation perceptive des transitions, de détection sémantique des phrases/drops, de grille à tempo variable ou de branchement complet de la maquette UI. [Suivi des exigences et travail restant](AUDIT-SUIVI.md).

Les distributions prévues sont `Sillora-DJ-Setup-0.19.0.exe` et `Sillora-DJ-0.19.0-Windows.exe`. L’intégrité du paquet et la correspondance aux sources sont vérifiées séparément avant remise des exécutables. L’installation sur le profil personnel n’est pas lancée automatiquement.
