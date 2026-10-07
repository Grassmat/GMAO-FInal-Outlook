'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Row, Site, Reports, Movement, User, Tab, Draft } from '../../lib/maintenance/types';
type MaintenanceData = {
  error?: string;
  records: Row[];
  movements: Movement[];
  sites: Site[];
  reports: Reports;
};
export function useMaintenance(user: User, onSessionChanged: () => void) {
  const [sites, setSites] = useState<Site[]>([]);
  const [reports, setReports] = useState<Reports>(null);
  const [records, setRecords] = useState<Row[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [site, setSite] = useState(user.site || '');
  const [tab, setTab] = useState<Tab>('Machines');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [modal, setModal] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archived, setArchived] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const savingNow = useRef(false);
  const readOnly = user.role === 'manager' && user.site !== site;
  const globalAccess = user.role === 'admin' || user.role === 'director';
  const load = useCallback(async () => {
    if (pending.current) return pending.current;
    const request = (async () => {
      try {
        const response = await fetch('/api/data');
        const data = await response.json() as MaintenanceData;
        if (response.status === 401 || response.status === 428) {
          onSessionChanged();
          return;
        }
        if (!response.ok) throw new Error(data.error);
        setRecords(data.records);
        setSelected(previous => previous ? data.records.find(row => row.id === previous.id) || null : null);
        setMoves(data.movements);
        setSites(data.sites);
        setSite(previous=>data.sites.some(s=>s.id===previous)?previous:data.sites[0]?.id||'');
        if(!data.sites.length && ['admin','director'].includes(user.role))setTab('Sites');
        setReports(data.reports);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      } finally {
        setLoading(false);
      }
    })();
    pending.current = request;
    try { await request; } finally { pending.current = null; }
  }, [onSessionChanged]);
  const refresh = useCallback(async () => {
    if (pending.current) await pending.current;
    await load();
  }, [load]);
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);
  async function save(draft: Draft) {
    if (readOnly) { setError('Ce site est accessible en consultation uniquement.'); return; }
    if (savingNow.current) return;
    savingNow.current = true;
    setSaving(true);
    setError('');
    let savedOrder: Row | undefined;
    try {
      const { pdfFile, ...payload } = draft;
      if (pdfFile) {
        if (!pdfFile.name.toLowerCase().endsWith('.pdf') || pdfFile.size === 0 || pdfFile.size > 20 * 1024 * 1024 ||
          new TextDecoder().decode(await pdfFile.slice(0, 5).arrayBuffer()) !== '%PDF-')
          throw new Error('Choisissez un PDF valide, non vide, de 20 Mo maximum.');
      }
      const response = await fetch('/api/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; record?: Row };
      if (response.status === 401 || response.status === 428) {
        onSessionChanged();
        return;
      }
      if (!response.ok) throw new Error(data.error);
      savedOrder = data.record;
      if (pdfFile && draft.kind === 'order') {
        const orderId = savedOrder?.id || draft.id || draft.clientId;
        if (!orderId || !draft.documentId) throw new Error('Identifiant du devis manquant pour l’envoi du PDF.');
        const form = new FormData();
        form.set('order', orderId); form.set('file', pdfFile); form.set('uploadId', draft.documentId);
        const uploaded = await fetch('/api/order-documents', { method: 'POST', body: form });
        const document = await uploaded.json() as { error?: string };
        if (uploaded.status === 401 || uploaded.status === 428) { onSessionChanged(); return; }
        if (!uploaded.ok) throw new Error(document.error || 'Envoi du PDF impossible.');
      }
      setModal(null);
      // Finish an older background read before fetching the newly saved state.
      await refresh();
      if (selected && draft.id === selected.id) setSelected({ ...selected, ...draft });
    } catch (cause) {
      if (savedOrder) {
        setModal({ ...draft, ...savedOrder, originalStatus: savedOrder.status });
        await refresh();
      }
      setError((savedOrder ? 'Le devis est enregistré, mais le PDF n’a pas été ajouté. Réessayez avec le fichier toujours sélectionné. ' : '') + (cause instanceof Error ? cause.message : 'Enregistrement impossible.'));
    } finally {
      savingNow.current = false;
      setSaving(false);
    }
  }
  const machines = records.filter(row => row.site === site && row.kind === 'machine');
  const parts = records.filter(row => row.site === site && row.kind === 'part' && !row.deleted);
  const quantityByPart = new Map<string, number>();
  for (const movement of moves) quantityByPart.set(movement.part, (quantityByPart.get(movement.part) || 0) + movement.quantity);
  const qty = (id: string) => quantityByPart.get(id) || 0;
  const list = machines.filter(machine => !!machine.archived === archived && machine.name.toLowerCase().includes(query.toLowerCase()));
  const displayedParts = parts.filter(part => (!selected || part.machines?.includes(selected.id))
    && `${part.name} ${part.reference || ''}`.toLowerCase().includes(query.toLowerCase()));
  function add(kind: Row['kind']) {
    if (readOnly) return;
    setModal({ kind, site, clientId: crypto.randomUUID(), name: '', machines: [], quantity: 1, part: '', archived: false, status: 'Devis' });
  }
  return {
    user, onSessionChanged, sites, reports, globalAccess, readOnly, records, moves, site, setSite, tab, setTab, query, setQuery,
    selected, setSelected, modal, setModal, error, loading, saving, archived, setArchived, load, refresh, save,
    machines, parts, qty, list, displayedParts, add
  };
}
export type MaintenanceModel = ReturnType<typeof useMaintenance>;
