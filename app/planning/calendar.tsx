'use client';
import { DeletePlanning } from './controls';
import { PlanningMachinePicker } from './machine-picker';
import { AssignmentFields, assignmentLabel } from './assignment';
import { useState } from 'react';
import type { Routine, RoutineDone, Teammate, PlanView } from '../../lib/planning/types';
import { routineOccurs, planningMachines } from '../../lib/planning/routines-client';
import { interventionToday } from '../../lib/interventions/types';
import type { MaintenanceModel } from '../maintenance/use-maintenance';
export function RoutineCalendar({ model, routines, done, teammates = [], plans = [], canCreate = true, canManage = false, readOnly = false, onOpenPlan, onReportPlan, onSaved }: {
    model: MaintenanceModel;
    routines: Routine[];
    done: RoutineDone[];
    teammates?: Teammate[];
    plans?: PlanView[];
    canCreate?: boolean;
    canManage?: boolean;
    readOnly?: boolean;
    onOpenPlan?: (plan: PlanView) => void;
    onReportPlan?: (plan: PlanView) => void;
    onSaved: () => Promise<void>;
}) {
    const [month, setMonth] = useState(() => interventionToday().slice(0, 7)), [draft, setDraft] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const first = new Date(month + '-01T12:00:00Z'), days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), offset = (first.getUTCDay() + 6) % 7;
    async function post(input: any) { if (busy)
        return; setBusy(true); setError(''); try {
        const response = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data: any = await response.json();
        if (response.status === 401 || response.status === 428) {
            model.onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        setDraft(null);
        await onSaved();
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
    finally {
        setBusy(false);
    } }
    function shift(delta: number) { const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)); setMonth(d.toISOString().slice(0, 7)); }
    return <section className="panel routine-calendar"><div className="panel-head"><div><h2>Calendrier des interventions</h2><small>Tâches récurrentes et interventions ponctuelles datées. Le bouton « Fait » ne crée pas de rapport et ne modifie pas le stock.</small></div>{canCreate && <button onClick={() => setDraft({ assignment: { mode: 'any', users: [] }, action: 'routine', clientId: crypto.randomUUID(), site: model.site, name: '', instructions: '', machine: '', machines: [], start: interventionToday(), frequency: 'weekly',emailReminder:'none' })}>Ajouter une tâche</button>}</div>
 <div className="calendar-nav"><button onClick={() => shift(-1)} aria-label="Mois précédent">Précédent</button><strong>{first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><button onClick={() => shift(1)} aria-label="Mois suivant">Suivant</button></div>
 {error && <p className="error" role="alert">{error}</p>}<div className="calendar-grid">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <strong className="calendar-weekday" key={day}>{day}</strong>)}{Array.from({ length: offset }, (_, i) => <div className="calendar-blank" key={'blank' + i}/>)}{Array.from({ length: days }, (_, i) => { const date = month + '-' + String(i + 1).padStart(2, '0'); return <div className={'calendar-day' + (date === interventionToday() ? ' today' : '')} key={date}><time dateTime={date}>{i + 1}</time><CalendarPlans plans={plans.filter(plan => plan.date === date)} teammates={teammates} onOpen={onOpenPlan} onReport={readOnly ? undefined : onReportPlan} onReadReport={onReportPlan}/>{routines.filter(r => routineOccurs(r, date)).map(r => { const checked = done.find(d => d.routine === r.id && d.date === date); return <div className={'calendar-task' + (checked ? ' complete' : '')} key={r.id}><button disabled={!canCreate} className="task-title" onClick={() => setDraft({ ...r, action: 'routine' })}>{r.name}</button><small>{planningMachines(r).map(id => model.machines.find(m => m.id === id)?.name || 'Machine introuvable').join(', ')}</small><small>{assignmentLabel(r.assignment, teammates)}</small>{r.instructions && <details><summary>Consignes</summary><p className="plan-description">{r.instructions}</p></details>}{checked ? <small title={checked.actor + ' · ' + checked.completedAt}>✓ Fait</small> : <button disabled={readOnly || busy || date > interventionToday()} onClick={() => post({ action: 'routine-done', id: r.id, date })}>Fait</button>}</div>; })}</div>; })}</div>{!routines.length && !plans.some(plan => plan.date.startsWith(month)) && <p className="muted">Aucune tâche récurrente ou intervention datée pour ce mois.</p>}
 {canCreate && draft && <div className="overlay"><form className="modal" onSubmit={e => { e.preventDefault(); post(draft); }}><div className="panel-head"><h2>{draft.id ? 'Modifier' : 'Ajouter'} une tâche récurrente</h2><button type="button" disabled={busy} onClick={() => setDraft(null)}>Fermer</button></div><fieldset className="report-fields" disabled={busy}><label>Tâche *<input required maxLength={150} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><PlanningMachinePicker machines={model.machines} value={draft} onChange={machines => setDraft({ ...draft, machines })}/><label>Première occurrence *<input required type="date" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })}/></label><label>Récurrence<select value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value })}><option value="daily">Tous les jours</option><option value="weekly">Chaque semaine, le même jour</option><option value="monthly">Chaque mois, le même jour</option></select></label><label>Précisions pour réaliser la tâche<textarea maxLength={10000} value={draft.instructions || ''} onChange={e => setDraft({ ...draft, instructions: e.target.value })}/></label><AssignmentFields value={draft.assignment} teammates={teammates} onChange={assignment => setDraft({ ...draft, assignment })}/><label>Rappels par mail<select value={draft.emailReminder || 'none'} onChange={e=>setDraft({...draft,emailReminder:e.target.value})}><option value="none">Aucun rappel</option><option value="same">Le jour même</option><option value="before">La veille</option><option value="both">La veille et le jour même</option></select><small>À 8 h, heure de Paris, aux personnes affectées dont l’adresse est confirmée. Sans destinataire pour « N’importe qui ».</small></label><small>« Fait » valide cette occurrence pour toutes les machines sélectionnées. Pour les mois plus courts, une tâche prévue le 29, 30 ou 31 revient le dernier jour du mois.</small></fieldset>{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>Enregistrer</button>{canManage && draft.id && <DeletePlanning model={model} item={draft} kind="routine" onDeleted={async () => { setDraft(null); await onSaved(); }}/>}</form></div>}
 </section>;
}

function CalendarPlans({ plans, teammates, onOpen, onReport, onReadReport }: { plans: PlanView[]; teammates: Teammate[]; onOpen?: (plan: PlanView) => void; onReport?: (plan: PlanView) => void; onReadReport?: (plan: PlanView) => void }) {
    return <>{[...plans].sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt)).map(plan => <div key={plan.id} className={'calendar-task calendar-plan' + (plan.status === 'done' ? ' complete' : '')}>
        <small>Intervention ponctuelle{plan.time ? ' · ' + plan.time : ' · Heure libre'}</small>
        <button className="task-title" onClick={() => onOpen?.(plan)}>{plan.name}</button>
        <small>{plan.machineName}</small><small>{assignmentLabel(plan.assignment, teammates)}</small>
        <span className={'service-badge ' + (plan.status === 'done' || plan.ready ? 'running' : 'stopped')}>{plan.status === 'done' ? '✓ Réalisée' : plan.ready ? '● Réalisable' : '● En attente'}</span>
        {plan.status === 'planned' && plan.blockers.map(blocker => <small className="red" key={blocker}>{blocker}</small>)}
        {(onReport || plan.status === 'done') && <button onClick={() => (plan.status === 'done' ? onReadReport || onReport : onReport)?.(plan)}>{plan.status === 'done' ? 'Voir le rapport' : 'Intervention réalisée'}</button>}
    </div>)}</>;
}
