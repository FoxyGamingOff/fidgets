Voici comment je vais découper ton message. C'est gros, donc je veux confirmer avant de tout coder.

## 1. Petits fix sur le panier et le site
- Prénom / Nom / Groupe-classe deviennent **obligatoires** dans le panier (étoile rouge si vide, bouton "Confirmer" désactivé sinon).
- Si l'utilisateur est **connecté à son compte**, ces champs deviennent **facultatifs** (auto-remplis depuis le profil).
- Dans la section "Suggérer un fidget" : seul le **nom du fidget** est obligatoire, le reste devient facultatif.

## 2. Bandeau du haut
- Supprimer le bandeau « Top secret… 418-999-4577 ».
- Le remplacer par un bandeau au-dessus de "3D PRINTS / IMPRIMÉ 3D ÉDITION LIMITÉE" : « La vente de fidgets n'est pas autorisée à l'intérieur du bâtiment de l'école, mais elle est permise à l'extérieur. »

## 3. Tailles standardisées
Partout sur le site (badges produits, calcul de prix, description) :
- Petit = 75 %
- Normal = 100 %
- Moyen = 160 %
- Grand = 200 %
- Gargantuesque = 250 %

Calcul du prix : `prix_de_base × pourcentage_taille`, **puis** appliquer la réduction du produit, **puis** la réduction de pack, **puis** le coupon. (ex : 4 $ × 1.6 = 6.40 $, − 10 % = 5.76 $.)

## 4. Coupons (admin)
Ajout sur chaque coupon de :
- **Nombre d'utilisations max** (chiffre, ou `inf` = illimité).
- **Durée de validité** (date d'expiration, optionnelle).
- **Afficher sur la page d'accueil** (oui/non) — si oui, le code apparaît dans une petite bannière sur le site.
- Compteur d'utilisations qui s'incrémente à chaque commande validée.
- Validation au moment d'appliquer : refusé si expiré ou max atteint.

## 5. Catalogue produits
- "Populaire" (⭐) : les produits étoilés remontent automatiquement **en haut** du catalogue.
- Nouveau champ **position** modifiable dans l'admin (boutons ↑ / ↓) pour réordonner les autres produits.
- Nouveau champ **stock** :
  - Toggle "En stock / Rupture / En production"
  - Nombre en stock (entier)
  - Affiché sur la fiche produit côté client. Si rupture → bouton "Ajouter" désactivé (sauf si précommande activée).

## 6. Bouton « Commandes » (utilisateurs non-admin)
À côté du panier :
- Liste des commandes **en cours** (pending / en livraison)
- Historique des commandes **livrées**
- Statuts visibles : `pending`, `in_delivery`, `delivered`
- L'admin peut changer le statut + ajouter une **note de livraison** (ex: « viens à 12 h 30 au gymnase ») visible par l'utilisateur.

## 7. Comptes utilisateurs
Bouton « Compte » à côté de « Commandes ». Inscription / connexion avec **Prénom + Nom + Groupe-classe + Mot de passe** (pas d'email).

**Détail technique important** : Lovable Cloud (Supabase) exige un email pour l'auth. Je vais générer un email synthétique en interne à partir de `prenom.nom.classe@fidgets.local`. L'utilisateur ne le voit jamais, il se connecte uniquement avec ses 3 infos + mot de passe. Une table `profiles` stocke prénom/nom/classe et lie au compte auth.

- Une fois connecté : panier auto-rempli, bouton "Commandes" lié à son compte.
- Texte explicatif dans le menu Compte et près du bouton : « Crée un compte pour ne plus avoir à entrer ton prénom, nom et groupe-classe à chaque commande. »

## 8. Admin : section « Comptes »
Nouvel onglet listant tous les comptes :
- Prénom, Nom, Groupe-classe
- Historique de commandes + commandes en cours par compte

⚠️ **Mots de passe** : tu as demandé de pouvoir voir les mots de passe. **Ce n'est pas possible** — Supabase les hash et personne (pas même moi) ne peut les lire. À la place, je mets un bouton "Réinitialiser le mot de passe" qui te laisse en définir un nouveau pour ce compte. Dis-moi si ça te va.

## Confirme-moi
1. ✅ OK pour la solution "email synthétique" pour l'auth (prénom+nom+classe au lieu d'un email réel) ?
2. ✅ OK pour "réinitialiser" au lieu de "voir" les mots de passe ?
3. ✅ Le reste de la liste te va telle quelle ?

Réponds juste "go" si tout est bon, ou indique ce qu'il faut ajuster.