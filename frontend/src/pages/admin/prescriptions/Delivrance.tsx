import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MapPin, PackageCheck, Store, Undo2, XCircle } from "lucide-react";
import { ApiError } from "../../../api/client";
import { prescriptionsApi } from "../../../api/services";
import type { Prescription } from "../../../api/types";
import { ErrorBox, Loading, formatDate } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";

/**
 * Métier avancé — délivrance de l'ordonnance en pharmacie :
 * pharmacies classées selon leur stock (nx:disposeDe), refus si un médicament manque,
 * confirmation explicite si un risque est détecté (pharmacovigilance), annulation possible.
 */
export function Delivrance({ prescription, onChange }: { prescription: Prescription; onChange: () => void }) {
  const pharmacies = useAsync(() => prescriptionsApi.pharmacies(prescription.id), [prescription.id, prescription.statut]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);

  const delivrer = async (pharmacieId: string, forcer = false) => {
    setBusy(pharmacieId);
    setError(null);
    try {
      await prescriptionsApi.delivrer(prescription.id, pharmacieId, forcer);
      setConfirmFor(null);
      onChange();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && prescription.nbRisques > 0 && !forcer) setConfirmFor(pharmacieId);
      else setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const annuler = async () => {
    setBusy("annuler");
    try {
      await prescriptionsApi.annulerDelivrance(prescription.id);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (prescription.statut === "Délivrée") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <PackageCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">Ordonnance délivrée</p>
            <p className="text-emerald-800">
              par <Link className="font-medium underline" to={`/admin/pharmacies/${prescription.pharmacie?.id}`}>{prescription.pharmacie?.nom}</Link> le {formatDate(prescription.dateDelivrance)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">Une ordonnance délivrée ne peut plus être modifiée.</p>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-secondary btn-sm" onClick={annuler} disabled={busy !== null}>
          {busy === "annuler" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Annuler la délivrance
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-slate-600"><Clock className="h-4 w-4 text-amber-500" /> En attente de délivrance. Pharmacies classées selon leur stock :</p>
      {error && <ErrorBox message={error} />}
      {pharmacies.loading && !pharmacies.data ? <Loading /> : pharmacies.error ? <ErrorBox message={pharmacies.error} /> : (
        <ul className="space-y-2">
          {pharmacies.data!.map((ph) => (
            <li key={ph.id} className={`rounded-xl border p-3 ${ph.complete ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Store className={`h-5 w-5 ${ph.complete ? "text-emerald-600" : "text-slate-400"}`} />
                <div className="min-w-0 flex-1 text-sm">
                  <Link to={`/admin/pharmacies/${ph.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{ph.nom}</Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><MapPin className="h-3 w-3" />{ph.ville} {ph.horaires && <>· {ph.horaires}</>}</p>
                </div>
                {ph.complete ? (
                  <button className="btn-primary btn-sm" disabled={busy !== null} onClick={() => delivrer(ph.id)}>
                    {busy === ph.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Délivrer ici
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-700"><XCircle className="h-3.5 w-3.5" /> Manque : {ph.manquants.map((m) => m.nom).join(", ")}</span>
                )}
              </div>
              {confirmFor === ph.id && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="flex-1">Cette ordonnance présente {prescription.nbRisques} risque(s) détecté(s). Confirmez-vous la délivrance après vérification ?</span>
                  <button className="btn-sm btn bg-amber-600 text-white hover:bg-amber-700" onClick={() => delivrer(ph.id, true)}>Confirmer</button>
                  <button className="btn-ghost btn-sm" onClick={() => setConfirmFor(null)}>Annuler</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatutBadge({ statut }: { statut: Prescription["statut"] }) {
  return statut === "Délivrée" ? (
    <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"><PackageCheck className="h-3 w-3" /> Délivrée</span>
  ) : (
    <span className="badge bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"><Clock className="h-3 w-3" /> En attente</span>
  );
}
