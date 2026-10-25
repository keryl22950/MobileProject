# ChallengeApp

App mobile (Android + iOS) pour créer des groupes avec ses proches et se challenger
ensemble sur des objectifs à deadline (course, pompes, lecture, jeux vidéo…), avec
suivi GPS, import depuis une montre connectée, classement en temps réel et chat.

## Concepts

```
Groupe (membres, rôles, chat)
 └─ Événement (nom + deadline : ponctuel avec bouton Start, ou récurrent, éventuellement à objectif dynamique)
     └─ Challenge (objectif précis, hérite de la deadline de l'événement)
```

Dans le code, un « événement » s'appelle encore `groupement` (collections Firestore,
noms de fonctions). Seul l'affichage a été renommé.

## ⚠️ Expo Go ne fonctionne plus

Le projet utilise du code natif (`react-native-health-connect`, `expo-dev-client`).
Il faut un **dev client**, pas Expo Go.

## Installer et lancer en développement

Prérequis : Node.js 18+, un compte Expo, `npm install -g eas-cli`, puis `eas login`.

```bash
npm install
eas build --profile development --platform android   # une seule fois (et à chaque dépendance native ajoutée)
```

Installe l'APK obtenu sur le téléphone (il s'appelle « ChallengeApp (Dev) »), puis :

```bash
npx expo start --dev-client
```

### Configurer Firebase (une seule fois)

1. Crée un projet sur https://console.firebase.google.com
2. Active **Firestore Database** et **Authentication** (méthode « Anonyme »)
3. Renseigne ta config dans `src/services/firebase.js`
4. Déploie les règles de sécurité (versionnées dans `firestore.rules`) :

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## Importer des séances depuis une montre (Android)

L'app lit les séances dans **Health Connect**, la couche santé d'Android, quelle que soit la marque.

- Installe/active l'application Health Connect (intégrée à Android 14+, sinon Play Store).
- Dans l'appli de ta montre (Garmin Connect, Samsung Health, Fitbit…), active la synchronisation vers Health Connect.
- Dans l'app : accueil, « Importer depuis ma montre ». Autorise **Séances d'exercice** et **Distance**.

Une séance ne compte pour un challenge que si elle a eu lieu pendant la période en cours de son événement.
Elle est toujours ajoutée à ton profil. Sur iPhone, cette fonction n'existe pas encore.

## Distribuer une version de test

```bash
eas build --platform android --profile preview
```

Partage le lien de l'APK. Pour un changement de JavaScript uniquement :

```bash
eas update --branch preview --message "description" --environment preview
```

Un nouveau `eas build` est nécessaire si tu ajoutes une dépendance native, changes une permission,
l'icône ou `app.config.js`. Dans ce cas, **monte aussi `version` dans `app.config.js`** : la `runtimeVersion`
en dépend, et les anciens APK ne recevront pas du JS qui appelle un module qu'ils n'ont pas.

## Qualité du code

```bash
npm run lint      # ESLint
npm run format    # Prettier
```

## Données Firestore

```
groups/{groupId}                  name, inviteCode, ownerId, memberIds
  members/{uid}                   name, role (creator | admin | participant), joinedAt
  groupements/{id}                name, recurring, recurrenceHours, durationHours, status, startedAt,
                                  dynamicTarget, adaptStep
    challenges/{id}               presetId, label, icon, unit, target
      periods/{P0, P1…}           target (événements dynamiques)
        progress/{uid}            name, value
        activities/{id}           userId, userName, value, createdAt
      cumulative/{uid}            name, value (total toutes périodes)
  messages/{id}                   userId, userName, text, createdAt
users/{uid}                       displayName, nameLower
  friends/{friendUid}
  stats/{key}                     icon, label, unit, total
  activities/{id}                 historique du profil (dont séances importées : externalId, source)
```