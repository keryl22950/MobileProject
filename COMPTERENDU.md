# Compte rendu et feuille de route — ChallengeApp

> Référence consolidée le 24 novembre 2026, à partir de `COMPTERENDU.md` (revue du 23 novembre, base `4efc9a4`, complétée après déploiement) et de `compte-rendu-projet.md` (revue du 12 octobre, base `c1868f2`). Code relu à partir de `38a9c48`. Les constats anciens corrigés sont distingués des travaux restants. Le fichier du 15 octobre affiché dans un onglet de l’éditeur n’est pas présent sur disque.

## Application et architecture

ChallengeApp permet à des proches de se challenger dans des groupes : événements ponctuels ou récurrents, objectifs chiffrés et dynamiques, classements en temps réel et discussion. Une activité peut être saisie dans un challenge, enregistrée via QuickLog et le GPS au premier plan, ou importée depuis Health Connect sur Android.

La navigation comprend 20 écrans. Les 11 services séparent Firebase, groupes, événements, challenges, enregistrement des activités, profils, recherche de challenges, statistiques, objectifs dynamiques et import natif. Le contexte d’authentification gère l’UID anonyme et le pseudo ; les hooks suivent notamment le remplissage des événements. Les calculs GPS sont dans `src/utils/geo.js`.

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

Socle réalisé le 24 novembre : `activities.js` remplace les écritures séparées des trois parcours par une transaction commune. Historique, statistiques, journal, progression et cumul sont enregistrés ensemble. L’identifiant `hc_<id>` protège les imports concurrents ; les saisies manuelles gardent un identifiant de tentative sur disque avant envoi, avec leurs cibles et leur date. Une lecture serveur reconnaît aussi un succès dont la réponse a été perdue ou un import concurrent refusé par les règles de création seule.

- [x] Opération commune aux saisies simples, QuickLog et imports, avec identifiant stable pendant la tentative et transaction pour l’historique, les stats et les contributions. Verrou immédiat contre les doubles validations.
- [x] Revérifier les événements et périodes à la confirmation, y compris la frontière exacte de fin, les changements d’unité et les suppressions pendant une boîte de dialogue.
- [x] Tester double soumission, import simultané, refus d’écriture, reprise et changement de période sur émulateurs.
- [x] Fixer et vérifier la limite d’une transaction unique à 100 challenges ou 8 groupes. Ne retirer une séance de la liste qu’après succès global.
- [x] Reprise persistante des saisies et imports sur cet appareil : identifiant, valeur, date et cibles sauvegardés avant envoi. Encart sur l’accueil pour réessayer ou retirer la copie locale, isolée par compte. La copie reste disponible après échec réseau ou échec du nettoyage local.
- [x] Au-delà des limites d’une transaction, valider la sélection puis écrire les contributions par lots avec un point de reprise enregistré dans la même transaction que les scores. Le profil et les statistiques sont publiés au dernier lot. Un échec laisse l’activité à reprendre depuis l’accueil avec ses cibles d’origine. Une cible qui disparaît après la validation bloque la reprise à cet endroit.
- [ ] Recette sur appareil des trois parcours, notamment perte de connexion et nouvelle tentative. Les transactions nécessitent une connexion ; les périodes sont vérifiées selon l’heure du téléphone au moment des lectures, pas par une validation temporelle serveur.

Compatibilité : aucun changement de règles ni migration requis pour ces corrections. Les activités anciennes restent lisibles et ne sont pas rejouées. Les imports déjà partiellement enregistrés par les anciens clients nécessiteraient un audit séparé : leurs cibles initiales n’étaient pas conservées. Les nouveaux historiques mémorisent les cibles.

Critère de fin : chaque action compte une seule fois partout, ou reste explicitement à reprendre sans perdre les cibles prévues.

### Lot 3 — Fermer la lecture générale des groupes sans casser les APK

La lecture des documents `groups` reste autorisée à tout compte authentifié pour la recherche par code des anciens clients. Les sous-collections sont réservées aux membres. Ne pas confondre ces deux niveaux de confidentialité.

- [x] Index d’invitations par code exact. Les nouveaux groupes réservent un code de 10 caractères dans la transaction de création. Un réglage Firestore permet de réserver ensuite les groupes aux membres et d’exiger une invitation valide à l’adhésion. Les clients et les règles gardent le mode compatible jusqu’à la migration.
- [ ] Migrer les codes existants, diffuser le nouveau client puis restreindre les lectures des groupes aux membres. Le script de diagnostic et de migration est prêt et les collisions sont couvertes par des tests. La migration, la diffusion et l’activation sur le projet Firebase restent à faire.
- [x] Isoler Firebase en développement. Les émulateurs sont utilisés par défaut, avec prise en charge d’un projet de développement distinct via la configuration documentée dans le README. Les builds preview et production pointent vers le projet existant.
- [x] Vérifier sur émulateur l’adhésion historique, l’adhésion indexée dans les deux modes, le refus de lecture et d’adhésion sans invitation en mode privé, la requête des seuls groupes du membre et le retour au mode compatible.

### Lot 4 — Fiabiliser les sources de santé et le GPS

- [x] Health Connect utilise les distances de la source de la séance, ou la source qui couvre le plus de temps. Les intervalles qui se chevauchent ne sont comptés qu’une fois par source.
- [x] Distinguer les séances rapprochées d’une même source et ne regrouper entre sources que des séances du même type presque superposées. Conserver un identifiant stable et les autres identifiants connus pour reconnaître les imports des anciennes versions.
- [x] Parcourir toutes les pages Health Connect pour les séances et les distances. L’écran garde sept jours par défaut et propose de chercher jusqu’à trente jours.
- [x] Libérer le GPS et le maintien d’écran à l’arrêt ou quand l’utilisateur quitte l’écran. Une permission ou un abonnement qui se termine après la fermeture est annulé. Une erreur GPS laisse la saisie manuelle disponible.
- [ ] Ajouter le suivi en arrière-plan et une carte du parcours, avec permissions, nouveau build natif et recette sur téléphone.
- [x] Étudier HealthKit pour les séances des testeurs iOS. L’intégration reste à prioriser quand un build iPhone pourra être distribué.

L’import iOS pourrait reprendre la confirmation et les classements d’Android en lisant
uniquement les séances HealthKit et la distance des sports pris en charge. Un module
natif iOS doit activer la capacité HealthKit, déclarer la raison d’accès et vérifier
que HealthKit est disponible sur l’appareil. L’application ne peut pas distinguer
un refus de lecture de certains types de données d’une liste vide. L’écran doit donc
proposer la saisie manuelle dans les deux cas. [Configuration Apple](https://developer.apple.com/documentation/healthkit/setting-up-healthkit)
et [autorisations de lecture](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data).

L’identifiant HealthKit de chaque séance serait stocké avec un préfixe `hk_` à côté
des imports Android. Seules les séances confirmées seraient envoyées et le partage
aux challenges resterait visible avant validation. La recette doit couvrir une
séance Apple Watch synchronisée, une distance absente, deux sources, un import
répété et l’absence d’autorisation. Un build iOS signé est nécessaire. La saisie
actuelle reste utilisable en attendant un canal de distribution iPhone.

### Lot 5 — Rendre le compte récupérable

- [x] Liaison facultative par e-mail et mot de passe depuis le profil. Firebase rattache la méthode de connexion au même UID. Le fournisseur e-mail/mot de passe doit être activé sur le projet Firebase avant la diffusion.
- [x] Connexion et réinitialisation depuis « J’ai déjà un compte ». La déconnexion passe par « Mon compte » après association d’une adresse. Une adresse déjà utilisée laisse le profil actuel intact. Le pseudo est chargé depuis Firestore et mis en cache par compte et projet.
- [ ] Tester la réinstallation réelle et le changement de téléphone. Le parcours automatisé avec un client Firebase vierge couvre déjà la récupération du pseudo, des groupes, des amis, des statistiques et des identifiants d’import.

### Lot 6 — Données et montée en charge

- [ ] Suppression en cascade côté serveur pour groupes, événements et challenges ; les suppressions actuelles laissent les sous-collections orphelines.
- [ ] Mesurer puis réduire les lectures imbriquées groupes → événements → challenges de QuickLog et des statistiques.
- [ ] Paginer les historiques (limite actuelle de 50) et le chat (fenêtre de 200).
- [ ] Compléter les tests des périodes, objectifs dynamiques et calcul GPS ; harmoniser les erreurs d’abonnements.

### Lot 7 — Ajouts produit et maintenance

À ordonner selon les retours d’usage après stabilisation : invitation directe depuis les amis, notifications de deadline/activité/classement, rappels locaux, badges et séries, annonce du vainqueur en fin de période, photo de preuve via Storage, challenges par équipes, widgets et publication Play Store. Migration TypeScript progressive et harmonisation des noms internes à planifier séparément. Le dossier `dist/` est ignoré : aucun nettoyage destructif n’est nécessaire.

## Validation et limites

### Distribution aux proches — 26 novembre 2026

- [x] Bandeau sur l’accueil pour télécharger une mise à jour Expo compatible, puis redémarrer après confirmation.
- [x] Message distinct pour une nouvelle version native, avec lien HTTPS séparé par canal et plateforme (`appReleases/preview_android`, `preview_ios`, etc.). Comparaison avec le runtime installé, sans inviter à désinstaller l’application et perdre le compte anonyme.
- [x] Règles locales : lecture d’une annonce par utilisateur connecté, écritures client interdites. Documentation de publication dans le README.
- [ ] Déployer ces règles et renseigner les vrais liens des versions natives lors de leur distribution. Aucun lien d’installation n’est inventé ni publié par cette modification.
- [ ] Recette sur build preview Android/iOS : téléchargement, redémarrage, hors ligne, annonce native et ouverture du lien. Diffuser d’abord ce bandeau aux anciens runtimes compatibles.

Validation du 26 novembre : lint et 21 tests locaux réussis ; les tests de règles sur émulateur incluent les permissions des annonces. Aucune publication OTA ni déploiement des règles effectué.

- `npm test` : 20 tests de régression passent le 24 novembre 2026, dont 6 pour la reprise persistante (redémarrage simulé, stockage indisponible, nettoyage échoué, concurrence, isolation des comptes et conservation des tentatives périmées).
- `npm run lint` : passe sans avertissement après réinstallation des dépendances manquantes. Syntaxe des écrans et services également vérifiée avec Babel.
- Tests Auth/Firestore : les 11 scénarios d’activités et la suite de règles existante passent ensemble sur les émulateurs (12 tests), dont la limite de 100 challenges / 8 groupes.
- Aucun déploiement Firebase, build EAS, publication OTA ou test sur téléphone effectué pendant cette revue.

Recette avant distribution : créer et rejoindre un groupe, saisir une activité, vérifier profil et classement, échanger plus de 200 messages, tester les permissions Health Connect, puis vérifier sur iOS le parcours de base et l’absence du bouton d’import Android.
