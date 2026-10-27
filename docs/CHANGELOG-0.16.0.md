# Version 0.16.0

## Sidechain léger

Le bouton **PUMP** du mixer active une compression rythmique de la partie médium/aiguë de la musique, déclenchée par ses attaques graves. Le corps du kick et les basses sont davantage préservés. Le traitement est désactivé par défaut ; son dosage initial de 2,5 dB et son relâchement de 180 ms donnent un mouvement discret. Dosage, durée de retour, seuil et limite des graves préservés se règlent dans **Master → Sidechain**. Un témoin de détection et une barre de réduction montrent le fonctionnement réel du moteur.

Le traitement est stéréo lié et sans anticipation, donc sans délai audio ajouté. Désactivation et remise à zéro libèrent le gain. Il est appliqué au bus musique : les micros/entrées ligne conservent leur propre chemin et l’autoduck micro reste indépendant. Les réglages et la mesure sont également disponibles depuis la console Web.

La détection travaille sur les attaques graves du mix complet. Elle peut donc réagir à certaines notes de basse, pas uniquement à un kick isolé. Le seuil est réglable. Le test sur un extrait ODESZA de 24 secondes mesure un maximum d’environ 2,1 dB de réduction et une variation globale de niveau de −0,31 dB au réglage initial ; ce résultat ne garantit pas le même dosage perceptif sur tous les titres.

## Transitions et Automix

Le menu rassemble maintenant 27 choix, dont les familles de transitions disponibles : Fondu, Filtre, EQ, Echo, Dissolve, Tremolo, Riser, **Écho orbital**, **Sweep**, **Jet** et trois transitions à stems. **Stems · Tenue harmonique** suspend un fragment des instruments isolés pendant le relais. Les voix sont exclues de ce fragment ; un instrument coupé manuellement reste coupé. La tenue requiert les stems précalculés sur les deux platines.

Les quatre ajouts utilisent des traitements distincts, des queues bornées et des branchements temporaires libérés après le passage ou son annulation. Les filtres, répétitions et étapes suivent l’horloge du tempo progressif. Un accent automatique ne remplace plus les automations propres au Sweep, au Jet ou au Whoosh.

Le choix automatique tient compte des tempos, de la fiabilité de grille, de la densité et de l’énergie mesurées, des tonalités estimées, des stems disponibles, de l’intensité et des deux derniers effets. Il alterne les familles adaptées. Un arrangement dense réduit le chevauchement à huit temps ; les effets plus appuyés demandent un dosage plus élevé. Les cas incompatibles conservent un relais sobre. Voir [la politique de sélection](AUTOMIX-0.16.md) et [le catalogue des transitions](TRANSITIONS-0.16.md).

## Vérification et limites

La suite comprend 200 tests réussis. Dix-huit contrôles Electron vérifient notamment l’activation du vrai worklet depuis Web/PC, sa réduction visible, les réglages distants, l’exclusion du micro, les nouveaux types de transitions, leurs annulations, les boucles, le sampler, les pochettes et les mises en page. Des rendus utilisent les deux MP3 fournis ; d’autres utilisent des stems synthétiques identifiés et le vrai chargeur de stems pour vérifier les canaux et les retours audio.

Une grille musicale détectée reste une estimation corrigeable, même lorsque les horloges des platines sont synchronisées. Les enregistrements personnels utilisés pour les essais restent hors du dépôt public.
