# Sillora DJ 0.21.0 — profil de maintien de hauteur Rythme

Le profil **Rythme**, disponible dans **Régie → Master** et sur Remote, raccourcit les fenêtres du maintien de hauteur pour mieux préserver l’alignement des attaques pendant les changements de tempo. **Standard reste le réglage par défaut.** Le choix est mémorisé et la latence du traitement est mesurée, affichée et compensée par le moteur.

- Profil appliqué au constructeur du processeur, avant le premier bloc audio ; la calibration et les voix utilisent les mêmes paramètres.
- Changement autorisé lorsque les platines sont arrêtées. Lecture, scratch, freinage, préparation ou transition verrouillent le sélecteur.
- Un lancement demandé pendant la calibration attend sa fin et reste annulable. En cas d’échec, le profil précédent est conservé.
- Commande Remote validée, transmise par le chemin IPC du PC et reflétée sur les deux interfaces.
- Correction d’une course : annuler une transition pendant la calibration ou le démarrage d’une voix ne laisse plus démarrer sa source entrante. Le nettoyage préserve une source lancée ensuite par l’utilisateur.
- Les changements de vitesse et de boucle internes à une transition n’annulent plus leur propre préparation ; les commandes manuelles conservent leur comportement d’annulation.

## Mesure acoustique

Le banc utilise des pulsations synthétiques isolées par platine/canal, prélevées **après le maintien de hauteur et avant EQ**. Il compare réellement les signaux rendus, en complément des vérifications du transport de la 0.20. La résolution de l’enveloppe est de 1 ms. Les mesures couvrent tempo identique, beatmatch fixe, accélération et ralentissement à 44,1/48 kHz.

| Mesure sur ce banc | Standard | Rythme |
| :--- | :--- | :--- |
| Latence du traitement à 44,1 kHz | 131,36 ms | 59,43 ms |
| Latence du traitement à 48 kHz | 132,69 ms | 58,69 ms |
| Écart maximal par corrélation des pulsations | 13 ms | 5 ms |
| Écart maximal des attaques détectées | 13 ms | 6 ms |

Sans maintien de hauteur, les pulsations sont alignées à la résolution du banc. Ces résultats ne mesurent ni la latence aller-retour du périphérique, ni les pertes de blocs en utilisation réelle. Un profil plus court change le compromis entre attaques et timbre ; une meilleure mesure de calage ne prouve pas une meilleure qualité sur tous les morceaux.

## Recettes et périmètre

```powershell
npm test
npm run test:keylock:windows
npm run test:keylock-ui:windows -- "piste-A.mp3"
npm run test:transitions:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:transitions:windows -- --rhythm "piste-A.mp3" "piste-B.mp3"
npm run test:library:windows -- "piste-A.mp3" "piste-B.mp3"
npm run test:audio:windows -- "piste-A.mp3" "piste-B.mp3"
```

Les profils et résultats restent isolés dans `.runtime/`. Les fichiers musicaux, rendus privés et données personnelles ne sont pas distribués avec les sources. [Architecture et relevés](KEYLOCK-0.21.md) · [Suivi de l’audit](AUDIT-SUIVI.md).

La reconnaissance des phrases, voix et drops, les pilotes matériels, la validation perceptive de toute une collection, la refonte UI complète et les autres exigences ouvertes du registre restent à traiter.

## Validation et distribution

**261 tests automatisés réussis** et **48 scénarios natifs réussis depuis le code inclus dans `app.asar`** : 16 cas acoustiques, quatre scénarios de profil PC/Remote, neuf rendus musicaux Standard, neuf Rythme, six scénarios de bibliothèque et quatre de continuité/audio. Les deux thèmes ont également été contrôlés pour l’accessibilité et le contraste du nouveau sélecteur. Les mêmes 16 relevés de pulsations sont obtenus depuis les sources et depuis le paquet.

Les 18 rendus musicaux n’ont ni échantillon non fini, ni saturation, ni fenêtre silencieuse de 50 ms dans les passages mesurés. Le titre entrant poursuit sa lecture à sa vitesse native. La bibliothèque simule 1 000 références avec les deux fichiers de test, sans prétendre avoir analysé 1 000 titres distincts.

Les exécutables Windows x64 sont construits et leurs versions et mentions Gaerisson vérifiées. Les **136 fichiers applicatifs** correspondent aux sources testées. Les ressources natives contrôlées correspondent aux ressources préparées. Installateur et portable embarquent le **même contenu** ; l’archive commune de **7 215 fichiers** passe le contrôle d’intégrité. L’installation sur le profil personnel n’a pas été exécutée. Les binaires restent remis séparément du dépôt source.

| Exécutable | SHA-256 |
| :--- | :--- |
| Sillora-DJ-Setup-0.21.0.exe | `af406b7bb3b5b755a8d7a8b9aa1ee19ab0edcf0cb76ccb0afee914b0c6669f5e` |
| Sillora-DJ-0.21.0-Windows.exe | `98e3dc76b5a491323bcebcf06fe1ccf244b6a01134a98070cb678df7b6ff0f35` |
