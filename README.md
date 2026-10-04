# Docker Whale Portfolio — template

Un portfolio en 3D sur le thème Docker, prêt à personnaliser. La baleine du logo vogue sur la mer en
plein jour et porte neuf containers maritimes, un par section du portfolio.

- **Neuf sections** (CV, projets, compétences, infra, labs, outils, loisirs, jeux, contact). Un clic sur
  un container l'ouvre : il sort de la pile, la caméra se place devant, ses portes s'ouvrent et un
  panneau affiche la section. Chaque section a sa propre adresse (`#cv`, `#projets`…).
- **Un terminal façon macOS** : vraies commandes Linux (`ls`, `cd`, `cat`, `grep`, `find`, tubes `|`,
  `&&`…) et Docker (`docker ps`, `docker stop cv`…) simulées, qui pilotent la scène.
- **Deux jeux** dans le terminal : *Moby Quest*, un escape game 100 % bash, et un quiz Docker / IA
  locale / DevOps.
- **Un écran de démarrage** façon `docker compose up`, avec les vraies infos de la machine du visiteur.

## Démarrer

Il faut [Node.js](https://nodejs.org) 20.19 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Ajouter `?debug` à l'adresse affiche un panneau de réglages
(caméra, wireframe, FPS).

## Personnaliser

Tout le contenu est dans `src/data/`. Le code n'a pas besoin d'être modifié.

1. **`profile.ts`** : ton nom, l'utilisateur du terminal, ton nom de domaine (titre de la page), ton
   trigramme (code peint sur les containers) et les lignes de l'écran de démarrage.
2. **`sections.ts`** : le contenu des neuf sections (texte, parcours, projets, compétences, liens).
   Les blocs possibles sont décrits dans `sectionTypes.ts`. `draft: true` affiche une pastille
   « à compléter » : retire-la quand le bloc est rempli.
3. **`public/cv.pdf`** : ton CV. Indique ensuite `href: '/cv.pdf'` dans la section `cv`.
4. **`containers.ts`** (facultatif) : nom, statut et pictogramme de chaque container.
5. **`quiz.ts`** (facultatif) : les questions du quiz.

## Mettre en ligne

Le site est statique : `npm run build` produit le dossier `dist/`. Sur [Vercel](https://vercel.com) ou
[Netlify](https://www.netlify.com), importe le dépôt ; ils détectent Vite tout seuls (commande
`npm run build`, dossier `dist`).

## Structure

```
public/models/docker-whale.glb    modèle 3D (baleine, containers, yeux, bouche), CC BY-SA 4.0
src/
  data/                           ton contenu : profil, sections, containers, quiz
  scene/                          baleine, ciel, mer, lumières, containers (marquage, portes, survol)
  ui/                             écran de démarrage, panneau des sections, terminal et ses jeux
  viewer.ts                       scène, caméra, boucle de rendu
```

Stack : Vite, TypeScript, Three.js, GSAP, Tailwind CSS.

Pour modifier la baleine ou les containers, importe `public/models/docker-whale.glb` dans
[Blender](https://www.blender.org) (*Fichier → Importer → glTF 2.0*), puis réexporte-le au même
endroit en gardant les noms des objets (`whale_body`, `whale_box_01` à `whale_box_09`…).

## Crédits et licences

- Template créé par [EliasDevIT](https://github.com/EliasDevIT), développé avec
  [Claude Code](https://claude.com/claude-code).
- Code sous licence Apache 2.0 (voir [LICENSE](LICENSE)), à l'exception du modèle 3D.
- Modèle de la baleine (`public/models/docker-whale.glb`) : adaptation de « 3D Docker Whale » par
  **leo199483** ([Printables #566955](https://www.printables.com/model/566955-3d-docker-whale)), sous
  licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Modifications :
  réassemblage dans Blender, yeux, trait de la bouche, containers et leur disposition. Cette adaptation
  est distribuée sous la même licence CC BY-SA 4.0. Le site crédite l'auteur dans le terminal (message
  d'accueil et commande `credits`) : garde ce crédit si tu publies ton portfolio.
- Docker et le logo Docker sont des marques de Docker, Inc. Ce projet n'est ni affilié ni soutenu par
  Docker, Inc.
