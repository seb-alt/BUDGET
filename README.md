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
npm run build   # vérifie les types et construit la version de production
npm run lint    # analyse le code
```

## Où se trouve quoi

```
src/
  db/
    types.ts     # la forme de chaque donnée (dictionnaire)
    db.ts        # les tables IndexedDB et leurs versions (classeur)
    seed.ts      # comptes, catégories et réglages créés au premier lancement
  utils/
    money.ts     # conversion centimes <-> euros et formatage
  App.tsx        # écran temporaire de vérification du socle
  main.tsx       # point d'entrée : remplit la base puis affiche React
```

## Deux conventions à connaître

**Les montants sont des entiers en centimes.** 24,50 € est stocké `2450`.
En informatique `0.1 + 0.2` ne vaut pas exactement `0.3` ; avec des entiers, les
totaux restent justes même après des années d'opérations. La conversion se fait
uniquement à l'affichage, dans `src/utils/money.ts`.

**Aucune valeur métier n'est écrite en dur dans un composant.** Budget, seuil LEP,
taux URSSAF, délais de paiement : tout vient de la base (`settings`, `microSettings`,
`categories`) et sera modifiable depuis l'écran Paramètres.

## Faire évoluer la base de données

Le schéma est versionné dans `src/db/db.ts`. Une version publiée **ne se modifie
jamais** : pour ajouter une table ou un index, on ajoute un bloc `.version(2)` en
dessous, avec au besoin un `.upgrade()`. Une base déjà remplie sur ton téléphone
se met alors à jour au lieu d'être effacée.

## État d'avancement

- [x] **Étape 1** — socle : projet Vite, Dexie, modèle de données, remplissage initial
- [ ] **Étape 2** — écran « Nouvelle opération » branché sur la table `transactions`
- [ ] Dashboard, Opérations, Patrimoine, Micro, Paramètres
- [ ] Export / sauvegarde / restauration
- [ ] PWA installable
