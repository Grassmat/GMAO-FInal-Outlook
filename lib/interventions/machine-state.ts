import { database } from '../store';
import { globalReadAccess, type User } from '../auth';
import { chronologicalInterventions, isFutureIntervention, type Intervention } from './types';

// Derived from live reports, so editing/deleting/reassigning a report cannot leave a stale machine state.
export async function machineStates(user: User) {
  const db = database();
  const rows = await (globalReadAccess(user)
    ? db.prepare('SELECT i.*,m.machine FROM interventions i JOIN intervention_machines m ON m.intervention=i.id WHERE i.deleted=0')
    : db.prepare('SELECT i.*,m.machine FROM interventions i JOIN intervention_machines m ON m.intervention=i.id WHERE i.deleted=0 AND i.site=?').bind(user.site)).all<any>();
  const reports = rows.results.map(r => ({ ...r, answers:JSON.parse(r.answers),questions:JSON.parse(r.questions) }))
    .sort((a,b) => chronologicalInterventions(a as Intervention,b as Intervention));
  const states = new Map<string,{ serviceState:string; waitingNote:string; waitingOrder:string|null; stateReport:string; stateRevision:number }>();
  for (const report of reports) {
    if (isFutureIntervention(report)) continue;
    const service = report.machine_service || report.answers.service;
    if (states.has(report.machine) || !['Oui','Non'].includes(service)) continue;
    states.set(report.machine,{ serviceState:service === 'Oui' ? 'running' : 'stopped',
      waitingNote:service === 'Non' ? report.waiting_note || '' : '',
      waitingOrder:service === 'Non' ? report.waiting_order || null : null,stateReport:report.id,stateRevision:report.revision||1 });
  }
  const machines=await (globalReadAccess(user)?db.prepare("SELECT id,data FROM records WHERE kind='machine'"):db.prepare("SELECT id,data FROM records WHERE kind='machine' AND site=?").bind(user.site)).all<any>();
  for(const machine of machines.results){
    const data=JSON.parse(machine.data),latest=states.get(machine.id);
    if(!['running','stopped'].includes(data.manualServiceState))continue;
    // A new, edited, reassigned or deleted latest report supersedes the manual change.
    const anchor=(latest?.stateReport||'')+':'+(latest?.stateRevision||0);
    if(data.manualServiceAnchor!==anchor)continue;
    states.set(machine.id,{serviceState:data.manualServiceState,waitingNote:data.manualServiceState==='stopped'?latest?.waitingNote||'':'',waitingOrder:data.manualServiceState==='stopped'?latest?.waitingOrder||null:null,stateReport:latest?.stateReport||'',stateRevision:latest?.stateRevision||0});
  }
  return states;
}
