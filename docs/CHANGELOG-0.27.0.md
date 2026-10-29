# Sillora DJ 0.27.0 — préparation des stems

La préparation des stems dispose maintenant d’un Worker d’encodage et d’enveloppes, de budgets CPU/mémoire/temps et d’un contrôle global PC/Remote. Le programme en lecture conserve sa source pendant le travail. [Utilisation et limites](STEMS-0.27.md).

![Préparation des stems](images/stems-027.png)

## Comportement livré

- Calcul natif unique, threads Torch bornés, temps maximum configurable et rejet des sources dépassant le budget avant allocation des stems.
- WAV/enveloppes hors du thread interface ; transferts et assemblage découpés. Les stems comptent dans le cache PCM et les imports de fond attendent pendant le travail.
- Annulation du bon processus, même après remplacement de platine ou rechargement de l’interface ; le bouton de préparation se réactive après la fin effective du processus.
- Cache v2 validé par format, horloge et empreintes des quatre fichiers ; publication atomique, reconstruction des fichiers altérés et conservation des niveaux précédents.
- Réglages mémorisés, synchronisés avec Remote et adaptés aux deux thèmes. Ancien numéro de version figé retiré de l’en-tête Remote.

## Vérification

**345 tests automatisés et 51 cas natifs passent depuis le code final embarqué.**

| Périmètre | Cas |
| :--- | ---: |
| Stems, vrai modèle, Worker, budgets, annulation, cache et redémarrage | 12 |
| Arrivée au relais et interface/Remote | 6 |
| Préparation de grille, persistance et conflits | 9 |
| Gestes d’onde et Remote | 10 |
| Bibliothèque et cache | 6 |
| Continuité audio et Remote | 4 |
| Rendus Whoosh/automatique sur deux MP3, sans correction manuelle de grille | 4 |

L’encodage Worker porte sur 180 secondes de PCM synthétique stéréo (69 120 044 octets de WAV) : plus grand écart entre images, 33,4 ms. La séparation utilise le modèle embarqué sur **huit secondes de musique réelle**, à 48 kHz, avec deux threads Torch. Elle conserve la lecture de l’autre platine, produit huit canaux et reconstruit la somme avec une erreur absolue maximale de 1,28 × 10⁻⁷. Ce contrôle de somme ne certifie pas l’isolation des instruments.

Cette préparation a pris environ **276 secondes**, pendant la compression de la distribution sur un PC à quatre cœurs logiques. Écart maximal entre images : 150 ms ; aucun échantillon non fini dans les mesures. Le calcul CPU reste lent et se prépare en amont. [Mesures anonymisées](STEMS-MEASURES-0.27.json).

Les recettes utilisent les IPC et le preload de production, des profils/cache isolés, le modèle/Python embarqués et un téléphone Remote à 390 px. Deux thèmes passent à 1440/480 px. Elles vérifient une annulation après remplacement de piste, une annulation Remote après rechargement, la corruption du cache et la conservation des niveaux, ainsi que la lecture réelle du tampon huit canaux. Le modèle ne sert pas de doublure dans cette recette ; les tests unitaires de cycle de vie utilisent, eux, des fixtures.

Une recette source a révélé un bouton restant désactivé après annulation : le retour d’état natif rafraîchit désormais les commandes. Le premier essai du paquet a été lancé avant la fin de copie des ressources et a été repris après copie complète ; cette erreur de séquencement n’est pas présentée comme un défaut d’installation corrigé. Les échecs initiaux restent dans les preuves locales. Relecture par l’auteur ; aucune revue indépendante déclarée.

## Distribution

**155 sources** comparées à app.asar, ressources et métadonnées contrôlées. Les deux exécutables contiennent le même paquet et l’archive passe son contrôle d’intégrité (7 215 fichiers). Installation sur le profil personnel non exécutée.

| Fichier | Octets | SHA-256 |
| :--- | ---: | :--- |
| Sillora-DJ-Setup-0.27.0.exe | 289785246 | 50bf84b5f592b4089e1f1cdfbe34fce297e47b340e964fd83ebea02edefe28b7 |
| Sillora-DJ-0.27.0-Windows.exe | 289543250 | 83fe626550a5a0f5394d26715c996027e2b275209203f26f6d5139949db2ae03 |

Les exécutables et les cinq WAV d’écoute de l’extrait restent locaux. Les sources, captures et mesures anonymisées sont publiées ; les binaires ne sont pas dans GitHub Releases.

## Limites

Le modèle et la méthode de séparation ne changent pas. Le budget mémoire concerne les stems décodés par titre ; le modèle et les copies temporaires s’y ajoutent. Le nombre de threads ne garantit pas un taux d’occupation CPU. Le cache disque n’a pas de quota. Les caches v1 ne sont pas réutilisés. Les contrôles sur un extrait réel ne certifient ni l’isolation d’un morceau complet ni les longues sessions. Ce lot ne clôt pas l’ensemble du [registre d’audit](AUDIT-SUIVI.md).
