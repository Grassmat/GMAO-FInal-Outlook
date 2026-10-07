
'use client';
import { useState } from 'react';
import type { FormDefinition, Question, QuestionType } from '../../lib/interventions/types';
const labels: Record<QuestionType, string> = { text: 'Texte court', textarea: 'Texte long', select: 'Choix unique', multiselect: 'Choix multiples', date: 'Date', time: 'Heure', number: 'Nombre', photos: 'Photos' };
export function FormEditor({ form, onSaved, onClose, onSessionChanged }: { form: FormDefinition; onSaved: () => void; onClose: () => void; onSessionChanged: () => void }) {
  const [baseVersion]=useState(form.version);
  const [questions, setQuestions] = useState<Question[]>(form.questions.map(q => ({ ...q, options: [...q.options] })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function change(index: number, update: Partial<Question>) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...update } : q))
  }
  function move(index: number, direction: number) {
    setQuestions(prev => {
      const copy = [...prev], other = index + direction;
      if (other < 0 || other >= copy.length) return prev;
      [copy[index], copy[other]] = [copy[other], copy[index]];
      return copy
    })
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/interventions/form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: baseVersion, questions }) });
      const data: any = await response.json();
      if (response.status === 401 || response.status === 428) {
        onSessionChanged();
        return
      }
      if (!response.ok) throw Error(data.error);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="overlay"><form className="modal intervention-modal form-editor" onSubmit={save}><div className="panel-head"><h2>Modifier le formulaire</h2><button type="button" disabled={busy} onClick={onClose}>Fermer</button></div><p className="muted">Ce formulaire est commun aux sites. Le site et les machines restent obligatoires et sont proposés automatiquement. Les changements n’altèrent pas les rapports déjà enregistrés.</p>
    {questions.map((q, index) => <section className="question-editor" key={q.id}><div className="panel-head"><strong>Question {index + 1}</strong><div className="actions"><button type="button" aria-label="Monter la question" disabled={index === 0} onClick={() => move(index, -1)}>Monter</button><button type="button" aria-label="Descendre la question" disabled={index === questions.length - 1} onClick={() => move(index, 1)}>Descendre</button><button type="button" className="danger" onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))}>Retirer</button></div></div>
      <label>Question<input required maxLength={200} value={q.label} onChange={e => change(index, { label: e.target.value })} /></label><div className="fields"><label>Type<select value={q.type} onChange={e => change(index, { type: e.target.value as QuestionType })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="check"><input type="checkbox" checked={q.required} onChange={e => change(index, { required: e.target.checked })} />Réponse obligatoire</label></div>
      {['select', 'multiselect'].includes(q.type) && <label>Choix proposés — un par ligne<textarea rows={3} value={q.options.join('\n')} onChange={e => change(index, { options: e.target.value.split('\n') })} /></label>}
    </section>)}
    <button type="button" onClick={() => setQuestions(prev => [...prev, { id: 'question-' + crypto.randomUUID(), label: 'Nouvelle question', type: 'text', required: false, options: [] }])}>Ajouter une question</button>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le formulaire'}</button></form></div>;
}
