'use client';
import type { MaintenanceModel } from './use-maintenance';
export function PartFields({ model }: { model: MaintenanceModel }) {
  const { modal, setModal, machines } = model;
  const set = (key: string, value: unknown) => setModal({ ...modal, [key]: value });
  return <>
    <label>Référence<input maxLength={200} value={modal.reference || ''} onChange={e => set('reference', e.target.value)} /></label>
    <label>Fournisseur<input maxLength={200} value={modal.supplier || ''} onChange={e => set('supplier', e.target.value)} /></label>
    <label>Emplacement<input maxLength={200} value={modal.location || ''} onChange={e => set('location', e.target.value)} /></label>
    {!modal.id && <label>Quantité ajoutée au stock *<input required type="number" min="0" max="1000000" step="1" value={modal.quantity ?? 1} onChange={e => set('quantity', e.target.value === '' ? '' : Number(e.target.value))} /></label>}
    <fieldset><legend>Machines compatibles</legend>{machines.filter(m => !m.archived).map(machine => <label className="check" key={machine.id}><input type="checkbox" checked={modal.machines?.includes(machine.id) || false} onChange={e => set('machines', e.target.checked ? [...(modal.machines || []), machine.id] : (modal.machines || []).filter((id: string) => id !== machine.id))} />{machine.name}</label>)}</fieldset>
    <p className="muted">Le minimum se règle dans le tableau du magasin. Les quantités évoluent par les entrées, les sorties et les réceptions de commandes.</p>
  </>;
}
