import {
  Baby, Building2, FlaskConical, HeartPulse, Stethoscope, Store, UsersRound, type LucideIcon,
} from "lucide-react";
import { referentielsApi } from "../../../api/services";
import type { RefSpec } from "../../../api/types";
import { useAsync } from "../../../hooks/useAsync";

export const REF_ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope, "users-round": UsersRound, store: Store, "heart-pulse": HeartPulse, baby: Baby,
  "flask-conical": FlaskConical, "building-2": Building2,
};

/** Spécification d'un référentiel (champs, relations) fournie par le back-end : les pages s'y adaptent. */
export function useRefSpec(type: string) {
  const specs = useAsync(() => referentielsApi.specs(), []);
  const spec: RefSpec | undefined = specs.data?.find((s) => s.type === type);
  return { spec, loading: specs.loading, error: specs.error, reload: specs.reload };
}

export const CLASS_TONES: Record<string, string> = {
  Pharmacien: "chip-indigo", Infirmier: "chip-sky", Medecin: "chip-brand",
};
