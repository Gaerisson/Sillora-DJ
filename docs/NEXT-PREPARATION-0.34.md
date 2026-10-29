# Préparer le prochain titre — 0.34

Automix prépare le prochain morceau avec priorité sur le travail de fond. Si un fichier ne peut pas être lu, le studio le signale, l’écarte du set en cours et essaie un autre titre. Le morceau audible continue de jouer. Les propositions et le nombre de titres disponibles, sur PC et Remote, excluent ce fichier sans le compter comme joué.

Le témoin **PRÉPARATION…** et l’état distant indiquent qu’un chargement est encore en cours. Un morceau est retenu temporairement en mémoire pendant sa préparation : la pression du cache ne peut pas le retirer avant son affectation à la platine. Si son analyse déjà demandée est en attente, elle est promue et attendue avant l’armement. Le maintien d’urgence existant reste borné ; ce travail ne rend pas instantanés le décodage et l’analyse.

**Arrêter Automix**, changer de set ou charger une autre platine invalide la demande précédente. Un résultat ou une erreur tardive ne peut pas remplacer cette platine ni réarmer le set. Le décodage partagé peut continuer pour la bibliothèque ; son résultat ne reprend pas la propriété de la platine. Les réservations mémoire sont relâchées indépendamment et ne sont pas enregistrées sur disque.

Un nouveau démarrage explicite remet à zéro les exclusions du set précédent. Le chargement manuel permet aussi de réessayer un fichier retrouvé. Les erreurs de fichier sont distinctes d’une erreur critique du moteur, qui peut toujours interrompre Automix.

Un import sans rapport avec le set ne suffit plus à déclencher le maintien de secours lorsque le set est terminé. Seule une préparation utile ou l’import du dossier Automix actif justifie cette attente.

![Automix pendant la recette de fichier indisponible](images/next-preparation-034.png)

## Portée vérifiée

416 tests unitaires, 19 scénarios natifs source et 17 depuis le paquet Windows passent. Neuf scénarios de préparation couvrent une lecture native refusée, un autre choix, PC/Remote, mémoire froide, annulation, reprise manuelle, import distinct et sept passages accélérés sans répétition. Cette recette réemploie deux vrais fichiers avec des identités de catalogue différentes ; elle ne représente pas huit musiques distinctes ni plusieurs heures de mix.

Six rendus de transition sur quatre fichiers distincts contrôlent séparément les grilles calculées, le tempo, la phase et les échantillons ; quatre scénarios contrôlent la continuité. La séparation automatique anticipée des stems n’est pas ajoutée. Gros fichiers, préparation sur une longue session et mémoire totale du processus restent à mesurer. [Mesures](NEXT-PREPARATION-MEASURES-0.34.json) · [Recette](CHANGELOG-0.34.0.md).
