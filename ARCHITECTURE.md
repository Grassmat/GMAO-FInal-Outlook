# GMAO Entreprise — Organisation du code

## Interface

- `app/workspace.tsx` : connexion, session et changement de mot de passe.
- `app/access.tsx` : formulaire de connexion et mot de passe.
- `app/maintenance/workspace.tsx` : composition des écrans.
- `app/maintenance/shell.tsx` : navigation, sélection du site et compte.
- `app/maintenance/use-maintenance.ts` : chargement, rafraîchissement et enregistrement.
- `app/maintenance/` : écrans Machines, Stock, Mouvements, Devis, Interventions, Sites, Utilisateurs et éditeur commun.
- `lib/maintenance/types.ts` : types partagés et libellés des rôles.

## Serveur

- `app/api/data/route.ts` : frontière HTTP, session, origine et erreurs.
- `lib/maintenance/service.ts` : opérations de maintenance et validation des droits par site.
- `lib/maintenance/repository.ts` : initialisation, relations machine/site et création/renommage des sites.
- `lib/auth.ts` : sessions, mots de passe et règles de permissions.
- `app/api/users/route.ts` : gestion des comptes réservée aux administrateurs.
- `db/schema.ts` et `drizzle/` : schéma et migrations versionnées. Ne pas modifier une migration déjà déployée.

## Invariants

Un site possède un identifiant stable. Modifier son nom ne modifie pas cet identifiant et ne déplace aucune machine, pièce, intervention ou affectation utilisateur. L'ancien site Site principal est initialisé une fois avec `INSERT OR IGNORE`, ce qui préserve son nouveau nom.

Un stock représente une quantité physique par pièce et par site. Les machines compatibles partagent ce stock. Les mouvements déterminent la quantité disponible ; les sorties négatives sont refusées de manière atomique en base.

Les rôles sont vérifiés côté serveur. Le filtrage de l'interface ne constitue jamais une autorisation. Les utilisateurs locaux ne reçoivent pas les données des autres sites. Les mots de passe et les jetons de session ne sont pas renvoyés aux clients.

## Vérification

- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/access.mjs` : connexion, permissions, isolation des sites, blocage des sessions et conservation des rattachements après renommage.
- `node tests/site-ui.mjs` : actions de renommage pour le site initial et les sites ajoutés.
- Construire avec le helper Sites avant de publier.

Les liens des anciennes photos restent soumis aux droits Google Drive. Les sauvegardes et leur restauration nécessitent encore un dispositif séparé ; Git conserve le code, pas les données métier.

## Documents machines

`app/maintenance/machine-page.tsx` compose les onglets Aperçu et Documents. `machine-documents.tsx` gère la sélection d'un PDF et l'affichage de la liste. Les routes `app/api/documents/` délèguent à `lib/maintenance/documents.ts`.

Les PDF sont conservés dans le stockage objet R2 ; D1 ne stocke que leurs métadonnées et leur rattachement à la machine. Chaque liste, ajout, ouverture et téléchargement vérifie la session et le site de la machine côté serveur. Les clés de stockage ne sont pas renvoyées dans les listes et les fichiers sont servis par une route protégée.

L'ajout accepte un seul PDF non vide de 20 Mo maximum et vérifie sa signature. L'analyse multipart est également bornée. Si l'enregistrement des métadonnées échoue, le fichier est retiré du stockage pour éviter un ajout incomplet. L'archivage d'une machine conserve ses documents.

## Interventions internes

`app/interventions/` sépare le tableau d'historique, le formulaire de saisie et l'éditeur de questions. Le même tableau est utilisé pour le site entier et pour une seule machine. Les machines proposées sont lues depuis le parc du site ; aucune liste d'équipements n'est enregistrée dans la définition des questions.

`lib/interventions/service.ts` gère les droits, validations, versions de formulaire et écritures atomiques. Chaque rapport conserve une copie des questions utilisées au moment de sa saisie : retirer ou renommer une question ne détruit pas les anciennes réponses. Le site et les machines concernées restent des informations structurelles obligatoires. Une relation dédiée permet de retrouver un même rapport dans plusieurs fiches machines.

Les questions configurables sont communes aux sites. L'admin et le Directeur technique peuvent les modifier ; les autres rôles peuvent remplir le formulaire pour leur site. Une version évite d'écraser les modifications d'un autre éditeur. Les rapports et leurs rattachements sont enregistrés dans un même lot transactionnel. Un identifiant de saisie stable permet de réessayer un enregistrement sans le dupliquer.

La reprise du Google Sheets du 2 octobre 2026 est effectuée une seule fois, à partir de `legacy-interventions.ts`, uniquement côté serveur. Elle conserve les photos historiques sous forme de liens Google Drive ; les nouvelles photos sont stockées en interne et servies par une route protégée. Le Google Sheets d'origine est laissé intact et les nouvelles saisies ne lui sont pas synchronisées.

## Pièces utilisées et stock

`app/interventions/parts-picker.tsx` gère la recherche des références et les lignes de consommation. `report-details.tsx` présente les réponses et les pièces utilisées ; la consultation est séparée du chargement des historiques. La recherche ignore la casse et les accents, accepte plusieurs mots et donne priorité aux références compatibles avec les machines sélectionnées. Les autres références du site restent disponibles.

`lib/interventions/parts.ts` valide les quantités entières positives, les références uniques et leur appartenance au site. Il résout la désignation et la référence depuis le catalogue côté serveur. Les noms saisis librement sont exclusivement des pièces non référencées, consignées sans mouvement ni création automatique d'une référence de magasin.

`lib/maintenance/stock.ts` centralise la lecture des disponibilités et l'écriture des mouvements, pour les sorties manuelles comme pour celles des interventions. Le contrôle de disponibilité est réalisé dans la même instruction SQL que la sortie. Une indisponibilité provoque une violation contrôlée de la contrainte NOT NULL de la quantité : D1 annule tout le lot, y compris le rapport, ses pièces et les sorties précédentes. Les photos déjà envoyées sont alors retirées. Aucun stock n'est réservé avant l'enregistrement.

`intervention_parts` conserve la désignation et la référence au moment de la saisie, même si le catalogue évolue ensuite. Chaque mouvement porte l'identifiant de son intervention. Une intervention portant sur plusieurs machines ne consomme chaque référence qu'une fois ; le mouvement est relié au rapport commun plutôt qu'attribué arbitrairement à une machine.

Le contrôle d'idempotence précède la validation du formulaire, afin qu'un nouvel envoi d'un rapport déjà enregistré ne prélève rien même si le formulaire a changé. Deux envois simultanés du même identifiant sont également protégés par la clé primaire et l'annulation transactionnelle du second lot. Les anciens rapports importés ne provoquent aucune sortie rétroactive de stock.

Les résultats de chargements devenus obsolètes sont ignorés par les historiques et le sélecteur de pièces. Le rafraîchissement du magasin après saisie attend un éventuel ancien chargement puis relit le nouvel état.

Vérifications supplémentaires : `tests/access.mjs` couvre les déductions et leurs liens, les pièces libres, les erreurs de quantité, les droits par site, l'annulation de sorties multiples et des photos, un prélèvement concurrent et deux envois du même rapport. `tests/intervention-ui.mjs` vérifie aussi les choix de pièces, la recherche et la consultation des consommations.

## Magasin et achats

`lib/maintenance/parts.ts` gère les références : création avec une quantité initiale, modification des informations, seuil minimum indépendant et retrait du magasin. Le minimum commence à zéro ; il se règle depuis le tableau de stock par une mise à jour JSON ciblée. La création et son entrée initiale partagent un lot transactionnel et un identifiant stable protège les réessais. Une modification de fiche ne remplace jamais la quantité disponible.

La suppression est un retrait logique (`deleted`) : la référence n'est plus proposée pour les prélèvements et achats, mais ses données et mouvements restent consultables dans l'historique. Elle ne constitue pas une sortie physique. Les écritures de mouvements vérifient aussi l'état actif de la référence dans leur instruction SQL pour empêcher une réception ou un prélèvement sur une pièce supprimée simultanément.

`lib/maintenance/orders.ts` gère les devis et commandes pour une référence existante ou future. Le fournisseur et la quantité sont conservés avec le devis. Le passage à Reçu enregistre atomiquement la commande, une réception unique (`purchase_receipts`), l'entrée de stock et, si nécessaire, la nouvelle référence. L'identifiant de réception est lié à la commande ; une saisie répétée ne crédite pas deux fois le stock. Une version et un contrôle de l'ancien contenu protègent les mises à jour simultanées. Après réception, référence et quantité sont verrouillées : les corrections physiques passent par des mouvements explicites du magasin.

Les commandes déjà marquées Reçu avant cette fonctionnalité restent des réceptions historiques et ne provoquent aucun crédit rétroactif. Les autres anciens devis peuvent être complétés avec une référence et une quantité avant réception.

`PartFields` et `OrderFields` séparent les champs spécifiques de l'éditeur commun. Le tableau du magasin propose le minimum et la suppression ; le tableau des achats affiche le fournisseur, la quantité et ouvre une réception à vérifier avant enregistrement. Les entrées et sorties manuelles utilisent également un identifiant de saisie stable pour les réessais.

## PDF de devis et suppression admin

`lib/maintenance/order-documents.ts` et `app/api/order-documents/` conservent les PDF des devis dans R2 avec leurs métadonnées en D1. La validation PDF et la limite de 20 Mo sont partagées avec les documents machines. Les droits du site et l'état actif du devis sont vérifiés pour chaque liste, envoi, ouverture et téléchargement. Les clés de stockage ne sont pas renvoyées au navigateur.

Un fichier peut être sélectionné avant de créer le devis. Le devis est d'abord enregistré, puis son PDF est envoyé avec un identifiant stable. L'API d'enregistrement renvoie la fiche enregistrée pour permettre un réessai en modification si l'envoi du PDF échoue. Le message indique explicitement que le devis est déjà enregistré. Le fichier et l'identifiant d'envoi sont conservés ; la réception ne se répète pas.

Chaque tentative de stockage possède une clé objet distincte. La clé primaire du document empêche les doublons ; en cas d'envois concurrents, seul l'objet de la tentative perdante est supprimé. L'insertion des métadonnées vérifie encore l'état actif du devis, afin d'annuler un envoi si le devis est supprimé entretemps.

La suppression de devis et de références du magasin est réservée à l'admin côté serveur et côté interface. Il s'agit d'un retrait logique : les pièces disparaissent des listes actives, et les PDF d'un devis supprimé ne sont plus accessibles. Les historiques et les réceptions sont conservés. Supprimer un devis reçu ne retire pas les pièces physiquement livrées ; la confirmation explique que les corrections de quantité passent par un mouvement du magasin. Les devis supprimés ne peuvent pas être restaurés par l'enregistrement d'une ancienne fiche.

`tests/access.mjs` vérifie les PDF de devis, leurs accès, limites et signatures, les nettoyages après erreur et suppression, les envois concurrents, les droits admin et la conservation du stock après suppression. `tests/stock-orders-ui.mjs` vérifie les boutons admin et le réessai d'un PDF après création réussie du devis.

## Suppression des interventions

`lib/interventions/deletion.ts` centralise les droits de suppression et l'annulation transactionnelle des prélèvements. L'admin peut supprimer tous les rapports ; les autres comptes peuvent supprimer uniquement leurs propres rapports, dans leur périmètre de site. Le serveur fournit `canDelete` à l'interface et revérifie les droits sur la route DELETE. Les nouveaux rapports enregistrent `author_id` depuis la session, jamais depuis le formulaire. La migration attribue les anciens rapports natifs lorsque le nom sauvegardé correspond à un seul compte ; les auteurs ambigus et les rapports importés restent réservés à l'admin.

La suppression retire le rapport de tous les historiques et bloque ses photos. Une trace de suppression (compte et date) est conservée pour empêcher qu'un ancien envoi recrée le rapport. Les prélèvements originaux restent dans les mouvements ; leur inverse est enregistré avec un identifiant déterministe. Retrait du rapport et restitution de toutes les références partagent un même lot D1 : un échec annule l'ensemble, un réessai ou deux suppressions simultanées ne créditent jamais deux fois. Les quantités proviennent des mouvements réellement enregistrés, pas du texte libre ou des questions. Les autres entrées et sorties, ainsi que les minimums, sont préservés. Une référence retirée du catalogue conserve ses mouvements et reçoit également la restitution, sans être réactivée.

Le bouton est dans la consultation du rapport, avec confirmation des pièces à restituer. Après suppression, la liste et le magasin sont rafraîchis et la restitution effective est affichée. `tests/access.mjs` couvre les permissions, auteurs homonymes/renommés, restitutions multiples, références retirées, annulation atomique, suppressions concurrentes, réessais et protection des photos et historiques.

## Modification des rapports et état du parc

Le formulaire de rapport sert à la création et à la modification complète : réponses, date et heures, machines, pièces utilisées et photos. Pour modifier un ancien rapport, le serveur réutilise la copie de ses questions, même si le formulaire global a changé. Les photos existantes sont explicitement conservées ou retirées ; les nouvelles sont validées et stockées selon les mêmes limites. Les objets retirés sont nettoyés seulement après la réussite du lot D1. L'auteur initial est conservé ; le dernier compte modificateur et la date sont enregistrés.

L'admin et le Directeur technique peuvent modifier tous les rapports. Les autres utilisateurs peuvent modifier leurs propres rapports dans leur site. La révision et un identifiant de modification stable empêchent les écrasements concurrents et les prélèvements répétés. Le stock est ajusté de la différence entre la consommation réelle cumulée et les nouvelles lignes de pièces. Une restitution antérieure est prise en compte lors de la suppression : seule la consommation nette restante est annulée. Contenu, rattachements, photos, état et mouvements partagent le même lot transactionnel ; une indisponibilité de stock annule l'ensemble.

`lib/interventions/machine-state.ts` calcule l'état du parc à partir du dernier rapport chronologique actif qui renseigne la remise en service. Il n'écrase pas les fiches machines. Corriger la date, changer les machines ou supprimer un rapport recalcule donc leur état au prochain chargement. Une machine sans état connu est affichée « État non renseigné », sans supposer qu'elle est opérationnelle. Le statut d'archivage reste indépendant.

La remise en service est une information structurelle du rapport, accompagnée d'une précision d'attente de pièce et d'un devis/commande facultatif du même site. Le parc et la fiche affichent un badge vert ou rouge et la pièce attendue. Une commande reçue est signalée sans remettre automatiquement la machine en service : cette confirmation reste faite dans un rapport. Les listes intersites et la modification intersites sont disponibles pour l'admin et le Directeur technique, tandis que les comptes locaux restent isolés.

`tests/access.mjs` vérifie les modifications complètes, différences de stock, suppressions après plusieurs modifications, photos conservées/remplacées, changement de machines, attente de commande, chronologie des états, accès du Directeur technique, conflits et courses entre modification et suppression. `tests/intervention-ui.mjs` vérifie le préremplissage, les contrôles d'attente, les badges vert/rouge et la case intersites du Directeur technique.

## Dates futures et devis liés aux rapports

La date métier et l'heure de début restent la base de la chronologie. La date du jour est calculée en Europe/Paris. Un rapport daté dans le futur est conservé et signalé après les rapports actuels, mais ne détermine pas l'état actuel du parc. Les nouveaux enregistrements refusent une date future ; les rapports existants peuvent être corrigés.

`prepareOrder` valide et prépare les opérations sans écrire. Depuis un rapport en attente de pièce, ces opérations rejoignent le lot transactionnel du rapport : devis, association, consommation et éventuelle réception réussissent ou échouent ensemble. Depuis le devis, une association vérifie le site, le droit de modification, l'état hors service et la révision du rapport. Le contrôle de révision dans le lot empêche d'associer un rapport modifié ou supprimé en parallèle. Les réessais utilisent les identifiants stables du rapport, du devis et du document PDF.

Les champs du devis sont partagés par les deux parcours. Le PDF est envoyé après l'enregistrement transactionnel ; en cas d'échec, le formulaire conserve l'identifiant du devis et propose de réessayer uniquement le PDF. La réception ne vaut jamais confirmation de remise en service.

## Ordre de création des devis

Les listes de devis du site et de la machine affichent les derniers créés en premier. La lecture D1 fournit `creationOrder`, issu de l'ordre d'insertion des lignes, qui couvre aussi les anciens devis sans date enregistrée. Les nouveaux devis conservent un `createdAt` attribué par le serveur et préservé lors des modifications. Une modification ou réception ne réordonne donc pas la liste. Aucun historique existant n'est daté artificiellement.

## Planning et tâches récurrentes

La rubrique Planning juxtapose le calendrier des tâches récurrentes et les interventions ponctuelles. Les enregistrements métier sont des types `plan`, `routine` et `routine_done` de la table générique `records` ; aucune initialisation ne crée de tâches ni de données d'essai. Les comptes restent limités à leur site, sauf admin/directeur.

`lib/planning/service.ts` valide les interventions ponctuelles et calcule leur disponibilité depuis les mouvements actuels : quantités regroupées par référence, devis reçu et référence réellement créditée, références retirées, machine archivée et équipement disponible. Un devis associé constitue une attente de réception explicite. La planification ne réserve pas de stock. Le vert indique donc la disponibilité actuelle, sans garantie pour plusieurs interventions utilisant le même stock ; le prélèvement réel du rapport est toujours contrôlé au moment de l'enregistrement.

Le formulaire de rapport accepte une intervention planifiée, depuis le planning ou depuis la création normale d'un rapport. Machine, travaux prévus et pièces disponibles sont préremplis, mais l'utilisateur confirme les travaux et quantités réellement utilisés. Le statut `done`, l'identifiant du rapport et la date de réalisation sont enregistrés dans le même lot D1 que le rapport et ses mouvements. Le contrôle de révision protège contre une modification ou une clôture simultanée. Un stock insuffisant annule aussi la clôture. Supprimer le rapport restitue le stock et remet l'intervention ponctuelle à planifier ; les modifications de rapport utilisent toujours le moteur normal de différences de stock.

Les tâches récurrentes se répètent quotidiennement, chaque semaine ou chaque mois depuis leur date de départ. Pour les jours 29–31, la récurrence mensuelle utilise le dernier jour d'un mois plus court. Le helper partagé de calendrier est indépendant du serveur. « Fait » conserve une trace par tâche et date, avec auteur et heure, sans rapport ni changement de stock. L'identifiant déterministe protège les doubles clics. Les occurrences futures ne peuvent pas être confirmées. Les tests couvrent les droits, calculs de disponibilité, réceptions, conflits, clôture atomique, réouverture après suppression et récurrences.

Les plans et tâches récurrentes acceptent une affectation libre, à toute l’équipe ou à plusieurs comptes actifs hors admin ayant accès au site. Les identifiants sont validés côté serveur. Cette affectation organise le travail sans empêcher un autre intervenant autorisé de le réaliser ; le rapport ou la validation conserve l’auteur réel.

Les plans et routines stockent la sélection dans `machines` ; les anciens éléments avec `machine` restent lisibles. Toutes les machines sont validées dans le site. Le rapport préremplit toute la sélection et doit toutes les couvrir avant d’archiver le plan. Les quantités de pièces sont le total de l’intervention, sans multiplication par le nombre de machines. Une validation récurrente « Fait » couvre l’occurrence complète. Le bouton « Toutes les machines » sélectionne les machines actives au moment de la saisie.

Les plans ponctuels acceptent une date et une heure vides (créneau à définir), classés après les plans datés. Les instructions sont conservées séparément des travaux et affichées à l’exécutant ; elles existent également pour les tâches récurrentes. Le rapport reste daté du travail réellement effectué.

Le calendrier affiche aussi les plans ponctuels ayant une date, dans leur case du jour, avec heure facultative, disponibilité et état réalisé. Il utilise les mêmes objets et actions que la liste : aucun doublon de données, de rapport ou de mouvement de stock. Les plans sans date restent dans la liste.

Un rapport ouvert depuis un plan ou associé à un plan présélectionne Préventive lorsque le choix existe dans le formulaire. Le type reste modifiable. En préventif, les questions système `fault` et `diagnosis` sont masquées dans le formulaire et la lecture du rapport et ne sont pas obligatoires côté serveur. Leurs réponses existantes restent conservées et réapparaissent si le type change. Les questions personnalisées restent indépendantes.

Les techniciens sont autorisés individuellement à créer/modifier le planning (`users.planning_create`, désactivé par défaut). La permission est relue côté serveur à chaque écriture et peut être attribuée par l’admin, le directeur ou le responsable du site, uniquement à un technicien actif du site. La réalisation demeure indépendante. Les trois rôles d’encadrement peuvent supprimer les plans (y compris réalisés) et les séries récurrentes, dans leurs sites d’écriture ; les suppressions gardent une trace et n’affectent ni stock ni rapports.

Les responsables maintenance ont un accès de lecture global, distinct de l’accès d’écriture limité à leur site. `allowReadSite` et `globalReadAccess` couvrent les consultations (rapports, états machine, magasin, planning et fichiers), tandis que `allowSite` continue à protéger toutes les mutations. L’interface indique Consultation uniquement et masque les actions d’écriture sur les autres sites.

## Profils et mails

L’adresse mail est obligatoire pour accéder à la GMAO après connexion. La confirmation de la boîte est nécessaire pour les liens de récupération du mot de passe et les notifications du planning. Les photos sont privées dans R2. Les services de comptes, d’expédition, de réglages par site et de validation des devis sont séparés dans `lib/account` et `lib/mail`.

Les expéditeurs de devis et les autorisations individuelles sont gérés par l’encadrement du site. Les demandes des techniciens attendent une validation atomique avant la création du mail fournisseur ; responsable/directeur/admin peuvent envoyer directement. Une file D1 dédupliquée assure la reprise des envois. Voir `MAIL-AUTOMATION.md` pour le branchement du prestataire et le traitement cloud, qui reste sans effet tant que l’expédition n’est pas configurée.
