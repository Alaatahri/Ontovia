# Nexora — Pharmaceutique et Santé

Application web sémantique de gestion des **médicaments**, des **patients** et des **prescriptions**, basée sur une
ontologie pharmaceutique OWL interrogée en **SPARQL**, avec un **assistant en langage naturel** qui traduit les
questions en requêtes SPARQL.

```
Ontologie OWL (nexora.owl)  →  rdflib + SPARQL  →  API REST FastAPI  →  Interface React
```

## Choix techniques

| Couche | Technologie | Pourquoi |
|---|---|---|
| Ontologie | OWL 2 (RDF/XML), ouvrable dans **Protégé** | Format attendu ; un seul fichier partagé par tous les modules |
| Moteur RDF | **rdflib 7** (Python) | SPARQL 1.1 complet (SELECT, INSERT DATA, DELETE/INSERT WHERE), aucun serveur à installer |
| Back-end | **FastAPI** + Pydantic | Validation automatique des champs, documentation Swagger générée (`/docs`) |
| NLP | **spaCy** (tokenizer français) + **snowballstemmer** (racinisation) + **rapidfuzz** (correspondance approximative) | Léger, sans modèle à télécharger, tolère reformulations et fautes de frappe |
| Front-end | **React 18 + Vite + TypeScript**, React Router, icônes lucide-react | Template de tableau de bord sans framework CSS : un seul fichier `styles.css` |

## Démarrage

Prérequis : Python 3.11+ et Node 18+.

```bash
# 1. Back-end (terminal 1)
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (Linux/macOS : source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → API : http://localhost:8000/api   ·   Swagger : http://localhost:8000/docs

# 2. Front-end (terminal 2)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Si le port 8000 est déjà occupé, lancez l'API sur un autre port puis indiquez-le à Vite :

```powershell
uvicorn app.main:app --reload --port 8010
$env:NEXORA_API="http://127.0.0.1:8010"; npm run dev      # PowerShell
```

**Réinitialiser les données** (régénère `backend/ontology/nexora.owl` avec les individus de démonstration) :

```bash
cd backend && python -m scripts.seed_ontology
```

**Tests** : `cd backend && python -m pytest` (13 tests ; ils s'exécutent sur une copie temporaire de l'ontologie).

## Structure

```
backend/
  ontology/nexora.owl            ← LE graphe partagé (lu au démarrage, réécrit après chaque modification)
  scripts/seed_ontology.py       ← schéma OWL + individus de démonstration
  app/
    main.py                      ← application FastAPI, gestion des erreurs
    core/
      graph_store.py             ← chargement / requêtes / sauvegarde du graphe (verrou + écriture atomique)
      rdf.py                     ← namespace, validation des identifiants, encodage des termes RDF
      common.py                  ← helpers partagés : validation des références, INSERT/DELETE, suppression
    modules/
      medicaments/   (membre 1)  router.py · schemas.py · repository.py (requêtes SPARQL)
      patients/      (membre 2)  idem
      prescriptions/ (membre 3)  idem + risks.py (détection des risques)
      nlp/           (membre 4)  analyzer.py · intents.py · service.py · router.py
      references/                listes pour les formulaires + statistiques
      sparql/                    console SPARQL en lecture seule
  tests/test_api.py
frontend/src/
  api/          client.ts (service HTTP commun) · types.ts (contrat JSON) · references.ts
  components/   Layout, ui (états chargement/vide/erreur, cartes, pastilles), MultiSelect, ConfirmDialog, ResultTable, SparqlBlock
  modules/
    medicaments/   (membre 1)  service.ts · MedicamentList · MedicamentDetail · MedicamentForm
    patients/      (membre 2)  service.ts · PatientList · PatientDetail · PatientForm
    prescriptions/ (membre 3)  service.ts · PrescriptionList · PrescriptionDetail · PrescriptionForm · RiskPanel
    assistant/     (membre 4)  AssistantPage · service.ts
    sparql/ · dashboard/       console SPARQL et tableau de bord (intégration — membre 4)
  App.tsx (routes) · styles.css (thème du template)
```

## L'ontologie

Namespace : `http://www.nexora.org/ontologie/pharma#` (préfixe `nx:`) — 551 triplets au départ.

**Classes** : `Personne` ⊃ {`Patient`, `Medecin`} · `Medicament` · `Molecule` · `Laboratoire` · `Condition` ⊃
{`Maladie`, `ConditionPhysiologique`} · `Prescription` (avec axiomes de disjonction).

**Propriétés objet**

| Propriété | Domaine → Portée | Caractéristique |
|---|---|---|
| `contientMolecule` | Medicament → Molecule | |
| `traite` / `estTraitePar` | Medicament → Maladie | inverses |
| `aContreIndication` | Medicament → Condition | |
| `interagitAvec` | Medicament → Medicament | symétrique |
| `fabriquePar` | Medicament → Laboratoire | fonctionnelle |
| `souffreDe` | Patient → Maladie | |
| `presenteCondition` | Patient → ConditionPhysiologique | |
| `estAllergiqueA` | Patient → Molecule | |
| `concernePatient` · `prescritePar` · `prescritMedicament` | Prescription → Patient · Medecin · Medicament | les 2 premières fonctionnelles |

**Propriétés de données** : `nom`, `prenom`, `age`, `sexe`, `specialite`, `dosage`, `formeGalenique`, `description`,
`datePrescription` (xsd:date), `posologie`, `dureeJours`.

**Individus** : 13 médicaments, 13 molécules, 13 maladies, 4 conditions physiologiques, 8 laboratoires, 4 médecins,
7 patients, 7 prescriptions (dont 5 présentant un risque, pour la démonstration).

> rdflib n'exécute pas de raisonneur : les requêtes tiennent compte explicitement des sous-classes
> (`Maladie` et `ConditionPhysiologique` pour `Condition`) et de la symétrie (`nx:interagitAvec|^nx:interagitAvec`).

## Contrat API

| Action | Médicaments | Patients | Prescriptions |
|---|---|---|---|
| Liste + recherche | `GET /api/medicaments?q=&maladie=&molecule=` | `GET /api/patients?q=&maladie=&condition=` | `GET /api/prescriptions?q=&patient=&medecin=&medicament=&risque=` |
| Détail | `GET /api/medicaments/{id}` | `GET /api/patients/{id}` | `GET /api/prescriptions/{id}` (inclut l'analyse des risques) |
| Ajout | `POST /api/medicaments` | `POST /api/patients` | `POST /api/prescriptions` |
| Modification | `PUT /api/medicaments/{id}` | `PUT /api/patients/{id}` | `PUT /api/prescriptions/{id}` |
| Suppression | `DELETE /api/medicaments/{id}` | `DELETE /api/patients/{id}` | `DELETE /api/prescriptions/{id}` |

Autres routes : `POST /api/prescriptions/verifier-risques`, `POST /api/nlp/query`, `GET /api/nlp/exemples`,
`GET /api/references`, `GET /api/stats`, `POST /api/sparql`, `GET /api/health`.

Exemple de corps `POST /api/medicaments` :

```json
{ "nom": "Doliprane", "dosage": "1000 mg", "formeGalenique": "Comprimé", "description": null,
  "laboratoireId": "Lab_Sanofi", "moleculeIds": ["Mol_Paracetamol"], "maladieIds": ["Mal_Fievre"],
  "contreIndicationIds": ["Mal_InsuffisanceHepatique"], "interactionIds": [] }
```

Codes d'erreur : `404` individu introuvable · `422` champ invalide ou référence vers un individu inexistant ou d'une
autre classe · `409` suppression refusée (voir ci-dessous). Le corps contient toujours `{"detail": "..."}`.

### Sécurité des requêtes

Aucune saisie utilisateur n'est concaténée telle quelle dans une requête :

- les identifiants sont validés (`^[A-Za-z][A-Za-z0-9_-]*$`) puis vérifiés dans le graphe avec le bon `rdf:type` ;
- les textes passent par `rdflib.Literal(...).n3()`, qui produit un littéral typé et correctement échappé ;
- les paramètres des SELECT (recherche, filtres) sont transmis via `initBindings`.

### Suppression et relations

- **Médicament** utilisé dans une prescription → `409` avec la liste des prescriptions ; sinon l'individu est supprimé
  avec **toutes** ses relations, y compris les interactions déclarées par d'autres médicaments.
- **Patient** ayant des prescriptions → `409` ; sinon suppression complète.
- **Prescription** → suppression de ses triplets ; le patient, le médecin et les médicaments sont conservés.

## Détection des risques (membre 3)

Le calcul est réellement exécuté par **quatre requêtes SPARQL** (`backend/app/modules/prescriptions/risks.py`) :

| Risque | Relations croisées |
|---|---|
| Contre-indication | `aContreIndication` ∩ (`souffreDe` ∪ `presenteCondition`) |
| Allergie | `contientMolecule` ∩ `estAllergiqueA` |
| Interaction | `interagitAvec` entre deux médicaments de la même prescription |
| Redondance | deux médicaments qui contiennent la même molécule |

L'interface la présente comme une **détection par SPARQL**, et non comme une déduction SWRL. Elle précise aussi
qu'une absence de correspondance ne garantit pas qu'une prescription est sûre. Les requêtes utilisées s'affichent
dans la fiche, et la vérification se fait en direct dans le formulaire.

## Assistant NLP (membre 4)

Traitement de `POST /api/nlp/query` :

1. **Analyse** : tokenisation française spaCy (élisions *l'*, *d'*, mots vides), puis racinisation Snowball
   (*traitent*, *traitement* → `trait`).
2. **Entités** : les n-grammes sont comparés aux noms des individus **lus dans le graphe** (les ajouts par le CRUD
   sont donc reconnus immédiatement). La comparaison accepte les synonymes (*enceinte* → Grossesse, *HTA* →
   Hypertension) et tolère les fautes de frappe grâce à rapidfuzz (*migrane* → Migraine).
3. **Intention** : un score par mots-clés racinisés, plus un bonus si l'entité attendue est du bon type.
4. **SPARQL** : la requête est construite à partir du modèle de l'intention, puis **exécutée**. La réponse
   renvoie la requête, les colonnes, les résultats, l'explication et le détail de l'analyse.
5. **Question non comprise** : un message s'affiche, avec des suggestions construites à partir des entités
   reconnues.

17 intentions, dont les 3 demandées :

| Exemple | Intention | Relation |
|---|---|---|
| « Quels médicaments traitent la migraine ? » / « Que prendre contre la fièvre ? » | `traitement_maladie` | `traite` |
| « Quelles sont les contre-indications de l'aspirine ? » | `contre_indications_medicament` | `aContreIndication` |
| « Quels patients souffrent de migraine ? » / « Qui a de l'asthme ? » | `patients_condition` | `souffreDe` / `presenteCondition` |
| « Quels médicaments éviter pendant la grossesse ? » | `contre_indiques_condition` | `aContreIndication` |
| « Quelles molécules contient l'Augmentin ? » · « Quels médicaments contiennent du paracétamol ? » | composition | `contientMolecule` |
| « Avec quoi la Coumadine interagit-elle ? » | `interactions_medicament` | `interagitAvec` |
| « De quoi souffre Youssef Hammami ? » · « Allergies de Ines ? » · « Ordonnances de Ahmed ? » | dossier patient | plusieurs |
| « Prescriptions du Dr Khelifi » · « Médicaments du laboratoire GSK » | médecin / laboratoire | `prescritePar` / `fabriquePar` |
| « Quelles prescriptions présentent un risque ? » | `prescriptions_risque` | requête de détection |
| « Patients de plus de 60 ans » · « Combien de médicaments ? » · « Liste des laboratoires » | âge / comptage / liste | `age`, `rdf:type` |

## Répartition dans le groupe

| Membre | Back-end | Front-end |
|---|---|---|
| 1 — Médicaments | `app/modules/medicaments/` | `src/modules/medicaments/` |
| 2 — Patients | `app/modules/patients/` | `src/modules/patients/` |
| 3 — Prescriptions | `app/modules/prescriptions/` (+ `risks.py`) | `src/modules/prescriptions/` |
| 4 — NLP + intégration | `app/modules/nlp/`, `sparql/`, `references/`, `core/` | `src/modules/assistant/`, `sparql/`, `dashboard/`, `components/`, `App.tsx` |

Règles communes :

- Un seul graphe : `backend/ontology/nexora.owl`. Toute évolution du **schéma** passe par
  `scripts/seed_ontology.py`, dont le membre 4 est responsable.
- Une branche Git par membre (`feature/medicaments`, `feature/patients`, `feature/prescriptions`, `feature/nlp`),
  avec une fusion dans `main` après le passage des tests.
- On ne modifie pas le contrat JSON (`frontend/src/api/types.ts`) sans prévenir le groupe.
