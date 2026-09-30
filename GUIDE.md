# Budget — guide d'utilisation

Ce guide répond à trois questions : **comment installer l'application sur ton
téléphone**, **comment t'en servir au quotidien**, et surtout **comment ne
jamais perdre tes données**.

La dernière partie est la plus importante. Lis-la même si tu sautes le reste.

---

## 1. Ce qu'il faut comprendre avant tout

Budget ne ressemble pas aux applications que tu connais. Il n'y a **pas de
compte à créer, pas de mot de passe, pas de serveur**. Tes données ne partent
nulle part : elles sont écrites dans le stockage de ton navigateur, sur ton
téléphone, et elles y restent.

C'est un choix, et il a deux faces.

**L'avantage :** personne d'autre que toi ne voit tes comptes. Pas
d'abonnement, pas d'entreprise qui peut fermer, pas de conditions d'utilisation
qui changent. L'application fonctionnera dans dix ans exactement comme
aujourd'hui.

**La contrepartie :** *personne ne sauvegarde à ta place.* Si tu perds ton
téléphone, si tu effaces les données de ton navigateur, si tu désinstalles
l'application — tes données disparaissent avec. Il n'y a pas de « mot de passe
oublié », pas de support à contacter, rien à restaurer depuis un nuage.

D'où la règle unique de ce guide :

> **Une sauvegarde par mois, rangée ailleurs que sur le téléphone.**

Tout le reste est du confort. Ça, non.

---

## 2. Installer l'application sur ton téléphone

### Étape préalable : mettre l'application en ligne (une seule fois)

Pour installer une application web sur un téléphone, il lui faut une adresse.
Le code est sur GitHub ; il suffit de demander à GitHub de le servir.

1. **Fusionne le travail dans la branche `main`.** Tout a été développé sur une
   branche à part ; la publication ne se déclenche que depuis `main`. Sur
   GitHub : onglet **Pull requests** → **New pull request** → de la branche
   `claude/new-session-hc8u08` vers `main` → **Merge**.
2. Va sur ton dépôt : **github.com/seb-alt/BUDGET**
3. Onglet **Settings** (Réglages), puis **Pages** dans la colonne de gauche
4. Sous **Source**, choisis **GitHub Actions**
5. C'est tout. À chaque fois que le code changera, le site se reconstruira tout
   seul.

Tu peux suivre la construction dans l'onglet **Actions** : une coche verte veut
dire que le site est en ligne. Elle prend deux à trois minutes.

Après quelques minutes, ton application est à l'adresse :

```
https://seb-alt.github.io/BUDGET/
```

**Ce qui est publié, c'est le CODE de l'application, pas tes données.** N'importe
qui avec ce lien obtiendrait une application *vide*, la sienne. Tes chiffres ne
sont sur aucun serveur — ils sont dans ton téléphone.

> Si tu préfères que même le code reste privé, dis-le-moi : on peut le servir
> depuis un hébergement privé. Mais ce n'est pas nécessaire pour la
> confidentialité de tes données.

### Sur iPhone (Safari)

Safari est **obligatoire** ici. Chrome sur iPhone ne sait pas installer les
applications web.

1. Ouvre **Safari** et va sur l'adresse ci-dessus
2. Appuie sur le bouton **Partager** (le carré avec une flèche vers le haut, en
   bas de l'écran)
3. Fais défiler et choisis **Sur l'écran d'accueil**
4. Nomme-la « Budget » et appuie sur **Ajouter**

L'icône orange apparaît sur ton écran d'accueil. Lance-la : plus de barre
d'adresse, plus d'onglets — elle se comporte comme une vraie application.

> **Important sur iPhone :** l'application installée depuis l'écran d'accueil a
> son propre stockage, séparé de celui de Safari. Si tu avais saisi des choses
> dans Safari avant d'installer, elles ne suivront pas. Installe **d'abord**,
> saisis ensuite.

### Sur Android (Chrome)

1. Ouvre **Chrome** et va sur l'adresse
2. Menu **⋮** en haut à droite
3. **Installer l'application** (ou « Ajouter à l'écran d'accueil »)
4. Confirme

### Sur ordinateur

Même adresse dans Chrome ou Edge : une icône d'installation apparaît dans la
barre d'adresse, à droite.

Attention : **l'ordinateur et le téléphone ont chacun leurs propres données.**
Rien ne se synchronise entre les deux. Choisis un appareil principal — ton
téléphone — et sers-toi de l'autre uniquement pour consulter, ou transfère par
sauvegarde.

### Ça marche sans connexion

Une fois ouverte une première fois, l'application fonctionne dans le métro, en
avion, à la campagne. Tu peux saisir, consulter, tout faire. La connexion ne
sert qu'à récupérer les mises à jour.

Quand une mise à jour est prête, un bandeau apparaît en haut : **« Une nouvelle
version est prête »**. Tu choisis le moment — jamais en pleine saisie.

---

## 3. Le tour du propriétaire

Quatre onglets en bas, un bouton **+** au milieu, deux icônes en haut.

### Le bouton **+** — saisir une opération

C'est le geste que tu feras le plus souvent. Il est au centre, sous le pouce.

Trois types :

| Type | Ce que c'est | Exemple |
| --- | --- | --- |
| **Dépense** | de l'argent qui sort | courses, essence, restaurant |
| **Entrée** | de l'argent qui rentre | salaire, remboursement |
| **Transfert** | de l'argent qui change de poche | CIC → PEA |

**Un transfert n'est pas une dépense.** Virer 200 € sur ton PEA ne t'appauvrit
pas — c'est pourquoi l'application ne le compte jamais dans tes sorties. C'est
l'une des trois règles de calcul du budget, et elle est là pour t'éviter de
croire que tu as trop dépensé alors que tu as juste épargné.

### 🏠 Accueil

Le mois en cours. Quatre chiffres en haut, puis :

- **Épargne du mois — proposition.** Ce que tu *devrais* verser ce mois-ci,
  calculé sur ce que tu as réellement encaissé. C'est une proposition :
  l'application ne vire rien à ta place.
- **Trois cartes budgétaires** (Charges fixes, Épargne, Loisirs). Appuie sur
  une carte pour voir le détail par catégorie.
- Le **camembert** de répartition, avec l'onglet Prévu / Réalisé.
- Les **dernières opérations**.

Les flèches en haut permettent de revenir sur les mois passés.

> **« Budget figé »** : dès qu'un mois est terminé, ses chiffres ne bougent
> plus, même si tu changes ton budget après coup. Sans ça, ton historique se
> réécrirait tout seul à chaque ajustement et ne voudrait plus rien dire.

### ☰ Opérations

Tout l'historique. Recherche par libellé, catégorie, compte ou montant, et des
filtres. Appuie sur une ligne pour la modifier ou la supprimer.

### 📊 Patrimoine

Ce que tu possèdes, compte par compte, et son évolution.

L'application ne se connecte à aucune banque — **c'est toi qui saisis les
soldes**, quand tu veux, via **Mettre à jour mes soldes**. Un relevé par mois
suffit largement.

Deux chiffres à ne pas confondre :

- **Épargné** : ce que tu as versé de ta poche.
- **Valorisation** : ce que tes placements ont gagné ou perdu tout seuls.

Les additionner n'aurait aucun sens. L'application les sépare, et la
valorisation n'est calculable qu'à partir de ton premier relevé de soldes —
avant lui, elle ne sait pas d'où tu pars.

### 💼 Micro

Tes factures clients, l'URSSAF et ton prévisionnel.

Le chiffre à regarder est **Disponible estimé** : ton encaissé, moins tes frais
professionnels, moins la provision URSSAF. C'est ce que tu peux réellement te
verser — avant impôt sur le revenu.

L'application distingue l'URSSAF **provisionnée** (ce que tu dois) de l'URSSAF
**versée** (ce que tu as payé). Sans cette distinction, impossible de savoir ce
qu'il te reste à régler.

**La micro ne se mélange jamais au budget personnel.** Une dépense
professionnelle n'apparaît pas dans tes charges fixes. C'est la troisième règle
de calcul.

### ☀️ / 🌙 et ⚙️ en haut

Le soleil ou la lune bascule entre clair et sombre. L'engrenage ouvre les
**Paramètres**.

---

## 4. Les Paramètres

| Section | À quoi ça sert |
| --- | --- |
| **Apparence** | Automatique (suit ton téléphone), Clair ou Sombre |
| **Budget mensuel** | le montant alloué à chaque catégorie |
| **Épargne et prêt** | assurance-vie mensuelle, plafond du LEP |
| **Catégories** | créer, renommer, réordonner, désactiver |
| **Comptes** | tes comptes bancaires et placements |
| **Opérations récurrentes** | loyer, abonnements, prêt étudiant |
| **Micro-entreprise** | taux URSSAF, délai de paiement, numérotation |
| **Rapport mensuel** | **les exports Excel et PDF** |
| **Sauvegarde** | **la sauvegarde complète** |

### Les opérations récurrentes, en deux mots

Une règle décrit ce qui revient chaque mois. Deux modes :

- **Automatique** — l'opération se crée toute seule à l'ouverture. Pour ce qui
  tombe à coup sûr : loyer, prêt, abonnement.
- **À confirmer** — elle est proposée sur l'accueil et attend ton accord. Pour
  ce qui varie ou peut ne pas avoir lieu.

Trois gestes à ne pas confondre :

| Geste | La règle | Les opérations déjà créées |
| --- | --- | --- |
| **Désactiver** | ne produit plus rien, reste là | intactes |
| **Supprimer** | disparaît | intactes |
| **Écarter** une échéance | continue | celle-là ne sera jamais créée |

Rouvrir l'application après trois semaines d'absence crée d'un coup toutes les
échéances manquées, chacune à sa vraie date. Et jamais de doublon, même si tu
ouvres l'application dix fois dans la journée.

---

## 5. Exporter et sauvegarder — la partie importante

Il y a **deux choses différentes**, et les confondre est le seul vrai risque.

| | **Sauvegarde** | **Rapport mensuel** |
| --- | --- | --- |
| Fichier | `budget-sauvegarde-2026-09-30.json` | `budget-2026-09.xlsx` et le PDF |
| Contient | **tout**, jusqu'au moindre réglage | un mois, mis en forme |
| Sert à | **remettre l'application d'aplomb** | regarder, calculer, archiver |
| Se lit ? | non, ce n'est pas fait pour | oui |
| Restaure ? | **oui** | **non, jamais** |

**Un fichier Excel ne restaurera jamais tes données.** Il ne contient ni tes
réglages, ni les liens entre tes tables. Si tu ne gardes que des Excel et que
ton téléphone tombe à l'eau, tu as perdu ton application.

### La sauvegarde — le geste à ne pas rater

**Paramètres → Sauvegarde → Télécharger la sauvegarde**

Tu obtiens un fichier `.json` daté. Ce fichier contient **absolument tout** :
opérations, budgets, catégories, comptes, factures, clients, réglages,
historique des soldes.

**Une fois par mois. Le même jour que ton rapport mensuel.**

L'application te le rappelle : si ta dernière sauvegarde date de plus d'un mois,
un bandeau apparaît sur l'accueil. **Ne l'ignore pas.** Il est discret exprès —
ce n'est pas une alerte, c'est un rappel. Mais c'est le seul filet de sécurité
qui existe.

### Où ranger ce fichier

La règle : **ailleurs que sur le téléphone**. Un fichier de sauvegarde rangé
uniquement dans le téléphone qu'il est censé protéger ne protège rien.

Par ordre de préférence :

1. **Deux endroits valent mieux qu'un.** Par exemple ton stockage en ligne
   habituel (iCloud Drive, Google Drive, Dropbox…) *et* un dossier sur ton
   ordinateur.
2. **Un stockage en ligne** — le plus simple : depuis le téléphone, après le
   téléchargement, tu partages le fichier vers Fichiers / Drive.
3. **Ton ordinateur**, dans un dossier « Budget » que tu sauvegardes déjà.
4. **Une clé USB**, si tu tiens à ce que rien ne passe par un service en ligne.

> « Mais je croyais que mes données ne devaient pas aller dans le nuage ? »
>
> Nuance importante. L'application ne parle à aucun service : rien ne part
> automatiquement, rien n'est partagé sans toi. Mais *toi*, tu peux ranger ta
> sauvegarde où tu veux. Un fichier que tu déposes volontairement dans ton
> Drive n'a rien à voir avec une application qui envoie tes données en
> permanence à une entreprise. Si ça te gêne quand même : clé USB ou ordinateur,
> et c'est parfait.

**Garde les douze dernières.** Elles ne pèsent presque rien. Si tu t'aperçois en
mars qu'une erreur s'est glissée en janvier, tu pourras revenir en arrière.

### Restaurer

**Paramètres → Sauvegarde → Restaurer depuis un fichier**

L'application lit d'abord le fichier et t'annonce ce qu'il contient — combien
d'opérations, quelle date. **Rien n'est remplacé avant que tu confirmes.**

⚠️ **La restauration REMPLACE tout.** Ce n'est pas une fusion. Tout ce qui est
dans l'application au moment de la restauration disparaît au profit du contenu
du fichier. Fais une sauvegarde juste avant, par précaution.

C'est aussi comme ça qu'on **change de téléphone** : sauvegarde sur l'ancien,
installe l'application sur le nouveau, restaure.

### Le rapport mensuel

**Paramètres → Rapport mensuel**, tu choisis un mois, puis :

**Télécharger le classeur Excel** — cinq feuilles :

| Feuille | Contenu |
| --- | --- |
| Résumé | les chiffres du mois, groupe par groupe |
| Opérations | toutes les opérations, ligne par ligne |
| Budget | prévu / dépensé / reste, par catégorie |
| Comptes | les soldes à la fin du mois |
| Factures | les factures du mois, s'il y en a |

Les montants sont de **vrais nombres**, pas du texte : tu peux additionner,
trier, faire un tableau croisé. Les dates sont de vraies dates.

> Une précision sur la colonne **Montant** de la feuille Opérations : elle est
> signée du point de vue du compte de la colonne « Compte ». Additionner
> *toutes* les lignes mélangerait donc les comptes. C'est la feuille **Résumé**
> qui applique les règles du budget.

**Voir le rapport et l'enregistrer en PDF** — une page mise en forme. Puis
**Imprimer / PDF**, et ton téléphone propose « Enregistrer au format PDF ».

- **iPhone** : bouton Partager → Imprimer → pince-à-écarter sur l'aperçu →
  Enregistrer dans Fichiers
- **Android** : Imprimer → destination « Enregistrer au format PDF »

### Il existe aussi des CSV

**Paramètres → Sauvegarde → Exports CSV**, pour ouvrir tes tables brutes dans
n'importe quel tableur. Utile pour bricoler. **Jamais pour restaurer.**

---

## 6. Ta routine de fin de mois

Cinq minutes, une fois par mois. Le 1er ou le 2, quand le mois précédent est
clos et figé.

1. **Mets tes soldes à jour** — onglet Patrimoine → *Mettre à jour mes soldes*.
   Recopie les montants affichés par tes banques.
2. **Sors le rapport** — Paramètres → Rapport mensuel → le mois qui vient de se
   terminer → Excel et/ou PDF.
3. **Fais ta sauvegarde** — Paramètres → Sauvegarde → *Télécharger la
   sauvegarde*.
4. **Range les trois fichiers** hors du téléphone, dans le même dossier.
5. **Jette un œil au mois écoulé** — dépassements, catégories à réajuster.

Un dossier par année, un sous-dossier par mois, et dans dix ans tu auras un
historique complet et lisible sans aucune application.

---

## 7. Questions que tu vas te poser

**Je change de téléphone, je fais comment ?**
Sauvegarde sur l'ancien → installe l'application sur le nouveau → restaure.

**J'ai effacé les données de mon navigateur par erreur.**
Restaure ta dernière sauvegarde. Si tu n'en as pas, les données sont perdues —
il n'existe aucune autre copie. C'est toute la raison de la section 5.

**L'application peut-elle disparaître de mon écran d'accueil ?**
Oui : iOS supprime les applications web qu'on n'ouvre pas pendant plusieurs
semaines, et ça emporte leurs données. Ouvre l'application au moins une fois par
mois — ta routine de fin de mois suffit — et garde tes sauvegardes.

**Et si je perds mon téléphone ?**
Personne ne peut lire tes comptes sans déverrouiller le téléphone. Sur un
nouvel appareil, installe et restaure.

**Puis-je l'utiliser sur téléphone ET ordinateur ?**
Oui, mais **les données ne se synchronisent pas**. Choisis un appareil
principal. Pour transférer ponctuellement : sauvegarde d'un côté, restauration
de l'autre.

**Pourquoi mon budget du mois dernier ne bouge plus ?**
C'est voulu. Un mois révolu est figé pour que ton historique reste vrai.

**L'application me propose une opération que je ne veux pas.**
Appuie sur **Écarter**. La règle continue, seule cette échéance est abandonnée,
et elle ne reviendra pas.

**Comment corriger une erreur de saisie ?**
Onglet Opérations → appuie sur la ligne → modifie ou supprime.

**Les chiffres du rapport ne collent pas avec ce que j'attendais.**
Vérifie les trois règles de calcul : un transfert n'est pas une dépense,
l'épargne se compte quand l'argent *entre* dans la poche d'épargne, et la micro
ne se mélange jamais au personnel.

---

## 8. Si tu ne retiens que trois choses

1. **Une sauvegarde `.json` par mois, rangée ailleurs que sur le téléphone.**
   C'est le seul filet. Il n'y en a pas d'autre.
2. **Le fichier Excel ne restaure rien.** Seul le `.json` le peut.
3. **Ouvre l'application au moins une fois par mois**, sinon iOS peut la faire
   disparaître avec ses données.
