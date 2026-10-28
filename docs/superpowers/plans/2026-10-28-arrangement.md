# Repères d’arrangement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Placer les passages automatiques sur des changements d’arrangement mesurés et afficher leurs repères dans les outils existants.

**Architecture:** Détecteur pur sur les caractéristiques déjà calculées, carte versionnée dans l’analyse, sélecteurs de régions conservateurs. Planification en temps natif, rendu d’onde partagé et panneau d’analyse connectés aux mêmes données.

**Tech Stack:** JavaScript modules, Web Audio, Electron, node:test. Aucune dépendance ajoutée.

**Spec:** [ARRANGEMENT-0.22.md](../../ARRANGEMENT-0.22.md), sections 3.1/3.2 du cahier des charges et [suivi](../../AUDIT-SUIVI.md).

## Global Constraints

- Préserver la lecture, les corrections manuelles et les fonctions existantes.
- Ne pas analyser de PCM dans le chemin audio ou le dessin des ondes.
- Ne pas attribuer de sémantique voix/refrain/drop aux seuls changements d’énergie.
- Conserver les profils Standard/Rythme et leurs calibrations.
- Aucun fichier musical, donnée personnelle ou outil de validation privé dans le dépôt ou le paquet.
- Le projet local sans `.git` est publié via Git Data avec vérification de la branche et sans force ; l’autorisation de publication est déjà donnée dans la conversation.

## Review Focus

- Grille manuelle modifiée après analyse : ne pas réutiliser les anciens temps de repères.
- Court extrait / silence / valeurs non finies : résultat borné et repli existant.
- Dernier changement proche d’EOF : place suffisante après le relais pendant une rampe de tempo.
- Analyse reçue pendant lecture : préserver la source et les repères manuels.
- Remote : taille des données bornée, temps validés et mêmes marques que le PC.

## Task 1 — Détecteur et persistance

**Files:** Create `public/arrangement.mjs`, `tests/arrangement.test.mjs`; modify `public/analysis.mjs`, `public/analysis-cache.mjs`, `desktop/analysis-store.cjs`, corresponding tests.

**Interfaces:** `analyzeArrangement(track)` retourne `{version:1,bpm,downbeat,gridConfidence,landmarks:[{time,confidence,kind,energyDeltaDb,bassDelta}]}`. `arrangementFor(track)` réutilise une carte valide ou recalcule sur caractéristiques ; cache mémoire par identité, grille et confiance.

- [x] Écrire et observer les échecs des cas changement durable / texture / accent / stable / incertain / grille modifiée.
- [x] Implémenter agrégation par mesure, comparaison de deux mesures de part et d’autre, confiance et suppression des voisins.
- [x] Versionner les régions et persister la carte ; vérifier lecture du cache et corrections manuelles.
- [x] Passer les tests ciblés puis consigner le résultat dans PROGRESS.

## Task 2 — Régions et relais musical

**Files:** Modify `public/musical-plan.mjs`, `public/transition-design.mjs`; tests `musical-plan` / `transition-score` / `engine`.

**Interfaces:** Les IN/OUT restent des secondes natives. `musicalExit` reçoit le `handoffFraction` du score ; les repères choisis réservent la fin du passage avant EOF. Une carte absente ou peu fiable conserve le repli.

- [x] Reproduire le défaut de relais décalé lorsque la durée est soustraite sans tenir compte du relais du score.
- [x] Choisir un repère d’entrée proche et un repère de sortie dans les huit dernières mesures actives ; conserver les manuels.
- [x] Calculer le score avant les régions et réserver l’audio après relais ; tester les deux sens de tempo et la stabilité de l’aperçu.
- [x] Passer les tests ciblés et la suite entière.

## Task 3 — Repères et préparation dans l’UI réelle

**Files:** Modify `public/dj-waveform.mjs`, `public/app.js`, `public/remote.js`, `desktop/remote-protocol.cjs`; new shared view/style if necessary; tests de marqueurs et protocole.

**Interfaces:** Les données pré-calculées alimentent l’onde ; pas de calcul d’analyse par frame. Le panneau utilise les fonctions de lecture/seek et de préparation existantes. Remote reçoit une liste bornée et validée.

- [x] Tests de repères visibles et d’état Remote filtré en échec, puis implémentation.
- [x] Ajouter la liste de repères au panneau d’analyse, écoute et réglages IN/OUT accessibles, sans phrases décoratives.
- [x] Recette Electron : vrai MP3, contrôle visible, source préservée lors d’analyse, marqueurs PC/Remote, thèmes et téléphone.

## Task 4 — Vérification et livraison

- [x] Revue indépendante ciblée et correction des problèmes importants avec régression.
- [x] Recettes natives musicales avec régions automatiques, les deux profils et les contrôles de continuité/bibliothèque concernés.
- [x] Version 0.22.0 et paquet Windows : sources comparées, ressources et intégrité, mêmes charges utiles des exécutables.
- [x] Audit/README/PROGRESS avec mesures et limites ; publication vérifiée et remise d’extraits/paquets.

## Ledger

Ruling: Le cahier des charges, la proposition UI et les lots sont déjà demandés et approuvés pour poursuite ; le détecteur mesuré est une décision d’implémentation, pas une nouvelle demande d’approbation. Le projet source existant est conservé, sans créer de copie concurrente ni changer le profil installé.

Pre-flight: les champs de carte, la version de région, le relais du score et les états Remote doivent évoluer ensemble. Les IN/OUT manuels et la source en lecture restent protégés par les tests existants.

Task 1: complete — détecteur, version des régions, carte et migration par digest ; tests en échec puis réussis. Le digest du contenu est séparé de la version du cache pour préserver les préparations.

Task 2: complete — le score précède le calcul des régions, la sortie réserve l’audio après relais et la grille du départ utilise la phase du relais. La revue a reproduit le cas court et l’arrondi avançant d’une mesure ; régressions moteur réussies.

Task 3: complete — marqueurs et panneau exécutés, huit scénarios natifs avec deux MP3, thèmes/largeurs, téléphone et reprise de catalogue. Une action sur une piste remplacée a été reproduite puis empêchée par contrôle d’identité.

Task 4: complete — suite complète 282/282 et 60 cas natifs depuis le paquet. Revue ciblée sans problème important restant ; 140 sources comparées, ressources et intégrité vérifiées, même contenu des exécutables. Un délai initial du banc bibliothèque n’a pas été reproduit dans trois reprises instrumentées ; cause non confirmée conservée dans les notes et preuves.

Ruling: les deux MP3 ont une confiance de grille insuffisante pour une carte automatique. Le banc corrige/accepte explicitement la grille pour vérifier le chemin suivant ; ce résultat ne sera pas présenté comme une reconnaissance automatique des phrases.
