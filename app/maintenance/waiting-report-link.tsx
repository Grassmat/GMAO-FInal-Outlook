'use client';
import { useEffect, useState } from 'react';
import type { Draft } from '../../lib/maintenance/types';
import type { Intervention } from '../../lib/interventions/types';
import { interventionStart } from '../../lib/interventions/types';
export function WaitingReportLink({ site, draft, onChange, onSessionChanged }: {
    site: string;
    draft: Draft;
    onChange: (value: Draft) => void;
    onSessionChanged: () => void;
}) {
    const [enabled, setEnabled] = useState(!!draft.intervention);
    const [reports, setReports] = useState<Intervention[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!enabled)
            return;
        let active = true;
        (async () => {
            try {
                const response = await fetch('/api/interventions?site=' + encodeURIComponent(site));
                const data: any = await response.json();
                if (!active)
                    return;
                if (response.status === 401 || response.status === 428) {
                    onSessionChanged();
                    return;
                }
                if (!response.ok)
                    throw Error(data.error);
                setReports(data.interventions.filter((r: Intervention) => r.canEdit && (r.machine_service || r.answers.service) === 'Non' && (!r.waiting_order || r.waiting_order === (draft.id || draft.clientId))));
                setError('');
            }
            catch (cause) {
                if (active)
                    setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
            }
        })();
        return () => { active = false; };
    }, [enabled, site, draft.id, draft.clientId, onSessionChanged]);
    return <fieldset><legend>Rapport d’intervention</legend><label className="check"><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); if (!e.target.checked)
        onChange({ ...draft, intervention: undefined, interventionRevision: undefined, waitingNote: undefined }); }}/>Associer à un rapport en attente de pièce</label>
    {enabled && <><label>Rapport à mettre à jour *<select required value={draft.intervention || ''} onChange={e => { const report = reports.find(r => r.id === e.target.value); onChange({ ...draft, intervention: report?.id, interventionRevision: report?.revision, waitingNote: report?.waiting_note || draft.name || '' }); }}><option value="">Choisir un rapport…</option>{reports.map(r => <option key={r.id} value={r.id}>{r.date} {interventionStart(r)} · {r.machines.map(m => m.name).join(', ')} · {String(r.answers.work || '').slice(0, 80)}</option>)}</select></label><label>Pièce attendue / précision<textarea required maxLength={1000} value={draft.waitingNote || ''} onChange={e => onChange({ ...draft, waitingNote: e.target.value })}/></label><small>Seuls les rapports hors service que vous pouvez modifier, sur ce site et sans autre devis associé, sont proposés.</small></>}
    {error && <p className="error" role="alert">{error}</p>}
  </fieldset>;
}
