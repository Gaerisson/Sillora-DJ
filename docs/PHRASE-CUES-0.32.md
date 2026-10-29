# Phrases préparées — 0.32

Dans **Préparation → Analyse**, l’éditeur **Phrases préparées** permet de placer jusqu’à 32 repères par morceau. La même commande est disponible sur Remote, dans **Outils DJ** de chaque platine.

1. Déplacer le curseur sur une phrase choisie à l’écoute.
2. Nommer le point et cliquer **Au curseur**. **Sur la mesure** cale les nouveaux points sur la mesure la plus proche lorsque la grille est exploitable.
3. Choisir **Entrée** pour le moment où le nouveau groove doit prendre le relais, ou **Sortie** pour le moment où le titre courant doit le céder. Un seul point de chaque rôle peut être désigné ; les autres restent des repères de navigation.
4. Choisir **DJ dynamique** avec le profil **Mix musical**, puis activer **Relais sur repères** pour les passages préparés.

**Entrée désigne le moment du relais, pas le début de la lecture.** Le titre entrant démarre plus tôt pour atteindre le point préparé pendant le relais des graves ou du filtre. L’avance est recalculée avec le tempo, sa courbe et la durée réelle, y compris avec Next. Prévoir suffisamment de musique avant et après le repère.

Les points sont visibles sous les codes P1, P2… sur les ondes PC/Remote. Leur nom et leur position sont modifiables ; Aller déplace la lecture, × supprime le point. Créer, renommer ou attribuer un rôle ne relance pas la source audio.

## Priorités et garde-fous

- Les IN/OUT définis manuellement gardent la priorité. Les styles choisis explicitement et les autres profils Auto ne sont pas déplacés par ces repères préparés.
- Les repères préparés guident Auto musical. Pour les titres ainsi préparés, son choix d’effets reste dans les partitions compatibles avec ce calage : graves, phrase harmonique, filtre, Whoosh et écho.
- La grille et la synchronisation doivent permettre l’arrivée préparée. Avec la quantification active, un point hors mesure est ignoré ; le point enregistré n’est pas déplacé silencieusement. Pour le recaler, naviguer vers lui puis le recréer avec Sur la mesure, ou corriger sa position.
- Un point qui manque de réserve audio ou une sortie déjà dépassée laisse place au choix automatique. Le moteur ne revient pas en arrière pour retrouver une sortie préparée. Next privilégie le passage immédiat et recalcule l’arrivée entrante.
- Une modification pendant un passage prépare les suivants. L’arrivée et l’horaire déjà programmés restent figés. Identité du morceau et révision des repères protègent les commandes distantes périmées.
- Les points sont enregistrés avec la préparation du fichier, conservés après réanalyse et rechargement. Une identité audio différente ou des positions devenues invalides ne reprend pas des repères incompatibles.

Ces repères sont des annotations de l’utilisateur. Les changements d’énergie R1/R2 restent des mesures automatiques distinctes ; la reconnaissance automatique des couplets, refrains, voix et drops reste à développer.

[Recette et limites](CHANGELOG-0.32.0.md) · [Audit](AUDIT-SUIVI.md)
