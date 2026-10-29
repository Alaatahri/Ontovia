# Nexora — Pharmaceutique et Santé

Application web sémantique de gestion des **médicaments**, des **patients**, des **prescriptions**, des
**professionnels de santé** et des **pharmacies**. Elle repose sur une ontologie OWL interrogée en **SPARQL** et
comprend :

- un **module NLP** qui traduit une question en français en requête SPARQL ;
- une **API IA** : recommandations, alternatives, et un chat qui rédige ses réponses avec un LLM local (Ollama) ;
- deux interfaces : un **front-office** public et un **back-office** de type tableau de bord.

```
Protégé ⇄ ontologie OWL (nexora.owl) ⇄ rdflib / SPARQL ⇄ API REST FastAPI ⇄ React (front-office + back-office)
                                                               ⇅
                                              NLP (spaCy, Snowball, rapidfuzz) → SPARQL
                                              LLM local (Ollama) → rédaction des réponses
```

## Démarrage

Prérequis : Python 3.11+, Node 18+. En option : [Ollama](https://ollama.com) pour le chat IA génératif, et
Protégé 5.6 avec un JDK 11+ pour le raisonneur HermiT.

```bash
# 0. (optionnel) LLM local pour le chat
ollama pull gemma3:4b                  # modèle par défaut (≈ 3 Go, tient sur un GPU de 6 Go)

# 1. Back-end (terminal 1)
cd backend
python -m venv .venv
.venv\Scripts\activate                 # Windows (Linux/macOS : source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# API : http://localhost:8000/api   ·   documentation Swagger : http://localhost:8000/docs

# 2. Front-end (terminal 2)
cd frontend
npm install
npm run dev
# Front-office : http://localhost:5173   ·   Back-office : http://localhost:5173/admin
```

Si le port 8000 est occupé, lancez l'API sur un autre port, par exemple 8010, puis indiquez ce port à Vite.
En PowerShell : `$env:NEXORA_API="http://127.0.0.1:8010"; npm run dev`.

**Variables d'environnement du back-end**

| Variable | Rôle |
|---|---|
| `OLLAMA_MODEL` | Modèle utilisé par le chat (`gemma3:4b` par défaut, `qwen3:8b` possible). |
| `OLLAMA_URL` | Adresse d'Ollama. |
| `NEXORA_LLM=off` | Désactive le LLM : le chat répond alors avec des phrases construites à partir des résultats SPARQL. |
| `PROTEGE_HOME` | Dossier d'installation de Protégé, s'il n'est pas détecté automatiquement. |

- **Réinitialiser les données** : `cd backend && python -m scripts.seed_ontology` régénère `backend/ontology/nexora.owl`.
- **Tests** : `cd backend && python -m pytest` lance 47 tests (CRUD des 10 entités, délivrance, NLP, chat, IA,
  Protégé). Ils s'exécutent sur une copie temporaire de l'ontologie, sans LLM.

## Correspondance avec la grille de validation

| Critère | Ce qui est livré |
|---|---|
| **Requêtes SPARQL (4)** | CRUD complet sur 10 types d'individus (`SELECT`, `INSERT DATA`, `DELETE/INSERT WHERE`, `DELETE WHERE`). Recherche (`FILTER CONTAINS`), filtres (maladie, molécule, laboratoire, âge, statut, fonction), agrégats (`COUNT`, `SUM`, `GROUP BY`), `EXISTS` / `NOT EXISTS`, chemins de propriétés (`souffreDe\|presenteCondition`, `^interagitAvec`), `UNION`, `OPTIONAL`, `BIND`, `VALUES`, `ASK`. Console SPARQL interactive. |
| **Individus (2)** | 78 individus dans 11 classes : 13 médicaments, 13 molécules, 13 maladies, 4 conditions, 8 laboratoires, 4 médecins, 3 pharmaciens, 2 infirmiers, 4 pharmacies, 7 patients, 7 prescriptions. Ils sont reliés par 15 propriétés objet et 19 propriétés de données. |
| **Scénario (2)** | Parcours complet décrit ci-dessous : un patient, une prescription à risque, la détection, une alternative IA, la délivrance en pharmacie, puis le chat IA. |
| **API IA (4)** | NLP vers SPARQL (spaCy, Snowball, rapidfuzz). Chat conversationnel avec LLM local (Ollama) et mémoire du contexte. Synthèse IA du dossier patient. Recommandation par contenu (TF-IDF et cosinus). Recommandation de traitements à base de connaissances. Alternatives thérapeutiques. Vérificateur public. |
| **Interfaces graphiques (3)** | Front-office santé avec photos et back-office dashboard (React, Tailwind, Recharts), responsive. 7 graphiques, explorateur de graphe RDF, ordonnance imprimable, export CSV, réponses du chat au fil de l'eau. |
| **Communication BE ↔ FE (3)** | API REST JSON documentée par Swagger, avec flux NDJSON pour le chat. Validation Pydantic, codes 404/409/422/503 avec message clair. Service HTTP unique côté front (`src/api/client.ts`), cache invalidé à chaque écriture, états de chargement, liste vide et erreur. |
| **Valeur ajoutée (2)** | Délivrance en pharmacie (stock, pharmacovigilance, statut). Liaison en direct avec Protégé et raisonneur HermiT. Détection de risques en temps réel. Chat IA local, sans envoi de données à l'extérieur. Recherche de pharmacie pour une ordonnance. |

### Scénario de démonstration

1. **Front-office** : sur `/catalogue`, on cherche « Advil » (photo, graphe RDF, médicaments similaires par l'IA). Sur `/pharmacies`, on cherche où trouver Coumadine et Doliprane.
2. **Référentiels** : on ajoute une maladie, un médecin et un pharmacien rattaché à une pharmacie. La suppression d'une maladie encore utilisée est refusée (409).
3. **Patient et IA** : on crée la patiente Nadia (enceinte, migraineuse, allergique à l'ibuprofène). Sa fiche affiche les traitements recommandés, et la **synthèse IA** est rédigée par Ollama.
4. **Prescription** : Nadia avec Advil. Une **contre-indication** et une **allergie** sont détectées en direct. L'IA propose des alternatives, on clique sur Doliprane, puis on enregistre.
5. **Délivrance** : dans la fiche, les pharmacies sont classées selon leur stock. On délivre l'ordonnance, qui passe au statut « Délivrée » et ne peut plus être modifiée.
6. **Chat IA** : « Quelles sont les contre-indications de l'aspirine ? », puis « Et avec quoi interagit-elle ? » (le contexte est repris), puis « Où peut-on la trouver ? ».
7. **Protégé** : on ouvre le fichier depuis le panneau, on lance HermiT, on ajoute un individu, on enregistre, et il apparaît dans le site.

## Structure

```
backend/
  ontology/nexora.owl            ← le graphe partagé (RDF/XML, ouvrable dans Protégé)
  scripts/seed_ontology.py       ← schéma OWL, axiomes et individus de démonstration
  app/
    main.py                      ← application FastAPI, gestion des erreurs, préchauffage
    core/                        ← graphe (chargement, synchronisation Protégé, caches, sauvegarde), encodage RDF
    modules/
      medicaments/   (membre 1)  router · schemas · repository (requêtes SPARQL)
      patients/      (membre 2)  idem
      prescriptions/ (membre 3)  idem + risks.py (détection) + délivrance en pharmacie
      referentiel/   (membres 1-3) CRUD générique : médecins, personnel, pharmacies, maladies, conditions,
                                 molécules, laboratoires (specs.py déclare champs, relations et règles de suppression)
      nlp/           (membre 4)  analyzer (spaCy/Snowball/rapidfuzz) · intents (21 intentions) · service
      chat/          (membre 4)  assistant IA (5 modes) · guide de l'application · synthèse du dossier patient
      ia/                        recommender.py : similarité, recommandations, alternatives, vérificateur
      references/                listes pour les formulaires + statistiques du tableau de bord
      sparql/                    console SPARQL, exploration de l'ontologie, liaison avec Protégé (HermiT)
  tests/                         test_api.py · test_metier.py (47 tests)
frontend/src/
  api/          client.ts (service HTTP + flux NDJSON) · services.ts (un service par module) · types.ts
  components/   ui, MultiSelect, ConfirmDialog, RiskPanel, GraphExplorer, Charts, Sparql, ProtegePanel,
                chat/ (ChatContext, ChatAssistant, ChatWidget, Markdown)
  layouts/      PublicLayout (front-office) · AdminLayout (back-office)
  pages/public/ Home · Catalogue · MedicamentPublic · Pharmacies · Verificateur · AssistantPublic · About
  pages/admin/  Dashboard · medicaments/ · patients/ · prescriptions/ · referentiels/ (liste, fiche, formulaire
                génériques) · AssistantAdmin · OntologyPage · SparqlConsole
tools/protege/  VerifierOntologie.java (OWL API + HermiT, les bibliothèques de Protégé)
```

## L'ontologie

Namespace : `http://www.nexora.org/ontologie/pharma#` (préfixe `nx:`), version 2.0, 808 triplets. Chaque individu
porte un `rdfs:label` pour être affiché par son nom dans Protégé.

- **Classes (14)** :
  - `Personne` ⊃ {`Patient`, `PersonnelSante` ⊃ {`Medecin`, `Pharmacien`, `Infirmier`}} ;
  - `Medicament`, `Molecule`, `Laboratoire`, `Pharmacie`, `Prescription` ;
  - `Condition` ⊃ {`Maladie`, `ConditionPhysiologique`}.
- **Propriétés objet (15)** :
  - `contientMolecule`, `traite` et son inverse `estTraitePar`, `aContreIndication` ;
  - `interagitAvec` (symétrique), `fabriquePar` (fonctionnelle) ;
  - `souffreDe`, `presenteCondition`, `estAllergiqueA` ;
  - `concernePatient`, `prescritePar` et `delivreePar` (fonctionnelles), `prescritMedicament` ;
  - `travailleDans`, `disposeDe` (stock des pharmacies).
- **Propriétés de données (19)** : `nom`, `prenom`, `age`, `sexe`, `specialite`, `dosage`, `formeGalenique`,
  `description`, `datePrescription`, `posologie`, `dureeJours`, `statut`, `dateDelivrance`, `telephone`, `email`,
  `adresse`, `ville`, `horaires`, `pays`.
- **Axiomes** : sous-classes, disjonctions (`owl:disjointWith`), propriété inverse, propriétés symétrique et
  fonctionnelles, domaines et portées. HermiT confirme que l'ontologie est **cohérente**.

> rdflib n'exécute pas de raisonneur. Les requêtes tiennent donc compte explicitement des sous-classes et de la
> symétrie (`nx:interagitAvec|^nx:interagitAvec`).

## Métiers avancés

- **Délivrance en pharmacie.**
  - `GET /api/prescriptions/{id}/pharmacies` classe les pharmacies selon leur stock (`nx:disposeDe`).
  - `POST /api/prescriptions/{id}/delivrer` applique trois règles : délivrance refusée si un médicament manque
    (409 avec la liste) ; confirmation explicite demandée si un risque est détecté (pharmacovigilance) ; une seule
    délivrance par ordonnance.
  - Une ordonnance délivrée ne peut plus être modifiée, mais la délivrance peut être annulée.
- **Disponibilité.** `GET /api/pharmacies/disponibilite?medicaments=…` alimente la page publique « Pharmacies ».
- **Indicateurs métier**, calculés par requêtes d'agrégation :
  - médecin : prescriptions, patients suivis, prescriptions à risque, délivrées, médicaments les plus prescrits ;
  - pharmacie : stock, prescriptions délivrées, prescriptions en attente qu'elle peut servir en totalité.
- **Suppression protégée.** Une maladie portée par des patients, un laboratoire qui fabrique des médicaments ou un
  médecin qui a prescrit ne peuvent pas être supprimés (409 avec le détail). Les liens de catalogue (stock, personnel)
  sont, eux, retirés avec l'individu.
- **Détection des risques.** Quatre requêtes SPARQL : contre-indication, allergie, interaction et redondance de
  principe actif. Elle est présentée comme une **détection par SPARQL**, et non comme une inférence SWRL.

## Liaison avec Protégé

L'application et Protégé travaillent sur **le même fichier** : `backend/ontology/nexora.owl`, au format RDF/XML.

- **De Protégé vers l'application.** Quand le fichier est enregistré dans Protégé, le back-end le **recharge
  automatiquement** au prochain appel. Les nouveaux individus apparaissent aussitôt dans les listes et dans le chat.
- **De l'application vers Protégé.** Chaque création ou modification réécrit le fichier. Dans Protégé, fermez
  l'ontologie puis rouvrez-la (*File › Open recent*) pour voir les changements.
- **Pas d'écrasement.** Avant chaque écriture, le back-end se resynchronise avec le disque. Si le fichier est
  verrouillé par un autre programme, il réessaie, puis annule proprement l'opération (503 avec un message clair).
- **Dans le back-office**, la page *Ontologie & graphe* contient le panneau *Liaison avec Protégé* :
  - *Ouvrir dans Protégé* lance Protégé sur le fichier ;
  - *Recharger* relit le fichier ;
  - *Raisonner (HermiT)* exécute le raisonneur via l'OWL API et HermiT, les bibliothèques de Protégé.
- **Règles à suivre dans Protégé** :
  - enregistrez en *RDF/XML Syntax* ;
  - nommez les individus sans espaces (`Med_Exemple`) ;
  - donnez-leur la propriété `nx:nom` ;
  - activez *View › Render by label* ;
  - travaillez avec **un seul outil à la fois**, et rouvrez l'ontologie dans Protégé après avoir modifié des données
    dans le site.

## Module NLP / TALN et chat IA

> **Conformité au sujet.** La conversion d'une question en SPARQL est faite **par le module NLP**, avec des
> bibliothèques de TALN, et **jamais par un LLM**. Le LLM local (Ollama) ne reçoit que la question et les résultats
> SPARQL déjà calculés : il ne fait que **rédiger la réponse**. Il n'a pas accès à l'ontologie et ne génère jamais
> de SPARQL.

L'assistant est disponible en pleine page et sous forme de **bulle flottante sur toutes les pages**. La
conversation est conservée quand on change de page. Chaque question est orientée vers un mode, affiché par un badge
sous la réponse :

| Mode | Exemple | Traitement |
|---|---|---|
| Données | « Quels patients souffrent de migraine ? » | NLP vers SPARQL ; le LLM rédige la réponse à partir des résultats |
| Suivi | « Tu es sûr ? », « Donne-moi un autre médicament », « Et pendant la grossesse ? » | L'intention et l'entité du tour précédent sont rejouées. Si un nouvel élément est cité, sa fiche ontologique est jointe. |
| Guide | « Comment créer une prescription ? » | Les pages et les étapes du guide intégré, avec des liens |
| Navigation | « Ouvre la page des pharmacies » | La page s'ouvre automatiquement |
| Général | « Bonjour », « Qu'est-ce qu'un antibiotique ? » | Culture générale du LLM, signalée comme hors ontologie |

Le LLM ne peut écrire que les liens fournis par le guide. Tout lien inconnu est affiché comme simple texte, et le
bouton « Voir : … » vers la fiche concernée est ajouté par l'application.

Traitement de `POST /api/chat`, dont la réponse arrive en flux NDJSON (`analyse`, puis des morceaux de texte, puis
`fin`) :

1. **spaCy** (tokenizer français) découpe la question, gère les élisions et marque les mots vides.
2. **snowballstemmer** réduit les mots à leur racine (*traitent*, *traitement* → `trait`).
3. **rapidfuzz** reconnaît les individus du graphe malgré les fautes de frappe (*migrane* → Migraine). Des
   synonymes sont aussi reconnus (*enceinte* → Grossesse).
4. **Contexte de la conversation** : si la question ne cite aucune entité (« et avec quoi interagit-elle ? »),
   l'entité du tour précédent est reprise.
5. **Intention** : un score de mots-clés racinisés choisit parmi **21 intentions**, puis la **requête SPARQL** est
   générée et exécutée.
6. **Ollama** (`gemma3:4b`, sur le GPU local) rédige la réponse à partir des résultats seuls. Sans Ollama, une
   réponse construite à partir des résultats est renvoyée.

La route `POST /api/nlp/query` renvoie l'analyse et les résultats SPARQL seuls, sans LLM.

`POST /api/chat/synthese/patients/{id}` produit une **synthèse IA du dossier patient**. Les données (maladies,
allergies, prescriptions, risques, recommandations) sont extraites par SPARQL, puis rédigées par le LLM local.

Exemples de questions :

- « Quels médicaments traitent la migraine ? »
- « Quelles sont les contre-indications de l'aspirine ? » puis « Et avec quoi interagit-elle ? »
- « Où trouver le Coumadine ? »
- « Qui travaille à la pharmacie Ennasr ? »
- « Quels médicaments éviter pendant la grossesse ? »
- « Patients de plus de 60 ans »
- « Combien de pharmacies ? »

## API IA

| Route | Méthode |
|---|---|
| `POST /api/chat` | Chat : NLP vers SPARQL, puis réponse rédigée par le LLM local, avec mémoire du contexte |
| `POST /api/chat/synthese/patients/{id}` | Synthèse générative du dossier patient, à partir de données SPARQL |
| `GET /api/ia/medicaments/{id}/similaires` | Recommandation par contenu : vecteurs TF-IDF des relations, similarité cosinus |
| `GET /api/ia/patients/{id}/recommandations` | Recommandation de traitements à base de connaissances, qui exclut les contre-indications et les allergies |
| `POST /api/ia/alternatives` | Remplaçants sûrs pour les médicaments à risque d'une prescription |
| `POST /api/ia/verificateur` | Vérification anonyme d'une combinaison de médicaments (front-office) |

## Contrat API (CRUD)

| Entité | Routes |
|---|---|
| Médicaments | `GET/POST /api/medicaments`, `GET/PUT/DELETE /api/medicaments/{id}` (filtres `q`, `maladie`, `molecule`, `laboratoire`) |
| Patients | `GET/POST /api/patients`, `GET/PUT/DELETE /api/patients/{id}` (filtres `q`, `maladie`, `condition`, `ageMin`, `ageMax`) |
| Prescriptions | `GET/POST /api/prescriptions`, `GET/PUT/DELETE /api/prescriptions/{id}` (filtres `q`, `patient`, `medecin`, `medicament`, `risque`, `statut`) |
| Référentiels | `GET /api/referentiels` (description des champs), puis `GET/POST /api/referentiels/{type}` et `GET/PUT/DELETE /api/referentiels/{type}/{id}`. Valeurs de `{type}` : `medecins`, `personnel`, `pharmacies`, `maladies`, `conditions`, `molecules`, `laboratoires`. Filtres `q` et `classe`. |

**Sécurité des requêtes**

- Les identifiants sont validés, et leur type RDF est vérifié dans le graphe.
- Les textes sont encodés avec `rdflib.Literal(...).n3()`.
- Les filtres des SELECT passent par `initBindings`.
- La console SPARQL est en lecture seule.

## Répartition dans le groupe

| Membre | Back-end | Front-end |
|---|---|---|
| 1 — Médicaments | `modules/medicaments`, référentiels `molecules` et `laboratoires`, IA « similaires » | `pages/admin/medicaments`, `Catalogue`, `MedicamentPublic` |
| 2 — Patients | `modules/patients`, référentiels `maladies` et `conditions`, IA « recommandations » et « synthèse » | `pages/admin/patients`, `SynthesePatient` |
| 3 — Prescriptions et officines | `modules/prescriptions` (risques, délivrance), référentiels `medecins`, `personnel` et `pharmacies`, IA « alternatives » | `pages/admin/prescriptions`, `Delivrance`, `Pharmacies`, `Verificateur` |
| 4 — NLP, chat IA et intégration | `modules/nlp`, `chat`, `sparql` (Protégé), `referentiel` (moteur générique), `core` | `ChatAssistant`, `AssistantAdmin`, `Dashboard`, `OntologyPage`, `SparqlConsole`, layouts |
