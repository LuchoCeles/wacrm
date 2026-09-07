const DEFAULT_STAGE_NAMES: Record<string, string> = {
  "New Lead": "Nuevo cliente potencial",
  Qualified: "Calificado",
  "Proposal Sent": "Propuesta enviada",
  Negotiation: "Negociación",
  Won: "Ganado",
};

/** Translate only the built-in stage names; custom names remain untouched. */
export function displayPipelineStageName(name: string): string {
  return DEFAULT_STAGE_NAMES[name] ?? name;
}

/** Translate the legacy name used by the built-in starter pipeline. */
export function displayPipelineName(name: string): string {
  return name === "Sales Pipeline" || name === "Embudo de ventas"
    ? "Proceso de ventas"
    : name;
}
