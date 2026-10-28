import { ArrowRight, BrainCircuit } from "lucide-react";
import { prescriptionsApi } from "../../../api/services";
import { ErrorBox, Loading } from "../../../components/ui";
import { useAsync } from "../../../hooks/useAsync";

/** IA — alternatives thérapeutiques pour les médicaments à risque d'une prescription. */
export function Alternatives({ patientId, medicamentIds, onPick }: {
  patientId: string; medicamentIds: string[]; onPick?: (from: string, to: string) => void;
}) {
  const key = medicamentIds.join(",");
  const { data, loading, error } = useAsync(() => prescriptionsApi.alternatives(patientId, medicamentIds), [patientId, key]);
  if (loading) return <Loading label="Recherche d'alternatives…" />;
  if (error || !data) return <ErrorBox message={error ?? "Indisponible"} />;
  if (!data.remplacements.length) return null;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-900"><BrainCircuit className="h-4 w-4" /> Alternatives proposées par l'IA</h4>
      <div className="space-y-4">
        {data.remplacements.map((r) => (
          <div key={r.medicament.id}>
            <p className="text-sm"><span className="font-semibold">{r.medicament.nom}</span> <span className="text-slate-500">— {r.problemes.join(" ; ")}</span></p>
            {r.alternatives.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Aucune alternative sans risque trouvée dans l'ontologie.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.alternatives.map((a) => (
                  <button key={a.id} type="button" disabled={!onPick} onClick={() => onPick?.(r.medicament.id, a.id)}
                    className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-left text-sm transition enabled:hover:border-indigo-400 enabled:hover:shadow-sm">
                    {onPick && <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />}
                    <span>
                      <span className="font-semibold text-ink-900">{a.nom}</span>
                      <span className="block text-xs text-slate-500">traite {a.traite.join(", ")} · similarité {Math.round(a.similarite * 100)} %</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">{data.methode}{onPick ? " Cliquez sur une alternative pour remplacer le médicament." : ""}</p>
    </div>
  );
}
