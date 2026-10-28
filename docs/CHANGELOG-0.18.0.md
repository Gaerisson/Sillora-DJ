# Sillora DJ 0.18.0 — mesures réelles et secours de préparation

28 octobre 2026. Lot A de la refonte : continuité et mesures. La nouvelle interface complète reste une proposition séparée.

## Mesures audio

- AudioWorklet de mesure passif, sans insertion dans le chemin audible. Le traitement principal ne dépend pas du fonctionnement du mètre.
- Master après le limiteur final ; platines après EQ, effets directs, volume et trim, avant crossfader. Les retours d'écho et de réverbération sont mesurés au master.
- L/R indépendants : RMS par fenêtre d'environ 50 ms, crête échantillon, maintien 1,5 s puis décroissance, saturation mémorisée 2 s et compteurs d'échantillons invalides/saturés.
- Affichage dans le studio et dans Remote à partir des mêmes mesures. Les mètres sont signalés indisponibles en l'absence de données fraîches ; ils ne simulent pas le son.
- Déconnexion Remote : arrêt du flux et rejet des réponses tardives, qui ne peuvent plus réactiver la session ni ses mètres.
- Clic ou Entrée/Espace sur le témoin PEAK local : remise à zéro des maintiens et compteurs.

Ces mesures ne sont pas des mesures true peak, LUFS, de latence acoustique ou d'underruns. Les paramètres des mètres ne sont pas encore exposés dans l'inspecteur proposé.

## Préparation tardive

Pendant un import ou une préparation asynchrone encore active, le planificateur peut armer un maintien audio avant la fin audible du titre. Ce maintien utilise une courte région du morceau et des fondus de 4 ms de part et d'autre des raccords, programmés en avance sur l'horloge audio.

Lorsque le titre suivant est prêt, un relais EQ court prend le relais. Pause, arrêt d'Automix, chargement, seek et prise en main manuelle retirent ce secours. Une boucle utilisateur lui reste prioritaire. Sans préparation en cours, le dernier titre du set se termine normalement.

Le budget supervisé est de 30 secondes et empêche un réarmement permanent sur le même titre. L'expiration est surveillée par le planificateur : si l'interface reste bloquée, le maintien audio peut continuer jusqu'à la reprise de cette surveillance. Ce mécanisme ne remplace pas un lecteur de secours entièrement autonome ni une détection musicale avancée des phrases.

## Validation

- **225 tests automatisés réussis**, dont nouveaux cas L/R, opposition de phase, impulsion entre rafraîchissements, saturation, valeurs invalides, protocole Remote et maintien/annulation/expiration.
- Lecture des deux MP3 de test sous Electron avec mesures au master et sur les platines.
- Télécommande appairée sur écran 390×844 : canal droit coupé dans la sortie programme et distinct du gauche dans les mètres ; composants chargés par le serveur Remote.
- Rendu AudioWorklet natif : écart maximal **0** entre le programme mesuré et le même programme sans branche de mesure.
- Rendu de 12 secondes à partir des deux fichiers musicaux : maintien au-delà de la fin initiale, puis relais après disponibilité tardive. Aucun échantillon non fini ni fenêtre silencieuse de 50 ms entre 0,1 et 10 secondes ; crête maximale 0,937 ou moins dans ce test.

Le rendu personnel et les fichiers musicaux ne sont pas distribués dans le dépôt. Ces essais ne valident pas tous les styles de transition, le maintien de hauteur dans tous les cas, les sessions prolongées ou la qualité perceptive par comparaison aux vidéos.

### Reproduire les essais Windows

Après préparation des dépendances de développement, fournir deux morceaux locaux distincts d'au moins 52 secondes :

```powershell
npm run test:audio:windows -- "D:\Musique\piste-A.mp3" "D:\Musique\piste-B.mp3"
```

Le [banc de contrôle Electron](../scripts/qa-audio-continuity.cjs) utilise un profil isolé dans `.runtime/audio-proof`, sans ouvrir de micro ni modifier la session installée. Il vérifie les mesures réelles, le rendu sans modification par le mètre, le secours suivi du relais, puis l'affichage et la déconnexion Remote. Rapport, captures et extrait musical de test restent localement dans `.runtime/audio-proof/results`, hors du dépôt. Le son de la fenêtre de test est coupé. Les seuils mesurés portent sur ce scénario et ces fichiers, pas sur tous les morceaux.

## Suite du document

Découverte immédiate et reprise des imports, réanalyse manuelle et file prioritaire complète ; planification musicale et analyse des références ; branchement progressif des composants de la nouvelle interface. Les 374 états de l'audit initial restent un instantané de la 0.17.0, pas un décompte actualisé après ce lot.
