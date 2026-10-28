import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { iaApi, referencesApi } from "../../api/services";
import type { AnalyseRisques } from "../../api/types";
import { MultiSelect } from "../../components/MultiSelect";
import { RiskPanel } from "../../components/RiskPanel";
import { Card, ErrorBox, Loading } from "../../components/ui";
import { useAsync, useDebounced } from "../../hooks/useAsync";
import { PHOTOS } from "../../lib/images";
import { PublicHero } from "./Catalogue";

/** Scénario public : vérifier une combinaison de médicaments pour un profil anonyme (rien n'est enregistré). */
export function Verificateur() {
  const refs = useAsync(() => referencesApi.all(), []);
  const [meds, setMeds] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyseRisques | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useDebounced(JSON.stringify([meds, conditions, allergies]), 300);

  useEffect(() => {
    const [m, c, a] = JSON.parse(draft) as string[][];
    if (!m.length) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    iaApi.verificateur(m, c, a)
      .then((r) => !cancelled && setResult(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [draft]);

  return (
    <>
      <PublicHero eyebrow="Outil gratuit" title="Vérificateur d'interactions" image={PHOTOS.verificateur}
        text="Sélectionnez des médicaments et, si vous le souhaitez, des conditions et allergies : les risques sont détectés en direct par des requêtes SPARQL. Aucune donnée n'est enregistrée." />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {refs.loading ? <Loading /> : refs.error ? <ErrorBox message={refs.error} onRetry={refs.reload} /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <Card title="1. Médicaments">
                <MultiSelect options={refs.data!.medicaments} value={meds} onChange={setMeds} placeholder="Rechercher un médicament…" />
              </Card>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Card title="2. Conditions (optionnel)">
                  <MultiSelect height="max-h-44" value={conditions} onChange={setConditions}
                    options={[...refs.data!.conditions.map((c) => ({ ...c, type: "ConditionPhysiologique" as const })),
                      ...refs.data!.maladies.map((m) => ({ ...m, type: "Maladie" as const }))]}
                    groupBy={(o) => (o.type === "Maladie" ? "Maladies" : "Conditions physiologiques")} />
                </Card>
                <Card title="3. Allergies (optionnel)">
                  <MultiSelect height="max-h-44" options={refs.data!.molecules} value={allergies} onChange={setAllergies} />
                </Card>
              </div>
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Card title={<>Résultat de l'analyse {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}</>}>
                {error && <ErrorBox message={error} />}
                {result ? <RiskPanel analyse={result} /> : (
                  <div className="flex flex-col items-center py-10 text-center text-sm text-slate-500">
                    <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><ShieldCheck className="h-7 w-7" /></span>
                    Sélectionnez au moins un médicament pour lancer la vérification.
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
