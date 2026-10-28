import { lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { Catalogue } from "./pages/public/Catalogue";
import { Home } from "./pages/public/Home";

// Chargement à la demande : chaque page (et Recharts) n'est téléchargée que lorsqu'on l'ouvre.
const AssistantAdmin = lazy(() => import("./pages/admin/AssistantAdmin").then((m) => ({ default: m.AssistantAdmin })));
const Dashboard = lazy(() => import("./pages/admin/Dashboard").then((m) => ({ default: m.Dashboard })));
const MedicamentDetail = lazy(() => import("./pages/admin/medicaments/MedicamentDetail").then((m) => ({ default: m.MedicamentDetail })));
const MedicamentForm = lazy(() => import("./pages/admin/medicaments/MedicamentForm").then((m) => ({ default: m.MedicamentForm })));
const MedicamentList = lazy(() => import("./pages/admin/medicaments/MedicamentList").then((m) => ({ default: m.MedicamentList })));
const OntologyPage = lazy(() => import("./pages/admin/OntologyPage").then((m) => ({ default: m.OntologyPage })));
const PatientDetail = lazy(() => import("./pages/admin/patients/PatientDetail").then((m) => ({ default: m.PatientDetail })));
const PatientForm = lazy(() => import("./pages/admin/patients/PatientForm").then((m) => ({ default: m.PatientForm })));
const PatientList = lazy(() => import("./pages/admin/patients/PatientList").then((m) => ({ default: m.PatientList })));
const PrescriptionDetail = lazy(() => import("./pages/admin/prescriptions/PrescriptionDetail").then((m) => ({ default: m.PrescriptionDetail })));
const PrescriptionForm = lazy(() => import("./pages/admin/prescriptions/PrescriptionForm").then((m) => ({ default: m.PrescriptionForm })));
const PrescriptionList = lazy(() => import("./pages/admin/prescriptions/PrescriptionList").then((m) => ({ default: m.PrescriptionList })));
const SparqlConsole = lazy(() => import("./pages/admin/SparqlConsole").then((m) => ({ default: m.SparqlConsole })));
const About = lazy(() => import("./pages/public/About").then((m) => ({ default: m.About })));
const AssistantPublic = lazy(() => import("./pages/public/AssistantPublic").then((m) => ({ default: m.AssistantPublic })));
const MedicamentPublic = lazy(() => import("./pages/public/MedicamentPublic").then((m) => ({ default: m.MedicamentPublic })));
const Verificateur = lazy(() => import("./pages/public/Verificateur").then((m) => ({ default: m.Verificateur })));

function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page introuvable</h1>
      <Link to="/" className="btn-primary mt-6">Retour à l'accueil</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Front-office public */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="catalogue" element={<Catalogue />} />
        <Route path="catalogue/:id" element={<MedicamentPublic />} />
        <Route path="verificateur" element={<Verificateur />} />
        <Route path="assistant" element={<AssistantPublic />} />
        <Route path="a-propos" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Back-office */}
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        {/* Membre 1 — Médicaments */}
        <Route path="medicaments" element={<MedicamentList />} />
        <Route path="medicaments/nouveau" element={<MedicamentForm />} />
        <Route path="medicaments/:id" element={<MedicamentDetail />} />
        <Route path="medicaments/:id/modifier" element={<MedicamentForm />} />
        {/* Membre 2 — Patients */}
        <Route path="patients" element={<PatientList />} />
        <Route path="patients/nouveau" element={<PatientForm />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="patients/:id/modifier" element={<PatientForm />} />
        {/* Membre 3 — Prescriptions */}
        <Route path="prescriptions" element={<PrescriptionList />} />
        <Route path="prescriptions/nouvelle" element={<PrescriptionForm />} />
        <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
        <Route path="prescriptions/:id/modifier" element={<PrescriptionForm />} />
        {/* Membre 4 — NLP, ontologie, intégration */}
        <Route path="assistant" element={<AssistantAdmin />} />
        <Route path="ontologie" element={<OntologyPage />} />
        <Route path="sparql" element={<SparqlConsole />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
