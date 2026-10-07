
export const questionTypes = ['text', 'textarea', 'select', 'multiselect', 'date', 'time', 'number', 'photos'] as const;
export type QuestionType = typeof questionTypes[number];
export type Question = { id: string; label: string; type: QuestionType; required: boolean; options: string[] };
export type FormDefinition = { version: number; questions: Question[] };
export type Answer = string | string[];
export type PartUsageInput = { part: string | null; name?: string; reference?: string; quantity: number };
export type PartUsage = { part: string | null; name: string; reference: string; quantity: number };
export type StockPart = { id: string; name: string; reference: string; location: string; supplier: string; machines: string[]; quantity: number };
export type Intervention = { revision?: number; canEdit?: boolean; machine_service?: string | null; waiting_note?: string; waiting_order?: string | null; updated_at?: string | null; canDelete?: boolean; id: string; site: string; siteName?:string; created: string; actor: string; date: string; duration: number | null; answers: Record<string, Answer>; questions: Question[]; machines: { id: string; name: string }[]; files: { id: string; field: string; name: string; mime: string }[]; parts: PartUsage[]; source: string };
export const initialQuestions: Question[] = [
  { id: 'type', label: 'Type d’intervention', type: 'select', required: true, options: ['Préventive', 'Curative', 'Dépannage'] },
  { id: 'technicians', label: 'Techniciens intervenants', type: 'multiselect', required: true, options: [] },
  { id: 'date', label: 'Date de l’intervention', type: 'date', required: true, options: [] },
  { id: 'start', label: 'Heure de début', type: 'time', required: true, options: [] },
  { id: 'end', label: 'Heure de fin', type: 'time', required: true, options: [] },
  { id: 'fault', label: 'Description de la panne', type: 'textarea', required: false, options: [] },
  { id: 'diagnosis', label: 'Diagnostic', type: 'textarea', required: false, options: [] },
  { id: 'work', label: 'Travaux réalisés', type: 'textarea', required: true, options: [] },
  { id: 'parts', label: 'Pièces remplacées', type: 'textarea', required: false, options: [] },
  { id: 'service', label: 'Machine remise en service', type: 'select', required: true, options: ['Oui', 'Non'] },
  { id: 'photos', label: 'Photos (facultatif)', type: 'photos', required: false, options: [] },
];
export function interventionDuration(answers: Record<string, Answer>) {
  const start = answers.start, end = answers.end;
  if (typeof start !== 'string' || typeof end !== 'string' || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const result = minutes(end) - minutes(start);
  return result < 0 ? result + 1440 : result;
}

export function interventionStart(report: Pick<Intervention, 'answers' | 'questions'>): string {
  const start = report.answers.start;
  return report.questions.some(q => q.id === 'start' && q.type === 'time') && typeof start === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(start) ? start : '';
}
export function chronologicalInterventions(a: Intervention, b: Intervention): number {
  return b.date.localeCompare(a.date) || interventionStart(b).localeCompare(interventionStart(a)) || b.created.localeCompare(a.created) || b.id.localeCompare(a.id);
}
export type StockUpdate = { part: string; name: string; reference: string; quantityUsed: number; remaining: number };
export type InterventionSaveResult = { id: string; orderId?: string; stockUpdates: StockUpdate[] };

export type InterventionDeleteResult = { id: string; stockRestored: { part: string; name: string; reference: string; quantityRestored: number; remaining: number }[] };

export type WaitingOrder = { id: string; site: string; name: string; reference?: string; supplier?: string; status?: string; machine?: string };

export function interventionToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function isFutureIntervention(report: Pick<Intervention,'date'>, today = interventionToday()): boolean {
  return report.date > today;
}
export function currentInterventions(a: Intervention, b: Intervention): number {
  return Number(isFutureIntervention(a)) - Number(isFutureIntervention(b)) || chronologicalInterventions(a,b);
}

function preventiveOption(value: unknown) {
  return typeof value === 'string' && value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'preventive';
}
export function plannedInterventionAnswers(questions: Question[]): Record<string, Answer> {
  const type = questions.find(q => q.id === 'type' && ['select', 'multiselect'].includes(q.type));
  const option = type?.options.find(preventiveOption);
  return type && option ? { type: type.type === 'multiselect' ? [option] : option } : {};
}
export function isPreventiveIntervention(answers: Record<string, Answer>) {
  const value = answers.type;
  return (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).some(preventiveOption);
}
export function hiddenPreventiveQuestion(question: Question, answers: Record<string, Answer>) {
  return ['fault', 'diagnosis'].includes(question.id) && isPreventiveIntervention(answers);
}
