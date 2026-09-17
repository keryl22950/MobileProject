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
- Auth anonyme Firebase + prompt de prénom au premier lancement (stocké en local)
- Écran d'accueil listant **tes vrais groupes**, avec deadline calculée en direct
- Création de challenge : presets (course, pompes, vélo, lecture, jeu vidéo...)
  + durée (12h/24h/48h/semaine/custom) + objectif chiffré → écrit dans Firestore
- Rejoindre un groupe via un code → recherché dans Firestore
- Écran de groupe avec classement **en temps réel** (mis à jour instantanément
  pour tout le monde dès qu'un membre progresse)
- Enregistrement d'activité : saisie manuelle **ou** suivi GPS en direct
  (calcul de distance parcourue avec `expo-location`) → écrit dans Firestore
- Chat de groupe **en temps réel**
- Détail d'une activité façon Strava (emplacement prévu pour une carte —
  encore avec des données d'exemple, pas branché sur une activité réelle)

## Structure des données dans Firestore

```
groups/{groupId}
  - label, icon, unit, target, durationHours, deadline
  - inviteCode, ownerId, memberIds: [uid, ...]
  members/{userId}
    - name, progress, joinedAt
  activities/{activityId}
    - userId, userName, value, createdAt
  messages/{messageId}
    - userId, userName, text, createdAt
```

## Règles de sécurité Firestore (mode test)

Le "mode test" de Firestore expire après 30 jours. Dans la console Firebase
(Firestore Database → Règles), tu peux mettre ceci pour un prototype accessible
uniquement aux personnes connectées (même anonymement) :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Ce qu'il reste à faire

- Carte du parcours GPS avec `react-native-maps` (dans ActivityDetailScreen)
- Notifications push (deadline proche, un membre vient d'avancer)
- Lier chaque activité affichée dans le classement au détail réel (actuellement
  ActivityDetailScreen affiche encore un exemple statique)
- Historique des challenges terminés

## Prochaines étapes possibles

- Notifications push (deadline proche, un membre vient d'avancer)
- Carte du parcours GPS avec `react-native-maps`
- Vraie authentification (nom/pseudo au lieu d'un compte anonyme)
- Historique des challenges terminés
