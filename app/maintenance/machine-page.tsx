
'use client';
import { MachineState } from './machine-state';
import { useState } from 'react';
import { FileText, Wrench, ClipboardList } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
import { StockView } from './stock';
import { OrdersView } from './orders';
import { MachineDetailsView } from './machine-details';
import { InterventionHistory } from '../interventions/history';
import { MachineDocuments } from './machine-documents';
export function MachinePage({ model, onSessionChanged }: { model: MaintenanceModel; onSessionChanged: () => void }) {
  const [tab, setTab] = useState<'overview' | 'documents' | 'interventions'>('overview');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function toggleState(){const machine=model.selected;if(!machine||busy||model.readOnly)return;setBusy(true);setError('');try{const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'machine-state',id:machine.id,serviceState:machine.serviceState==='running'?'stopped':'running',expectedState:machine.serviceState||'unknown',expectedReport:(machine.stateReport||'')+':'+(machine.stateRevision||0)})}),d:any=await r.json();if(!r.ok)throw Error(d.error);await model.refresh();}catch(e){setError(e instanceof Error?e.message:'Modification impossible.');await model.refresh();}finally{setBusy(false);}}
  if (!model.selected) return null;
  return <>
    {error&&<p className="error" role="alert">{error}</p>}
    <MachineState busy={busy} onToggle={model.readOnly?undefined:toggleState} machine={model.selected} orders={model.records.filter(r => r.kind === 'order' && !r.deleted)} />
    <div className="machine-tabs" role="tablist" aria-label="Fiche machine">
      <button id="machine-overview-tab" role="tab" aria-selected={tab === 'overview'} aria-controls="machine-overview" onClick={() => setTab('overview')}><Wrench size={17} />Aperçu</button>
      <button id="machine-documents-tab" role="tab" aria-selected={tab === 'documents'} aria-controls="machine-documents" onClick={() => setTab('documents')}><FileText size={17} />Documents</button>
      <button id="machine-interventions-tab" role="tab" aria-selected={tab === 'interventions'} aria-controls="machine-interventions" onClick={() => setTab('interventions')}><ClipboardList size={17} />Interventions</button>
    </div>
    {tab === 'overview' ? <div role="tabpanel" id="machine-overview" aria-labelledby="machine-overview-tab">
      <StockView model={model} /><OrdersView model={model} /><MachineDetailsView model={model} />
    </div> : tab === 'interventions' ? <div role="tabpanel" id="machine-interventions" aria-labelledby="machine-interventions-tab"><InterventionHistory readOnly={model.readOnly} key={model.selected.id} site={model.site} siteName={model.sites.find(s => s.id === model.site)?.name || ''} machine={model.selected.id} userRole={model.user.role} onStockChanged={model.refresh} onSessionChanged={onSessionChanged} /></div> : <div role="tabpanel" id="machine-documents" aria-labelledby="machine-documents-tab">
      <MachineDocuments readOnly={model.readOnly} machine={model.selected.id} onSessionChanged={onSessionChanged} />
    </div>}
  </>;
}
