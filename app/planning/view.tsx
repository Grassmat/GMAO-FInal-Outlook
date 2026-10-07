'use client';
import { planningSchedule } from '../../lib/planning/routines-client';
import { DeletePlanning } from './controls';
import { assignmentLabel } from './assignment';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { MaintenanceModel } from '../maintenance/use-maintenance';
import type { PlanView, Routine, RoutineDone, Teammate } from '../../lib/planning/types';
import type { FormDefinition, WaitingOrder, Intervention } from '../../lib/interventions/types';
import { PlanEditor } from './editor';
import { RoutineCalendar } from './calendar';
import { ReportForm } from '../interventions/report-form';
import { ReportDetails } from '../interventions/report-details';
export function PlanningView({ model }: {
    model: MaintenanceModel;
}) {
    const [plans, setPlans] = useState<PlanView[]>([]), [routines, setRoutines] = useState<Routine[]>([]), [done, setDone] = useState<RoutineDone[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [editor, setEditor] = useState<PlanView | true | null>(null), [selected, setSelected] = useState<PlanView | null>(null), [archived, setArchived] = useState(false);
    const [report, setReport] = useState<{
        plan: PlanView;
        form: FormDefinition;
        orders: WaitingOrder[];
    } | null>(null), [historyReport, setHistoryReport] = useState<Intervention | null>(null);
    const [teammates, setTeammates] = useState<Teammate[]>([]);
    const [access, setAccess] = useState({ canCreate: false, canManage: false });
    const [mailEnabled,setMailEnabled]=useState(true);
    const sequence = useRef(0);
    const load = useCallback(async () => { const current = ++sequence.current; try {
        const response = await fetch('/api/planning?site=' + encodeURIComponent(model.site));
        const data: any = await response.json();
        if (current !== sequence.current)
            return;
        if (response.status === 401 || response.status === 428) {
            model.onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        setMailEnabled(data.mailReady===true);
        setAccess(data.access || { canCreate: false, canManage: false });
        setTeammates(data.teammates || []);
        setPlans(data.plans);
        setRoutines(data.routines);
        setDone(data.done);
        setError('');
    }
    catch (cause) {
        if (current === sequence.current)
            setError(cause instanceof Error ? cause.message : 'Planning indisponible.');
    }
    finally {
        if (current === sequence.current)
            setLoading(false);
    } }, [model.site, model.onSessionChanged]);
    useEffect(() => { load(); const timer = setInterval(load, 10000); return () => { clearInterval(timer); sequence.current++; }; }, [load]);
    async function openReport(plan: PlanView) { try {
        const response = await fetch('/api/interventions?site=' + encodeURIComponent(model.site));
        const data: any = await response.json();
        if (response.status === 401 || response.status === 428) {
            model.onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        if (plan.status === 'done') {
            const r = data.interventions.find((r: Intervention) => r.id === plan.reportId);
            if (!r)
                throw Error('Rapport introuvable ou supprimé. Rechargez le planning.');
            setHistoryReport(r);
        }
        else
            setReport({ plan, form: data.form, orders: data.orders || [] });
        setSelected(null);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Rapport indisponible.');
    } }
    const shown = plans.filter(p => (p.status === 'done') === archived);
    return <>{!loading&&!mailEnabled&&<p className="panel muted">L’envoi des alertes et rappels par mail sera disponible après activation du service mail.</p>}<div className="planning-layout"><RoutineCalendar canCreate={access.canCreate} canManage={access.canManage} readOnly={model.readOnly} plans={plans} onOpenPlan={setSelected} onReportPlan={openReport} teammates={teammates} model={model} routines={routines} done={done} onSaved={load}/><section className="panel punctual-plans"><div className="panel-head"><div><h2>Interventions ponctuelles</h2><small>Disponibilité actuelle, sans réservation de stock.</small></div>{access.canCreate && <button className="primary" onClick={() => setEditor(true)}>Planifier</button>}</div><label className="toggle"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)}/>Afficher les interventions réalisées</label>{error && <p className="error" role="alert">{error}<button onClick={load}>Réessayer</button></p>}{loading ? <p>Chargement…</p> : !shown.length ? <p className="empty">{archived ? 'Aucune intervention réalisée.' : 'Aucune intervention planifiée.'}</p> : shown.map(plan => <article className="planned-card" key={plan.id}><div className="panel-head"><button className="plan-title" onClick={() => setSelected(plan)}>{plan.name}</button><span className={'service-badge ' + (plan.status === 'done' ? 'running' : plan.ready ? 'running' : 'stopped')}>{plan.status === 'done' ? '✓ Réalisée' : plan.ready ? '● Réalisable' : '● En attente'}</span></div><p>{planningSchedule(plan)} · {plan.machineName}</p><p>Affectation : {assignmentLabel(plan.assignment, teammates)}</p>{plan.status !== 'done' && plan.blockers.map(b => <small className="red" key={b}>{b}</small>)}{(!model.readOnly || plan.status === 'done') && <button onClick={() => openReport(plan)}>{plan.status === 'done' ? 'Voir le rapport' : 'Intervention réalisée — remplir le rapport'}</button>}{access.canManage && <DeletePlanning model={model} item={plan} kind="plan" onDeleted={load}/>}</article>)}
 {access.canCreate && editor && <PlanEditor teammates={teammates} model={model} initial={editor === true ? undefined : editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await load(); }}/>}
 {selected && <div className="overlay"><div className="modal intervention-modal"><div className="panel-head"><h2>{selected.name}</h2><button onClick={() => setSelected(null)}>Fermer</button></div><p>{planningSchedule(selected)} · {selected.machineName}</p><p>Affectation : {assignmentLabel(selected.assignment, teammates)}</p><p className="plan-description">{selected.work || 'Aucun travail précisé.'}</p>{selected.instructions && <><h3>Précisions pour réaliser la tâche</h3><p className="plan-description">{selected.instructions}</p></>}<h3>Pièces / devis requis</h3>{!selected.requirements.length ? <p>Aucune pièce particulière requise.</p> : selected.requirements.map((r, i) => <p key={i}>{model.records.find(p => p.id === (r.part || r.order))?.name || 'Référence absente'} · quantité {r.quantity}{r.order ? ' · devis associé' : ''}</p>)}{selected.equipment && <p>Équipement : {selected.equipment} — {selected.equipmentReady ? 'disponible' : 'indisponible'}</p>}{selected.status === 'planned' && selected.blockers.map(b => <p className="red" key={b}>{b}</p>)}<div className="actions">{access.canCreate && selected.status === 'planned' && <button onClick={() => { setEditor(selected); setSelected(null); }}>Modifier la planification</button>}{(!model.readOnly || selected.status === 'done') && <button className="primary" onClick={() => openReport(selected)}>{selected.status === 'done' ? 'Voir le rapport' : 'Intervention réalisée'}</button>}{access.canManage && <DeletePlanning model={model} item={selected} kind="plan" onDeleted={async () => { setSelected(null); await load(); }}/>}</div></div></div>}
 {!model.readOnly && report && <ReportForm key={report.plan.id} initialPlan={report.plan} form={report.form} orders={report.orders} site={model.site} siteName={model.sites.find(s => s.id === model.site)?.name || ''} machines={model.machines} onClose={() => setReport(null)} onSessionChanged={model.onSessionChanged} onRefresh={load} onSaved={async () => { setReport(null); await Promise.all([load(), model.refresh()]); }}/>}
 {historyReport && <ReportDetails report={historyReport} onClose={() => setHistoryReport(null)} onSessionChanged={model.onSessionChanged} onDeleted={async () => { setHistoryReport(null); await Promise.all([load(), model.refresh()]); }}/>}
 </section></div></>;
}
