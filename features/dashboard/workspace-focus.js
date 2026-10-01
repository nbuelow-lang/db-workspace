// Personal focus rounds reference source records; they never complete business tasks.
const WorkspaceFocus = (() => {
  let storageKey, session = null, storageFailed = false;
  const candidates = () => state.operations?.importCandidates || [];
  const eligible = () => candidates().filter(item =>
    ['Importbereit', 'Prüfung nötig'].includes(item.status) && item.id && item.proposedProjectID &&
    !projects.some(project => project.id === item.proposedProjectID));

  function load() {
    const key = 'bd-workspace-focus-v1:' + AdminPreview.storageKey;
    if (key === storageKey) return;
    storageKey = key;
    session = null;
    storageFailed = false;
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (value?.version !== 1 || !Array.isArray(value.tasks) || !value.tasks.length || value.tasks.length > 3) return;
      if (value.tasks.some(task => typeof task.id !== 'string' || typeof task.projectID !== 'string')) return;
      if (new Set(value.tasks.map(task => task.id)).size !== value.tasks.length) return;
      session = {version:1, tasks:value.tasks.map(({id,projectID}) => ({id,projectID})),
        selected:typeof value.selected === 'string' ? value.selected : '',
        seen:Array.isArray(value.seen) ? value.seen.filter(id => typeof id === 'string') : []};
    } catch { /* Invalid or unavailable storage must not block the workplace. */ }
  }

  function persist() {
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
      storageFailed = false;
    } catch { storageFailed = true; }
  }

  function tasks() {
    return (session?.tasks || []).map(task => {
      const item = candidates().find(candidate => candidate.id === task.id);
      const sameProject = item?.proposedProjectID === task.projectID;
      const done = sameProject && item.status === 'Importiert' && projects.some(project => project.id === task.projectID);
      const actionable = sameProject && ['Importbereit','Prüfung nötig'].includes(item.status) &&
        !projects.some(project => project.id === task.projectID);
      return {...task, item, done, actionable};
    });
  }

  function renderPanel({preview=false} = {}) {
    load();
    if (state.role !== 'admin') return '';
    const list = tasks(), done = list.filter(task => task.done), available = eligible();
    if (!session && !available.length) return '';
    const active = list.find(task => task.id === session?.selected && !task.done) || list.find(task => !task.done);
    const complete = session && done.length === list.length;
    const fresh = session && done.some(task => !session.seen.includes(task.id));
    if (session && !preview) { session.seen = done.map(task => task.id); persist(); }
    return `<section class="workspace-focus ${fresh ? 'has-progress' : ''}" aria-labelledby="workspaceFocusTitle">
      <div class="workspace-focus-heading"><div><span class="workspace-focus-kicker">Projektimport · Lokaler Datenstand</span><h3 id="workspaceFocusTitle">${complete ? 'Runde geschafft.' : 'Fokusrunde'}</h3></div>
        ${session ? `<button type="button" data-action="focus-end" aria-label="Fokusrunde beenden" title="Fokusrunde beenden">${icon('x',18)}</button>` : ''}</div>
      ${session ? `<div class="workspace-focus-track" role="group" aria-label="Vorgänge der Fokusrunde">${list.map((task,index) => `<button type="button" data-action="focus-select" data-task="${escapeAttr(task.id)}" class="${task.done ? 'is-done' : ''}" aria-pressed="${active?.id === task.id}" aria-label="Vorgang ${index+1}: ${escapeAttr(task.item?.city || task.projectID)}, ${task.done ? 'Projekt angelegt' : task.actionable ? 'offen' : 'Klärung nötig'}">${task.done ? icon('check',18) : index+1}</button>`).join('')}<span role="status" aria-live="polite">${done.length} von ${list.length} angelegt</span></div>` : ''}
      <div class="workspace-focus-body"><div class="workspace-focus-copy">
        <strong>${escapeAttr(complete ? 'Platz für den nächsten Schritt.' : active ? active.item?.title || active.projectID : `${Math.min(3,available.length)} Vorgänge für deine nächste Runde`)}</strong>
        <p>${escapeAttr(complete ? 'Projektanlage abgeschlossen · technische Freigaben bleiben offen.' : active ? `${active.item?.city || active.projectID} · ${active.item?.source || 'Import'} · ${active.done ? 'Angelegt' : active.actionable ? active.item.status : 'Klärung nötig'}` : 'Ein Vorgang nach dem anderen.')}</p>
      </div><div class="workspace-focus-actions">
        ${!session ? `<button type="button" class="focus-primary" data-action="focus-start">${icon('arrow-right',18)} Runde starten</button>` : complete ? `<button type="button" class="focus-primary" data-action="focus-end">${icon('check',18)} Fertig</button>` : `<button type="button" class="focus-primary" data-action="focus-open" data-task="${escapeAttr(active.id)}">${icon(active.actionable && active.item.status === 'Importbereit' ? 'upload' : 'arrow-right',18)} ${active.actionable ? active.item.status === 'Importbereit' ? 'Projekt anlegen' : 'Daten prüfen' : 'Import öffnen'}</button>${list.filter(task => !task.done).length > 1 ? '<button type="button" data-action="focus-next" title="Nächster Vorgang">Später</button>' : ''}`}
      </div></div>${storageFailed ? '<p class="workspace-focus-note" role="status">Runde nur für diese Sitzung gespeichert.</p>' : ''}
    </section>`;
  }

  function action(name, target) {
    if (state.role !== 'admin') return;
    load();
    if (name === 'focus-start') {
      session = {version:1, tasks:eligible().slice(0,3).map(item => ({id:item.id,projectID:item.proposedProjectID})),selected:'',seen:[]};
      if (!session.tasks.length) session = null;
    } else if (name === 'focus-end') session = null;
    else if (!session) return;
    else if (name === 'focus-select') {
      if (tasks().some(task => task.id === target.dataset.task && !task.done)) session.selected = target.dataset.task;
    } else if (name === 'focus-next') {
      const pending = tasks().filter(task => !task.done);
      const index = Math.max(0,pending.findIndex(task => task.id === session.selected));
      session.selected = pending[(index+1)%pending.length]?.id || '';
    } else if (name === 'focus-open') {
      const task = tasks().find(task => task.id === target.dataset.task);
      if (!task || task.done) return;
      session.selected = task.id;
      persist();
      if (!task.actionable) {
        if (task.item?.source) state.operations.importSource = task.item.source;
        setView('imports'); return;
      }
      if (task.item.status === 'Importbereit') {
        importOperationsCandidate(task.id);
        document.querySelector('.workspace-focus .focus-primary')?.focus({preventScroll:true});
      }
      else showImportReview(task.id);
      return;
    } else return;
    persist();
    render();
    document.querySelector('.workspace-focus .focus-primary')?.focus({preventScroll:true});
  }
  return {render:renderPanel, action};
})();
