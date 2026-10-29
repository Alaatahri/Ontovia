import { useEffect, useState } from "react";

const KEY = "nexora.modeSemantique";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Mode sémantique : affiche les propriétés nx:, IRI et requêtes (classe « sem-on » sur <html>), mémorisé localement. */
export function useSemantic(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    document.documentElement.classList.toggle("sem-on", on);
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  }, [on]);
  return [on, setOn];
}

/** Applique le choix mémorisé dès le chargement (front-office compris). */
export function applyStoredSemanticMode() {
  document.documentElement.classList.toggle("sem-on", read());
}
