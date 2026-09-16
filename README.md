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
    operations/         # écran de saisie d'une opération
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
- [ ] **Étape 3** — onglet Opérations : liste complète, recherche, filtres, édition
- [ ] Moteur d'épargne flexible et répartition LEP / PEA
- [ ] Écran Paramètres, graphiques, Patrimoine, Micro
- [ ] Export / sauvegarde / restauration
- [ ] PWA installable

### Graphiques

Dessinés à la main en SVG, sans bibliothèque : l'application reste légère, les
couleurs suivent les variables du thème (donc le mode sombre fonctionne sans
code supplémentaire) et il n'y a aucune dépendance extérieure à maintenir.

Les trois couleurs de groupe (`--chart-1/2/3` dans `src/index.css`) ont été
vérifiées par script : elles restent distinguables pour les principales formes
de daltonisme et lisibles sur fond clair comme sur fond sombre. **Ne pas les
changer sans revalider.** Le rouge `--chart-over` est réservé au dépassement et
ne sert jamais de couleur de série.

### Décisions en attente

- **Quand un budget mensuel se fige-t-il ?** (§11) La lecture est en place dans
  `db/budgets.ts`, mais rien n'écrit encore dans `monthlyBudgets` : il faut
  choisir le déclencheur (première opération du mois / clôture / manuel).
