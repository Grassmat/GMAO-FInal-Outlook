'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { PartUsageInput, StockPart } from '../../lib/interventions/types';

export const normalizePartSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matchingParts(parts: StockPart[], query: string, machines: string[]) {
  const words = normalizePartSearch(query).trim().split(/\s+/).filter(Boolean);
  const compatible = (part: StockPart) => part.machines.some(id => machines.includes(id));
  return parts.filter(part => words.every(word => normalizePartSearch(`${part.name} ${part.reference} ${part.supplier} ${part.location}`).includes(word)))
    .sort((a, b) => Number(compatible(b)) - Number(compatible(a)) || a.name.localeCompare(b.name, 'fr'));
}

export function PartsPicker({ site, machines, value, onChange, onSessionChanged, disabled, baseline = [] }: {
  baseline?: PartUsageInput[]; site: string; machines: string[]; value: PartUsageInput[]; onChange: (value: PartUsageInput[]) => void;
  onSessionChanged: () => void; disabled: boolean;
}) {
  const [stock, setStock] = useState<StockPart[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const requestNumber = useRef(0);
  const load = useCallback(async () => {
    const number = ++requestNumber.current;
    try {
      const response = await fetch('/api/interventions/stock?site=' + encodeURIComponent(site));
      const data = await response.json() as { parts: StockPart[]; error?: string };
      if (number !== requestNumber.current) return;
      if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
      if (!response.ok) throw new Error(data.error || 'Stock indisponible.');
      setStock(data.parts); setError('');
    } catch (cause) { if (number === requestNumber.current) setError(cause instanceof Error ? cause.message : 'Stock indisponible.'); }
    finally { if (number === requestNumber.current) setLoading(false); }
  }, [site, onSessionChanged]);
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => { clearInterval(interval); requestNumber.current++; };
  }, [load]);
  const available = stock.map(part => ({ ...part,quantity:part.quantity + (baseline.find(line => line.part === part.id)?.quantity || 0) }));
  for (const line of baseline) if (line.part && !available.some(part => part.id === line.part)) available.push({id:line.part,name:line.name || '',reference:line.reference || '',quantity:line.quantity,machines:[],supplier:'',location:''});
  const options = matchingParts(available, query, machines).filter(part => !value.some(line => line.part === part.id));
  function addStockPart(id: string) {
    const selectedPart = available.find(part => part.id === id);
    if (!selectedPart || selectedPart.quantity < 1 || value.length >= 100 || value.some(line => line.part === id)) return;
    onChange([...value, { part: selectedPart.id, name: selectedPart.name, reference: selectedPart.reference, quantity: 1 }]);
    setError('');
  }
  function update(index: number, patch: Partial<PartUsageInput>) {
    onChange(value.map((line, i) => i === index ? { ...line, ...patch } : line));
  }
  return <section className="parts-picker" aria-label="Pièces utilisées">
    <div className="panel-head"><h3>Pièces utilisées</h3><button type="button" disabled={disabled || loading} onClick={load}><RefreshCw size={15} />Actualiser le stock</button></div>
    {!!baseline.length && <p className="muted">Les quantités déjà prélevées par ce rapport sont incluses dans la disponibilité affichée. Seule la différence sera prélevée ou restituée.</p>}
    <p className="muted">Choisir une référence l’ajoute directement au rapport. Ajustez sa quantité ci-dessous. Les pièces du stock seront déduites à l’enregistrement du rapport. Les pièces non référencées sont consignées sans modifier le stock.</p>
    <fieldset disabled={disabled} className="stock-picker-controls" onKeyDown={event => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) event.preventDefault();
    }}><legend>Prélever dans le stock du site</legend>
      <label>Rechercher une pièce<input type="search" placeholder="Nom, référence, fournisseur, emplacement…" value={query} onChange={e => { setQuery(e.target.value); }} /></label>
      <label>Référence du stock<select value="" disabled={loading || !options.length || value.length >= 100} onChange={e => addStockPart(e.target.value)}><option value="">{loading ? 'Chargement du stock…' : !options.length ? 'Aucune référence correspondante' : 'Choisir une pièce…'}</option>{options.map(part => <option key={part.id} value={part.id} disabled={part.quantity <= 0}>{part.machines.some(id => machines.includes(id)) ? 'Compatible · ' : ''}{part.name} · {part.reference || 'Sans référence'} · Stock : {part.quantity}</option>)}</select><small>Les références compatibles avec les machines choisies apparaissent en premier.</small></label>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="used-parts">{value.map((line, index) => {
      const current = line.part ? available.find(part => part.id === line.part) : null;
      const unavailable = line.part && !loading && (!current || line.quantity > current.quantity);
      return <div key={line.part || 'unlisted-' + index} className="used-part">
        <div className="panel-head"><strong>{line.part ? line.name : 'Pièce non référencée'}</strong><button type="button" disabled={disabled} aria-label={'Retirer ' + (line.name || 'la pièce non référencée')} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={15} />Retirer</button></div>
        {line.part ? <small>{line.reference || 'Sans référence'} · Stock disponible : {current?.quantity ?? '—'}</small> : <div className="fields"><label>Nom de la pièce *<input required maxLength={150} disabled={disabled} value={line.name || ''} onChange={e => update(index, { name: e.target.value })} /></label><label>Référence (facultatif)<input maxLength={200} disabled={disabled} value={line.reference || ''} onChange={e => update(index, { reference: e.target.value })} /></label></div>}
        <label>Quantité utilisée *<input type="number" min="1" max={current ? current.quantity : 1000000} step="1" required disabled={disabled} value={line.quantity || ''} onChange={e => update(index, { quantity: Number(e.target.value) })} /></label>
        {unavailable && <p role="alert" className="error">Stock insuffisant pour cette quantité. Ajustez-la ou retirez la ligne.</p>}
      </div>;
    })}</div>
    <button type="button" disabled={disabled || value.length >= 100} onClick={() => onChange([...value, { part: null, name: '', reference: '', quantity: 1 }])}><Plus size={16} />Ajouter une pièce non référencée</button>
  </section>;
}
