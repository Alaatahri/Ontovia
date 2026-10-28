# Nexora — Pharmaceutique et Santé

Application web sémantique de gestion des **médicaments**, des **patients** et des **prescriptions**, basée sur une
ontologie OWL interrogée en **SPARQL**. Elle comprend :

- un **module NLP**, qui traduit une question en français en requête SPARQL ;
- une **API IA** de recommandation ;
- deux interfaces : un **front-office** public et un **back-office** de type tableau de bord.

```
Ontologie OWL (nexora.owl) ⇄ rdflib / SPARQL ⇄ API REST FastAPI ⇄ React (front-office + back-office)
```

## Démarrage

Prérequis : Python 3.11+ et Node 18+.

```bash
# 1. Back-end (terminal 1)
cd backend
python -m venv .venv
.venv\Scripts\activate                 # Windows (Linux/macOS : source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API : http://localhost:8000/api   ·   documentation Swagger : http://localhost:8000/docs

# 2. Front-end (terminal 2)
cd frontend
npm install
npm run dev
# Front-office : http://localhost:5173   ·   Back-office : http://localhost:5173/admin
```

Si le port 8000 est occupé, lancez l'API sur un autre port, par exemple 8010, puis indiquez ce port à Vite.
En PowerShell : `$env:NEXORA_API="http://127.0.0.1:8010"; npm run dev`.

- **Réinitialiser les données** : `cd backend && python -m scripts.seed_ontology` régénère `backend/ontology/nexora.owl`.
- **Tests** : `cd backend && python -m pytest` lance 20 tests de l'API (CRUD, NLP, IA, ontologie). Ils s'exécutent
  sur une copie temporaire de l'ontologie.

## Correspondance avec la grille de validation

| Critère | Ce qui est livré |
|---|---|
| **Requêtes SPARQL (4)** | CRUD complet (`SELECT`, `INSERT DATA`, `DELETE/INSERT WHERE`, `DELETE WHERE`). Recherche (`FILTER CONTAINS`), filtres (maladie, molécule, laboratoire, âge), agrégats (`COUNT`, `GROUP BY`), chemins de propriétés (`souffreDe\|presenteCondition`, `^interagitAvec`), `UNION`, `OPTIONAL`, `BIND`, `VALUES`, `ASK`. Console SPARQL interactive. |
| **Individus (2)** | 69 individus dans 8 classes : 13 médicaments, 13 molécules, 13 maladies, 4 conditions, 8 laboratoires, 4 médecins, 7 patients, 7 prescriptions. Ils sont reliés par 12 propriétés objet et 11 propriétés de données. |
| **Scénario (2)** | Scénario décrit ci-dessous : un patient, une prescription à risque, la détection, une alternative proposée par l'IA, puis la correction. |
| **API IA (4)** | Module NLP (spaCy, Snowball, rapidfuzz), recommandation par contenu (TF-IDF et cosinus), recommandation de traitements à base de connaissances, alternatives thérapeutiques, vérificateur public. |
| **Interfaces graphiques (3)** | Front-office santé et back-office dashboard (React, Tailwind, Recharts), responsive. Graphiques statistiques, explorateur de graphe RDF, ordonnance imprimable, export CSV. |
| **Communication BE ↔ FE (3)** | API REST JSON documentée par Swagger. Validation Pydantic, codes 404/409/422 avec message clair. Service HTTP unique côté front (`src/api/client.ts`), avec états de chargement, liste vide et erreur. |
| **Valeur ajoutée (2)** | Détection de risques en temps réel et alternatives proposées par l'IA, explorateur visuel du graphe, vérificateur d'interactions public, visualisation de l'ontologie (classes, propriétés, axiomes). |

### Scénario de démonstration

1. **Front-office** : sur `/catalogue`, on recherche « Imigrane ». La fiche affiche son graphe RDF et les médicaments similaires calculés par l'IA.
2. **Assistant** : sur `/assistant`, on pose la question « Quels patients souffrent d'hypertension ? ». La réponse liste Ahmed Ben Ali et Mohamed Gharbi, avec la requête SPARQL générée.
3. **Back-office** : on crée une prescription pour Ahmed (`/admin/prescriptions/nouvelle`) et on sélectionne Imigrane. Une **contre-indication** apparaît en direct, car Imigrane est contre-indiqué en cas d'hypertension.
4. L'IA propose des **alternatives** : on clique sur Doliprane, le risque disparaît, puis on enregistre. La prescription est écrite dans le graphe avec `INSERT DATA`.
5. Le **tableau de bord** se met à jour (COUNT/GROUP BY). La fiche patient affiche les **traitements recommandés**.

## Structure

```
backend/
  ontology/nexora.owl            ← le graphe partagé (RDF/XML, ouvrable dans Protégé)
  scripts/seed_ontology.py       ← schéma OWL, axiomes et individus de démonstration
  app/
    main.py                      ← application FastAPI et gestion des erreurs
    core/                        ← graphe (chargement, requêtes, sauvegarde atomique), encodage RDF, helpers CRUD
    modules/
      medicaments/   (membre 1)  router · schemas · repository (requêtes SPARQL)
      patients/      (membre 2)  idem
      prescriptions/ (membre 3)  idem + risks.py (détection des risques)
      nlp/           (membre 4)  analyzer (spaCy/Snowball/rapidfuzz) · intents (17 intentions) · service
      ia/                        recommender.py : similarité, recommandations, alternatives, vérificateur
      references/                listes pour les formulaires + statistiques du tableau de bord
      sparql/                    console SPARQL (lecture seule) + exploration de l'ontologie
  tests/test_api.py
frontend/src/
  api/          client.ts (service HTTP) · services.ts (un service par module) · types.ts (contrat JSON)
  components/   ui, MultiSelect, ConfirmDialog, RiskPanel, NlpAssistant, GraphExplorer, Charts, Sparql
  layouts/      PublicLayout (front-office) · AdminLayout (back-office)
  pages/public/ Home · Catalogue · MedicamentPublic · Verificateur · AssistantPublic · About
  pages/admin/  Dashboard · medicaments/ · patients/ · prescriptions/ · AssistantAdmin · OntologyPage · SparqlConsole
```

## L'ontologie

Namespace : `http://www.nexora.org/ontologie/pharma#` (préfixe `nx:`), 620 triplets. Chaque individu porte un
`rdfs:label` pour être affiché par son nom dans Protégé.

- **Classes** : `Personne` ⊃ {`Patient`, `Medecin`}, `Medicament`, `Molecule`, `Laboratoire`,
  `Condition` ⊃ {`Maladie`, `ConditionPhysiologique`}, `Prescription`.
- **Propriétés objet** : `contientMolecule`, `traite` et son inverse `estTraitePar`, `aContreIndication`,
  `interagitAvec` (symétrique), `fabriquePar` (fonctionnelle), `souffreDe`, `presenteCondition`, `estAllergiqueA`,
  `concernePatient` (fonctionnelle), `prescritePar` (fonctionnelle), `prescritMedicament`.
- **Propriétés de données** : `nom`, `prenom`, `age`, `sexe`, `specialite`, `dosage`, `formeGalenique`, `description`,
  `datePrescription`, `posologie`, `dureeJours`.
- **Axiomes** : sous-classes, disjonctions (`owl:disjointWith`), propriété inverse, propriétés symétrique et
  fonctionnelles, domaines et portées.

> rdflib n'exécute pas de raisonneur. Les requêtes tiennent donc compte explicitement des sous-classes et de la
> symétrie (`nx:interagitAvec|^nx:interagitAvec`).

## Liaison avec Protégé

L'application et Protégé travaillent sur **le même fichier** : `backend/ontology/nexora.owl`, au format RDF/XML.

- **De Protégé vers l'application.** Quand le fichier est enregistré dans Protégé, le back-end le **recharge
  automatiquement** au prochain appel (il compare la date de modification). Les nouveaux individus apparaissent
  aussitôt dans les listes, les filtres et l'assistant NLP.
- **De l'application vers Protégé.** Chaque création ou modification faite dans l'application réécrit le fichier.
  Dans Protégé, fermez l'ontologie puis rouvrez-la (*File › Open recent*) pour voir les changements.
- **Pas d'écrasement.** Avant chaque écriture, le back-end se resynchronise avec le disque. Une modification
  enregistrée dans Protégé n'est donc jamais écrasée par une version périmée.
- **Dans le back-office**, la page *Ontologie & graphe* contient un panneau *Liaison avec Protégé* :
  - *Ouvrir dans Protégé* lance Protégé sur le fichier ;
  - *Recharger* relit le fichier ;
  - *Raisonner (HermiT)* exécute le raisonneur de Protégé, via l'OWL API et HermiT : cohérence, classes
    insatisfiables et inférences.
- **Installation de Protégé.** Elle est détectée automatiquement dans Téléchargements, Bureau ou Program Files.
  Sinon, définissez la variable `PROTEGE_HOME` (dossier qui contient `run.bat`, `bundles/` et `plugins/`).
  Le raisonnement demande un JDK 11 ou plus récent dans le PATH.
- **Vérification en ligne de commande**, avec le même programme que le bouton, depuis la racine du projet et
  après un premier clic sur *Raisonner*, qui crée `tools/protege/.lib` :
  ```powershell
  $P = "C:\Users\<vous>\Downloads\Protege-5.6.9-win\Protege-5.6.9"
  java -cp "$P\bundles\*;tools\protege\.lib\*;$P\plugins\org.semanticweb.hermit-1.4.3.456.jar" tools\protege\VerifierOntologie.java backend\ontology\nexora.owl
  ```

Résultat actuel avec HermiT : ontologie **cohérente**, aucune classe insatisfiable, 617 axiomes. HermiT infère les
instances de `Personne` (patients et médecins) et de `Condition` (maladies et conditions), ainsi que `estTraitePar`
comme inverse de `traite`.

**Règles à suivre dans Protégé**

- Enregistrez en *RDF/XML Syntax*. Le format OWL/XML n'est pas lu par rdflib : l'application le signale et garde
  la dernière version valide.
- Nommez les individus sans espaces, par exemple `Med_Exemple`.
- Donnez-leur la propriété `nx:nom`, sinon ils n'apparaissent pas dans les listes.
- Activez *View › Render by label* pour afficher les noms des individus.

## Module NLP / TALN (sans API de LLM)

Comme l'exige le sujet, aucune API de LLM n'est utilisée. Le traitement de `POST /api/nlp/query` suit ces étapes :

1. **spaCy** (tokenizer français) découpe la question, gère les élisions (*l'*, *d'*) et marque les mots vides.
2. **snowballstemmer** réduit les mots à leur racine : *traitent* et *traitement* donnent `trait`.
3. **rapidfuzz** compare les groupes de mots aux noms des individus lus dans le graphe, ainsi qu'à des synonymes
   (*enceinte* → Grossesse, *HTA* → Hypertension). La comparaison tolère les fautes : *migrane* → Migraine.
4. L'**intention** est choisie par un score de mots-clés racinisés, avec un bonus si l'entité est du bon type.
   Il existe 17 intentions.
5. La **requête SPARQL** est générée à partir du modèle de l'intention, puis exécutée. La réponse contient la
   requête, les résultats, l'explication et l'analyse. Si la question n'est pas comprise, des suggestions sont
   proposées.

Exemples de questions : « Quels médicaments traitent la migraine ? », « Quelles sont les contre-indications de
l'aspirine ? », « Quels patients souffrent de migraine ? », « Que prendre contre la fièvre ? », « Quels médicaments
éviter pendant la grossesse ? », « Qui est allergique à l'amoxicilline ? », « Patients de plus de 60 ans ».

## API IA

| Route | Méthode |
|---|---|
| `GET /api/ia/medicaments/{id}/similaires` | Recommandation par contenu : vecteurs TF-IDF des relations (molécules ×3, indications ×2, contre-indications ×1, laboratoire ×0,5) comparés par similarité cosinus |
| `GET /api/ia/patients/{id}/recommandations` | Recommandation à base de connaissances : traitements de chaque maladie, sans contre-indication ni allergie, avec pénalité pour les interactions et bonus si plusieurs maladies sont couvertes |
| `POST /api/ia/alternatives` | Remplaçants sûrs pour les médicaments à risque d'une prescription |
| `POST /api/ia/verificateur` | Vérification anonyme d'une combinaison de médicaments (front-office) |

La détection des risques (`risks.py`) repose sur quatre requêtes SPARQL : contre-indication, allergie,
interaction et redondance. Elle est présentée comme une **détection par SPARQL**, et non comme une inférence SWRL.
Une absence de risque détecté ne garantit pas que la prescription est sûre.

## Contrat API (CRUD)

| Action | Médicaments | Patients | Prescriptions |
|---|---|---|---|
| Liste et filtres | `GET /api/medicaments?q=&maladie=&molecule=&laboratoire=` | `GET /api/patients?q=&maladie=&condition=&ageMin=&ageMax=` | `GET /api/prescriptions?q=&patient=&medecin=&medicament=&risque=` |
| Détail | `GET /api/medicaments/{id}` | `GET /api/patients/{id}` | `GET /api/prescriptions/{id}` |
| Ajout | `POST /api/medicaments` | `POST /api/patients` | `POST /api/prescriptions` |
| Modification | `PUT /api/medicaments/{id}` | `PUT /api/patients/{id}` | `PUT /api/prescriptions/{id}` |
| Suppression | `DELETE /api/medicaments/{id}` | `DELETE /api/patients/{id}` | `DELETE /api/prescriptions/{id}` |

Autres routes : `POST /api/prescriptions/verifier-risques`, `POST /api/nlp/query`, `GET /api/nlp/exemples`,
`GET /api/references`, `GET /api/stats`, `GET /api/ontologie/schema`, `GET /api/ontologie/graphe/{id}`,
`POST /api/sparql`, `GET /api/health`.

**Sécurité des requêtes**

- Les identifiants sont validés, et leur type RDF est vérifié dans le graphe.
- Les textes sont encodés avec `rdflib.Literal(...).n3()`.
- Les filtres des SELECT passent par `initBindings`.
- Aucune saisie n'est concaténée telle quelle dans une requête.

**Suppression**

- Un médicament ou un patient encore utilisé dans une prescription ne peut pas être supprimé : l'API répond `409`
  en indiquant les prescriptions concernées.
- Sinon, l'individu est supprimé avec toutes ses relations, entrantes et sortantes.

## Répartition dans le groupe

| Membre | Back-end | Front-end |
|---|---|---|
| 1 — Médicaments | `modules/medicaments`, IA « similaires » | `pages/admin/medicaments`, `pages/public/Catalogue`, `MedicamentPublic` |
| 2 — Patients | `modules/patients`, IA « recommandations » | `pages/admin/patients` |
| 3 — Prescriptions | `modules/prescriptions` (+ `risks.py`), IA « alternatives » | `pages/admin/prescriptions`, `RiskPanel`, `Verificateur` |
| 4 — NLP et intégration | `modules/nlp`, `sparql`, `references`, `core` | `NlpAssistant`, `AssistantAdmin`, `Dashboard`, `OntologyPage`, `SparqlConsole`, layouts |
