import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { chatApi } from "../../api/services";
import type { ChatEvent, ChatMode, NlpResponse } from "../../api/types";

export type BotTurn = {
  role: "assistant";
  text: string;
  mode?: ChatMode;
  analyse?: ChatEvent & { type: "analyse" };
  navigation?: { chemin: string; titre: string } | null;
  modele?: string | null;
  duree?: number;
  done: boolean;
  error?: string;
};
export type Turn = { role: "user"; text: string } | BotTurn;
type Contexte = { entite?: NlpResponse["entite"]; intention?: string } | null;

interface ChatState {
  turns: Turn[];
  contexte: Contexte;
  busy: boolean;
  ask: (question: string) => void;
  stop: () => void;
  reset: () => void;
}

const Ctx = createContext<ChatState | null>(null);

/**
 * Conversation partagée par l'assistant pleine page et la bulle flottante : elle survit aux changements de page.
 * Quand l'assistant reçoit un ordre de navigation (« ouvre la page des pharmacies »), la page est ouverte.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [contexte, setContexte] = useState<Contexte>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const updateBot = (patch: (t: BotTurn) => BotTurn) =>
    setTurns((all) => {
      const copy = [...all];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") copy[copy.length - 1] = patch(last);
      return copy;
    });

  const ask = useCallback(async (q: string) => {
    const text = q.trim();
    if (text.length < 2 || busy) return;
    const historique = turns
      .filter((t) => t.role === "user" || (t.role === "assistant" && t.done && !t.error))
      .map((t) => ({ role: t.role, content: t.text }));
    setTurns((all) => [...all, { role: "user", text }, { role: "assistant", text: "", done: false }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatApi.envoyer(text, historique, contexte, (ev) => {
        if (ev.type === "analyse") {
          updateBot((t) => ({ ...t, analyse: ev, mode: ev.mode, navigation: ev.navigation }));
          if (ev.navigation) navigate(ev.navigation.chemin);
        } else if (ev.type === "token") updateBot((t) => ({ ...t, text: t.text + ev.text }));
        else if (ev.type === "fin") {
          updateBot((t) => ({ ...t, done: true, modele: ev.modele, duree: ev.duree }));
          setContexte((ev.contexte as Contexte) ?? null);
        }
      }, controller.signal);
      updateBot((t) => ({ ...t, done: true }));
    } catch (e) {
      updateBot((t) => ({ ...t, done: true, error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }, [busy, turns, contexte, navigate]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setContexte(null);
  }, []);

  return <Ctx.Provider value={{ turns, contexte, busy, ask, stop, reset }}>{children}</Ctx.Provider>;
}

export function useChat(): ChatState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useChat doit être utilisé dans <ChatProvider>");
  return value;
}
