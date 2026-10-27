# Version 0.14

## Transitions

Filtre et Whoosh retirent le grave sortant et font monter un passe-haut pendant que le titre reste audible. Le titre entrant garde son grave au relais. Souffle filtré et queue d’écho accompagnent le mouvement selon l’intensité. Écho, espace, EQ, dissolve et fondu ont des enveloppes distinctes.

Le mode automatique utilise tempo, confiance de grille, clé et régions mesurées. Une grille incertaine évite la synchronisation forcée. IN, OUT et premier temps restent réglables. Les repères manuels sont conservés ; les anciennes régions automatiques sont recalculées.

**Suivant / Mixer maintenant** utilise le titre préparé ou une proposition dans le dossier du set et commence au prochain temps sûr. La durée suit le réglage de transition, limitée à seize temps pour ce passage immédiat. Automix utilise les sorties calculées et la sélection compatible, aléatoire sans répétition ou dans l’ordre.

Pause applique un freinage bref. CUE et les coupures restent immédiats. La sortie de boucle conserve la position audible au lieu de reprendre une horloge qui aurait continué hors de la boucle.

## Interface et sources

Deux platines ou Automix ; ondes horizontales ou verticales ; outils repliables ; identité et visuels dans Signature ; fenêtres Visuels, Infos et Son. Les disques restent circulaires et les animations suivent les dimensions réelles. Les couvertures sont visibles dans la collection, les platines, Automix et Remote. Le bouton de pochette par titre permet une recherche manuelle.

Les imports YouTube / SoundCloud compatibles sont enregistrés dans Musique / Gaerisson DJ Studio, puis chargés ou ajoutés à la file. Les contenus privés, payants et indisponibles restent refusés. La version ne propose pas de connexion SoundCloud Go+.

Les stems sont préparés par le runtime CPU et le modèle intégrés. Leur calcul est distinct de la lecture et peut être long ; le résultat est conservé dans le cache local.

Le sampler capture au curseur de A/B ou importe un sample de trente secondes maximum. Huit pads conservent leurs extraits, volume et option de boucle. Les pads passent dans le bus musique, donc dans le ducking et REC.

## Régie et Remote

Chaque entrée possède sa source, son gain, sa diffusion et ses traitements. Onde brute, niveaux d’entrée/sortie et réduction musicale rendent les réglages visibles. Les contrôles donnent accès au seuil et à la profondeur de ducking, à l’attaque, au maintien, au retour, au gate, compresseur, limiteur, EQ et filtres anti-larsen. Le master propose mono, balance, EQ, DIM et coupure générale.

La Remote reçoit un flux d’états et un retour de commande confirmé. Les sliders regroupent les valeurs en attente et la boucle affiche sa position audible. Les commandes se suspendent si le studio ne répond plus. La latence dépend aussi du réseau.

## Vérifications

168 tests automatiques couvrent transport, régions, DSP, sampler, téléchargements et Remote. L’essai Electron complet a chargé deux MP3 réels, exécuté un passage filtre et vérifié boucle, freinage, déplacements, pads, pochette, micro simulé et formats mobile / PC. Une séparation CPU hors ligne de quatre secondes a fourni les quatre pistes. Un lien SoundCloud public a été récupéré puis décodé dans Electron.

Ces tests détectent des défauts fonctionnels et mesurables ; ils ne démontrent pas une qualité subjective universelle. Les rendus comparatifs fournis séparément permettent de juger les passages à l’écoute.
