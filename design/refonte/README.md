# Proposition de refonte Sillora DJ

Maquette interactive distincte de l’application exécutée. Le registre intégré reste la baseline 0.17.0 ; les évolutions réelles 0.18–0.20 sont détaillées dans le [suivi de l’audit](../../docs/AUDIT-SUIVI.md). Les titres, analyses, niveaux et commandes de la maquette sont illustratifs. Elle ne joue pas de musique et ne modifie aucune session, aucun périphérique, aucun fichier musical ni aucun réglage de l’application.

Ouvrir `index.html` dans un navigateur, ou lancer depuis la racine du projet :

```powershell
node design/refonte/serve.mjs
```

Ouvrir l'adresse locale affichée. Le serveur écoute uniquement sur `127.0.0.1`, sert les ressources autorisées de la proposition et s'arrête avec Ctrl+C.

Parcours disponibles : Studio, Automix, Préparation, Régie, Visuels ; réglages, Remote et Sources s'ouvrent depuis les commandes correspondantes. Le lien en haut donne accès aux 374 points filtrables de l'audit.

- Thèmes Obsidienne / Porcelaine, disposition compacte et bibliothèque redimensionnable.
- Recherche, favoris, tri BPM/clé, file et chargement illustratif sur A/B.
- Seek, scratch vinyle et contrôles de transport illustratifs.
- Timeline de transition, sélection de mode et inspecteur.
- États micro communs entre en-tête, régie et pied de page.
- Pages de traitements, scènes et réglages proposés.

[Audit complet](../../docs/AUDIT-REFONTE.md) · [Principes de refonte](../../docs/REFONTE-UI.md) · [Suivi](../../PROGRESS.md).

© 2026 Gaerisson. Développement avec assistance IA, notamment ChatGPT d'OpenAI. Le symbole et les couvertures illustratives sont des ressources du projet ; les crédits et licences des dépendances restent conservés.
