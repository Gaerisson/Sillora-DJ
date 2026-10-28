# Repères d’arrangement — lot E

## Intention

Poursuivre les sections 3.1 et 3.2 du cahier des charges et la préparation de la refonte UI : les points de passage doivent s’appuyer sur la musique analysée et rester compréhensibles et modifiables. La grille régulière ne constitue pas une détection de phrases.

## Choix de réalisation

Le lot réutilise les enveloppes de niveau et de graves ainsi que la densité spectrale déjà calculées en worker. Il recherche des changements durables entre groupes de mesures, avec score de confiance et rejet des accidents isolés. L’affichage parlera de **repères d’arrangement** : montée/retrait d’énergie ou changement de texture, sans annoncer une reconnaissance de voix, refrain ou drop.

Choix technique de l’implémentation dans le cadre du plan déjà demandé : réutiliser ces caractéristiques mesurées, plutôt qu’ajouter un nouveau modèle ou une nouvelle passe spectrale. Cela conserve le moteur et les dépendances existants. La reconnaissance sémantique reste un chantier distinct.

## Comportement

- Les analyses incertaines, les morceaux trop courts et les arrangements sans changement net ne produisent pas de repères artificiels. Ils conservent le repli énergétique actuel.
- Les changements doivent durer au moins deux mesures de chaque côté et sont espacés pour éviter de traiter chaque kick comme une section.
- Les IN/OUT automatiques peuvent privilégier un repère proche de leur région actuelle. Les corrections manuelles sont prioritaires. Les derniers temps du passage doivent tenir avant EOF.
- Le relais des graves du plan commun est placé sur le repère sortant ; la durée et la vitesse moyenne restent exprimées en temps natif du fichier.
- La carte est persistée avec l’analyse. Une grille modifiée invalide la carte correspondante. PC et Remote affichent les mêmes repères, sans analyser de PCM dans le dessin de l’onde.
- Le panneau d’analyse présente les repères, permet de les écouter et de poser IN/OUT, avec les contrôles de validité existants.

## Validation

Tests synthétiques : changement durable, changement de texture à niveau constant, accent isolé, pulsation stable, silence, grille incertaine, décalage de premier temps, manuel prioritaire, tempo morph dans les deux sens, place avant EOF, persistance et état Remote borné. Recette Electron sur les deux MP3, fonctionnement des contrôles, marqueurs PC/Remote et rendus musicaux avec repères automatiques. Comparaison technique et extraits d’écoute ; aucune certification perceptive par les seules mesures.

## État

Implémentation, revue ciblée et paquet vérifiés. Les 282 tests automatisés et les 60 cas natifs passent ; ces derniers sont exécutés depuis le code embarqué. Les 140 fichiers applicatifs correspondent aux sources, et les deux exécutables ont le même contenu contrôlé par intégrité. Les reprises du banc bibliothèque et les limites sont conservées dans les [notes de version](CHANGELOG-0.22.0.md). Les exigences restantes du registre et la refonte complète de la console ne sont pas déclarées terminées par ce lot.

## Résultats et compromis

Les deux MP3 de la recette ont une stabilité de grille trop faible pour une carte automatique. Le banc UI corrige explicitement la grille avant de proposer les repères ; les rendus de régions acceptent également cette grille pour tester l’exécution du plan. Deux des quatre relais suivent un repère mesuré ; les deux autres conservent le repli énergétique. La reconnaissance automatique des phrases sur ces morceaux reste ouverte.

Les [relevés des quatre rendus](ARRANGEMENT-MEASURES-0.22.json) précisent le relais prévu et exécuté, le repère utilisé ou le repli, les crêtes et la continuité. Ils ne contiennent aucun audio ni nom de fichier personnel.

La revue a reproduit un relais décalé par la quantification du départ : la phase du relais est maintenant prise en compte et les temps de repères ne sont plus arrondis. Elle a aussi reproduit une action sur une nouvelle piste depuis un ancien panneau d’analyse ; les commandes contrôlent désormais l’identité de la piste. Les régressions moteur et natives passent après correction.

Le changement de cache conserve les préparations par digest des octets audio, et non par version de données dérivées. La recette simule un catalogue de l’ancienne version de régions, supprime le repli de préparation localStorage puis recharge le titre : grille et IN/OUT manuels sont conservés sans lecture automatique. Les caches d’analyse peuvent être recalculés.
