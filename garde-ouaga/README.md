# Garde Ouaga

Application web et mobile qui affiche, selon le jour et l'heure, les pharmacies **ouvertes maintenant** à Ouagadougou et les **pharmacies de garde**, les plus proches d'abord.

- **Web** : site installable sur Android et iPhone (PWA), fonctionne hors connexion, utilise le GPS du téléphone.
- **Android** : vraie application (APK) construite avec Capacitor, compilée gratuitement par GitHub.
- **Hébergement gratuit** : GitHub Pages, Netlify, Vercel ou Cloudflare Pages.

## Comment ça marche

| Règle | Valeur |
|---|---|
| Groupes de garde | 4 groupes, un par semaine, 24h/24 |
| Relève | chaque **samedi à 12h00** |
| Repère du calendrier | samedi 10/10/2026 12h → groupe 1 (programme officiel de l'Ordre) |
| Pharmacies ordinaires | lundi au samedi, **7h30–20h00** ; fermées dimanche et jours fériés |
| Pharmacies d'appui | week-ends et fériés, 8h–20h, jusqu'à mi-novembre 2026 (liste non intégrée) |

Toutes ces règles se modifient en haut de `www/app.js`, dans `CONFIG`.

Les 239 pharmacies (4 groupes) viennent du site de l'Ordre national des pharmaciens du Burkina Faso et se trouvent dans `www/data.js`.

## Structure

```
garde-ouaga/
├── www/                     ← l'application (c'est tout ce qu'il faut pour le web)
│   ├── index.html
│   ├── style.css
│   ├── app.js               ← logique + CONFIG (horaires, calendrier)
│   ├── data.js              ← pharmacies et quartiers
│   ├── manifest.webmanifest ← installation sur le téléphone
│   ├── sw.js                ← fonctionnement hors connexion
│   └── icons/
├── android/                 ← projet Android (Capacitor)
├── capacitor.config.json
├── package.json
├── netlify.toml / vercel.json
└── .github/workflows/       ← déploiement web + compilation APK automatiques
```

## 1. Tester tout de suite sur ton ordinateur

```bash
npm start
```
Puis ouvre http://localhost:8080. (Il faut Node.js 22.)

## 2. Mettre le site en ligne gratuitement

### Option A — Netlify Drop (2 minutes, sans compte GitHub)
1. Va sur https://app.netlify.com/drop
2. Glisse-dépose le dossier **`www`**.
3. Netlify te donne une adresse du type `https://garde-ouaga-xxxx.netlify.app`. C'est en ligne.

### Option B — GitHub Pages (recommandé : site + APK automatiques)
1. Crée un compte sur https://github.com et un nouveau dépôt public nommé `garde-ouaga`.
2. Envoie le projet :
   ```bash
   git init
   git add .
   git commit -m "Garde Ouaga"
   git branch -M main
   git remote add origin https://github.com/TON-NOM/garde-ouaga.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
4. Onglet **Actions** : attends que « Déployer le site web » soit vert.
   Le site est à `https://TON-NOM.github.io/garde-ouaga/`.

### Option C — Vercel ou Cloudflare Pages
Importe le dépôt GitHub, sans commande de build, dossier de sortie : `www`.

## 3. Installer l'application sur Android

### Depuis le site (le plus simple)
Ouvre l'adresse du site dans **Chrome** sur ton téléphone → bouton **Installer** dans l'appli (ou menu ⋮ → *Ajouter à l'écran d'accueil*). L'icône à la croix verte apparaît comme une vraie application.

### L'APK (vraie application Android)
Avec l'option B, à chaque `git push`, GitHub compile l'APK tout seul (workflow « Compiler l'APK Android », environ 5 minutes) :
1. Dans le dépôt, onglet **Releases** → dernière version → télécharge `garde-ouaga.apk` **depuis ton téléphone**.
2. Ouvre le fichier. Android demande d'autoriser l'installation depuis Chrome ou Fichiers : accepte.
3. Au premier lancement, autorise la localisation.

Pour compiler l'APK sur ton propre PC (Android Studio + JDK 21 installés) :
```bash
npm install
npm run apk
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```
Ou `npx cap open android` pour ouvrir le projet dans Android Studio.

> L'APK produit est une version **debug**, parfaite pour tester et distribuer à la main. Pour le Play Store, il faudra une version signée (`./gradlew bundleRelease` avec une clé de signature) et un compte développeur Google (25 $, une fois).

## 4. Mettre à jour les données

- **Une pharmacie change** : modifie sa ligne dans `www/data.js`.
- **Position exacte d'une pharmacie** : ajoute `lat` et `lon`, par exemple
  `{g:4, name:"Kadiogo", tel:"25318788", addr:"...", q:"koulouba", lat:12.3712, lon:-1.5198}`.
  La distance et l'itinéraire deviennent alors exacts.
- **Le calendrier de l'Ordre est décalé** : change `ancre` / `groupeAncre` dans `CONFIG` (`www/app.js`). En attendant, l'utilisateur peut forcer le groupe dans l'appli (« Changer le jour, l'heure ou le groupe »).
- Après une modification du site, change `VERSION` dans `www/sw.js` (par ex. `garde-ouaga-v2`) pour que les téléphones prennent la nouvelle version.

## Limites connues

- Les distances partent du centre du quartier de chaque pharmacie (≈ ±1 km) tant que `lat`/`lon` ne sont pas renseignés.
- Les fêtes mobiles (Tabaski, Ramadan, Pâques, etc.) ne sont pas dans `CONFIG.feries` : ajoute-les au format `AAAA-MM-JJ`.
- La liste des pharmacies d'appui du week-end n'est pas intégrée.

Source des listes : https://ordrepharmacien.bf/index.php/service/pharmacie-garde/
