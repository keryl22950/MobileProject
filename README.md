# ChallengeApp

App mobile (Android + iOS) pour créer des groupes avec ses proches, et se
challenger ensemble sur des objectifs à deadline (course à pied, pompes,
lecture, jeux vidéo...), avec suivi GPS, classement en temps réel et chat.

## Concepts

    Groupe (persistant : membres, rôles, chat)
    
    └─ Groupement (nom + deadline : ponctuelle avec bouton Start, ou récurrente)
    
        └─ Challenge (objectif précis, hérite la deadline du groupement)
    
            ├─ periods/{P0, P1, P2...}/progress ← classement, repart à zéro chaque période
            
            ├─ periods/{...}/activities ← journal des activités
            
            └─ cumulative ← total toutes périodes confondues (stats)


- **Groupe** : ex "Famille Dupont". Contient des membres avec un rôle
  (`creator` / `admin` / `participant`) et un chat commun.
- **Groupement** : une session avec une deadline — ponctuelle ("Vacances
  août 2026", démarrée manuellement par un admin) ou récurrente ("Hebdo
  20km", qui redémarre automatiquement à intervalle régulier à partir d'une
  date de départ choisie par l'admin).
- **Challenge** : un objectif précis à l'intérieur d'un groupement (ex :
  50 km de course). Peut être suivi manuellement ou via le GPS.

## Stack

- **React Native + Expo** (SDK 57) — un seul code pour Android et iOS
- **Firebase** (Firestore + Auth anonyme) — données temps réel
- **React Navigation** — navigation entre écrans
- **expo-location** — suivi GPS
- **@react-native-community/datetimepicker** — choix de date/heure de démarrage

## Installer et lancer en local (développement)

```bash
npm install
npx expo start -c
```

Scanne le QR code avec l'app **Expo Go** (Android) — aucune compilation
native nécessaire pour développer.

### Configurer Firebase (une seule fois)

1. Crée un projet sur https://console.firebase.google.com
2. Active **Firestore Database** et **Authentication** (méthode "Anonyme")
3. Colle ta config dans `src/services/firebase.js`
4. Colle les règles de sécurité (`firestore.rules`) dans Firestore Database → Règles → Publier

## Mettre en ligne une version testable (EAS Build)

Le but : générer un vrai `.apk` que tes proches installent directement
(sans passer par le Play Store), avec mises à jour automatiques ensuite.

### Setup (une seule fois)

```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Construire l'APK à partager

```bash
eas build --platform android --profile preview
```

Récupère le lien de téléchargement donné à la fin (aussi visible sur
https://expo.dev), partage-le à tes proches. Ils devront autoriser
« installer des sources inconnues » sur leur Android.

### Pousser une mise à jour (sans nouvel APK)

Pour un changement de JS uniquement (nouvel écran, correctif, style...) :

```bash
eas update --branch preview --message "Description du changement"
```

L'app le récupère automatiquement au prochain lancement.

⚠️ **Un nouveau build complet (`eas build`) est nécessaire** si tu :
- ajoutes/changes une dépendance native (comme `datetimepicker`)
- changes une permission, l'icône, le nom de l'app, ou `app.config.js`

### Pour plus tard : publication sur le Play Store

```bash
eas build --platform android --profile production
eas submit --platform android
```

## Structure des données Firestore

groups/{groupId}
  - name, inviteCode, ownerId, memberIds
    members/{uid} — name, role, joinedAt
    groupements/{groupementId}
      - name, recurring, recurrenceHours, durationHours, status, startedAt
        challenges/{challengeId}
          - presetId, label, icon, unit, target
            periods/{periodKey}/progress/{uid} — name, value
            periods/{periodKey}/activities/{activityId} — userId, userName, value
            cumulative/{uid} — name, value (total toutes périodes)
            messages/{messageId} — userId, userName, text

## Ce qu'il reste à faire

- Carte du parcours GPS (`react-native-maps`)
- Notifications push (deadline proche, activité d'un membre)
- Séparer Firebase dev/prod (voir `APP_VARIANT` dans `app.config.js`)