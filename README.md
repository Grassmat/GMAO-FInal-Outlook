# GMAO vierge — Microsoft 365 / Outlook
Version du 6 octobre 2026, issue des fonctionnalités de la version 40.
Code source complet, sans sites, machines, références, rapports, devis, plannings, comptes métier, pièces jointes, logo d'entreprise ni configuration/secret mail réels.
Les données sont stockées en Cloudflare D1 et les documents en R2 : ce dépôt n'est pas une application HTML autonome et ne se lance pas en double-cliquant un fichier.

## Mettre sur GitHub depuis le navigateur
Décompresser cette archive. Dans le dépôt : Add file → Upload files, puis glisser le CONTENU du dossier gmao-outlook, y compris les dossiers, et valider Commit changes. Ne pas déposer uniquement le ZIP : GitHub ne le décompresse pas.
Pour remplacer une ancienne sauvegarde, supprimer les anciens fichiers absents de la nouvelle version ; un simple ajout ne retire pas les vieux fichiers. Pour ces deux éditions, le plus facile est deux dépôts distincts. Aucun dépôt GitHub n'a été modifié automatiquement.

## Installation
Node.js 22.13 minimum (Node 24 pour les tests SQLite) et npm.
1. Dans le dossier : corepack enable, puis pnpm install --frozen-lockfile (version pnpm indiquée dans package.json). Les commandes npm run ci-dessous fonctionnent ensuite avec ces dépendances.
2. Copier .dev.vars.example vers .dev.vars, réservé aux secrets locaux et exclu de Git.
3. Générer le hash du mot de passe provisoire : node scripts/create-admin-hash.mjs. Mettre le résultat dans BOOTSTRAP_ADMIN_HASH. Aucun mot de passe par défaut n'est fourni.
4. Générer une clé : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))". Mettre le résultat dans MAIL_CONFIG_ENCRYPTION_KEY. Conserver cette clé pour pouvoir déchiffrer les connexions mail et la sauvegarder séparément.
5. APP_ORIGIN doit être l'origine HTTPS effective de la GMAO. Pour tester les mails/OAuth, disposer d'une URL HTTPS enregistrée chez le fournisseur.
6. npm run build, puis npm run db:init pour une base LOCALE NEUVE uniquement. Ensuite npm run dev. Au besoin, consulter README-TECHNIQUE.md pour l'exécution et les migrations.
7. Premier identifiant : admin, avec le mot de passe choisi à l'étape 3. Le compte Administrateur est créé au premier accès ; changer son mot de passe et renseigner son mail. Créer ensuite le premier site, les utilisateurs et les machines. La liste des techniciens du formulaire se remplit avec les utilisateurs actifs du site si cette question n'a pas de choix personnalisés.

## Hébergement
Cette archive n'est reliée à aucun Site existant et ne contient aucun identifiant de projet publié. Choisir un nouvel hébergement compatible Workers/D1/R2, ou créer un nouveau Site. Configurer les bindings DB et BUCKET, appliquer les migrations drizzle dans l'ordre et renseigner les secrets dans l'hébergement. Ne pas utiliser db:init pour modifier une base de production existante.
Prévoir les sauvegardes D1 + R2, la conservation de la clé de chiffrement, un responsable technique et un planificateur pour /api/mail/jobs. L'automatisation ChatGPT de la version originale n'est pas incluse ni transférée.
Toutes les fonctionnalités récentes sont conservées : planning, rôles, permissions dans Utilisateurs, stock lié aux rapports/achats, PDF, devis/validation, profils et récupérations de mot de passe. Les comptes de test restent une option explicite, aucun n'est créé.

## Connexion Microsoft 365 / Outlook
Dans Microsoft Entra : inscrire une application Web à locataire unique pour l'entreprise. Déclarer l'URI affichée dans la GMAO : https://VOTRE-DOMAINE/api/mail/microsoft/callback. Ajouter les permissions Microsoft Graph DÉLÉGUÉES User.Read et Mail.Send ; offline_access permet la reprise sans reconnexion à chaque envoi. Créer un secret client, noter sa date d'expiration et prévoir son renouvellement. Renseigner l'ID du répertoire (tenant), l'ID d'application (client) et la VALEUR du secret dans Utilisateurs → Réglages mails. Connecter ensuite une boîte Microsoft 365 disposant d'Exchange Online et autoriser la GMAO ; le consentement de l'administrateur peut être nécessaire selon la politique de l'entreprise.
Cette édition envoie depuis la boîte de l'utilisateur Microsoft connecté. Les boîtes partagées et Exchange hébergé en interne demandent une adaptation supplémentaire. Un simple logiciel Outlook connecté à un autre fournisseur n'est pas suffisant.

La boîte automatique commune, les boîtes automatiques par site et la boîte dédiée aux devis restent indépendantes. Les techniciens sans droit d'envoi direct soumettent une demande à validation. Configurer un expéditeur ne donne aucun droit technique supplémentaire.
Avant mise en service : vérifier un mail de test, une confirmation d'adresse, un mot de passe oublié, une validation de devis et un rappel. Aucun mail réel n'a été envoyé pour tester cette archive.

## Logo et nom
Modifier lib/branding.ts et remplacer public/brand/company.svg. Le nom et le logo s'appliquent au menu et à la connexion. Le titre de l'onglet se modifie dans app/layout.tsx.

## Vérifications
npm run check
npm test
npm run build
Les tests mail simulent le fournisseur : ils ne prouvent pas le fonctionnement avec le compte de l'entreprise. La connexion réelle reste à configurer et à tester par son service informatique.
Les scripts de test emploient des adresses example.org et des données fictives uniquement ; ils ne chargent aucune donnée de l'entreprise.
