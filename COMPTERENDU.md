# Compte rendu et feuille de route — ChallengeApp

> Référence consolidée le 24 novembre 2026, à partir de `COMPTERENDU.md` (revue du 23 novembre, base `4efc9a4`, complétée après déploiement) et de `compte-rendu-projet.md` (revue du 12 octobre, base `c1868f2`). Code relu à partir de `38a9c48`. Les constats anciens corrigés sont distingués des travaux restants. Le fichier du 15 octobre affiché dans un onglet de l’éditeur n’est pas présent sur disque.

## Application et architecture

ChallengeApp permet à des proches de se challenger dans des groupes : événements ponctuels ou récurrents, objectifs chiffrés et dynamiques, classements en temps réel et discussion. Une activité peut être saisie dans un challenge, enregistrée via QuickLog et le GPS au premier plan, ou importée depuis Health Connect sur Android.

La navigation comprend 20 écrans. Les 9 services séparent Firebase, groupes, événements, challenges, profils, recherche de challenges, statistiques, objectifs dynamiques et import natif. Le contexte d’authentification gère l’UID anonyme et le pseudo ; les hooks suivent notamment le remplissage des événements. Les calculs GPS sont dans `src/utils/geo.js`.

Stack déclarée : Expo 57, React Native 0.86, React 19, Firebase Auth/Firestore et React Navigation. Version mobile : 1.1.0 dans `app.config.js`. Le dev client est nécessaire ; Expo Go ne suffit pas. EAS dispose de profils développement, preview et production et des mises à jour OTA.

Le modèle est `groups → groupements → challenges → periods → progress / activities`, avec cumul par challenge. Les profils contiennent amis, statistiques et historique. Le mot interne `groupement` désigne un événement : le conserver tant qu’une migration explicite n’est pas prévue.

## Fonctionnalités présentes

- Authentification anonyme persistante, pseudo, profil, statistiques et historique personnel.
- Groupes avec code court, lien `challengeapp://join/:code`, rôles créateur/admin/participant, transfert de propriété et départ.
- Événements ponctuels à démarrage manuel, événements récurrents et début planifié ; objectifs adaptatifs selon les résultats précédents.
- Sept presets, challenges personnalisés, classements par période et cumul, journal d’activités et historiques d’événements.
- QuickLog vers plusieurs challenges, GPS au premier plan avec filtrage de précision et maintien de l’écran éveillé.
- Import Android Health Connect, distance automatique ou saisie manuelle ; recherche, ajout et suppression d’amis ; chat de groupe.

## Acquis depuis octobre

| Constat historique | État constaté dans le dépôt |
|---|---|
| Règles Firestore absentes | Règles versionnées, configuration d’émulateurs et script de tests présents. Le compte rendu précédent rapporte un déploiement sur `mobileproject-c534a` le 23 novembre ; non revérifié à distance pendant cette revue. |
| Adhésions concurrentes | `arrayUnion` évite l’écrasement des membres. Création, adhésion et départ utilisent des batches ; une fiche membre manquante peut être réparée en rejoignant à nouveau. |
| Permissions et rôles | Restrictions sur les modifications des groupes, transfert de propriété et écriture des progressions. Objectifs dynamiques en création seule. |
| Qualité | ESLint, Prettier, thème partagé dans la navigation et version unique d’AsyncStorage configurés. Tests de règles présents : l’affirmation ancienne « aucun test » est obsolète. |
| Documentation | README : installation du dev client, configuration Firebase, import Android, builds et OTA. |

## Feuille de route ordonnée

### Lot 1 — Corriger les bugs immédiatement reproductibles

- [x] Chat : sélectionner les 200 messages les plus récents, puis les présenter dans l’ordre chronologique.
- [x] Chat : conserver le brouillon en cas d’échec, signaler l’erreur, empêcher les envois simultanés et signaler les erreurs d’abonnement.
- [x] Import : ne jamais lire Distance sans permission ; permettre la saisie manuelle.
- [x] QuickLog : revenir à la sélection après un échec de recherche, au lieu de rendre `matches.length` lorsque `matches` vaut `null`.
- [x] Refuser les valeurs non finies dans QuickLog et l’import.
- [x] Ajouter `npm test` et des régressions sur les permissions Distance et la fenêtre de 200 messages.
- [ ] Recette sur appareil : envoi qui échoue, conservation du texte, permissions accordées/refusées, recherche QuickLog qui échoue.

### Lot 2 — Rendre les enregistrements cohérents et rejouables

Priorité suivante : aujourd’hui, profil, statistiques, journal, progression et cumul sont écrits séparément. Un échec partiel peut perdre une contribution ou provoquer un double comptage à la reprise. L’identifiant `hc_<id>` n’empêche pas deux imports concurrents de passer simultanément la lecture préalable.

- [ ] Introduire une opération commune aux saisies simples, QuickLog et imports, avec identifiant stable et transaction pour l’historique, les stats et les contributions.
- [ ] Pour un nombre de cibles dépassant les limites de transactions ou de règles, prévoir une reprise persistante et idempotente par cible ; ne pas masquer une séance avant la fin de ses contributions.
- [ ] Revérifier les événements et périodes à la confirmation, y compris la frontière exacte de fin et les changements pendant une boîte de dialogue.
- [ ] Tester double soumission, import simultané, échec d’écriture, reprise et changement de période sur émulateurs.

Critère de fin : chaque action compte une seule fois partout, ou reste explicitement à reprendre sans perdre les cibles prévues.

### Lot 3 — Fermer la lecture générale des groupes sans casser les APK

La lecture des documents `groups` reste autorisée à tout compte authentifié pour la recherche par code des anciens clients. Les sous-collections sont réservées aux membres. Ne pas confondre ces deux niveaux de confidentialité.

- [ ] Concevoir un mécanisme d’invitation dédié et contrôler l’adhésion par ce mécanisme.
- [ ] Migrer les codes existants, tester les collisions, diffuser le nouveau client puis restreindre les lectures des groupes aux membres.
- [ ] Séparer Firebase développement/production et documenter la configuration.
- [ ] Vérifier anciens/nouveaux clients et refus attendus avec les émulateurs avant tout déploiement.

### Lot 4 — Fiabiliser les sources de santé et le GPS

- [ ] Health Connect : éviter de sommer les distances de plusieurs origines pour la même séance ; choisir une source cohérente.
- [ ] Remplacer le dédoublonnage « même sport et départ à moins de dix minutes », qui peut fusionner deux séances distinctes ; préserver des identifiants stables.
- [ ] Vérifier pagination des enregistrements et étendre si nécessaire la fenêtre de sept jours.
- [ ] Nettoyer les abonnements GPS et le maintien d’écran au départ des écrans et gérer les erreurs de démarrage.
- [ ] Ajouter le suivi en arrière-plan et une carte du parcours, avec permissions, nouveau build natif et recette sur téléphone.
- [ ] Étudier HealthKit selon les besoins des testeurs iOS.

### Lot 5 — Rendre le compte récupérable

- [ ] Liaison facultative du compte anonyme à un moyen durable en conservant son UID.
- [ ] Parcours de connexion/récupération, déconnexion et traitement d’un identifiant déjà lié.
- [ ] Tester réinstallation et changement d’appareil avec conservation des groupes, amis, stats et identifiants d’import.

### Lot 6 — Données et montée en charge

- [ ] Suppression en cascade côté serveur pour groupes, événements et challenges ; les suppressions actuelles laissent les sous-collections orphelines.
- [ ] Mesurer puis réduire les lectures imbriquées groupes → événements → challenges de QuickLog et des statistiques.
- [ ] Paginer les historiques (limite actuelle de 50) et le chat (fenêtre de 200).
- [ ] Compléter les tests des périodes, objectifs dynamiques et calcul GPS ; harmoniser les erreurs d’abonnements.

### Lot 7 — Ajouts produit et maintenance

À ordonner selon les retours d’usage après stabilisation : invitation directe depuis les amis, notifications de deadline/activité/classement, rappels locaux, badges et séries, annonce du vainqueur en fin de période, photo de preuve via Storage, challenges par équipes, widgets et publication Play Store. Migration TypeScript progressive et harmonisation des noms internes à planifier séparément. Le dossier `dist/` est ignoré : aucun nettoyage destructif n’est nécessaire.

## Validation et limites

- `npm test` : 3 tests de régression passent le 24 novembre 2026 (vrais services exécutés avec frontières Firestore/natives simulées). Ils ne remplacent pas les émulateurs ni la recette mobile.
- `npm run lint` : passe sans avertissement après réinstallation des dépendances manquantes. Syntaxe des écrans et services également vérifiée avec Babel.
- Tests Auth/Firestore : réussite rapportée dans la revue du 23 novembre ; pas encore relancés dans cette session.
- Aucun déploiement Firebase, build EAS, publication OTA ou test sur téléphone effectué pendant cette revue.

Recette avant distribution : créer et rejoindre un groupe, saisir une activité, vérifier profil et classement, échanger plus de 200 messages, tester les permissions Health Connect, puis vérifier sur iOS le parcours de base et l’absence du bouton d’import Android.
