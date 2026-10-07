# Envois et rappels
Les mails sont désactivés tant qu'aucune boîte n'est connectée. Configurer Microsoft 365 / Outlook dans Utilisateurs → Réglages mails, puis tester avec une adresse autorisée.
Une boîte commune ou une boîte par site est possible ; les devis peuvent utiliser une autre boîte.
Les droits des techniciens se modifient dans Utilisateurs → Modifier. Sans autorisation directe, une demande de devis attend une validation du responsable ou du directeur.
Les messages sont dédupliqués dans la base. Les envois incertains doivent être contrôlés dans Envoyés avant reprise manuelle.
Pour les rappels sans utilisateur présent, configurer un planificateur indépendant appelant POST /api/mail/jobs avec X-GMAO-Scheduler contenant un secret aléatoire ; MAIL_JOB_TOKEN_HASH doit contenir son SHA-256. Si l'hébergement Sites contrôle l'accès, ajouter sa propre autorisation au même site. Aucun planificateur existant n'est fourni dans cette archive.
Répéter au plus cinq appels seulement si pending>0 et accepted>0 ; arrêter si ready=false.
