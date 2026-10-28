import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Code2, HelpCircle, Loader2, SendHorizontal, Sparkles, User } from "lucide-react";
import { nlpApi } from "../api/services";
import type { NlpResponse } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import { ResultTable, SparqlBlock } from "./Sparql";

const TYPE_LABELS: Record<string, string> = {
  Medicament: "Médicament", Molecule: "Molécule", Maladie: "Maladie", ConditionPhysiologique: "Condition",
  Patient: "Patient", Medecin: "Médecin", Laboratoire: "Laboratoire",
};

type Message = { role: "user"; text: string } | { role: "bot"; response: NlpResponse } | { role: "error"; text: string };

/**
 * Assistant NLP : question en français → analyse (spaCy, Snowball, rapidfuzz) → intention → SPARQL → résultats.
 * `expertMode` affiche directement la requête SPARQL et l'analyse linguistique (back-office).
 */
export function NlpAssistant({ expertMode = false, compact = false }: { expertMode?: boolean; compact?: boolean }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const examples = useAsync(() => nlpApi.examples(), []);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 2 || loading) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const response = await nlpApi.ask(text);
      setMessages((m) => [...m, { role: "bot", response }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  return (
    <div className="card overflow-hidden">
      <div className={`space-y-5 overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-6 ${compact ? "max-h-[520px]" : "min-h-[360px] max-h-[640px]"}`}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-600 text-white shadow-lift">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Posez votre question en français</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Elle sera analysée, traduite en requête SPARQL puis exécutée sur l'ontologie Nexora.
            </p>
            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {examples.data?.slice(0, compact ? 6 : 12).map((ex) => (
                <button key={ex} onClick={() => ask(ex)} className="chip chip-brand px-3 py-1.5 text-[13px] transition hover:bg-brand-100">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end gap-3">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">{m.text}</div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600"><User className="h-4 w-4" /></span>
            </div>
          ) : m.role === "error" ? (
            <BotBubble key={i}><p className="text-sm text-rose-700">{m.text}</p></BotBubble>
          ) : (
            <BotBubble key={i}><Answer response={m.response} expertMode={expertMode} onAsk={ask} /></BotBubble>
          ),
        )}
        {loading && (
          <BotBubble>
            <span className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Analyse et exécution SPARQL…</span>
          </BotBubble>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3 sm:p-4">
        <input
          className="input flex-1 border-transparent bg-slate-50 shadow-none"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question… ex. Quels médicaments traitent la migraine ?"
          maxLength={300}
          aria-label="Posez votre question"
        />
        <button className="btn-primary" disabled={loading || question.trim().length < 2}>
          <SendHorizontal className="h-4 w-4" /> <span className="hidden sm:inline">Rechercher</span>
        </button>
      </form>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-600 text-white"><Bot className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-4 shadow-sm">{children}</div>
    </div>
  );
}

function Answer({ response: r, expertMode, onAsk }: { response: NlpResponse; expertMode: boolean; onAsk: (q: string) => void }) {
  if (!r.compris) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-amber-800"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0" /> {r.message}</p>
        {r.suggestions && r.suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Vouliez-vous dire :</p>
            <div className="flex flex-wrap gap-2">
              {r.suggestions.map((s) => (
                <button key={s} onClick={() => onAsk(s)} className="chip chip-indigo px-3 py-1 transition hover:bg-indigo-100">{s}</button>
              ))}
            </div>
          </div>
        )}
        <Analysis r={r} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">{r.intention?.label}</span>
        {r.entite && (
          <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
            {TYPE_LABELS[r.entite.type] ?? r.entite.type} : {r.entite.nom}
            {r.entite.score < 100 && <span className="font-normal opacity-70">(« {r.entite.text} », {r.entite.score} %)</span>}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-700">{r.explication}</p>
      {r.message && <p className="text-sm text-slate-500">{r.message}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-100">
        <ResultTable columns={r.colonnes ?? []} rows={r.resultats ?? []} />
      </div>
      {expertMode ? (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Code2 className="h-3.5 w-3.5" /> Requête SPARQL générée</p>
          <SparqlBlock query={r.sparql ?? ""} />
          <Analysis r={r} />
        </>
      ) : (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">Voir la requête SPARQL générée</summary>
          <SparqlBlock className="mt-2" query={r.sparql ?? ""} />
        </details>
      )}
    </div>
  );
}

function Analysis({ r }: { r: NlpResponse }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
        Analyse NLP : tokens spaCy, racines Snowball, entités reconnues
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {r.analyse.tokens.map((t, i) => (
          <span key={i} title={`racine : ${t.stem}`}
            className={`inline-flex flex-col items-center rounded-lg px-2 py-1 text-xs ${t.stop ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-700"}`}>
            {t.text}
            <small className="font-mono text-[10px] opacity-70">{t.stem}</small>
          </span>
        ))}
      </div>
      {r.analyse.entites.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Entités : {r.analyse.entites.map((e) => `${e.nom} (${TYPE_LABELS[e.type] ?? e.type}, ${e.score} %)`).join(" · ")}
        </p>
      )}
    </details>
  );
}
