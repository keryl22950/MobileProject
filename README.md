# ChallengeApp — Prototype

Squelette d'application mobile (Android + iOS) pour créer/rejoindre des groupes
de challenge avec deadline, suivre sa progression en groupe, un chat, et un
suivi GPS pour les activités type course à pied.

## Installer et lancer le projet

1. **Installer Node.js** (version 18 ou plus) si pas déjà fait : https://nodejs.org
2. Ouvrir un terminal dans ce dossier et lancer :
   ```bash
   npm install
   npm start
   ```
3. Installer l'app **Expo Go** sur ton téléphone Android (Play Store) et scanner
   le QR code qui apparaît dans le terminal. L'app se lance directement sur ton
   téléphone, sans rien compiler côté Android Studio.
4. Pour tester sur iPhone plus tard : demande à quelqu'un d'installer Expo Go
   (App Store) et de scanner le même QR code — aucun Mac nécessaire pour ce
   stade de prototype.

## Ce qui est fait dans ce squelette

- Navigation complète entre les écrans (React Navigation)
- Écran d'accueil listant les challenges en cours (données factices pour l'instant)
- Création de challenge : presets (course, pompes, vélo, lecture, jeu vidéo...)
  + durée (12h/24h/48h/semaine/custom) + objectif chiffré
- Rejoindre un groupe via un code
- Écran de groupe avec classement / barres de progression
- Enregistrement d'activité : saisie manuelle **ou** suivi GPS en direct
  (calcul de distance parcourue avec `expo-location`)
- Chat de groupe (UI fonctionnelle, données factices)
- Détail d'une activité façon Strava (emplacement prévu pour une carte)

## Ce qu'il reste à connecter (marqué `// TODO` dans le code)

Tout le stockage réel des données doit se faire via **Firebase** :

1. Créer un projet gratuit sur https://console.firebase.google.com
2. Activer **Firestore Database** et **Authentication** (méthode "Anonyme")
3. Copier la config du projet dans `src/services/firebase.js`
4. Brancher les écrans sur Firestore (chaque `// TODO` indique quoi faire)

Structure de données Firestore suggérée :
```
groups/{groupId}
  - challengeType, target, unit, deadline, inviteCode
  members/{userId}
    - name, progress
  activities/{activityId}
    - userId, value, createdAt, gpsTrack (optionnel)
  messages/{messageId}
    - userId, text, createdAt
```

## Prochaines étapes possibles

- Notifications push (deadline proche, un membre vient d'avancer)
- Carte du parcours GPS avec `react-native-maps`
- Vraie authentification (nom/pseudo au lieu d'un compte anonyme)
- Historique des challenges terminés
