'use client';
import { useEffect, useState } from 'react';
import type { Draft, Row } from '../../lib/maintenance/types';
import { OrderFields } from '../maintenance/order-fields';
export function WaitingQuote({ site, machines, draft, onChange, onSessionChanged }: {
    site: string;
    machines: {
        id: string;
        name: string;
        archived?: boolean;
    }[];
    draft: Draft;
    onChange: (value: Draft) => void;
    onSessionChanged: () => void;
}) {
    const [parts, setParts] = useState<Row[]>([]), [error, setError] = useState('');
    useEffect(() => { let active = true; (async () => { try {
        const response = await fetch('/api/interventions/stock?site=' + encodeURIComponent(site));
        const data: any = await response.json();
        if (!active)
            return;
        if (response.status === 401 || response.status === 428) {
            onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        setParts(data.parts.map((p: Row) => ({ ...p, kind: 'part', site })));
        setError('');
    }
    catch (cause) {
        if (active)
            setError(cause instanceof Error ? cause.message : 'Stock indisponible.');
    } })(); return () => { active = false; }; }, [site, onSessionChanged]);
    return <fieldset><legend>Nouveau devis pour la pièce attendue</legend><OrderFields hideReportLink model={{ site, modal: draft, setModal: onChange, parts, machines: machines.map(m => ({ ...m, kind: 'machine', site })), onSessionChanged }}/>{error && <p className="error" role="alert">{error}</p>}</fieldset>;
}
