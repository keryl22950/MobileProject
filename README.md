# ChallengeApp

État du projet et priorités : [compte rendu consolidé et feuille de route](COMPTERENDU.md).

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

## Signaler les mises à jour aux testeurs

L’accueil affiche un bandeau lorsqu’une mise à jour Expo compatible est disponible :
« Télécharger la mise à jour », puis « Redémarrer et appliquer ». Le redémarrage demande
confirmation pour laisser terminer les saisies et le GPS. La vérification se fait à
l’ouverture et au retour au premier plan, au plus une fois par minute. Hors ligne,
l’application reste utilisable. Ce parcours se teste avec un build `preview`, pas Expo Go
ou le mode développement.

Une nouvelle version **native** n’est pas détectable via les mises à jour Expo d’un ancien
runtime. Pour l’annoncer, déployer les règles Firestore du dépôt, puis créer dans la console
Firebase un document dans `appReleases`, nommé selon le canal et la plateforme :
`preview_android`, `preview_ios`, `production_android` ou `production_ios`.

Champs : `version` (chaîne `X.Y.Z`, supérieure au runtime installé) et `installUrl`
(lien HTTPS vers le véritable APK, la page de distribution iOS ou TestFlight).
Ne publier l’annonce qu’après avoir testé le lien et rendu le build disponible.
Exemple de version : `1.2.0` pour remplacer le runtime `1.1.0` ; aucun lien fictif n’est
configuré par défaut. Les clients peuvent lire une annonce, mais jamais la modifier.

Le bandeau natif invite à installer par-dessus l’application actuelle, sans désinstallation,
pour préserver le compte anonyme. Sur Android, conserver le même identifiant d’application
et la même clé de signature. Le lien iPhone ne dispense pas des exigences de distribution Apple.
Une annonce absente, invalide ou inaccessible ne bloque pas l’application. Supprimer le document
retire l’annonce. Il faut diffuser ce code aux anciens runtimes **avant** de compter sur ce bandeau.

## Vérifications

```bash
npm run lint      # ESLint
npm test          # Régressions des services (Node.js 18+ ; modules VM expérimentaux)
npm run format    # Prettier
```

Pour vérifier les règles Firestore sur des données de test, lance les émulateurs Auth et Firestore
avec une version de Firebase CLI compatible avec ton JDK :

```bash
firebase emulators:exec --only firestore,auth --project demo-challengeapp "npm run test:emulators"
```

## Données Firestore

Les saisies directes, QuickLog et imports utilisent une transaction commune dans
`src/services/activities.js` : historique, statistiques, journal, progression et cumul
sont enregistrés ensemble. Une nouvelle tentative avec le même identifiant ne recompte
pas l'activité. Les imports conservent leur identifiant `hc_<id>` ; les saisies manuelles
conservent le leur sur l'appareil avant tout envoi, avec la valeur, la date et les cibles
initiales. L'encart « Activités à reprendre » sur l'accueil permet de réessayer après
fermeture ou redémarrage. Une connexion est nécessaire pour confirmer l'enregistrement.

Les périodes et les types des challenges sont revérifiés à la confirmation. Au-delà de
100 challenges ou de 8 groupes, l’application valide les cibles et enregistre les
contributions par lots. Reprendre une activité poursuit au premier lot incomplet.
Le profil et les statistiques sont enregistrés avec le dernier lot.
Une période expirée laisse la tentative visible, sans réattribution automatique. Retirer
une reprise supprime uniquement la copie locale, jamais une activité serveur. Ces copies
sont isolées par compte. Un traitement par lots déjà commencé reste accessible depuis
l’accueil sur le même compte. Les anciens imports partiellement enregistrés ne sont pas réparés
automatiquement : leurs contributions d'origine ne sont pas connues avec certitude.

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
