# Microsoft 365 : préparation de l’entreprise

Consulter README.md pour la procédure. Cette édition est destinée à une boîte utilisateur Exchange Online du tenant configuré. Elle utilise les permissions déléguées User.Read et Mail.Send, un code OAuth avec PKCE, offline_access et un retour protégé par état/cookie/session. Les secrets et jetons de renouvellement restent chiffrés côté serveur. Le renouvellement du refresh token est conservé avec contrôle de version. Les boîtes partagées ne sont pas prises en charge dans cette édition.

L’envoi passe par POST https://graph.microsoft.com/v1.0/me/sendMail, en JSON, avec copie dans Envoyés. HTTP 202 signifie accepté par Microsoft, sans identifiant de message ni preuve de livraison. L’application conserve un reçu interne et empêche une reprise automatique d’un envoi incertain ; vérifier Envoyés avant de relancer.

Sources techniques officielles, consultées le 6 octobre 2026 :
- https://learn.microsoft.com/en-us/graph/auth-v2-user
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0

Les tests utilisent un fournisseur simulé. Le service informatique doit valider la connexion réelle, la politique de consentement, la disponibilité de la boîte, l’expiration du secret, les limites d’envoi et le planificateur avant mise en service. Aucune autorisation Microsoft ni boîte réelle n’est fournie dans ce dépôt.
