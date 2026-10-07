
'use client';
import type { MaintenanceModel } from './use-maintenance';
import { InterventionHistory } from '../interventions/history';
export function InterventionsView({ model, onSessionChanged }: { model: MaintenanceModel; onSessionChanged: () => void }) {
  if (model.tab !== 'Interventions') return null;
  return <InterventionHistory readOnly={model.readOnly} key={model.site} site={model.site} siteName={model.sites.find(s => s.id === model.site)?.name || ''} userRole={model.user.role} onStockChanged={model.refresh} onSessionChanged={onSessionChanged} />;
}
