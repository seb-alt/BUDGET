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
  app/App.tsx           # coquille : navigation basse et bouton +
  features/
    dashboard/          # accueil : indicateurs, cartes budget, graphiques
    operations/         # saisie d'une opération, et liste complète
  domain/
    budget/             # LES CALCULS, en TypeScript pur, sans React ni Dexie
  components/ui/        # briques réutilisables (panneau, boutons de choix…)
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
- [ ] Moteur d'épargne flexible et répartition LEP / PEA
- [ ] Écran Paramètres, graphiques, Patrimoine, Micro
- [ ] Export / sauvegarde / restauration
- [ ] PWA installable

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
