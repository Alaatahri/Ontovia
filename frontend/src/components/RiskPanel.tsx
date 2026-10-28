import { AlertOctagon, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import type { AnalyseRisques, RisqueType } from "../api/types";
import { SparqlBlock } from "./Sparql";

export const RISK_LABELS: Record<RisqueType, string> = {
  CONTRE_INDICATION: "Contre-indication",
  ALLERGIE: "Allergie",
  INTERACTION: "Interaction médicamenteuse",
  REDONDANCE: "Redondance de principe actif",
};

/** Zone « risque détecté » : résultats des requêtes SPARQL de détection, avec leur explication. */
export function RiskPanel({ analyse, showQueries = true }: { analyse: AnalyseRisques; showQueries?: boolean }) {
  const { risques } = analyse;
  return (
    <div className="space-y-4">
      {risques.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          Aucun risque détecté par les requêtes SPARQL.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {risques.map((r, i) => {
            const high = r.gravite === "elevee";
            return (
              <li key={i} className={`flex gap-3 rounded-xl border-l-4 px-4 py-3 ${high ? "border-rose-500 bg-rose-50 text-rose-900" : "border-amber-500 bg-amber-50 text-amber-900"}`}>
                {high ? <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
                <div className="space-y-0.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {RISK_LABELS[r.type]}
                    <span className={`badge ${high ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                      gravité {high ? "élevée" : "modérée"}
                    </span>
                  </div>
                  <p>{r.explication}</p>
                  <p className="text-xs opacity-70">Relations exploitées : {r.relation}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-700">{analyse.methode}</p>
          <p>{analyse.avertissement}</p>
        </div>
      </div>
      {showQueries && analyse.requetes?.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
            Voir les {analyse.requetes.length} requêtes SPARQL de détection
          </summary>
          <div className="mt-3 space-y-3">
            {analyse.requetes.map((q, i) => <SparqlBlock key={i} query={q} />)}
          </div>
        </details>
      )}
    </div>
  );
}
