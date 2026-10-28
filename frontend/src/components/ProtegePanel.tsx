import { useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, ExternalLink, FileCode2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { ontologyApi } from "../api/services";
import type { OntologyFile, ReasonerResult } from "../api/types";
import { ErrorBox } from "./ui";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR") : "—");

/**
 * Liaison avec Protégé : l'application et Protégé travaillent sur le même fichier nexora.owl.
 * Un enregistrement dans Protégé est rechargé automatiquement par le back-end ; HermiT (le raisonneur
 * de Protégé) peut être lancé depuis ici pour vérifier la cohérence.
 */
export function ProtegePanel({ onReloaded }: { onReloaded?: () => void }) {
  const [file, setFile] = useState<OntologyFile | null>(null);
  const [busy, setBusy] = useState<"" | "reload" | "open" | "reason">("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasoner, setReasoner] = useState<ReasonerResult | null>(null);

  const refresh = () => ontologyApi.fichier().then(setFile).catch((e: Error) => setError(e.message));
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000); // détecte les enregistrements faits dans Protégé
    return () => clearInterval(id);
  }, []);

  const run = async (kind: "reload" | "open" | "reason") => {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      if (kind === "reload") {
        setFile(await ontologyApi.recharger());
        setMessage("Ontologie rechargée depuis le fichier.");
        onReloaded?.();
      } else if (kind === "open") {
        setMessage((await ontologyApi.ouvrirProtege()).message);
      } else {
        setReasoner(await ontologyApi.raisonner());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white px-5 py-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 font-display text-lg font-extrabold text-white">P</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink-900">Liaison avec Protégé</h2>
          <p className="text-xs text-slate-500">Même fichier OWL des deux côtés : un enregistrement dans Protégé est rechargé automatiquement par l'application.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => run("reload")} disabled={!!busy}>
            {busy === "reload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recharger
          </button>
          <button className="btn-secondary btn-sm" onClick={() => run("reason")} disabled={!!busy || !file?.protege}>
            {busy === "reason" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />} Raisonner (HermiT)
          </button>
          <button className="btn-sm btn bg-violet-600 text-white hover:bg-violet-700" onClick={() => run("open")} disabled={!!busy || !file?.protege}>
            {busy === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} Ouvrir dans Protégé
          </button>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          {error && <ErrorBox message={error} />}
          {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{message}</p>}
          {file?.erreur && <ErrorBox message={file.erreur} />}
          {file && (
            <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2">
              <dt className="text-slate-500">Fichier</dt>
              <dd className="flex items-start gap-1.5 break-all font-mono text-xs text-ink-900"><FileCode2 className="h-4 w-4 shrink-0 text-violet-600" />{file.chemin}</dd>
              <dt className="text-slate-500">Format</dt><dd>{file.format} · {(file.taille / 1024).toFixed(1)} Ko · {file.triplets} triplets</dd>
              <dt className="text-slate-500">Modifié le</dt><dd>{fmtDate(file.modifieLe)}</dd>
              <dt className="text-slate-500">Chargé le</dt><dd>{fmtDate(file.chargeLe)}</dd>
              <dt className="text-slate-500">Rechargements auto</dt><dd>{file.rechargementsAuto}</dd>
              <dt className="text-slate-500">Protégé</dt>
              <dd>{file.protege ? <span className="break-all text-xs">{file.protege}</span> : <span className="text-amber-700">non détecté — définissez PROTEGE_HOME</span>}</dd>
            </dl>
          )}
          <details className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Travailler dans Protégé</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>« Ouvrir dans Protégé » (ou File › Open… sur le chemin ci-dessus).</li>
              <li>View › Render by label (rdfs:label) pour voir les noms des individus.</li>
              <li>Pour qu'un individu apparaisse dans l'application, donnez-lui la propriété <code>nx:nom</code> ; IRI sans espaces (ex. <code>Med_Exemple</code>).</li>
              <li>Enregistrez (Ctrl + S) au format <strong>RDF/XML</strong> : l'application recharge le fichier automatiquement.</li>
              <li>Reasoner › HermiT › Start reasoner pour voir les inférences (sous-classes, inverse, symétrie).</li>
            </ol>
          </details>
        </div>

        <div>
          {reasoner ? (
            <div className={`rounded-xl border p-4 ${reasoner.coherente ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}>
              <p className={`mb-3 flex items-center gap-2 font-semibold ${reasoner.coherente ? "text-emerald-800" : "text-rose-800"}`}>
                {reasoner.coherente ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {reasoner.coherente ? "Ontologie cohérente selon HermiT" : reasoner.erreur ?? "Ontologie incohérente"}
              </p>
              <dl className="space-y-1.5 text-xs">
                {reasoner.resultats.filter((r) => r.cle !== "HermiT cohérence").map((r) => (
                  <div key={r.cle} className="grid grid-cols-[170px_1fr] gap-3">
                    <dt className="text-slate-500">{r.cle}</dt>
                    <dd className="text-slate-800">{r.valeur}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] text-slate-400">{reasoner.moteur}</p>
            </div>
          ) : (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              <BrainCircuit className="mb-2 h-8 w-8 text-violet-400" />
              Lancez HermiT pour vérifier la cohérence de l'ontologie et afficher les inférences
              (instances des super-classes, propriété inverse <code>estTraitePar</code>…).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
