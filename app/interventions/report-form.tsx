'use client';
import { planningMachines, planningSchedule } from '../../lib/planning/routines-client';

import { useEffect, useRef, useState } from 'react';
import type { Question, Answer, FormDefinition, PartUsageInput, InterventionSaveResult, Intervention, WaitingOrder } from '../../lib/interventions/types';
import { WaitingQuote } from './waiting-quote';
import type { Draft } from '../../lib/maintenance/types';
import { plannedInterventionAnswers, hiddenPreventiveQuestion, interventionToday, isFutureIntervention, interventionDuration } from '../../lib/interventions/types';
import type { PlanView } from '../../lib/planning/types';
import { PartsPicker } from './parts-picker';
export function ReportForm({ form, site, siteName, machines, selectedMachine, onSaved, onClose, onSessionChanged, onRefresh, initialReport, initialPlan, orders = [] }: { initialPlan?: PlanView; initialReport?: Intervention; orders?: WaitingOrder[]; form: FormDefinition; site: string; siteName: string; machines: { id: string; name: string; archived?: boolean }[]; selectedMachine?: string; onSaved: (result: InterventionSaveResult) => void | Promise<void>; onClose: () => void; onSessionChanged: () => void; onRefresh: () => void }) {
  const [id] = useState(() => initialReport?.id || crypto.randomUUID());
  const [editToken] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState<string[]>(initialReport ? initialReport.machines.map(m => m.id) : initialPlan ? planningMachines(initialPlan) : selectedMachine ? [selectedMachine] : []);
  const [answers, setAnswers] = useState<Record<string, Answer>>((): Record<string, Answer> => {
    if (initialReport) return { ...initialReport.answers };
    const now = new Date();
    return { ...(form.questions.some(q => q.id === 'date' && q.type === 'date') ? { date: interventionToday(now) } : {}), ...(initialPlan ? {...plannedInterventionAnswers(form.questions),work:initialPlan.work} : {}) }
  });
  const [stale, setStale] = useState(false);
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [parts, setParts] = useState<PartUsageInput[]>(initialReport?.parts || initialPlan?.parts || []);
  const [keepFiles, setKeepFiles] = useState<string[]>(initialReport?.files.map(f => f.id) || []);
  const [machineService, setMachineService] = useState(initialReport?.machine_service || String(initialReport?.answers.service || ''));
  const [waiting, setWaiting] = useState(!!(initialReport?.waiting_note || initialReport?.waiting_order));
  const [waitingNote, setWaitingNote] = useState(initialReport?.waiting_note || '');
  const [waitingOrder, setWaitingOrder] = useState(initialReport?.waiting_order || '');
  const [newOrder,setNewOrder]=useState<Draft|null>(null);
  const [savedReceipt,setSavedReceipt]=useState<InterventionSaveResult|null>(null);
  const [plan,setPlan]=useState<PlanView|null>(initialPlan || null);
  const [plans,setPlans]=useState<PlanView[]>([]),[planError,setPlanError]=useState('');
  useEffect(()=>{if(initialReport)return;let active=true;(async()=>{try{const response=await fetch('/api/planning?site='+encodeURIComponent(site));const data:any=await response.json();if(!active)return;if(response.status===401||response.status===428){onSessionChanged();return;}if(!response.ok)throw Error(data.error);setPlans(data.plans.filter((p:PlanView)=>p.status==='planned'));setPlanError('');}catch(cause){if(active)setPlanError(cause instanceof Error?cause.message:'Planning indisponible.');}})();return()=>{active=false;};},[site,initialReport,onSessionChanged]);
  function choosePlan(value:string){const next=plans.find(p=>p.id===value)||null;setPlan(next);if(next){setSelected(planningMachines(next));setParts(next.parts);setAnswers(prev=>({...prev,...plannedInterventionAnswers(form.questions),work:next.work}));}}
  const set = (q: Question, value: Answer) => setAnswers(prev => ({ ...prev, [q.id]: value }));
  const duration = interventionDuration(answers);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!selected.length) {
      setError('Choisissez au moins une machine.');
      return
    }
    const files = Object.values(photos).flat();
    if (files.length + keepFiles.length > 5 || files.some(f => f.size > 5 * 1024 * 1024)) {
      setError('Cinq photos maximum, de 5 Mo chacune.');
      return
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (!savedReceipt && machineService === 'Non' && waiting && newOrder?.pdfFile) {
        const file=newOrder.pdfFile;
        if (!file.name.toLowerCase().endsWith('.pdf') || !file.size || file.size > 20 * 1024 * 1024 || new TextDecoder().decode(await file.slice(0,5).arrayBuffer()) !== '%PDF-')
          throw Error('Choisissez un PDF valide, non vide, de 20 Mo maximum.');
      }
      let data: InterventionSaveResult;
      if(savedReceipt) data=savedReceipt;
      else {
      const payload = new FormData();
      payload.set('payload', JSON.stringify({ id, site, planId:!initialReport ? plan?.id : undefined, planRevision:plan?.revision, machines: selected, version: form.version, revision:initialReport?.revision, editToken, keepFiles, machineService:machineService || null, waitingNote:waiting ? waitingNote : '', waitingOrder:waiting && !newOrder ? waitingOrder : '', newOrder:machineService === 'Non' && waiting && newOrder ? {...newOrder,pdfFile:undefined,documentId:undefined} : undefined, answers: { ...answers, ...(form.questions.some(q => q.id === 'service' && q.type === 'select' && q.options.includes('Oui') && q.options.includes('Non')) ? {service:machineService} : {}) }, parts }));
      for (const [field, list] of Object.entries(photos).filter(([field]) => form.questions.some(q => q.id === field && q.type === 'photos'))) for (const file of list) payload.append('photo:' + field, file);
      const response = await fetch('/api/interventions', { method: initialReport ? 'PATCH' : 'POST', body: payload });
      const responseData: any = await response.json();
      if (response.status === 401 || response.status === 428) {
        onSessionChanged();
        return
      }
      if (response.status === 409) setStale(true);
      if (!response.ok) throw new Error(responseData.error);
      data=responseData;
      setSavedReceipt(data);
      }
      if(data.orderId && newOrder?.pdfFile) {
        const document=new FormData();document.set('order',data.orderId);document.set('file',newOrder.pdfFile);document.set('uploadId',newOrder.documentId!);
        const uploaded=await fetch('/api/order-documents',{method:'POST',body:document});const result: any=await uploaded.json();
        if(uploaded.status===401||uploaded.status===428){onSessionChanged();return;}
        if(!uploaded.ok){onRefresh();throw Error('Rapport et devis enregistrés, mais le PDF n’a pas été ajouté. Réessayez l’envoi du PDF. '+(result.error || ''));}
      }
      await onSaved(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      submitting.current = false;
      setBusy(false)
    }
  }
  return <div className="overlay"><form className="modal intervention-modal" onSubmit={submit}><div className="panel-head"><h2>{initialReport ? 'Modifier le rapport' : 'Nouvelle intervention'}</h2><button type="button" disabled={busy} onClick={onClose}>Fermer</button></div>
    <p className="muted">Site : {siteName}</p>{initialReport && isFutureIntervention(initialReport) && <p className="error">Ce rapport est daté dans le futur. Corrigez sa date : il ne détermine pas l’état actuel des machines.</p>}
    {!initialReport && <fieldset disabled={busy || !!savedReceipt}><legend>Intervention planifiée (facultatif)</legend><label>Relier ce rapport au planning<select value={plan?.id || ''} onChange={e=>choosePlan(e.target.value)}><option value="">Rapport sans intervention planifiée</option>{plans.map(p=><option key={p.id} value={p.id}>{planningSchedule(p)} · {p.machineName} · {p.name}</option>)}{plan&&!plans.some(p=>p.id===plan.id)&&<option value={plan.id}>{plan.name}</option>}</select></label>{plan&&<small>À l’enregistrement du rapport, « {plan.name} » sera archivée comme réalisée. Vérifiez les travaux réellement effectués et les pièces réellement utilisées avant de confirmer.</small>}{plan?.instructions && <div><strong>Précisions pour réaliser la tâche</strong><p className="plan-description">{plan.instructions}</p></div>}{planError&&<small className="error">{planError}</small>}</fieldset>}
    <fieldset disabled={busy || !!savedReceipt}><legend>Machines concernées *</legend>{machines.filter(m => !m.archived || initialReport?.machines.some(old => old.id === m.id)).map(machine => <label key={machine.id} className="check"><input type="checkbox" checked={selected.includes(machine.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, machine.id] : prev.filter(id => id !== machine.id))} />{machine.name}</label>)}</fieldset>
    <fieldset className="report-fields" disabled={busy || !!savedReceipt}>
    {form.questions.map(question => {
      if (hiddenPreventiveQuestion(question, answers)) return null;
      if (question.id === 'service' && question.type === 'select' && question.options.includes('Oui') && question.options.includes('Non')) return null;
      const value = answers[question.id] ?? (question.type === 'multiselect' ? [] : '');
      if (question.type === 'multiselect') return <fieldset key={question.id}><legend>{question.label}{question.required ? ' *' : ''}</legend>{question.options.map(option => <label key={option} className="check"><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={e => {
        const list = Array.isArray(value) ? value : [];
        set(question, e.target.checked ? [...list, option] : list.filter(v => v !== option))
      }} />{option}</label>)}</fieldset>;
      if (question.type === 'photos') return <div key={question.id}><label>{question.label}{question.required ? ' *' : ''}<input type="file" accept="image/jpeg,image/png,image/webp" multiple required={question.required && !initialReport?.files.some(f => f.field === question.id && keepFiles.includes(f.id)) && !(Array.isArray(value) && value.some(link => link.startsWith('https://')))} onChange={e => setPhotos(prev => ({ ...prev, [question.id]: Array.from(e.target.files || []) }))} /><small>JPEG, PNG ou WebP · 5 Mo par photo · 5 photos au total, en comptant celles conservées.</small></label>
        <div className="report-existing-photos">{initialReport?.files.filter(f => f.field === question.id).map(file => <label key={file.id}><img src={`/api/interventions/${id}/files/${file.id}`} alt={file.name} /><span><input type="checkbox" checked={keepFiles.includes(file.id)} onChange={e => setKeepFiles(prev => e.target.checked ? [...prev,file.id] : prev.filter(id => id !== file.id))} />Conserver {file.name}</span></label>)}</div>
        {Array.isArray(initialReport?.answers[question.id]) && (initialReport.answers[question.id] as string[]).filter(link => link.startsWith('https://')).map(link => <label key={link} className="check"><input type="checkbox" checked={Array.isArray(value) && value.includes(link)} onChange={e => set(question,e.target.checked ? [...(Array.isArray(value) ? value : []),link] : (Array.isArray(value) ? value.filter(v => v !== link) : []))} /><a href={link} target="_blank" rel="noreferrer">Conserver la photo historique</a></label>)}
      </div>;
      return <label key={question.id}>{question.label}{question.required ? ' *' : ''}
        {question.type === 'textarea' ? <textarea rows={3} required={question.required} maxLength={10000} value={String(value)} onChange={e => set(question, e.target.value)} /> : question.type === 'select' ? <select required={question.required} value={String(value)} onChange={e => set(question, e.target.value)}><option value="">Choisir…</option>{question.options.map(option => <option key={option}>{option}</option>)}</select> : <input type={question.type} max={question.type === 'date' && question.id === 'date' ? interventionToday() : undefined} step={question.type === 'number' ? 'any' : undefined} required={question.required} maxLength={10000} value={String(value)} onChange={e => set(question, e.target.value)} />}{question.id === 'parts' && question.type === 'textarea' && <small>Précisions uniquement. Pour déduire le stock, choisissez les références dans « Pièces utilisées » ci-dessous.</small>}</label>;
    })}
    </fieldset>
    <fieldset className="report-state" disabled={busy || !!savedReceipt}><legend>État des machines concernées</legend>
      <label>Machine remise en service *<select required value={machineService} onChange={e => setMachineService(e.target.value)}><option value="">Choisir…</option><option value="Oui">Oui — en service</option><option value="Non">Non — hors service</option></select></label>
      {selected.length > 1 && <small>Cet état s’applique à toutes les machines cochées.</small>}
      {machineService === 'Non' && <><label className="check"><input type="checkbox" checked={waiting} onChange={e => setWaiting(e.target.checked)} />Arrêt en attente d’une pièce</label>
        {waiting && <><label>Pièce attendue / précision *<textarea required maxLength={1000} rows={2} value={waitingNote} placeholder="Ex. roulement 6200 commandé, indisponible au magasin" onChange={e => setWaitingNote(e.target.value)} /></label>
          {newOrder ? <><WaitingQuote site={site} machines={machines} draft={newOrder} onChange={setNewOrder} onSessionChanged={onSessionChanged}/><button type="button" onClick={()=>setNewOrder(null)}>Annuler le nouveau devis</button></> : <><button type="button" onClick={()=>{setWaitingOrder('');setNewOrder({kind:'order',site,clientId:crypto.randomUUID(),name:waitingNote.slice(0,150),orderMode:'new',quantity:1,status:'Devis',machine:selected.length===1?selected[0]:''} as Draft);}}>Créer un devis pour cette pièce</button>
          <label>Devis ou commande associé (facultatif)<select value={waitingOrder} onChange={e => setWaitingOrder(e.target.value)}><option value="">Sans devis ou commande associé</option>{orders.filter(o => o.site === site).map(order => <option value={order.id} key={order.id}>{order.name} · {order.reference || 'Sans référence'} · {order.supplier || 'Fournisseur non renseigné'} · {order.status}</option>)}</select></label></>}<small>La réception de la pièce ne remet pas automatiquement la machine en service. Confirmez sa remise en service dans un rapport.</small></>}
      </>}
    </fieldset>
    <PartsPicker baseline={initialReport?.parts} site={site} machines={selected} value={parts} onChange={setParts} onSessionChanged={onSessionChanged} disabled={busy || !!savedReceipt} />
    {duration !== null && form.questions.some(q => q.id === 'start' && q.type === 'time') && form.questions.some(q => q.id === 'end' && q.type === 'time') && <p className="duration">Durée calculée : {Math.floor(duration / 60)} h {duration % 60} min<small>Si la fin précède le début, elle est considérée comme le lendemain.</small></p>}
    {error && <p role="alert" className="error">{error}</p>}{stale && <button type="button" onClick={() => {
      onRefresh();
      if (initialReport) {onClose();return;}
      setStale(false);
      setError('')
    }}>{initialReport ? 'Fermer pour recharger le rapport' : 'Actualiser le formulaire en conservant mes réponses'}</button>}<button className="primary" disabled={busy}>{busy ? 'Enregistrement…' : savedReceipt ? 'Réessayer l’envoi du PDF' : initialReport ? 'Enregistrer les modifications' : 'Enregistrer le rapport'}</button></form></div>;
}
