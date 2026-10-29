# Sillora DJ 0.26.0 — arrivée musicale au relais

Le plan Automix peut préparer le titre entrant avant un changement mesuré pour que celui-ci atteigne le relais, en évitant une arrivée trop tôt ou trop tard dans le passage. Option **Arrivée sur repère** dans le preset Dynamique, mémorisée et pilotable sur Remote. [Fonctionnement](ARRIVAL-0.26.md).

![Calage d’arrivée dans les réglages du passage](images/arrival-026.png)

## Comportement livré

- Repère d’énergie/graves conditionné par deux grilles fiables, une avance audible et une réserve après le relais. IN/OUT manuels prioritaires ; aucun changement du détecteur de tempo ni des seuils de confiance.
- Calcul de l’avance avec l’intégrale du tempo. Next recalcule son départ et son alignement sur la mesure sortante pour la durée effective ; une fin trop courte conserve un repli sans fausse indication d’arrivée.
- Repère ARRIVÉE sur l’onde entrante, aperçu du temps, même identité sur Remote ; les marqueurs ne s’appliquent pas à une piste remplacée. Le départ de passage reste distinct de l’IN mémorisé.
- Les indices de version obsolètes dans l’en-tête du PC et la bibliothèque sont retirés ; la version de distribution reste dans les réglages. Le descriptif du relais harmonique parle de mesures, sans prétendre reconnaître une phrase.

## Vérification

**332 tests automatisés et 53 cas natifs passent depuis le code final embarqué.**

| Périmètre | Cas |
| :--- | ---: |
| Option, ondes, Remote et Next dans la vraie interface | 6 |
| Préparation de grille, persistance et conflits | 9 |
| Gestes d’onde et Remote | 10 |
| Bibliothèque et cache | 6 |
| Continuité audio et Remote | 4 |
| Rendus automatiques sur les deux MP3 | 4 |
| Comparatifs sur trois paires Opus, programmé/Next, activé/désactivé | 12 |
| Repli avec une grille incertaine | 2 |

Les comparatifs couvrent un tempo montant, descendant et une équivalence demi/double. Ils utilisent les analyses de production sans correction manuelle de grille. Avec l’option active, la tête entrante rejoint le repère à moins de 10 ms dans le banc ; le relais sortant est contrôlé sur sa mesure. Ces valeurs décrivent les horloges du moteur, avec une résolution de bloc native, et non une mesure acoustique de latence matérielle ou une référence musicale humaine. Les douze fichiers restent finis, sans saturation ni fenêtre silencieuse de 50 ms selon les seuils du banc.

Les [mesures anonymisées](ARRIVAL-MEASURES-0.26.json) permettent de comparer les têtes au relais avec et sans l’option. Les douze WAV et leur lecteur sont préparés localement, hors du dépôt. Les anciennes recettes de continuité, de scratch et de bibliothèque restent dans la sélection ; la recette complète de chaque lot antérieur n’est pas répétée.

La recette UI a révélé une référence de plan absente au démarrage des platines vides ; elle est maintenant gardée. Le contrôle de visibilité a aussi été corrigé pour ouvrir les réglages comme l’utilisateur. Les erreurs initiales sont conservées dans les preuves locales. Relecture par l’auteur, sans revue indépendante déclarée. Les deux thèmes passent à 1440/480 px ; le téléphone appairé passe à 390 px.

## Distribution

**149 sources** comparées à app.asar ; ressources de stems/import et métadonnées contrôlées. Installateur et portable contiennent le même paquet ; contrôle d’intégrité de **7 215 fichiers**. Installation sur le profil personnel non exécutée.

| Fichier | Octets | SHA-256 |
| :--- | ---: | :--- |
| Sillora-DJ-Setup-0.26.0.exe | 289780727 | d679b634200546dd04ae2140ad8c611581bef38058689461849ff65c5bdbe415 |
| Sillora-DJ-0.26.0-Windows.exe | 289538734 | ba73f50a2130c00473423f7951095cb778bfbbc0e6aa0e1da37a449909cc8836 |

Les exécutables sont préparés localement, sans publication dans GitHub Releases.

## Limites

Le repère reste une estimation d’énergie ou de graves. Ce lot n’ajoute ni reconnaissance de phrases, voix, buildup/drop ni grille variable, et ne requalifie pas les 66 grilles incertaines du corpus. Un repère bien exécuté n’est pas nécessairement le meilleur choix musical. La validation d’écoute, les longues sessions, les budgets stems, la régie acoustique et la refonte complète restent ouverts dans le [suivi](AUDIT-SUIVI.md).
