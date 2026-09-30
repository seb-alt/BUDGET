# Budget

Application personnelle de gestion financière — budget courant, patrimoine, micro-entreprise.
React + TypeScript + Vite, données stockées **100 % en local** dans IndexedDB via Dexie.
Aucun service cloud, aucun abonnement, aucune donnée qui sort de la machine.

**Tu cherches à t'en servir, pas à le modifier ? → [GUIDE.md](GUIDE.md)** :
installation sur téléphone, prise en main, et surtout sauvegarde des données.
Ce README-ci s'adresse à qui touche au code.

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
    theme.ts            # choix du thème : automatique, clair, sombre
    ThemeToggle.tsx     # le bouton soleil / lune de l'en-tête
    useServiceWorker.ts # installation hors ligne et bannière de mise à jour
  features/
    dashboard/          # accueil : indicateurs, cartes budget, graphiques
    micro/              # micro-entreprise : factures, clients, prévisionnel
    operations/         # saisie d'une opération, et liste complète
    patrimony/          # saisie manuelle des soldes
    report/             # le rapport d'un mois, à l'écran et à l'impression
    settings/           # écran Paramètres
  domain/
    backup/             # format de sauvegarde, validation, CSV
    export/             # archive ZIP, classeur Excel, rapport d'un mois
    migration/          # renommages d'identifiants, partagés base et sauvegarde
    budget/             # LES CALCULS, en TypeScript pur, sans React ni Dexie
    operations/         # recherche et filtres
    patrimony/          # soldes des comptes
    recurring/          # échéances des règles récurrentes
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
    recurring.ts        # règles récurrentes : application et confirmation
    monthlyReport.ts    # tout ce qu'il faut savoir sur un mois, en une fois
  assets/               # la police Inter, embarquée dans l'application
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

Le cahier des charges est couvert. Les étapes sont listées dans l'ordre où
elles ont été construites, pas dans celui du document.

- [x] **Étape 1** — socle : projet Vite, Dexie, modèle de données, remplissage initial
- [x] **Étape 2** — saisie d'une opération, Dashboard, navigation, graphiques
- [x] **Étape 3** — onglet Opérations : liste, recherche, filtres, édition, suppression
- [x] **Étape 4** — moteur d'épargne flexible et répartition LEP / PEA (§4)
- [x] **Étape 5** — écran Paramètres
- [x] **Étape 6** — sauvegarde, restauration et exports CSV
- [x] **Étape 7** — onglet Patrimoine (§8)
- [x] **Étape 8** — onglet Micro-entreprise (§9)
- [x] **Étape 9** — PWA installable et hors connexion (§1)
- [x] **Gel des budgets mensuels** — un mois révolu ne bouge plus (§11)
- [x] **Étape 10** — opérations récurrentes (§7)
- [x] **Étape 11** — identité visuelle : police, palette, mode sombre (§13)
- [x] **Étape 12** — rapport mensuel en Excel (§12)
- [x] **Étape 13** — rapport mensuel en PDF (§12)
- [x] **Étape 14** — bascule clair / sombre
- [x] **Étape 15** — publication sur GitHub Pages et guide d'utilisation
- [x] **Étape 16** — remplissage initial neutre, pour un dépôt publiable

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

### Le rapport mensuel en Excel (§12)

Depuis **Paramètres → Rapport mensuel** : on choisit un mois, on obtient
`budget-2026-09.xlsx` — un nom qui se classe tout seul par ordre
chronologique. Cinq feuilles : Résumé, Opérations, Budget, Comptes, et
Factures s'il y en a.

À ne pas confondre avec la sauvegarde : la **sauvegarde** remet l'application
d'aplomb et n'est pas faite pour être lue ; le **rapport** sert à regarder un
mois et ne restaure rien.

**Les montants sont de vrais nombres**, avec un format d'affichage en euros.
C'est toute la différence avec un CSV : on peut additionner, trier, faire un
tableau croisé. Un montant écrit « 1 234,56 € » serait du texte, donc inerte.
Les dates aussi sont de vraies dates.

**Le classeur est fabriqué à la main, sans bibliothèque.** Un `.xlsx` est une
archive ZIP contenant des fichiers XML ; `domain/export/zip.ts` écrit
l'archive (sans compression — le format l'autorise et Excel l'accepte) et
`domain/export/xlsx.ts` écrit le XML. Coût total : **14 Ko** dans le fichier
que ton téléphone télécharge, contre plusieurs centaines pour une
bibliothèque, et aucune dépendance à surveiller pendant des années. Les deux
sont testés, et le fichier produit a été relu par un outil tiers pour
vérifier qu'Excel l'accepterait.

Une règle vaut d'être connue : **le format est celui de la colonne, mais la
cellule a le dernier mot.** La feuille Résumé mélange forcément « Entrées du
mois | 2 100 € » et « Mois | SEPTEMBRE 2026 » dans la même colonne. Si la
colonne imposait son format, le texte serait perdu — c'est exactement ce qui
arrivait avant que cette règle existe.

`db/monthlyReport.ts` est le **seul** endroit qui décide de ce que contient un
mois, et il appelle les mêmes fonctions que l'accueil (`computeMonthSummary`,
`applyFlexibleEnvelope`, `computeAccountBalances`, `computeMicroSummary`). Un
export qui raconterait autre chose que l'écran serait pire que pas d'export.

Attention à la colonne **Montant** de la feuille Opérations : elle est signée
du point de vue du compte de la colonne « Compte ». Additionner toutes les
lignes mélangerait donc les comptes — c'est le Résumé qui applique les règles
du budget (un virement n'est pas une dépense, la micro ne se mélange pas au
personnel).

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

### Opérations récurrentes (§7)

Une règle décrit une opération qui revient : un nom, un montant, une
fréquence (chaque semaine, chaque mois, chaque année), un jour du mois, une
date de début, une date de fin facultative, et **un mode** :

- **automatique** — l'opération se crée toute seule au lancement, pour ce qui
  tombe à coup sûr (loyer, prêt étudiant, abonnement) ;
- **à confirmer** — elle est proposée sur l'accueil et attend ton accord, pour
  ce qui varie ou peut ne pas avoir lieu.

**Comment les doublons sont évités.** La tentation est de retenir dans la
règle la date de son dernier déclenchement. C'est un compteur : il se
désynchronise dès qu'on restaure une sauvegarde plus ancienne, qu'on supprime
une opération à la main, ou que l'horloge recule. Ici, rien n'est retenu. Avant
de créer quoi que ce soit, le moteur liste les échéances dues depuis la date de
début, puis retire celles qui existent **déjà** dans la table des opérations,
reconnues par le couple `recurringRuleId` + `date`. La protection repose donc
sur un fait vérifiable dans la base, pas sur une mémoire à tenir à jour — et
elle reste vraie après n'importe quelle restauration.

Les échéances écartées, elles, sont bien mémorisées dans la règle
(`skippedDates`) : sans cette liste, une proposition refusée reviendrait à
chaque ouverture, et rien ne permettrait de s'en débarrasser.

Un jour du mois impossible est ramené au dernier jour réel : le 31 devient le
30 en avril, le 28 ou le 29 en février.

Trois gestes distincts sur une règle, à ne pas confondre :

| Geste | Effet sur la règle | Effet sur les opérations déjà créées |
| --- | --- | --- |
| Désactiver | elle ne produit plus rien, elle reste là | aucun |
| Supprimer | elle disparaît | aucun |
| Écarter une échéance | elle continue | cette échéance-là n'est jamais créée |

Le moteur est dans `domain/recurring/recurringEngine.ts` (pur, testé) ; son
branchement sur les tables est dans `db/recurring.ts`. `applyAutomaticRules()`
est appelée au démarrage dans `main.tsx`, après `syncMonthlyBudgets()` — dans
cet ordre, pour qu'un mois qui vient de se terminer soit figé avant que de
nouvelles opérations n'y soient ajoutées.

Limite assumée : les règles ne s'appliquent qu'à l'ouverture de l'application.
Sans serveur, rien ne peut tourner pendant qu'elle est fermée. Rouvrir
l'application un mois plus tard crée d'un coup toutes les échéances manquées,
chacune à sa vraie date.

### L'identité visuelle (§13)

Tout tient dans `src/index.css`. Aucun composant n'écrit une couleur : ils
utilisent des variables. Changer l'apparence de toute l'application, mode
sombre compris, se fait donc dans ce seul fichier.

**La police.** Inter, mais **embarquée dans l'application**, pas chargée depuis
Google. Trois raisons : elle doit fonctionner hors connexion (§1), ta
navigation n'a pas à passer chez un tiers (§2), et une police servie de
l'extérieur peut changer ou disparaître. C'est la version « variable » : un
seul fichier de 48 Ko couvre toutes les graisses. Seul le sous-ensemble latin
est embarqué — il couvre l'intégralité du français, accents, œ et € compris.
Le fichier vient de `@fontsource-variable/inter` ; sa licence est dans
`src/assets/inter-LICENSE.txt`.

**Les couleurs.** Trois familles, et rien d'autre : un gris clair, un
anthracite, un orange. En mode sombre les deux premiers s'échangent ; l'orange
ne bouge presque pas, c'est le repère de l'œil.

L'orange est rare exprès. Une couleur d'accent n'attire l'œil que si elle est
la seule à le faire. Elle est donc réservée à ce sur quoi on peut **agir**
(bouton principal, onglet actif, sélection) et au chiffre du moment.

Le rouge et le vert existent toujours, mais ils ne colorent plus les montants
ordinaires : une dépense normale n'est pas une alerte, et l'étiquette « Sorties
du mois » dit déjà de quoi il s'agit. Ils sont gardés pour ce qui signale
vraiment quelque chose — budget dépassé, solde négatif, plus-value,
suppression.

**Deux tons d'orange, et pourquoi.** Un aplat et un texte n'ont pas les mêmes
exigences de lisibilité. `--accent` (#dd5f1e) sert aux aplats ; `--accent-ink`
(#b8480f), plus sombre, sert quand l'orange est du **texte** sur fond clair, où
le premier passerait sous le seuil de contraste. Sur un aplat orange,
l'étiquette est anthracite et non blanche : le blanc n'y atteint que 3,7 pour 1
quand il en faut 4,5 ; l'anthracite tient 4,7.

**Les couleurs des graphiques ne sont pas choisies à l'œil.** Elles sont
passées au validateur de la méthode dataviz, qui vérifie la bande de clarté, la
saturation minimale, la séparation sous protanopie et deutéranopie, et le
contraste sur la carte :

```
node scripts/validate_palette.js "#dd5f1e,#2f6fc4,#0f8a6a,#8b4bb0" --mode light --surface "#ffffff"
node scripts/validate_palette.js "#dd5f1e,#2f6fc4,#0f8a6a" --mode light --surface "#ffffff" --pairs all
node scripts/validate_palette.js "#e56a2b,#5a8de0,#25a482,#a273d4" --mode dark --surface "#1c1c1b"
```

Les quatre passent en voisines (le cas des barres groupées) et les trois
premières passent toutes paires confondues (le cas de l'anneau, où la première
touche la dernière). La couleur de dépassement a été choisie assez loin de
l'orange pour qu'un budget dépassé ne se confonde pas avec les charges fixes.
Au passage, l'ancienne palette échouait à ce dernier test : son orange et son
ambre étaient trop proches pour être distingués, même avec une vision normale.

**Ne pas changer ces valeurs sans relancer le validateur.**

### Le rapport mensuel en PDF (§12)

Même endroit : **Paramètres → Rapport mensuel → Voir le rapport**. Une page
mise en forme, puis **Imprimer / PDF**.

**Aucune bibliothèque PDF.** Le navigateur sait déjà fabriquer un PDF — c'est
ce que fait « Imprimer → Enregistrer au format PDF », sur ordinateur comme sur
téléphone. Passer par lui donne du texte sélectionnable et cherchable, à la
bonne taille, sans ajouter plusieurs centaines de kilo-octets au
téléchargement de l'application, et ça marche hors connexion puisque rien
n'est chargé. La contrepartie est qu'il faut une vraie feuille de style
d'impression : c'est `features/report/Report.css`, et c'est là que se joue la
mise en page du PDF.

**Le rapport est rendu dans un portail**, c'est-à-dire à côté de
l'application dans le document, et non dedans. Raison : `window.print()`
imprime toute la page ; pour n'imprimer que le rapport il faut pouvoir écarter
tout le reste — or le reste est son parent, et cacher le parent cacherait
aussi le rapport. Avec le portail, l'application entière disparaît d'un
`display: none`, et le rapport se retrouve seul sur la feuille **dans le flux
normal** : il se répartit donc correctement sur plusieurs pages, les en-têtes
de tableau se répètent, et aucune ligne n'est coupée en deux.

Ce `display: none` est conditionné à `body:has(.report-portal)`. Sans cette
condition, un simple Ctrl+P n'importe où dans l'application imprimerait une
page blanche.

À l'impression, les couleurs sont forcées en clair quel que soit le thème de
l'écran : imprimer un fond anthracite viderait une cartouche et rendrait le
texte illisible. Un dépassement reste repérable même en noir et blanc, parce
que c'est le gras qui porte l'information et la couleur qui la renforce.

Sur un écran étroit, les colonnes secondaires disparaissent — le groupe d'une
catégorie, la date d'émission d'une facture, le compte d'une opération. Jamais
l'information principale, et jamais sur le papier ni dans le classeur Excel.

### La bascule clair / sombre

Le bouton soleil / lune est en haut de l'écran, à gauche de l'engrenage.
« Automatique » se retrouve dans **Paramètres → Apparence**.

**Trois états, pas deux.** « Automatique » suit le réglage de l'appareil, et
c'est l'état de départ. Un bouton qui se contenterait d'alterner clair et
sombre supprimerait cette possibilité dès le premier appui — d'où la section
dans les Paramètres, qui la nomme et permet d'y revenir.

**L'icône montre ce qu'on va obtenir, pas ce qu'on a.** En clair elle affiche
une lune : « appuie pour passer en sombre ». L'état actuel, on l'a déjà sous
les yeux — c'est l'écran.

**Le choix est dans `localStorage`, pas dans la base.** Deux raisons : c'est
une préférence d'appareil (sombre sur le téléphone, clair sur l'ordinateur),
donc elle n'a rien à faire dans une sauvegarde qu'on restaurera ailleurs ; et
`localStorage` se lit instantanément, avant que React démarre.

**Le clignement au démarrage**, c'est le vrai piège. Sans précaution,
quelqu'un qui a choisi le sombre verrait l'application apparaître en clair une
fraction de seconde à chaque ouverture, le temps que React lise sa préférence.
Un petit script dans `index.html` pose donc le thème **avant le premier pixel
affiché**. Il est écrit sans module ni dépendance, pour n'avoir rien à
télécharger avant de s'exécuter. Un test le vérifie en observant la page avant
même que React ait pu s'exécuter.

**Une seule déclaration par couleur.** `index.css` utilise
`light-dark(clair, sombre)`, et c'est `color-scheme` qui décide laquelle
s'applique. Avant, il fallait deux blocs complets : quarante lignes en double,
et le risque permanent d'en modifier une et d'oublier l'autre. Bonus : les
éléments fournis par le navigateur — barres de défilement, sélecteur de date —
suivent le thème eux aussi.

Contrepartie assumée : `light-dark()` demande un navigateur de 2024 ou plus
récent (Chrome 123, Safari 17.5, Firefox 120). Sur plus ancien, l'application
s'afficherait sans ses couleurs. C'est à peu près la même exigence que
`:has()` et `color-mix()`, déjà utilisés ailleurs.

Au passage, l'icône des Paramètres a été redessinée. L'ancienne — un petit
disque et huit rayons fins — se lisait comme un soleil, ce qui devenait
franchement ambigu à côté d'un bouton de thème qui en affiche un pour de bon.

### Publication

`.github/workflows/deploy.yml` construit et publie sur GitHub Pages à chaque
poussée sur `main`.

**L'ordre compte.** `Settings → Pages → Source : GitHub Actions` doit être posé
AVANT la première publication. Sinon la construction se lance, réussit, puis
échoue à l'étape `configure-pages` avec « Get Pages site failed » : il n'y a
pas de site où déposer le résultat. Le réglage, puis *Run workflow* depuis
l'onglet Actions, suffit — rien à corriger dans le code.

L'action sait activer Pages elle-même (paramètre `enablement`), mais cela exige
un jeton d'accès personnel à créer et à ranger dans les secrets du dépôt : plus
de travail que le réglage lui-même, et un secret de plus à surveiller.

GitHub Pages n'est gratuit que sur un dépôt **public** ; sur un dépôt privé, il
faut un compte payant. C'est la raison pour laquelle le remplissage initial ne
contient plus aucune valeur personnelle (voir plus bas).

Les contrôles passent **avant** la publication — lint, types, tests. Une
version cassée ne doit jamais atteindre un téléphone.

**L'application ne suppose plus d'être servie à la racine d'un domaine.** Un
site de projet GitHub Pages vit dans un sous-dossier (`/BUDGET/`), et trois
endroits écrivaient « / » en dur :

| Où | Avant | Maintenant |
| --- | --- | --- |
| `vite.config.ts` | — | `base: process.env.BASE_PATH ?? '/'` |
| `manifest.webmanifest` | `"start_url": "/"` | `"./"`, résolu par le navigateur |
| `sw.js` | `['/', '/manifest…']` | `ROOT`, déduit de l'adresse du service worker |
| `useServiceWorker.ts` | `register('/sw.js')` | `register(`${import.meta.env.BASE_URL}sw.js`)` |

`ROOT` mérite un mot : le service worker connaît sa propre adresse, et le
dossier qui la contient EST le dossier de l'application. Sans ça, il mettrait
en cache la racine du domaine — c'est-à-dire autre chose que l'application,
quand ce n'est pas une page d'erreur. Sa portée suit la même logique : déposé
dans un sous-dossier, il ne contrôle que ce sous-dossier.

Vérifié dans les deux configurations : à la racine, et servi depuis un
sous-dossier par un serveur qui imite GitHub Pages — démarrage, manifeste
résolu, portée du service worker, contenu du cache, et fonctionnement hors
connexion.

### Un remplissage initial neutre (version 5)

Le dépôt est destiné à être public. Le remplissage initial ne contient donc
plus aucune valeur personnelle : les catégories de revenus s'appellent
« Revenu principal » et « Revenu secondaire », le compte courant s'appelle
« Compte courant », et tous les montants partent à zéro. Chacun saisit les
siens dans les Paramètres, et ils restent dans son navigateur.

Les identifiants aussi portaient des noms : `cat-itaxia`, `acc-cic`. Ils sont
devenus `cat-revenu-1`, `acc-courant`.

**Changer un identifiant n'est pas anodin.** Il est recopié dans les
opérations, les budgets figés, les relevés de soldes, les règles récurrentes
et les réglages. Le changer au seul endroit du remplissage initial produirait
des doublons sur une base existante : l'ancienne catégorie resterait, avec
toutes ses opérations, et la nouvelle apparaîtrait vide à côté.

D'où la **version 5** de la base, qui renomme partout. Et d'où, surtout, le
fait que la logique vive dans `domain/migration/renameIds.ts` plutôt que dans
la migration elle-même :

> **Restaurer une sauvegarde ne rejoue aucune migration.** Dexie n'exécute ses
> `upgrade()` qu'au changement de version de la base, pas à chaque écriture.
> Une sauvegarde d'avant la version 5, restaurée dans une base déjà migrée,
> réintroduirait donc les anciens identifiants. `restoreBackup` applique la
> même transformation, depuis le même fichier — les deux chemins ne peuvent
> pas diverger.

Vérifié sur une vraie base : une base en version 4 est construite à la main
avec les anciens identifiants et des données dans huit tables, puis
l'application est lancée. Contrôles : plus aucun ancien identifiant, aucun
doublon, et aucune donnée perdue — opérations, soldes, budget figé, règle
récurrente, réglages et rattachements d'épargne suivent tous.

### Faire évoluer ses catégories

**Paramètres → Catégories** : ajouter, renommer, réordonner, désactiver,
supprimer. L'écran **Budget mensuel** construit sa liste à partir des
catégories — une nouvelle y apparaît donc aussitôt avec son champ de montant,
puis dans la saisie et sur la carte de son groupe.

Deux garde-fous :

- une catégorie **utilisée par des opérations ne peut pas être supprimée** ;
  le message propose de la désactiver, ce qui la retire de la saisie sans
  abîmer l'historique ;
- on n'ajoute pas de catégorie au groupe **Épargne** : ces enveloppes sont
  alimentées par des virements et doivent pointer vers des comptes précis
  (`savingAccountIds`), ce qu'un simple nom ne suffit pas à décrire.
