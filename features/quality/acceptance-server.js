// Electrical acceptance against the authenticated backend. Inactive in demo and admin preview.
// Backend/acceptance.py enforces roles and versions; this view only mirrors the permissions.
const ServerAcceptance = (() => {
  const enabled = Boolean(window.BD_BACKEND?.enabled && window.BD_BACKEND.user);
  const user = enabled ? BD_BACKEND.user : null;
  const prefix = enabled ? `${BD_BACKEND.workspaceID}-${user.username}` : '';
  const statusLabel = {requested:'Prüfung angefordert', approved:'Freigegeben', rejected:'Mangel · Nacharbeit'};
  const statusTone = {requested:'amber', approved:'green', rejected:'red'};
  const eventLabel = {requested:'Abnahme angefordert', rerequested:'Erneut angefordert', approved:'Technisch freigegeben', rejected:'Mangel festgestellt'};
  const messages = {
    offline:'Keine Verbindung zum Server. Nichts wurde gespeichert; deine Eingabe bleibt erhalten.',
    authentication_required:'Sitzung abgelaufen. Deine Eingabe ist in diesem Tab gesichert. Bitte neu anmelden.',
    forbidden_role:'Keine Berechtigung. Technische Freigaben erteilt ausschließlich der verantwortliche Elektromeister.',
    note_required:'Bitte eine Begründung eintragen: bei einem Mangel immer, bei einer Freigabe mit offenen Prüfpunkten ebenfalls.',
    version_conflict:'Diese Abnahme wurde inzwischen geändert. Deine Eingabe wurde nicht gespeichert und bleibt im Feld.',
    not_open:'Diese Abnahme ist bereits entschieden. Deine Eingabe wurde nicht gespeichert.',
    already_exists:'Für dieses Projekt gibt es bereits eine Abnahme.',
    unknown_project:'Projekt ist auf dem Server noch nicht gespeichert. Bitte kurz warten und erneut versuchen.',
    inspection_missing:'Abnahme erst, wenn das Prüfprotokoll ohne Mängel abgeschlossen ist.',
    invalid_note:'Die Notiz ist zu lang (höchstens 2000 Zeichen).',
    not_found:'Diese Abnahme gibt es auf dem Server nicht.',
    storage_unavailable:'Serverspeicher nicht verfügbar. Nichts wurde gespeichert.'
  };
  let records = [], checklist = null, permissions = enabled ? {...BD_BACKEND.permissions} : {};
  let phase = 'loading', loadError = '', loading = false, saving = false, signature = '', stale = false, loadedAt = null;
  const rows = new Map();
  let receipts = readJSON(localStorage, `bd-acceptance-receipts-${prefix}`) || {}, savedReceipts = JSON.stringify(receipts);

  function readJSON(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } }
  function writeJSON(store, key, value) { try { value == null ? store.removeItem(key) : store.setItem(key, JSON.stringify(value)); } catch {} }
  const draftKey = id => `bd-acceptance-draft-${prefix}-${id}`;
  const esc = escapeAttr, t = I18n.t;
  const when = value => value ? new Date(value).toLocaleString(I18n.locale(), {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
  const find = id => records.find(record => record.id === id);
  const checkItems = () => checklist?.items || [];

  async function call(path, body) {
    let response;
    try {
      response = await fetch(path, {method:body ? 'POST' : 'GET', cache:'no-store', credentials:'same-origin',
        headers:{'Content-Type':'application/json', 'X-BD-CSRF':BD_BACKEND.csrf}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000)});
    } catch { throw {code:'offline', message:t(messages.offline)}; }
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const code = response.status === 401 ? 'authentication_required' : data.error || 'server';
      throw {code, status:response.status, acceptance:data.acceptance, message:messages[code] ? t(messages[code]) : t('Serverfehler {status}. Nichts wurde gespeichert.', {status:response.status})};
    }
    return data;
  }

  function quietScreen() {
    return document.getElementById('modalBackdrop').hidden && !PullRefresh.isActive() && !MobileHomeSwipe.isActive()
      && !document.querySelector('.workspace-home.is-arranging') && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  }

  function refreshView() {
    if (state.view === 'acceptance' && quietScreen()) { stale = false; render(); }
    else { stale = state.view === 'acceptance'; updateBadges(); }
  }

  async function load() {
    if (!enabled || loading) return;
    loading = true;
    try {
      const data = await call('/api/acceptances');
      const next = JSON.stringify(data);
      const changed = next !== signature || phase !== 'ready' || loadError;
      checklist = data.checklist; permissions = data.permissions; records = data.acceptances;
      signature = next; phase = 'ready'; loadError = ''; loadedAt = new Date();
      syncRows();
      if (changed || stale) refreshView();
    } catch (error) {
      const changed = loadError !== error.message;
      loadError = error.message;
      if (phase !== 'ready') phase = 'error';
      if (changed) refreshView();
    } finally { loading = false; }
  }

  function replace(record) {
    const index = records.findIndex(row => row.id === record.id);
    if (index >= 0) records[index] = record; else records.unshift(record);
    signature = ''; syncRows();
  }

  // Notification rows: Meister sees open requests, requesters see rejected work. Read state is personal.
  function syncRows() {
    const visible = new Set();
    for (const record of records) {
      const relevant = (record.status === 'requested' && permissions.decideAcceptance) || (record.status === 'rejected' && permissions.requestAcceptance);
      if (!relevant) continue;
      visible.add(record.id);
      const row = rows.get(record.id) || {id:record.id};
      const last = record.events[record.events.length - 1];
      Object.assign(row, {projectID:record.projectID, city:record.site || record.title, status:t(statusLabel[record.status]),
        updatedAt:last?.at || record.requestedAt,
        checks:checkItems().map(item => [t(item.label), record.status === 'rejected' ? Boolean(record.checks[item.id]) : false])});
      const receipt = receipts[record.id] || {};
      if (receipt.read) row.notificationReadFingerprint = receipt.read;
      if (receipt.archived) row.notificationArchivedFingerprint = receipt.archived;
      rows.set(record.id, row);
    }
    for (const id of [...rows.keys()]) if (!visible.has(id)) rows.delete(id);
    for (const id of Object.keys(receipts)) if (!visible.has(id)) delete receipts[id];
  }

  function notificationRows() {
    for (const row of rows.values()) receipts[row.id] = {read:row.notificationReadFingerprint, archived:row.notificationArchivedFingerprint};
    const encoded = JSON.stringify(receipts);
    if (encoded !== savedReceipts) { writeJSON(localStorage, `bd-acceptance-receipts-${prefix}`, receipts); savedReceipts = encoded; }
    return [...rows.values()];
  }

  const openCount = () => records.filter(record => record.status === 'requested').length;

  function card(record) {
    const decided = record.status !== 'requested' && record.decidedName;
    const meta = decided ? t(record.status === 'approved' ? 'Freigegeben von {name} · {time}' : 'Mangel von {name} · {time}', {name:esc(record.decidedName), time:when(record.decidedAt)}) : t('Angefordert von {name} · {time}', {name:esc(record.requestedName), time:when(record.events.at(-1)?.at || record.requestedAt)});
    const primary = record.status === 'requested' && permissions.decideAcceptance;
    return `<article class="card sa-card"><div class="sa-card-main"><span class="eyebrow">${esc(record.projectID)}</span><h3>${esc(record.title)}</h3>${record.site ? `<p>${esc(record.site)}</p>` : ''}<p class="sa-meta">${meta}</p></div><div class="sa-card-side"><span class="status-pill ${statusTone[record.status]}">${t(statusLabel[record.status])}</span><button class="button ${primary ? 'primary' : 'outline'} small full" data-action="sa-open" data-acceptance="${esc(record.id)}">${t(primary ? 'Prüfen' : 'Ansehen')}</button></div></article>`;
  }

  function listBody(limit) {
    if (phase === 'loading') return `<div class="card sa-placeholder" role="status">${t('Abnahmen werden vom Server geladen …')}</div>`;
    if (phase === 'error') return `<div class="card sa-placeholder has-error" role="alert"><p>${esc(loadError)}</p><button class="button secondary small" data-action="sa-refresh">${icon('refresh',14)} ${t('Erneut laden')}</button></div>`;
    if (!records.length) return emptyState('clipboard-check', t('Noch keine Abnahme angefordert'), t(permissions.requestAcceptance ? 'Fordere die Abnahme an, sobald die Installation fertig ist.' : 'Sobald eine Abnahme angefordert ist, erscheint sie hier.'));
    if (limit) return records.filter(record => record.status === 'requested').slice(0, limit).map(card).join('') || `<div class="card sa-placeholder">${t('Keine offene Abnahme.')}</div>`;
    const groups = [['requested','Offen'],['rejected','Nacharbeit'],['approved','Freigegeben']];
    return groups.map(([status, title]) => {
      const items = records.filter(record => record.status === status);
      return items.length ? `<div class="sa-group"><h3 class="sa-group-title">${t(title)} <span>${items.length}</span></h3><div class="grid sa-list">${items.map(card).join('')}</div></div>` : '';
    }).join('');
  }

  function renderView() {
    setPageMeta('BÜLOW & DOLZ QUALITY', t('Elektro-Abnahmen'));
    const roleText = t(permissions.decideAcceptance ? 'Du kannst technische Freigaben erteilen.' : 'Technische Freigaben erteilt der verantwortliche Elektromeister.');
    return `
      <section class="section sa-view" style="margin-top:0">
        <div class="section-header"><div><h2>${t('Elektro-Abnahmen')}</h2><p>${t('Jede Entscheidung wird mit Name, Zeit und Notiz auf dem Server gespeichert.')}</p></div><div class="sa-header-actions"><span class="status-pill blue">${t('{n} offen', {n:openCount()})}</span>${permissions.requestAcceptance ? `<button class="button primary small" data-action="sa-request">${icon('clipboard-check',14)} ${t('Abnahme anfordern')}</button>` : ''}</div></div>
        <div class="notice info sa-identity"><span class="notice-icon">${icon('shield')}</span><div><strong>${esc(user.name)} · ${esc(t(user.roleLabel))}</strong><p>${roleText}</p></div></div>
        ${checklist && !checklist.approved ? `<div class="notice warning sa-draft"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Prüfpunkte sind ein Entwurf')}</strong><p>${esc(t(checklist.notice))}</p></div></div>` : ''}
        ${phase === 'ready' && loadError ? `<div class="notice warning" role="alert"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Stand von {time}', {time:loadedAt.toLocaleTimeString(I18n.locale(),{hour:'2-digit',minute:'2-digit'})})}</strong><p>${esc(loadError)}</p></div></div>` : ''}
        <div class="sa-groups">${listBody()}</div>
      </section>`;
  }

  function checksMarkup(record, editable, draft) {
    const items = checkItems();
    if (!items.length) return '';
    const rows = items.map(item => {
      const value = editable ? Boolean(draft?.checks?.[item.id]) : Boolean(record.checks[item.id]);
      return editable
        ? `<label class="sa-check"><input type="checkbox" data-sa-check="${esc(item.id)}" ${value ? 'checked' : ''}><span>${esc(t(item.label))}</span></label>`
        : `<div class="check-item ${value ? 'ok' : ''}"><span class="check-state">${icon(value ? 'check' : 'clock',13)}</span><span>${esc(t(item.label))}</span></div>`;
    }).join('');
    const hint = record.status === 'requested' && !editable ? `<p class="sa-hint">${t('Noch nicht geprüft.')}</p>` : '';
    return `<fieldset class="section sa-checks"><legend>${t('Prüfpunkte')} <span class="status-pill gray">${t('Entwurf')}</span></legend>${hint || rows}</fieldset>`;
  }

  function historyMarkup(record) {
    return `<div class="section"><h3 class="sa-group-title">${t('Verlauf')}</h3><ol class="sa-history">${record.events.map(event => `<li><strong>${eventLabel[event.action] ? t(eventLabel[event.action]) : esc(event.action)}</strong><span>${esc(event.actorName)} · ${when(event.at)}</span>${event.note ? `<p>${esc(event.note)}</p>` : ''}</li>`).join('')}</ol></div>`;
  }

  function open(id) {
    if (!enabled) return;
    const record = find(id);
    if (!record) { showToast(t('Abnahme nicht gefunden'), t('Liste wird neu geladen.'), 'warning'); load(); return; }
    const canDecide = record.status === 'requested' && permissions.decideAcceptance;
    const canRerequest = record.status === 'rejected' && permissions.requestAcceptance;
    const draft = readJSON(sessionStorage, draftKey(id)) || {};
    const decision = record.status !== 'requested' && record.decidedName
      ? `<div class="notice ${record.status === 'approved' ? 'info' : 'warning'} section"><span class="notice-icon">${icon(record.status === 'approved' ? 'check' : 'alert')}</span><div><strong>${t(record.status === 'approved' ? 'Technisch freigegeben von {name}' : 'Mangel festgestellt von {name}', {name:esc(record.decidedName)})}</strong><p>${when(record.decidedAt)}${record.note ? ` · ${esc(record.note)}` : ''}</p></div></div>` : '';
    const waiting = record.status === 'requested' && !permissions.decideAcceptance
      ? `<div class="notice info section"><span class="notice-icon">${icon('clock')}</span><div><strong>${t('Wartet auf technische Freigabe')}</strong><p>${t('Deine Rolle ({role}) kann keine technische Freigabe erteilen.', {role:esc(t(user.roleLabel))})}</p></div></div>` : '';
    const note = canDecide
      ? `<div class="field section"><label for="saNote">${t('Prüfnotiz / Mangelbeschreibung')}</label><textarea id="saNote" maxlength="2000" rows="4" aria-describedby="saNoteHint" placeholder="${esc(t('Feststellung, betroffener Bereich, erforderlicher Sollzustand'))}">${esc(draft.note || '')}</textarea><p class="sa-hint" id="saNoteHint">${t('Pflicht bei Mangel. Bei Freigabe mit offenen Prüfpunkten ebenfalls.')}</p></div>`
      : canRerequest ? `<div class="field section"><label for="saNote">${t('Was wurde nachgebessert? (optional)')}</label><textarea id="saNote" maxlength="2000" rows="3">${esc(draft.note || '')}</textarea></div>` : '';
    const buttons = canDecide
      ? `<button class="button danger" data-action="sa-reject" data-acceptance="${esc(id)}" data-version="${record.version}">${icon('alert',15)} ${t('Mangel melden')}</button><button class="button success" data-action="sa-approve" data-acceptance="${esc(id)}" data-version="${record.version}">${icon('check',15)} ${t('Technisch freigeben')}</button>`
      : canRerequest ? `<button class="button primary" data-action="sa-rerequest" data-acceptance="${esc(id)}" data-version="${record.version}">${icon('refresh',15)} ${t('Erneut zur Abnahme anfordern')}</button>` : '';
    openModal({
      eyebrow: `${t('ELEKTRO-ABNAHME')} · ${record.projectID}`,
      title: record.site || record.title,
      body: `
        <div class="detail-grid sa-detail"><div class="detail-block"><span>${t('Projekt')}</span><strong>${esc(record.title)}</strong></div><div class="detail-block"><span>${t('Status')}</span><strong>${t(statusLabel[record.status])}</strong></div><div class="detail-block"><span>${t('Angefordert von')}</span><strong>${esc(record.requestedName)}</strong></div><div class="detail-block"><span>${t('Stand')}</span><strong>${t('Version {n}', {n:record.version})}</strong></div></div>
        ${decision}${waiting}
        <div class="sa-editor" data-acceptance="${esc(id)}">${checksMarkup(record, canDecide, draft)}${note}</div>
        <p class="sa-feedback" id="saFeedback" role="alert" hidden></p>
        ${historyMarkup(record)}`,
      footer: `<button class="button outline" data-action="close-modal">${t('Schließen')}</button>${buttons}`
    });
  }

  function feedback(text, tone='error') {
    const node = document.getElementById('saFeedback');
    if (!node) return;
    node.hidden = !text; node.textContent = text || ''; node.dataset.tone = tone;
  }

  function editorValues() {
    return {note:document.getElementById('saNote')?.value || '',
      checks:Object.fromEntries([...document.querySelectorAll('[data-sa-check]')].map(input => [input.dataset.saCheck, input.checked]))};
  }

  function rememberDraft() {
    const id = document.querySelector('.sa-editor')?.dataset.acceptance;
    if (id) writeJSON(sessionStorage, draftKey(id), editorValues());
  }

  function lock(locked) {
    saving = locked;
    document.querySelectorAll('#modalFooter .button, .sa-editor input, .sa-editor textarea, .sa-request-form select, .sa-request-form textarea').forEach(node => { node.disabled = locked; });
  }

  // A slow answer must not touch a different dialog the person opened meanwhile.
  const ownDialog = () => !document.getElementById('modalBackdrop').hidden && Boolean(document.querySelector('#modal .sa-editor, #modal .sa-request-form'));

  function failed(error, id) {
    lock(false);
    if (!ownDialog()) { showToast(t('Nicht gespeichert'), esc(error.message), 'warning'); if (error.acceptance) replace(error.acceptance); return; }
    feedback(error.message);
    if (error.acceptance) {
      replace(error.acceptance);
      document.getElementById('modalFooter').innerHTML = `<button class="button outline" data-action="close-modal">${t('Schließen')}</button><button class="button primary" data-action="sa-open" data-acceptance="${esc(id || error.acceptance.id)}">${t('Aktuellen Stand anzeigen')}</button>`;
    } else if (error.code === 'authentication_required') {
      document.getElementById('modalFooter').insertAdjacentHTML('afterbegin', `<a class="button outline" href="/login">${t('Neu anmelden')}</a>`);
    }
    if (error.code === 'forbidden_role') load();
    hydrateIcons(document.getElementById('modal'));
  }

  function done(record, title, text, tone) {
    lock(false);
    replace(record);
    if (ownDialog()) closeModal();
    showToast(title, esc(text), tone);
    refreshView();
    load();
  }

  async function decide(target, decision) {
    if (saving) return;
    const id = target.dataset.acceptance, values = editorValues();
    const openPoints = Object.values(values.checks).some(value => !value);
    if ((decision === 'reject' || openPoints) && values.note.trim().length < 3) {
      feedback(t(messages.note_required)); document.getElementById('saNote')?.focus(); return;
    }
    if (decision === 'approve' && target.dataset.confirm !== 'yes') {
      target.dataset.confirm = 'yes';
      target.innerHTML = `${icon('check',15)} ${t('Verbindlich freigeben')}`;
      feedback(t('Bitte bestätigen: Die Freigabe wird mit deinem Namen gespeichert und ist danach abgeschlossen.') + (openPoints ? ' ' + t('Offene Prüfpunkte sind begründet.') : ''), 'info');
      return;
    }
    lock(true); feedback(t('Wird gespeichert …'), 'info');
    try {
      const result = await call(`/api/acceptances/${encodeURIComponent(id)}/decision`, {version:Number(target.dataset.version), decision, checks:values.checks, note:values.note});
      writeJSON(sessionStorage, draftKey(id), null);
      done(result.acceptance, t(decision === 'approve' ? 'Technisch freigegeben' : 'Mangel gespeichert'), `${result.acceptance.projectID} · ${result.acceptance.title}`, decision === 'approve' ? 'success' : 'warning');
    } catch (error) { failed(error, id); }
  }

  async function rerequest(target) {
    if (saving) return;
    const id = target.dataset.acceptance;
    lock(true); feedback(t('Wird gespeichert …'), 'info');
    try {
      const result = await call(`/api/acceptances/${encodeURIComponent(id)}/rerequest`, {version:Number(target.dataset.version), note:editorValues().note});
      writeJSON(sessionStorage, draftKey(id), null);
      done(result.acceptance, t('Erneut angefordert'), `${result.acceptance.projectID} · ${t('wartet auf Prüfung')}`, 'success');
    } catch (error) { failed(error, id); }
  }

  function showRequest() {
    const taken = new Set(records.map(record => record.projectID));
    const seen = new Set();
    const options = (list) => list.filter(project => project?.id && !taken.has(project.id) && !seen.has(project.id) && seen.add(project.id))
      .map(project => `<option value="${esc(project.id)}">${esc(project.id)} · ${esc(project.title || '')}${project.city ? ` · ${esc(project.city)}` : ''}</option>`).join('');
    const active = options(activeProjects), other = options(projects);
    const available = Boolean(active || other);
    openModal({
      eyebrow: t('ELEKTRO-ABNAHME'),
      title: t('Abnahme anfordern'),
      body: available ? `<div class="sa-request-form"><div class="field"><label for="saProject">${t('Projekt')}</label><select id="saProject">${active ? `<optgroup label="${esc(t('In Ausführung'))}">${active}</optgroup>` : ''}${other ? `<optgroup label="${esc(t('Weitere Projekte'))}">${other}</optgroup>` : ''}</select></div><div class="field section"><label for="saRequestNote">${t('Hinweis an den Prüfer (optional)')}</label><textarea id="saRequestNote" maxlength="2000" rows="3" placeholder="${esc(t('z. B. Termin vor Ort, Besonderheiten'))}"></textarea></div></div><p class="sa-feedback" id="saFeedback" role="alert" hidden></p>`
        : `<p>${t('Für alle Projekte gibt es bereits eine Abnahme.')}</p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button>${available ? `<button class="button primary" data-action="sa-submit-request">${icon('check',15)} ${t('Anfordern')}</button>` : ''}`
    });
  }

  async function submitRequest() {
    if (saving) return;
    const projectID = document.getElementById('saProject')?.value;
    if (!projectID) { feedback(t('Bitte ein Projekt wählen.')); return; }
    lock(true); feedback(t('Wird gespeichert …'), 'info');
    try {
      const result = await call('/api/acceptances', {projectID, note:document.getElementById('saRequestNote')?.value || ''});
      done(result.acceptance, t('Abnahme angefordert'), `${result.acceptance.projectID} · ${t('wartet auf technische Prüfung')}`, 'success');
    } catch (error) {
      failed({...error, acceptance:null}, null);
      if (error.acceptance) { replace(error.acceptance); refreshView(); }
    }
  }

  function action(name, target) {
    if (!enabled) return;
    if (name === 'sa-open') open(target.dataset.acceptance);
    else if (name === 'sa-refresh') { phase = phase === 'error' ? 'loading' : phase; refreshView(); load(); }
    else if (name === 'sa-request') showRequest();
    else if (name === 'sa-submit-request') submitRequest();
    else if (name === 'sa-approve') decide(target, 'approve');
    else if (name === 'sa-reject') decide(target, 'reject');
    else if (name === 'sa-rerequest') rerequest(target);
  }

  function start() {
    if (!enabled) return;
    document.addEventListener('input', event => { if (event.target.closest('.sa-editor')) rememberDraft(); });
    document.addEventListener('change', event => {
      if (!event.target.closest('.sa-editor')) return;
      rememberDraft();
      const approve = document.querySelector('[data-action="sa-approve"][data-confirm="yes"]');
      if (approve) { delete approve.dataset.confirm; approve.innerHTML = `${icon('check',15)} ${t('Technisch freigeben')}`; feedback(''); }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
    load();
    setInterval(() => { if (document.visibilityState === 'visible' && !saving) load(); }, 8000);
  }

  return {enabled, start, load, renderView, cards:limit => listBody(limit), open, action, openCount, notificationRows};
})();
