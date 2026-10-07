import type { Assignment, Teammate } from '../../lib/planning/types';
const roles: Record<string, string> = { director: 'Directeur technique', manager: 'Responsable maintenance', technician: 'Technicien' };
export function assignmentLabel(value: Assignment | undefined, teammates: Teammate[]) {
    if (value?.mode === 'all') return 'Toute l’équipe';
    if (value?.mode === 'named') return value.users.map(id => teammates.find(p => p.id === id)?.name || 'Compte indisponible').join(', ');
    return 'N’importe quel intervenant';
}
export function AssignmentFields({ value, teammates = [], onChange }: { value?: Assignment; teammates?: Teammate[]; onChange: (value: Assignment) => void }) {
    const assignment = value || { mode: 'any', users: [] };
    return <fieldset><legend>Affectation</legend><label>Travail confié à<select value={assignment.mode} onChange={e => onChange({ mode: e.target.value as Assignment['mode'], users: [] })}><option value="any">N’importe quel intervenant</option><option value="all">Toute l’équipe du site</option><option value="named">Une ou plusieurs personnes</option></select></label>{assignment.mode === 'named' && <div>{teammates.map(person => <label className="check" key={person.id}><input type="checkbox" checked={assignment.users.includes(person.id)} onChange={e => onChange({ mode: 'named', users: e.target.checked ? [...assignment.users, person.id] : assignment.users.filter(id => id !== person.id) })}/>{person.name} · {roles[person.role] || person.role}</label>)}{!teammates.length && <p>Aucun profil disponible sur ce site.</p>}</div>}<small>Une autre personne ayant accès au site peut aussi effectuer la tâche. La réalisation est enregistrée à son nom.</small></fieldset>;
}
