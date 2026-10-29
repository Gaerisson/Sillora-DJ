# Cache disque des stems — 0.29

Ouvrir **Stems → Réglages → Cache disque**. Le panneau indique la taille des caches gérés, leur nombre et la partie protégée. Les chiffres concernent les caches v2 reconnus ; ce n’est pas l’usage total du disque ni la mémoire du modèle.

Le quota peut être réglé à **1, 4, 16 ou 32 Gio** ; le défaut est **16 Gio**. Il est enregistré sur le PC et relu par un nouveau service. Changer le quota applique un nettoyage des résultats inactifs les plus anciens. Une nouvelle préparation réussie ou une réutilisation de cache applique aussi ce contrôle.

**Supprimer les caches inactifs** retire les fichiers générés admissibles, sans modifier les sources en mémoire. Les originaux et le modèle sont conservés. La gestion du disque se fait sur le PC ; Remote garde les commandes de mixage.

## Protection et limites

Un travail natif actif est protégé. Avant que son empreinte soit connue, le nettoyage attend pour toutes les entrées. Les résultats délivrés/lus récemment restent protégés pendant deux minutes ; une lecture prolonge cette protection. Le quota est donc souple : un résultat protégé peut le dépasser, et le panneau le signale. Un nettoyage ne déclenche pas une nouvelle séparation ; un résultat supprimé devra être préparé de nouveau si nécessaire.

Le cache est géré par empreinte d’entrée et ordre de dernier accès, dans le seul espace v2. Les anciens manifestes v2 valides sont reconnus ; un marqueur identifie aussi les nouvelles préparations incomplètes. Les caches v1, dossiers non reconnus, fichiers étrangers et liens sont laissés en place. Les opérations retirent uniquement les noms de fichiers générés autorisés, puis un dossier s’il est vide, sans suppression récursive. Les tailles des fichiers étrangers ne sont pas incluses dans le quota géré.

Le service sérialise les opérations de maintenance et revérifie les protections avant suppression. Un échec d’entretien ne remplace pas un résultat de séparation réussi. Les essais couvrent les protections, les changements de quota, les liens/jonctions et la concurrence sur de petits jeux de cache, ainsi que le résultat réel de huit secondes. Ils ne certifient pas encore les performances d’un disque rempli de dizaines de Gio ni les longues sessions.
