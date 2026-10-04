/** Thème d'une question du quiz (commande `quiz docker`, `quiz ia`, `quiz devops`). */
export type QuizCategory = 'docker' | 'ia' | 'devops'

export interface QuizQuestion {
  category: QuizCategory
  question: string
  /** Bonne réponse ; l'ordre des 4 choix est tiré au hasard à chaque partie. */
  answer: string
  wrong: readonly [string, string, string]
  /** Une ligne d'explication, affichée après la réponse. */
  explain: string
}

export const QUIZ_CATEGORIES: Record<QuizCategory, string> = {
  docker: 'Docker',
  ia: 'IA locale',
  devops: 'DevOps · Jenkins',
}

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  // ——— Docker ———
  {
    category: 'docker',
    question: 'Quelle instruction du Dockerfile fixe la commande lancée au démarrage, remplaçable par les arguments de docker run ?',
    answer: 'CMD',
    wrong: ['RUN', 'ENTRYPOINT', 'EXPOSE'],
    explain: "RUN s'exécute pendant le build ; les arguments de docker run s'ajoutent à ENTRYPOINT au lieu de le remplacer.",
  },
  {
    category: 'docker',
    question: 'Que fait réellement EXPOSE 8080 dans un Dockerfile ?',
    answer: 'Il documente le port, sans le publier',
    wrong: ["Il publie le port 8080 sur l'hôte", 'Il ouvre le port 8080 dans le pare-feu', 'Il redirige le port 80 vers le port 8080'],
    explain: 'Pour publier le port : docker run -p 8080:8080 (ou -P pour tous les ports exposés).',
  },
  {
    category: 'docker',
    question: 'Quelle option de docker run lance le container en arrière-plan ?',
    answer: '-d',
    wrong: ['-it', '--rm', '-b'],
    explain: '-d pour « detached » ; --rm supprime le container dès qu\'il s\'arrête.',
  },
  {
    category: 'docker',
    question: 'Pourquoi copier package.json et lancer npm install AVANT de copier le reste du code ?',
    answer: 'Pour réutiliser la couche des dépendances en cache quand seul le code change',
    wrong: ["Parce que COPY . . est interdit tant qu'aucun RUN n'a été lancé", "Pour fusionner toutes les instructions de l'image en une seule couche", "Pour que npm install s'exécute avec les droits administrateur"],
    explain: 'Chaque instruction crée une couche : dès que l\'une change, toutes les suivantes sont reconstruites.',
  },
  {
    category: 'docker',
    question: "À quoi sert un build multi-stage ?",
    answer: "À ne garder dans l'image finale que le résultat du build, sans les outils de compilation",
    wrong: ['À construire plusieurs images en parallèle pour accélérer le build', 'À lancer plusieurs containers différents depuis un seul Dockerfile', 'À produire une image distincte pour chaque architecture de processeur'],
    explain: 'On compile dans un stage (FROM node AS build), puis on récupère seulement le résultat : COPY --from=build …',
  },
  {
    category: 'docker',
    question: 'Quel fichier exclut des fichiers (node_modules, .git…) du contexte envoyé au build ?',
    answer: '.dockerignore',
    wrong: ['.gitignore', '.buildignore', 'Dockerfile.exclude'],
    explain: 'Docker ne lit pas le .gitignore : sans .dockerignore, tout le dossier part au démon.',
  },
  {
    category: 'docker',
    question: 'Comment garder les données d\'une base de données après un docker rm ?',
    answer: 'Monter un volume nommé sur son dossier de données',
    wrong: ['Faire un docker commit avant chaque arrêt', 'Lancer le container avec --restart always', 'Ajouter EXPOSE 5432 au Dockerfile'],
    explain: 'La couche inscriptible du container disparaît avec lui ; un volume nommé, non.',
  },
  {
    category: 'docker',
    question: 'Dans un fichier compose, comment le service api joint-il la base du service db ?',
    answer: "Avec le nom d'hôte db, résolu par le DNS du réseau Compose",
    wrong: ['Avec localhost, puisque tout tourne sur la même machine', "En écrivant l'adresse IP du container à la main", "Avec host.docker.internal, l'adresse de la machine hôte"],
    explain: 'Compose crée un réseau par projet, où chaque service est joignable par son nom.',
  },
  {
    category: 'docker',
    question: 'Quelle est la différence entre une image et un container ?',
    answer: "L'image est un modèle figé ; le container, une instance qui tourne",
    wrong: ['Aucune : ce sont deux noms pour le même objet, selon le contexte', 'Le container est une image compressée, prête à être envoyée sur un registre', "L'image tourne directement sur l'hôte, le container dans une machine virtuelle"],
    explain: 'On peut lancer autant de containers que l\'on veut à partir d\'une même image.',
  },
  {
    category: 'docker',
    question: 'Comment s\'appelle la baleine mascotte de Docker ?',
    answer: 'Moby Dock',
    wrong: ['Willy', 'Dockzilla', 'Flipper'],
    explain: 'Moby est aussi le nom du projet open source sur lequel Docker est construit.',
  },

  // ——— IA locale : RAG et moteurs d'inférence ———
  {
    category: 'ia',
    question: 'Que signifie RAG ?',
    answer: 'Retrieval-Augmented Generation',
    wrong: ['Random Access Generator', 'Recursive Attention Graph', 'Rapid AI Gateway'],
    explain: 'On récupère des passages pertinents, puis on les ajoute au prompt du LLM pour qu\'il s\'appuie dessus.',
  },
  {
    category: 'ia',
    question: 'Dans un RAG, à quoi sert la base vectorielle ?',
    answer: 'À retrouver les passages les plus proches de la question',
    wrong: ['À stocker les poids du modèle pour accélérer son chargement', 'À mettre en cache les réponses déjà générées par le LLM', 'À réentraîner le modèle sur les nouveaux documents chaque nuit'],
    explain: 'Exemples : Qdrant, Chroma, pgvector, Milvus…',
  },
  {
    category: 'ia',
    question: "Qu'est-ce qu'un embedding ?",
    answer: 'Un vecteur de nombres qui représente le sens d\'un texte',
    wrong: ['Le fichier de configuration qui accompagne le modèle', "Une clé d'API chiffrée pour appeler le modèle", 'Le token spécial qui marque la fin d\'une phrase'],
    explain: 'Deux textes de sens proche donnent des vecteurs proches, même sans mot en commun.',
  },
  {
    category: 'ia',
    question: 'Quelle mesure compare le plus souvent deux embeddings ?',
    answer: 'La similarité cosinus',
    wrong: ['La distance de Levenshtein', "L'empreinte MD5", 'Le nombre de mots en commun'],
    explain: 'Elle compare la direction des vecteurs, pas leur longueur.',
  },
  {
    category: 'ia',
    question: 'Pourquoi découper les documents en chunks avant de les indexer ?',
    answer: 'Pour retrouver des passages précis et tenir dans la fenêtre de contexte',
    wrong: ['Pour chiffrer les documents avant de les envoyer au modèle', 'Parce que les bases vectorielles refusent les gros fichiers', "Pour accélérer l'entraînement du modèle sur ces documents"],
    explain: 'Souvent quelques centaines de tokens par chunk, avec un léger chevauchement entre deux.',
  },
  {
    category: 'ia',
    question: 'Dans un RAG, que fait un reranker ?',
    answer: 'Il réordonne les passages trouvés selon leur pertinence',
    wrong: ['Il traduit la question en anglais avant la recherche', 'Il supprime les doublons de la base vectorielle', 'Il choisit le LLM le moins cher pour répondre à la question'],
    explain: 'Plus lent que la recherche vectorielle mais plus précis : on l\'applique seulement aux meilleurs résultats.',
  },
  {
    category: 'ia',
    question: "Qu'est-ce qu'un moteur d'inférence (llama.cpp, vLLM, Ollama…) ?",
    answer: 'Le logiciel qui charge un modèle déjà entraîné et calcule ses réponses',
    wrong: ["L'outil qui entraîne le modèle à partir des données", 'Une base de données qui stocke les prompts des utilisateurs', "Une carte graphique spécialisée dans les calculs d'IA"],
    explain: "L'inférence, c'est utiliser le modèle ; l'entraînement, c'est le fabriquer.",
  },
  {
    category: 'ia',
    question: 'Quel format de fichier utilise llama.cpp pour ses modèles ?',
    answer: 'GGUF',
    wrong: ['ONNX', 'SafeTensors', 'Pickle'],
    explain: 'GGUF a remplacé GGML en 2023 : poids, tokenizer et métadonnées dans un seul fichier.',
  },
  {
    category: 'ia',
    question: 'Quantifier un modèle en 4 bits (Q4) sert surtout à…',
    answer: 'Réduire fortement la mémoire nécessaire, avec une légère perte de qualité',
    wrong: ['Multiplier par 4 la taille de la fenêtre de contexte du modèle', 'Entraîner le modèle 4 fois plus vite sur le même GPU', 'Rendre le modèle capable de répondre dans 4 langues'],
    explain: 'Un modèle 7B passe d\'environ 14 Go en FP16 à environ 4 Go en Q4.',
  },
  {
    category: 'ia',
    question: "Par défaut, sur quel port écoute l'API d'Ollama ?",
    answer: '11434',
    wrong: ['8080', '5000', '3000'],
    explain: 'Par exemple : curl http://localhost:11434/api/generate',
  },
  {
    category: 'ia',
    question: 'À quoi sert le KV cache pendant la génération ?',
    answer: 'À garder les clés/valeurs des tokens déjà traités',
    wrong: ["À enregistrer l'historique des conversations sur disque", 'À réutiliser les réponses à des questions identiques', "À compresser les poids du modèle pour qu'il tienne en mémoire"],
    explain: 'Sans lui, chaque nouveau token obligerait à recalculer toute la séquence.',
  },
  {
    category: 'ia',
    question: 'Quelle technique de vLLM gère la mémoire du KV cache par blocs, comme la pagination d\'un OS ?',
    answer: 'PagedAttention',
    wrong: ['FlashAttention', 'LoRA', 'Speculative decoding'],
    explain: 'Moins de mémoire gaspillée, donc plus de requêtes servies en parallèle.',
  },

  // ——— DevOps : Jenkins et CI/CD ———
  {
    category: 'devops',
    question: 'Dans quel fichier décrit-on un pipeline Jenkins, versionné avec le code ?',
    answer: 'Jenkinsfile',
    wrong: ['pipeline.yml', '.jenkins.conf', 'Dockerfile'],
    explain: 'C\'est le « pipeline as code » : le Jenkinsfile vit à la racine du dépôt.',
  },
  {
    category: 'devops',
    question: 'Dans un pipeline déclaratif, quel bloc regroupe les différents stage ?',
    answer: 'stages',
    wrong: ['steps', 'jobs', 'tasks'],
    explain: "pipeline { agent any; stages { stage('Build') { steps { sh 'make' } } } }",
  },
  {
    category: 'devops',
    question: 'Que signifie agent any dans un Jenkinsfile ?',
    answer: "Il peut tourner sur n'importe quel agent disponible",
    wrong: ["N'importe quel utilisateur peut lancer le build", 'Le pipeline tourne sans agent, sur le poste du développeur', 'Le pipeline tourne uniquement sur le contrôleur'],
    explain: "On peut aussi cibler un agent précis : agent { label 'linux' }.",
  },
  {
    category: 'devops',
    question: "Quel bloc s'exécute à la fin du pipeline, qu'il réussisse ou qu'il échoue ?",
    answer: 'post { always { … } }',
    wrong: ['after { always { … } }', 'end { always { … } }', 'finish { always { … } }'],
    explain: 'post propose aussi success, failure, unstable… pour réagir au résultat.',
  },
  {
    category: 'devops',
    question: 'Où ranger le token GitHub utilisé par un pipeline Jenkins ?',
    answer: 'Dans les Credentials Jenkins (withCredentials)',
    wrong: ['En clair dans le Jenkinsfile, à côté du code', "Dans le README du dépôt, pour toute l'équipe", "Dans le message du commit qui l'utilise"],
    explain: 'Jenkins masque alors sa valeur dans les logs du build.',
  },
  {
    category: 'devops',
    question: 'Pour lancer un build à chaque push sans interroger le dépôt en boucle, on utilise…',
    answer: 'Un webhook GitHub vers Jenkins',
    wrong: ['Poll SCM toutes les minutes', 'Une tâche cron sur le poste du développeur', 'Un build lancé à la main'],
    explain: 'Le polling interroge le dépôt à intervalles réguliers ; le webhook prévient Jenkins dès le push.',
  },
  {
    category: 'devops',
    question: 'Quelle étape exécute une commande shell dans un pipeline Jenkins ?',
    answer: "sh 'make test'",
    wrong: ["run 'make test'", "exec 'make test'", "shell 'make test'"],
    explain: 'Sur un agent Windows, on utilise bat ou powershell.',
  },
  {
    category: 'devops',
    question: 'Comment faire tourner les étapes d\'un pipeline Jenkins dans un container Docker ?',
    answer: "agent { docker { image 'node:22' } }",
    wrong: ["docker.enable = true en tête du Jenkinsfile", 'Ce n\'est pas possible avec Jenkins', "stage('Build', docker) { … }"],
    explain: 'Avec le plugin Docker Pipeline, chaque build part d\'un environnement propre.',
  },
  {
    category: 'devops',
    question: 'Comment exécuter deux stages en même temps dans un pipeline déclaratif ?',
    answer: 'Les regrouper dans un bloc parallel { … }',
    wrong: ['Ajouter async: true à chaque stage', 'Écrire deux Jenkinsfile', "C'est impossible avec Jenkins"],
    explain: 'Pratique pour lancer les tests unitaires et le lint en même temps.',
  },
  {
    category: 'devops',
    question: 'Quelle différence entre intégration continue (CI) et déploiement continu (CD) ?',
    answer: 'La CI build et teste chaque changement ; le CD le déploie en prod',
    wrong: ['La CI sert au front-end, le CD au back-end et aux bases de données', 'Aucune : ce sont deux noms pour la même étape du pipeline', 'La CI tourne la nuit, le CD pendant les heures de bureau'],
    explain: 'Entre les deux, la livraison continue prépare la mise en production, déclenchée à la main.',
  },
  {
    category: 'devops',
    question: 'Quelle stratégie garde deux environnements identiques et bascule tout le trafic d\'un coup ?',
    answer: 'Blue/green',
    wrong: ['Canary', 'Rolling update', 'Recreate'],
    explain: 'En canary, on envoie d\'abord une petite part du trafic vers la nouvelle version.',
  },
]
