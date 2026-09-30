# Budget

Application personnelle de gestion financière — budget courant, patrimoine, micro-entreprise.
React + TypeScript + Vite, données stockées **100 % en local** dans IndexedDB via Dexie.
Aucun service cloud, aucun abonnement, aucune donnée qui sort de la machine.

## Démarrer

```bash
npm install     # une seule fois, après avoir récupéré le projet
npm run dev     # lance le serveur, puis ouvre l'adresse affichée
```

Autres commandes utiles :

```bash
npm test        # lance les tests des calculs (doit être vert avant tout commit)
npm run build   # vérifie les types et construit la version de production
npm run lint    # analyse le code
```

## Où se trouve quoi

```
src/
  app/
    App.tsx             # coquille : navigation basse et bouton +
    useServiceWorker.ts # installation hors ligne et bannière de mise à jour
  features/
    dashboard/          # accueil : indicateurs, cartes budget, graphiques
    micro/              # micro-entreprise : factures, clients, prévisionnel
    operations/         # saisie d'une opération, et liste complète
    patrimony/          # saisie manuelle des soldes
    settings/           # écran Paramètres
  domain/
    backup/             # format de sauvegarde, validation, CSV
    budget/             # LES CALCULS, en TypeScript pur, sans React ni Dexie
    operations/         # recherche et filtres
    patrimony/          # soldes des comptes
    settings/           # règles des réglages
  components/
    ui/                 # briques réutilisables (panneau, boutons de choix…)
    charts/             # graphiques partagés (anneau, courbe, barres)
  db/
    types.ts            # la forme de chaque donnée (dictionnaire)
    db.ts               # les tables IndexedDB et leurs versions (classeur)
    seed.ts             # comptes, catégories et réglages du premier lancement
    transactions.ts     # écriture et validation des opérations
    budgets.ts          # quel budget s'applique à quel mois
  utils/                # dates, montants
  main.tsx              # point d'entrée : remplit la base puis affiche React
```

La règle d'or : `domain/` ne connaît ni React ni la base de données. Il reçoit
des données, il renvoie des chiffres. C'est ce qui rend les calculs testables
isolément — et c'est là que vivent les règles métier importantes.

## Deux conventions à connaître

**Les montants sont des entiers en centimes.** 24,50 € est stocké `2450`.
En informatique `0.1 + 0.2` ne vaut pas exactement `0.3` ; avec des entiers, les
totaux restent justes même après des années d'opérations. La conversion se fait
uniquement à l'affichage, dans `src/utils/money.ts`.

**Aucune valeur métier n'est écrite en dur dans un composant.** Budget, seuil LEP,
taux URSSAF, délais de paiement : tout vient de la base (`settings`, `microSettings`,
`categories`) et sera modifiable depuis l'écran Paramètres.

**Trois règles de calcul, appliquées dans `domain/budget/monthSummary.ts` :**
un transfert n'est jamais une dépense ; l'épargne du mois ne compte que l'argent
qui entre dans la poche épargne (un virement LEP → PEA ne crée rien) ; la
micro-entreprise ne se mélange jamais au budget personnel.

## Faire évoluer la base de données

Le schéma est versionné dans `src/db/db.ts`. Une version publiée **ne se modifie
jamais** : pour ajouter une table ou un index, on ajoute un bloc `.version(2)` en
dessous, avec au besoin un `.upgrade()`. Une base déjà remplie sur ton téléphone
se met alors à jour au lieu d'être effacée.

## État d'avancement

- [x] **Étape 1** — socle : projet Vite, Dexie, modèle de données, remplissage initial
- [x] **Étape 2** — saisie d'une opération, Dashboard, navigation, graphiques
- [x] **Étape 3** — onglet Opérations : liste, recherche, filtres, édition, suppression
- [x] **Gel des budgets mensuels** — un mois révolu ne bouge plus (§11)
- [x] **Étape 4** — moteur d'épargne flexible et répartition LEP / PEA
- [x] **Étape 5** — écran Paramètres
- [ ] Export Excel (§12) — **décision en attente, voir plus bas**
- [x] **Étape 7** — onglet Patrimoine
- [x] **Étape 8** — onglet Micro-entreprise
- [ ] Opérations récurrentes (§7)
- [x] **Étape 6** — sauvegarde, restauration et exports CSV
- [x] **Étape 9** — PWA installable et hors connexion

### Graphiques

Le Dashboard montre l'avancement de deux façons complémentaires : une barre de
jauge sur chaque carte budgétaire (repliée : le total du groupe ; dépliée : le
détail par sous-catégorie), et un graphique en secteurs pour la répartition
d'ensemble.

Tout est dessiné à la main en SVG et en CSS, sans bibliothèque : l'application
reste légère, les couleurs suivent les variables du thème (donc le mode sombre
fonctionne sans code supplémentaire) et il n'y a aucune dépendance extérieure à
maintenir.

Les trois couleurs de groupe (`--chart-1/2/3` dans `src/index.css`) ont été
vérifiées par script : elles restent distinguables pour les principales formes
de daltonisme et lisibles sur fond clair comme sur fond sombre. **Ne pas les
changer sans revalider.** Le rouge `--chart-over` est réservé au dépassement et
ne sert jamais de couleur de série.

### Un seul écran pour créer et pour modifier

`OperationSheet` sert aux deux : on lui passe une opération existante, ou rien.
Un second écran presque identique aurait divergé au premier changement, et les
deux formulaires n'auraient plus validé la même chose.

À la modification, la ligne est **remplacée entièrement** (`buildTransaction` +
`put`), en conservant son identifiant et sa date de création. C'est ce qui
garantit qu'en transformant une dépense en transfert, l'ancienne catégorie
disparaît vraiment de la base au lieu d'y rester.

### Application installable et hors connexion (§1)

`npm run build` produit une PWA : une icône sur l'écran d'accueil, une
application plein écran, et un démarrage sans réseau.

Le service worker (`public/sw.js`) est écrit à la main plutôt que généré par
une bibliothèque : une cinquantaine de lignes lisibles, zéro dépendance.

**Le piège évité.** Une PWA peut rester figée sur une ancienne version pour
toujours, parce que son service worker sert indéfiniment de vieux fichiers —
et rien ne le signale. Deux garde-fous :

- Le nom du cache vient de l'identifiant de build passé dans l'adresse du
  service worker (`sw.js?v=...`), injecté par Vite. Un nouveau build ⇒ nouvelle
  adresse ⇒ nouveau service worker ⇒ cache neuf et suppression des anciens.
- La page elle-même est servie **réseau d'abord** : dès qu'il y a du réseau, tu
  as la dernière version. Le cache n'est qu'un filet hors ligne.

Les fichiers de `assets/` portent une empreinte dans leur nom : à nom égal leur
contenu ne change jamais, donc ils sont servis depuis le cache sans risque.

**La mise à jour ne s'impose pas.** Le nouveau service worker attend
(`skipWaiting` n'est PAS appelé à l'installation) ; l'application affiche une
bannière et n'active la nouvelle version qu'après ton accord. Prendre la main
d'autorité remplacerait les fichiers sous les pieds d'une page qui continue de
tourner avec l'ancien code, et ferait perdre une saisie en cours.

**L'ordre du nettoyage compte.** Le service worker prend la main sur les pages
(`clients.claim()`) AVANT de supprimer les anciens caches. Dans l'autre sens,
l'ancien service worker contrôle encore les pages pendant le nettoyage : la
moindre requête qu'il traite rouvre le cache qu'on vient d'effacer, et les
caches périmés s'accumulent build après build.

### Micro-entreprise (§9)

Deux règles dont on ne verrait l'erreur qu'en se croyant plus riche qu'on ne l'est :

**Les cotisations portent sur l'ENCAISSÉ, pas sur le facturé.** Une facture
émise mais impayée ne provisionne rien : sinon l'application ferait mettre de
côté de l'argent jamais reçu.

**L'URSSAF ne se compte jamais deux fois.** Elle apparaît à deux endroits —
provisionnée (calculée) et versée (une vraie dépense). Retrancher les deux du
disponible ferait fondre celui-ci à chaque versement, alors que cet argent
était déjà mis de côté :

```
disponible = encaissé - autresDépenses - max(provisionné ; payé)
```

**« En retard » ne se stocke pas.** Une facture devient en retard toute seule
le jour où son échéance passe : enregistré, ce statut serait faux dès le
lendemain. Le statut en base dit où tu en es de ton travail ; le retard se
déduit de la date du jour.

Les dépenses professionnelles sont des `transactions` ordinaires marquées
`isMicro`, conformément au §14 — le bouton « + Dépense » ouvre l'écran de
saisie habituel en mode professionnel. Les factures, elles, sont la source de
vérité du chiffre d'affaires : rien n'est dupliqué en transactions, ce qui
évite tout double compte.

### Patrimoine : versements contre performance (§8)

La question centrale de cet onglet : ton assurance-vie passe de 8 000 € à
8 600 €. Bonne nouvelle ? Impossible à dire sans savoir ce que tu y as mis. Si
tu as versé 500 €, elle a gagné 100 €. Si tu as versé 700 €, elle a **perdu**
100 € — et la hausse du solde te l'aurait caché.

```
variationDuSolde = soldeFin - soldeDebut      (lu dans tes relevés)
versements       = somme des mouvements       (lu dans tes opérations)
performance      = variationDuSolde - versements
```

**Le piège du capital préexistant.** Ton assurance-vie contient déjà 8 000 € le
jour où tu commences à utiliser l'application. Calculer la performance depuis le
1er janvier alors que le premier relevé date de septembre prendrait le solde de
départ pour zéro — et ces 8 000 € apparaîtraient comme un gain. La performance
n'est donc jamais constatée avant le premier relevé, et l'écran annonce depuis
quelle date elle est calculée.

**Deux ensembles de comptes, pas un.** L'effort d'épargne se mesure sur les
poches qui *reçoivent*, la performance sur les seuls placements. Mesuré sur
l'ensemble du patrimoine, un virement du compte courant vers le LEP
s'annulerait avec lui-même et l'épargne afficherait zéro.

### Sauvegarde et restauration (§12)

**Tes données ne vivent que dans ce navigateur.** Un nettoyage du stockage, un
changement de machine ou un profil réinitialisé les efface sans prévenir. Le
fichier `budget-backup-AAAA-MM-JJ.json` est la seule protection : il contient
les onze tables et sait tout remettre en place. Range-le ailleurs que sur
l'appareil qui fait tourner l'application.

Le Dashboard rappelle discrètement de sauvegarder si aucune sauvegarde n'existe
ou si la dernière date de plus de 30 jours.

Trois précautions dans le code :

- **La validation précède tout.** Restaurer remplace la base entière ; un
  fichier étranger, illisible, ou produit par une version plus récente est
  refusé avant que quoi que ce soit ne soit touché.
- **La restauration est atomique.** Tout passe dans une seule transaction
  Dexie : en cas d'échec, la base revient à son état d'avant. On ne peut pas se
  retrouver à moitié restauré.
- **La sauvegarde se date elle-même.** Sinon, restaurer un fichier ferait
  réapparaître aussitôt le rappel « aucune sauvegarde », alors que les données
  restaurées sont précisément celles de la sauvegarde en main.

Les **CSV** (`transactions`, `budgets`, `patrimoine`, `micro_factures`,
`micro_depenses`) servent à consulter et archiver, jamais à restaurer : ils
perdent les réglages et les liens entre tables. Ils sont écrits pour qu'Excel en
français les ouvre du premier coup — séparateur point-virgule, fins de ligne
CRLF, marqueur UTF-8 en tête, montants en nombres à virgule sans symbole €.

### Décision en attente : l'export Excel

Le §12 prévoit un `.xlsx` multi-onglets. Produire ce format demande soit une
bibliothèque (~1 Mo, à maintenir des années), soit un générateur maison
(un `.xlsx` est une archive ZIP de fichiers XML). À trancher ensemble.

### Paramètres : ce qui est protégé

Une catégorie ou un compte **utilisé par des opérations ne peut pas être
supprimé** : les opérations deviendraient orphelines et s'afficheraient « Sans
catégorie » pour toujours. L'écran propose de **désactiver** à la place —
l'élément disparaît de la saisie, l'historique reste intact.

Les comptes dont dépend le moteur d'épargne (LEP, PEA, assurance-vie) et le
compte de saisie par défaut ne peuvent être ni désactivés ni supprimés.

Une catégorie désactivée **ne consomme plus de budget**, mais ses dépenses du
mois continuent de compter — l'argent a bien été dépensé. Le Dashboard la
réaffiche tant qu'elle a servi dans le mois, pour que la somme des lignes
corresponde toujours au total du groupe.

Toute modification du budget rappelle `syncMonthlyBudgets()` : sans ça, la
copie du mois en cours garderait l'ancien budget jusqu'au prochain lancement.

### Le moteur d'épargne (§4)

Deux règles, deux fichiers, tous deux en TypeScript pur et couverts par les
exemples chiffrés du cahier des charges :

- `domain/budget/budgetEngine.ts` — l'enveloppe flexible. Charges fixes,
  loisirs et assurance-vie ne bougent pas ; c'est l'enveloppe LEP/PEA qui
  absorbe la variation des revenus. Si les revenus ne suffisent pas, elle tombe
  à zéro et l'app **affiche un déficit sans jamais rogner** une autre enveloppe.
- `domain/budget/lepPeaEngine.ts` — la répartition. Le LEP passe en premier
  tant qu'il n'a pas atteint son seuil, le surplus va au PEA.

`applyFlexibleEnvelope()` réécrit la ligne du budget correspondante, pour que la
carte Épargne et la carte de proposition affichent toujours le même montant.
La catégorie concernée est désignée par `settings.flexibleSavingsCategoryId` —
jamais devinée.

### Les soldes, sans connexion bancaire (§8)

`domain/patrimony/accountBalance.ts` reconstitue un solde en deux morceaux : le
dernier relevé manuel saisi, plus les mouvements enregistrés depuis. Sans
relevé, on part de zéro — le chiffre n'est alors qu'un cumul d'opérations, pas
un vrai solde. Les opérations datées du **jour** du relevé ne sont pas
recomptées : le solde saisi fait foi pour cette date.

« Actualiser mes soldes » n'est accessible que depuis la carte d'épargne du
Dashboard pour l'instant ; l'onglet Patrimoine le reprendra.

### Gel des budgets mensuels (§11)

Les statistiques d'un mois passé ne changent jamais rétroactivement.

Le mois **en cours** suit tes réglages en permanence : ajuste ton budget le 15,
le mois en cours en tient compte tout de suite. Une copie est tenue à jour dans
la table `monthlyBudgets`. Dès que le mois est **révolu**, cette copie cesse
d'être mise à jour : elle devient la photo définitive, et le Dashboard affiche
« Budget figé ». Rien à clôturer, c'est le passage du temps qui fige.

La règle est dans `domain/budget/monthlyBudget.ts` (pure, testée) ; son
application aux tables est dans `db/budgets.ts`. `syncMonthlyBudgets()` est
appelée au démarrage dans `main.tsx` — **elle devra aussi l'être après toute
modification du budget dans le futur écran Paramètres.**

Limite assumée : si l'application n'est pas ouverte de tout un mois, aucune
photo n'a pu être prise pendant ce mois-là ; elle est alors créée au lancement
suivant à partir du budget courant. C'est la meilleure information disponible,
et mieux que de laisser ce mois dériver à chaque futur changement.
