import { useRef, useState } from "react";
import { Cpu, Loader2, Sparkles, Square } from "lucide-react";
import { chatApi } from "../../../api/services";
import { Markdown } from "../../../components/chat/Markdown";

/** IA — synthèse du dossier patient : données SPARQL + recommandations, rédigées par le LLM local (Ollama). */
export function SynthesePatient({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [donnees, setDonnees] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ modele: string | null; duree: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setText("");
    setMeta(null);
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatApi.synthesePatient(id, (ev) => {
        if (ev.type === "donnees") setDonnees(ev.texte);
        else if (ev.type === "token") setText((t) => t + ev.text);
        else if (ev.type === "fin") setMeta({ modele: ev.modele, duree: ev.duree });
      }, controller.signal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {!text && !busy && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
          <Sparkles className="mb-2 h-7 w-7 text-violet-500" />
          <p className="mb-3 text-sm text-slate-600">
            Le dossier (maladies, conditions, allergies, prescriptions, risques détectés et recommandations) est extrait par
            SPARQL puis résumé par le modèle de langage local.
          </p>
          <button className="btn bg-violet-600 text-white hover:bg-violet-700" onClick={run}><Sparkles className="h-4 w-4" /> Générer la synthèse</button>
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {(text || busy) && (
        <div className="rounded-xl border border-violet-100 bg-white p-4">
          {text ? <Markdown text={text} /> : <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Extraction des données et rédaction…</p>}
          {busy && text && <span className="inline-block h-4 w-1.5 animate-pulse bg-violet-500 align-middle" />}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {meta && <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Cpu className="h-3 w-3" />{meta.modele ? `Rédigé par ${meta.modele} (Ollama, local)` : "Ollama indisponible : données brutes affichées"} · {meta.duree}s</p>}
        <div className="ml-auto flex gap-2">
          {busy && <button className="btn-secondary btn-sm" onClick={() => abortRef.current?.abort()}><Square className="h-3.5 w-3.5" /> Arrêter</button>}
          {!busy && text && <button className="btn-ghost btn-sm" onClick={run}><Sparkles className="h-3.5 w-3.5" /> Régénérer</button>}
        </div>
      </div>
      {donnees && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Données transmises au modèle (issues de l'ontologie)</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px]">{donnees}</pre>
        </details>
      )}
    </div>
  );
}
