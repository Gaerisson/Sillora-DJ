# Transitions Sillora DJ

Chaque style combine une courbe de relais et des traitements audio programmés sur la même horloge musicale.

| Style | Traitement |
| --- | --- |
| DJ dynamique | Sélection selon tempo, grille, énergie, densité, tonalité estimée, stems et historique. |
| Fondu · Velours | Relais à puissance constante. |
| Filtre · High-pass | Retrait progressif des graves et souffle filtré. |
| EQ · Échange des graves | Relais des bandes sur une couche distincte des réglages manuels. |
| Echo out | Capture rythmique et répétitions amorties. |
| Dissolve | Retrait du bas et du haut, relief des médiums. |
| Tremolo · Pulse mix | Pulsations suivant le nombre de temps. |
| Écho orbital | Deux délais croisés gauche/droite, mouvement stéréo et assombrissement des retours. |
| Whoosh rise | Montée de souffle, mouvement de filtre et retour des graves. |
| Sweep | Balayage sortant, ouverture du titre entrant et retour réverbéré court. |
| Jet | Réflexions courtes modulées, bande mobile et souffle dosé. |
| Stems · Fondu des voix | Voix espacées, batterie et basse relayées. |
| Stems · Echo out | Écho sur la voix isolée du titre sortant. |
| Stems · Tenue harmonique | Suspension d’un fragment des instruments isolés pendant le relais. |

Les effets suivent l’intégrale du tempo progressif. Filtres, envois, répétitions et étapes restent liés au relais pendant une accélération ou un ralentissement. Les retours sont bornés, filtrés et fondus à l’annulation. Leurs branchements sont déconnectés après leur queue ; PANIC arrête les retours restants.

La tenue harmonique requiert des stems préparés. Elle lit la paire `other` d’après l’ordre du chargeur : batterie 0/1, basse 2/3, instruments 4/5, voix 6/7. Les voix sont exclues du fragment et un instrument coupé reste coupé. Les grains fenêtrés sont lus à leur hauteur native, avec une tenue bornée à 3,6 secondes. Sans stems prêts, le planificateur explique le repli vers le relais EQ.

En automatique, la tenue d’accord demande des tonalités estimées compatibles. Les écarts de tempo excessifs et les grilles trop incertaines conservent un relais sobre. Les entrées micro et ligne gardent leur chemin de traitement dédié.
