
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Settings, Search, ClipboardList } from 'lucide-react';
import type { FormDefinition, Intervention, Answer, WaitingOrder } from '../../lib/interventions/types';
import { interventionStart, isFutureIntervention } from '../../lib/interventions/types';
import { ReportForm } from './report-form';
import { FormEditor } from './form-editor';
import { ReportDetails } from './report-details';
const display = (value: Answer | undefined) => Array.isArray(value) ? value.join(', ') : value || '—';
export function InterventionHistory({ site, siteName, machine, userRole, readOnly = false, onSessionChanged, onStockChanged }: { readOnly?: boolean; site: string; siteName: string; machine?: string; userRole: string; onSessionChanged: () => void; onStockChanged?: () => void | Promise<void> }) {
  const [orders, setOrders] = useState<WaitingOrder[]>([]);
  const [editingReport, setEditingReport] = useState<Intervention | null>(null);
  const [notice, setNotice] = useState('');
  const [allSites, setAllSites] = useState(false);
  const requestNumber = useRef(0);
  const [reports, setReports] = useState<Intervention[]>([]), [machines, setMachines] = useState<{ id: string; name: string; archived?: boolean }[]>([]), [form, setForm] = useState<FormDefinition | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [creating, setCreating] = useState(false), [editing, setEditing] = useState(false), [selected, setSelected] = useState<Intervention | null>(null), [query, setQuery] = useState(''), [filter, setFilter] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const load = useCallback(async () => {
    const number = ++requestNumber.current;
    try {
      const response = await fetch(`/api/interventions?site=${encodeURIComponent(allSites ? 'all' : site)}${machine ? '&machine=' + encodeURIComponent(machine) : ''}`);
      const data: any = await response.json();
      if (number !== requestNumber.current) return;
      if (response.status === 401 || response.status === 428) {
        onSessionChanged();
        return
      }
      if (!response.ok) throw Error(data.error);
      setReports(data.interventions);
      setOrders(data.orders || []);
      setMachines(data.machines);
      setForm(data.form);
      setError('');
    } catch (cause) {
      if (number === requestNumber.current) setError(cause instanceof Error ? cause.message : 'Chargement impossible.')
    } finally {
      if (number === requestNumber.current) setLoading(false)
    }
  }, [site, machine, onSessionChanged, allSites]);
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => { clearInterval(interval); requestNumber.current++; };
  }, [load]);
  const filtered = reports.filter(r => (!filter || r.machines.some(m => m.id === filter)) && (!from || r.date >= from) && (!to || r.date <= to) && (!query || [...Object.values(r.answers).map(v => display(v)), ...r.machines.map(m => m.name), ...(r.parts || []).map(p => p.name + ' ' + p.reference), r.actor].join(' ').toLowerCase().includes(query.toLowerCase())));
  return <section className="panel intervention-history"><div className="panel-head"><div><h2>{machine ? 'Interventions de cette machine' : 'Interventions · ' + (allSites ? 'Tous les sites' : siteName)}</h2><small>{filtered.length} rapport(s)</small></div><div className="actions">{['admin', 'director'].includes(userRole) && <button onClick={() => setEditing(true)} disabled={!form}><Settings size={16} />Modifier le formulaire</button>}{!readOnly && <button className="primary" disabled={!form} onClick={() => setCreating(true)}><Plus size={17} />Nouvelle intervention</button>}</div></div>
    {!machine && ['admin', 'director'].includes(userRole) && <label className="toggle"><input type="checkbox" checked={allSites} onChange={e => {
      setAllSites(e.target.checked);
      setFilter('')
    }} />Toutes les interventions des sites</label>}
    <div className="history-filters"><div className="search"><Search size={17} /><input placeholder="Rechercher dans les rapports…" value={query} onChange={e => setQuery(e.target.value)} /></div>{!machine && <label>Machine<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Toutes les machines</option>{machines.map(m => <option key={m.id} value={m.id}>{m.name}{m.archived ? ' (archivée)' : ''}</option>)}</select></label>}<label>Du<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Au<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="error">{error}<button onClick={load}>Réessayer</button></p>}{loading ? <p>Chargement des interventions…</p> : filtered.length === 0 ? <div className="empty">Aucune intervention pour cette sélection.</div> : <div className="table-wrap"><table><thead><tr><th>Date / heure</th>{allSites&&<th>Site</th>}<th>Machines</th><th>Type</th><th>Techniciens</th><th>Durée</th><th>Travaux réalisés</th><th /></tr></thead><tbody>{filtered.map(report => <tr key={report.id}><td>{new Date(report.date + 'T12:00:00').toLocaleDateString('fr-FR')} · {interventionStart(report) || 'Heure non renseignée'}{isFutureIntervention(report) && <small className="error">Date future — à corriger</small>}</td>{allSites&&<td>{report.siteName||report.site}</td>}<td>{report.machines.map(m => m.name).join(', ')}</td><td>{display(report.answers.type)}</td><td>{display(report.answers.technicians)}</td><td>{report.duration === null ? '—' : `${Math.floor(report.duration / 60)} h ${report.duration % 60} min`}</td><td className="work-preview">{display(report.answers.work)}</td><td><button onClick={() => setSelected(report)}><ClipboardList size={15} />Consulter</button></td></tr>)}</tbody></table></div>}
    {!readOnly && creating && form && <ReportForm orders={orders} form={form} site={site} siteName={siteName} machines={machines.filter((m: any) => !m.site || m.site === site)} selectedMachine={machine} onSessionChanged={onSessionChanged} onClose={() => setCreating(false)} onRefresh={load} onSaved={async result => {
      setNotice('Rapport enregistré. ' + result.stockUpdates.map(p => `${p.name} ${p.reference} : −${p.quantityUsed}, stock restant : ${p.remaining}`).join(' ; '));
      await Promise.all([load(), onStockChanged?.()]);
      setCreating(false);
    }} />}
    {editing && form && <FormEditor form={form} onSessionChanged={onSessionChanged} onClose={() => setEditing(false)} onSaved={() => {
      setEditing(false);
      load()
    }} />}
    {!readOnly && editingReport && <ReportForm key={editingReport.id} initialReport={editingReport} orders={orders} form={{version:0,questions:editingReport.questions}} site={editingReport.site} siteName={editingReport.siteName || siteName} machines={machines.filter((m:any) => !m.site || m.site === editingReport.site)} onSessionChanged={onSessionChanged} onRefresh={load} onClose={() => setEditingReport(null)} onSaved={async () => {
      setEditingReport(null); setNotice('Rapport modifié. Le stock et l’état des machines ont été actualisés.');
      await Promise.all([load(),onStockChanged?.()]);
    }} />}
    {selected && <ReportDetails onEdit={() => {setEditingReport(selected);setSelected(null);}} report={selected} onClose={() => setSelected(null)} onSessionChanged={onSessionChanged} onDeleted={async result => {
      setReports(previous => previous.filter(report => report.id !== result.id));
      setSelected(null);
      setNotice('Rapport supprimé. ' + (result.stockRestored.length ? result.stockRestored.map(p => `${p.name} ${p.reference} : +${p.quantityRestored}, stock restant : ${p.remaining}`).join(' ; ') : 'Aucun prélèvement de stock à annuler.'));
      await Promise.all([load(), onStockChanged?.()]);
    }} />}
  </section>;
}
