# Choix automatique des transitions — 0.16

Le mode musical choisit désormais un effet selon les informations disponibles sur les deux morceaux. Il utilise une liste de candidats limitée par le calage du tempo, la fiabilité de la grille, la tonalité, la densité estimée, l’évolution d’énergie et les stems effectivement prêts. La même paire et le même historique donnent la même proposition. Les scores musicaux déterminent la préférence ; une empreinte de la paire ne sert qu’à départager une égalité de score.

| Situation | Choix admissibles et limites |
| --- | --- |
| Tempos non synchronisés, tonalités incompatibles ou tempo non fiable | Relais propre au tempo naturel, sans longue superposition rythmique. |
| BPM mesurés mais grille encore estimée, avec Tempo progressif | Whoosh, filtre, Sweep ou écho ; au plus 16 temps. L’incertitude du premier temps reste signalée. Les découpes rythmiques et tenues harmoniques sont exclues. |
| Arrangement dense avec grille stable | Échange de graves, filtre ou écho sur 8 temps au maximum. Des stems prêts permettent un relais de voix séparées. |
| Faible intensité | Fondu, échange des graves ou relais harmonique discret. Pas de Jet, de Tremolo ni de grande texture de souffle. |
| Clés compatibles et grille stable | Relais harmonique, Dissolve, filtre, écho orbital ou fondu ; la durée demandée reste bornée selon le traitement. |
| Variation de tempo active | Priorité au Whoosh ou au Sweep pour composer le changement de vitesse autour du relais musical. |
| Montée ou baisse d’énergie mesurée | La montée favorise les balayages ; la baisse favorise une sortie d’écho. Ce sont des heuristiques, pas une détection de refrain ou de drop. |
| Stems prêts et clés connues compatibles | Fondu de stems, écho des voix ou tenue harmonique peuvent être choisis. Une préparation indisponible ne crée pas de faux traitement de stems. |
| Morceaux rapides et intensité explicitement élevée | Tremolo ou Jet deviennent admissibles ; ils restent courts. |

La mémoire évite les deux derniers types de passage quand d’autres candidats restent admissibles. Cette règle empêche le même Whoosh de revenir systématiquement sur les paires à grille estimée. Si la liste admissible est très courte, le choix préfère éviter au moins le dernier effet. La proposition reste stable tant que la paire, les réglages et l’historique ne changent pas.

Le profil Variations FX garde une sélection pondérée plus variée, étendue à Sweep, écho orbital, Jet, Tremolo et tenue harmonique quand leurs conditions sont remplies. Il conserve les relais sobres pour une synchronisation absente ou un arrangement dense. Les familles demandant une grille stable ou une préparation de stems ne sont pas activées seulement pour augmenter le nombre de choix.

## Validation

Les tests du sélecteur vérifient la stabilité des aperçus, la mémoire des effets, les bornes de durée, la protection des cas sans synchronisation ou avec conflit de clés, les conditions de stems, les dosages faibles et l’absence de mutation de l’analyse des morceaux. Ils ne prouvent pas que les estimations de tempo, de tonalité ou d’énergie sont musicalement exactes. La correction du premier temps reste utile lorsque les attaques ne coïncident pas.
