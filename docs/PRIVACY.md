# Données et réseau · 0.14

L’audio local est décodé et analysé sur le PC. Aucun signal audio ni chemin local n’est envoyé à un service distant pour l’analyse ou les stems. Le moteur CPU et le modèle sont inclus dans le paquet Windows.

Le profil local historique Sillage Studio conserve les chemins autorisés, analyses, préparation, favoris, samples, pochettes, pseudo, logo et apparence. IndexedDB stocke les analyses, pochettes et pads ; le stockage local conserve les préférences. Les stems et images ont aussi un cache dans le profil utilisateur. Les fichiers musicaux originaux ne sont pas réécrits.

La recherche de pochettes transmet titre, artiste et éventuellement album à MusicBrainz. Les images proviennent de Cover Art Archive et de ses hébergeurs autorisés. Aucun son ni chemin de fichier n’est transmis. La correspondance peut être corrigée manuellement.

Sources transmet le lien public demandé à yt-dlp, qui contacte YouTube ou SoundCloud et leurs hôtes de média. L’audio est enregistré dans Musique / Gaerisson DJ Studio. Aucun mot de passe, cookie de connexion ou jeton SoundCloud privé n’est demandé. Les contenus privés, payants et indisponibles ne sont pas importés. Cette version ne propose pas de connexion Spotify, Mixcloud ou SoundCloud Go+.

Le lecteur interne écoute sur 127.0.0.1. Quand elle est activée, la Remote ouvre un serveur sur les interfaces privées du PC. Le lien contient un secret de session, retiré de la barre d’adresse après appairage et conservé pour la session du navigateur. Les commandes et états utilisent une authentification Bearer. Arrêter la Remote révoque l’appairage. L’état transmis contient métadonnées, images, niveaux et ondes réduites, sans chemin local ni audio complet.

La Remote commande le PC et ne diffuse pas son audio en direct sur le téléphone. Le transfert d’un enregistrement terminé est déclenché explicitement. REC contient platines, samples, effets et entrées live dont la diffusion est activée. Les micros démarrent désactivés.

Aucune télémétrie ni publicité propre au projet n’est intégrée. Electron conserve son cache habituel dans le profil utilisateur.
