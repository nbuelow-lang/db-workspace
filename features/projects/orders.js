// Job files (Auftragsakte) against the authenticated backend. Inactive in demo and admin preview.
// Backend/orders.py enforces roles and versions; this view mirrors the permissions it receives.
const ServerOrders = (() => {
  const enabled = Boolean(window.BD_BACKEND?.enabled && window.BD_BACKEND.user);
  const user = enabled ? BD_BACKEND.user : null;
  const prefix = enabled ? `${BD_BACKEND.workspaceID}-${user.username}` : '';
  const esc = escapeAttr, t = I18n.t;
  const statusLabel = {offen:'Offen', in_arbeit:'In Arbeit', erledigt:'Erledigt', blockiert:'Blockiert', entfaellt:'Entfällt'};
  const statusTone = {offen:'gray', in_arbeit:'amber', erledigt:'green', blockiert:'red', entfaellt:'gray'};
  const eventLabel = {created:'Auftrag angelegt', updated:'Stammdaten geändert', survey_saved:'Aufnahme gespeichert', step_changed:'Schritt geändert', assessed:'Leistungsbilanz bewertet', file_added:'Datei hinzugefügt', grid_changed:'Netzbetreiber-Vorgang geändert',
    inspection_saved:'Prüfprotokoll gespeichert', inspection_finalized:'Prüfprotokoll abgeschlossen', inspection_reopened:'Prüfprotokoll wieder geöffnet', mood_changed:'Kundenstimmung geändert'};
  const gridTone = {nicht_gestartet:'gray', vorbereitet:'blue', eingereicht:'amber', rueckfrage:'amber', zugestimmt:'green', zugestimmt_auflagen:'green', abgelehnt:'red', nicht_erforderlich:'green'};
  // Fields each grid status needs; mirrors validate_grid in Backend/orders.py.
  const gridRequired = status => ({
    eingereicht:['operator','submittedAt'], rueckfrage:['operator','submittedAt','note','followUpAt'],
    zugestimmt:['operator','submittedAt','decisionAt'], zugestimmt_auflagen:['operator','submittedAt','decisionAt','conditions'],
    abgelehnt:['operator','submittedAt','decisionAt','note'], nicht_erforderlich:['note']
  }[status] || []);
  const presets = ['Herd','Durchlauferhitzer','Wärmepumpe','Wallbox','Sauna','Klimaanlage'];
  const messages = {
    offline:'Keine Verbindung zum Server. Nichts wurde gespeichert; deine Eingaben bleiben auf diesem Gerät erhalten.',
    authentication_required:'Sitzung abgelaufen. Deine Eingaben bleiben auf diesem Gerät erhalten. Bitte neu anmelden.',
    forbidden_role:'Keine Berechtigung für diesen Schritt mit deiner Rolle.',
    version_conflict:'Inzwischen hat jemand anderes geändert. Deine Eingaben sind nicht gespeichert und bleiben erhalten.',
    survey_changed:'Die Aufnahme wurde nach dem Öffnen geändert. Bitte die aktuelle Aufnahme prüfen und erneut bewerten.',
    survey_missing:'Erst die Aufnahme speichern, dann bewerten.',
    note_required:'Bitte eine Begründung eintragen.',
    title_required:'Bitte einen Titel eintragen.', customer_required:'Bitte den Kundennamen eintragen.', city_required:'Bitte den Ort eintragen.',
    invalid_survey:'Ein Feld der Aufnahme ist ungültig. Bitte rot markierte Werte prüfen.',
    invalid_date:'Ungültiges Datum.', unknown_person:'Unbekannte Person.',
    unsupported_file:'Dateiart nicht erlaubt. Erlaubt: JPEG, PNG, WebP, HEIC und PDF.',
    file_too_large:'Datei ist größer als 10 MB.', too_many_files:'Zu viele Dateien in diesem Auftrag.',
    not_found:'Auftrag nicht gefunden.', storage_unavailable:'Serverspeicher nicht verfügbar. Nichts wurde gespeichert.',
    grid_submission_missing:'Für diesen Status Netzbetreiber und Einreichungsdatum angeben.',
    grid_followup_missing:'Bei einer Rückfrage den Inhalt und ein Wiedervorlage-Datum angeben.',
    grid_decision_missing:'Bitte das Datum der Entscheidung angeben.', grid_conditions_missing:'Bitte die Auflagen eintragen.',
    grid_not_approved:'Inbetriebsetzung erst nach Zustimmung oder begründeter Entscheidung eintragen.',
    grid_approval_missing:'Montage erst nach Zustimmung des Netzbetreibers oder begründeter Entscheidung des Elektromeisters.',
    invalid_grid:'Eine Angabe im Netzbetreiber-Vorgang ist ungültig.',
    invalid_inspection:'Eine Angabe im Prüfprotokoll ist ungültig.', invalid_result:'Bitte ein gültiges Ergebnis wählen.', invalid_note:'Der Text ist zu lang.',
    inspection_incomplete:'Das Prüfprotokoll ist noch nicht vollständig.', inspection_closed:'Das Prüfprotokoll ist bereits abgeschlossen. Änderungen nur nach „Wieder öffnen“ durch den Elektromeister.',
    inspection_result_mismatch:'Das Ergebnis passt nicht zu den Bewertungen: Bei einem „n. i. O.“ nur „Mit Mängeln“, sonst „Ohne Mängel“.',
    montage_open:'Abschließen erst, wenn die Montage erledigt ist.', inspection_not_closed:'Das Prüfprotokoll ist nicht abgeschlossen.',
    acceptance_active:'Die Abnahme läuft oder ist erteilt. Das Protokoll kann nur nach einer abgelehnten Abnahme wieder geöffnet werden.',
    inspection_missing:'Abnahme erst, wenn das Prüfprotokoll ohne Mängel abgeschlossen ist.',
    invalid_mood:'Bitte eine Stimmung wählen.'
  };
  const testTone = {entwurf:'amber', bereit:'blue'};
  let orders = [], schema = null, permissions = {steps:{}}, phase = 'loading', loadError = '', loading = false;
  let current = null, currentID = readStore(sessionStorage, `bd-order-open-${prefix}`), detailError = '', filter = 'all';
  let saving = false, confirmOverwrite = false, confirmTestOverwrite = false, testOpen = false;
  const uploads = [];
  const rows = new Map();
  let receipts = readStore(localStorage, `bd-order-receipts-${prefix}`) || {}, savedReceipts = JSON.stringify(receipts);

  function readStore(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } }
  function writeStore(store, key, value) { try { value == null ? store.removeItem(key) : store.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  const draftKey = id => `bd-order-survey-${prefix}-${id}`;
  const testKey = id => `bd-order-inspection-${prefix}-${id}`;
  const when = value => value ? new Date(value).toLocaleString(I18n.locale(), {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
  const day = value => value ? new Date(value + 'T12:00:00').toLocaleDateString(I18n.locale(), {day:'2-digit', month:'2-digit', year:'numeric'}) : '';
  const person = username => schema?.people.find(entry => entry.username === username);
  const personName = username => person(username)?.name || username || '';
  const num = (value, digits = 1) => value == null ? '–' : value.toLocaleString(I18n.locale(), {maximumFractionDigits:digits});
  const pct = value => value == null ? '' : ` · ${Math.round(value * 100)} %`;
  const today = () => new Date().toISOString().slice(0, 10);

  async function call(path, {body, raw, headers = {}} = {}) {
    let response;
    try {
      response = await fetch(path, {method:body || raw ? 'POST' : 'GET', cache:'no-store', credentials:'same-origin',
        headers:{...(raw ? {} : {'Content-Type':'application/json'}), 'X-BD-CSRF':BD_BACKEND.csrf, ...headers},
        ...(body ? {body:JSON.stringify(body)} : raw ? {body:raw} : {}), signal:AbortSignal.timeout(raw ? 120000 : 12000)});
    } catch { throw {code:'offline', message:t(messages.offline)}; }
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const code = response.status === 401 ? 'authentication_required' : data.error || 'server';
      throw {code, status:response.status, order:data.order, missing:data.missing, message:messages[code] ? t(messages[code]) : t('Serverfehler {status}. Nichts wurde gespeichert.', {status:response.status})};
    }
    return data;
  }

  function quietScreen() {
    return document.getElementById('modalBackdrop').hidden && !PullRefresh.isActive() && !MobileHomeSwipe.isActive()
      && !document.querySelector('.workspace-home.is-arranging') && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  }

  // The order list and the project ring (view control, project-ring.js) render from the list data.
  const listVisible = () => (state.view === 'orders' && !currentID) || ['control','schedule','customers'].includes(state.view);

  // ---------- Loading ----------
  async function loadList() {
    if (!enabled || loading) return;
    loading = true;
    try {
      const data = await call('/api/orders');
      const changed = JSON.stringify(data.orders) !== JSON.stringify(orders) || phase !== 'ready' || loadError;
      schema = data.schema; permissions = data.permissions; orders = data.orders; phase = 'ready'; loadError = '';
      syncRows();
      if (changed && listVisible() && quietScreen()) render(); else updateBadges();
    } catch (error) {
      const changed = loadError !== error.message;
      loadError = error.message; if (phase !== 'ready') phase = 'error';
      if (changed && listVisible() && quietScreen()) render();
    } finally { loading = false; }
  }

  async function loadDetail({quiet = false} = {}) {
    if (!currentID) return;
    const id = currentID;
    try {
      const data = await call(`/api/orders/${encodeURIComponent(id)}`);
      if (id !== currentID) return;
      const changed = JSON.stringify(data.order) !== JSON.stringify(current);
      current = data.order; detailError = '';
      if (!changed) return;
      if (!quiet || (quietScreen() && !hasDraft() && !hasTestDraft())) { if (state.view === 'orders') render(); }
      else refreshSections();
    } catch (error) {
      detailError = error.message;
      if (error.code === 'not_found') { currentID = null; current = null; writeStore(sessionStorage, `bd-order-open-${prefix}`, null); }
      if (state.view === 'orders' && (!quiet || quietScreen())) render();
    }
  }

  // ---------- Notifications: my assigned, unfinished steps ----------
  function syncRows() {
    const visible = new Set();
    for (const order of orders) for (const step of schema?.steps || []) {
      const entry = order.steps[step.id];
      if (entry.assignee !== user.username || ['erledigt','entfaellt'].includes(entry.status)) continue;
      const id = `${order.id}:${step.id}`;
      visible.add(id);
      const overdue = entry.due && entry.due < today();
      const row = rows.get(id) || {id};
      Object.assign(row, {orderID:order.id, projectID:order.id, status:entry.status, updatedAt:entry.updatedAt || order.updatedAt,
        title:`${t(step.label)} · ${order.title}`, text:`${order.customer?.name || ''} · ${order.address?.city || ''}${entry.due ? ` · ${t('fällig {date}', {date:day(entry.due)})}` : ''}`,
        rank:overdue || entry.status === 'blockiert' ? 2 : 1, deadline:entry.due || ''});
      const receipt = receipts[id] || {};
      if (receipt.read) row.notificationReadFingerprint = receipt.read;
      if (receipt.archived) row.notificationArchivedFingerprint = receipt.archived;
      rows.set(id, row);
    }
    // The Meister is told when a protocol waits for closing.
    if (permissions.inspectFinal) for (const order of orders) {
      if (order.inspection?.status !== 'bereit') continue;
      const id = `${order.id}:inspection`;
      visible.add(id);
      const row = rows.get(id) || {id};
      Object.assign(row, {orderID:order.id, projectID:order.id, status:'bereit', updatedAt:order.updatedAt, rank:1, deadline:'',
        title:`${t('Prüfprotokoll freigeben')} · ${order.title}`, text:`${order.customer?.name || ''} · ${order.address?.city || ''}`});
      const receipt = receipts[id] || {};
      if (receipt.read) row.notificationReadFingerprint = receipt.read;
      if (receipt.archived) row.notificationArchivedFingerprint = receipt.archived;
      rows.set(id, row);
    }
    for (const id of [...rows.keys()]) if (!visible.has(id)) rows.delete(id);
    for (const id of Object.keys(receipts)) if (!visible.has(id)) delete receipts[id];
  }

  function notificationRows() {
    for (const row of rows.values()) receipts[row.id] = {read:row.notificationReadFingerprint, archived:row.notificationArchivedFingerprint};
    const encoded = JSON.stringify(receipts);
    if (encoded !== savedReceipts) { writeStore(localStorage, `bd-order-receipts-${prefix}`, receipts); savedReceipts = encoded; }
    return [...rows.values()];
  }

  // ---------- List ----------
  function nextStep(order) {
    const step = (schema?.steps || []).find(item => !['erledigt','entfaellt'].includes(order.steps[item.id].status));
    return step ? {step, entry:order.steps[step.id]} : null;
  }

  function progress(order) {
    return `<span class="so-progress" aria-label="${esc(t('{done} von {total} Schritten erledigt', {done:(schema?.steps || []).filter(s => order.steps[s.id].status === 'erledigt').length, total:schema?.steps.length || 0}))}">${(schema?.steps || []).map(step => `<i class="tone-${statusTone[order.steps[step.id].status]}" title="${esc(t(step.label))}: ${esc(t(statusLabel[order.steps[step.id].status]))}"></i>`).join('')}</span>`;
  }

  function card(order) {
    const next = nextStep(order);
    const mine = (schema?.steps || []).some(step => order.steps[step.id].assignee === user.username && !['erledigt','entfaellt'].includes(order.steps[step.id].status));
    return `<button type="button" class="card so-card" data-action="so-open" data-order="${esc(order.id)}">
      <span class="so-card-top"><span class="eyebrow">${esc(order.id)}</span>${mine ? `<span class="status-pill blue">${t('Meine Aufgabe')}</span>` : ''}</span>
      <strong class="so-card-title">${esc(order.title)}</strong>
      <span class="so-card-meta">${esc(order.customer?.name || '')} · ${esc(order.address?.city || '')}</span>
      ${progress(order)}
      <span class="so-card-next">${next ? `${t('Nächster Schritt:')} <b>${esc(t(next.step.label))}</b>${next.entry.assignee ? ` · ${esc(personName(next.entry.assignee))}` : ` · ${t('nicht zugewiesen')}`}${next.entry.due ? ` · ${day(next.entry.due)}` : ''}` : t('Alle Schritte erledigt')}</span>
    </button>`;
  }

  function renderList() {
    setPageMeta('BÜLOW & DOLZ', t('Aufträge'));
    let body;
    if (phase === 'loading') body = `<div class="card so-placeholder" role="status">${t('Aufträge werden vom Server geladen …')}</div>`;
    else if (phase === 'error') body = `<div class="card so-placeholder has-error" role="alert"><p>${esc(loadError)}</p><button class="button secondary small" data-action="so-reload">${icon('refresh',14)} ${t('Erneut laden')}</button></div>`;
    else {
      const visible = filter === 'mine' ? orders.filter(order => (schema?.steps || []).some(step => order.steps[step.id].assignee === user.username && !['erledigt','entfaellt'].includes(order.steps[step.id].status))) : orders;
      body = visible.length ? `<div class="so-list">${visible.map(card).join('')}</div>`
        : emptyState('hard-hat', t(filter === 'mine' ? 'Keine offenen Aufgaben für dich' : 'Noch kein Auftrag'), t(permissions.create ? 'Lege den ersten Auftrag an, zum Beispiel den Heizstab mit Hausanschlussprüfung.' : 'Aufträge legen Geschäftsführung, Meister oder Vertrieb an.'));
    }
    return `<section class="section so-view" style="margin-top:0">
      <div class="section-header"><div><h2>${t('Aufträge')}</h2><p>${t('Auftragsakte mit Aufnahme vor Ort, Leistungsbilanz, Schritten und Dateien.')}</p></div>${permissions.create ? `<button class="button primary small so-new" data-action="so-new">${icon('plus',14)} ${t('Neuer Auftrag')}</button>` : ''}</div>
      <div class="so-filter" role="group" aria-label="${esc(t('Filter'))}"><button class="${filter === 'all' ? 'active' : ''}" data-action="so-filter" data-filter="all" aria-pressed="${filter === 'all'}">${t('Alle')}</button><button class="${filter === 'mine' ? 'active' : ''}" data-action="so-filter" data-filter="mine" aria-pressed="${filter === 'mine'}">${t('Meine Aufgaben')}</button></div>
      ${phase === 'ready' && loadError ? `<div class="notice warning" role="alert"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Server gerade nicht erreichbar')}</strong><p>${esc(loadError)}</p></div></div>` : ''}
      ${body}
    </section>`;
  }

  // ---------- Detail ----------
  function hasDraft() { return Boolean(currentID && readStore(localStorage, draftKey(currentID))); }
  function hasTestDraft() { return Boolean(currentID && readStore(localStorage, testKey(currentID))); }
  function surveyValues() {
    const draft = readStore(localStorage, draftKey(currentID));
    return draft ? draft.values : current?.survey || {};
  }

  function headerMarkup() {
    const o = current, a = o.address || {}, c = o.customer || {};
    return `<div class="card so-head">
      <div class="so-head-main"><span class="eyebrow">${esc(o.id)}</span><h2>${esc(o.title)}</h2>
        <p class="so-head-line"><strong>${esc(c.name)}</strong>${c.phone ? ` · <a href="tel:${esc(c.phone.replace(/[^+\d]/g,''))}">${esc(c.phone)}</a>` : ''}${c.email ? ` · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</p>
        <p class="so-head-line">${esc([a.street, [a.postcode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</p>
        ${o.note ? `<p class="so-head-note">${esc(o.note)}</p>` : ''}
        <p class="so-head-meta">${t('Angelegt von {name} · {time}', {name:esc(o.createdName), time:when(o.createdAt)})}</p>
        ${o.hours?.total ? `<p class="so-head-meta">${icon('clock',12)} ${t('Arbeitszeit: {h} Std.', {h:(o.hours.total / 60).toLocaleString(I18n.locale(), {maximumFractionDigits:1})})} · ${esc(o.hours.people.map(p => `${p.name} ${(p.minutes / 60).toLocaleString(I18n.locale(), {maximumFractionDigits:1})}`).join(', '))}</p>` : ''}
        <p class="so-head-mood">${ProjectRing.moodChip(o.mood)} <button type="button" class="text-button" data-action="pr-mood" data-order="${esc(o.id)}">${t('Stimmung ändern')}</button></p></div>
      ${permissions.edit ? `<button class="button outline small" data-action="so-edit">${icon('edit',14)} ${t('Bearbeiten')}</button>` : ''}
    </div>`;
  }

  const gridApproved = () => (schema?.grid?.approved || []).includes(current?.grid?.status);
  const protocolClean = () => current?.inspection?.status === 'abgeschlossen' && current.inspection.result === 'ohne_maengel';
  const montageDone = () => ['erledigt','entfaellt'].includes(current?.steps.montage.status);
  const daysSince = value => Math.max(0, Math.round((Date.parse(today()) - Date.parse(value)) / 86400000));

  function stepsMarkup() {
    return `<ol class="so-steps">${schema.steps.map((step, index) => {
      const entry = current.steps[step.id], can = permissions.steps[step.id];
      const acceptance = step.id === 'abnahme' ? current.acceptance : null;
      const extra = step.id === 'abnahme' ? (acceptance ? `<button class="button outline small" data-action="so-open-acceptance" data-acceptance="${esc(acceptance.id)}">${t('Abnahme öffnen')}</button>` : (BD_BACKEND.permissions?.requestAcceptance ? `<button class="button outline small" data-action="so-request-acceptance" ${protocolClean() ? '' : 'disabled'}>${t('Abnahme anfordern')}</button>` : '')) : '';
      return `<li class="so-step status-${entry.status}"><span class="so-step-index" aria-hidden="true">${entry.status === 'erledigt' ? icon('check',14) : index + 1}</span>
        <div class="so-step-body"><div class="so-step-row"><strong>${esc(t(step.label))}</strong><span class="status-pill ${statusTone[entry.status]}">${t(statusLabel[entry.status])}</span></div>
        <p class="so-step-meta">${entry.assignee ? esc(personName(entry.assignee)) : t('Nicht zugewiesen')}${entry.due ? ` · ${t('fällig {date}', {date:day(entry.due)})}` : ''}${entry.derivedNote ? ` · ${esc(t(entry.derivedNote))}` : ''}</p>
        ${entry.note ? `<p class="so-step-note">${esc(entry.note)}</p>` : ''}
        ${step.id === 'montage' && !gridApproved() && !['erledigt','entfaellt'].includes(entry.status) ? `<p class="so-step-lock">${icon('lock',13)} ${t('Gesperrt bis zur Zustimmung des Netzbetreibers')}</p>` : ''}
        ${step.id === 'abnahme' && !acceptance && !protocolClean() ? `<p class="so-step-lock">${icon('lock',13)} ${t('Gesperrt bis zum Prüfprotokoll ohne Mängel')}</p>` : ''}
        <div class="so-step-actions">${can ? `<button class="button secondary small" data-action="so-step" data-step="${step.id}">${t(step.derived ? 'Zuständigkeit' : 'Status ändern')}</button>` : ''}${extra}</div></div></li>`;
    }).join('')}</ol>`;
  }

  function fieldMarkup(field, values, editable) {
    const value = values[field.id];
    const id = `sv-${field.id}`;
    if (field.type === 'consumers') return consumersMarkup(value || [], editable);
    if (!editable) {
      const shown = value == null || value === '' ? '–' : field.type === 'number' ? `${num(value, 2)} ${field.unit || ''}` : field.type === 'select' ? t(value) : value;
      return `<div class="so-readonly"><span>${esc(t(field.label))}</span><strong>${esc(shown)}</strong></div>`;
    }
    const label = `<label for="${id}">${esc(t(field.label))}${field.unit ? ` <span>(${esc(field.unit)})</span>` : ''}</label>`;
    // Stored values stay German (shared record); only the visible label is translated.
    if (field.type === 'select') return `<div class="field">${label}<select id="${id}" data-sv-field="${field.id}"><option value="">${t('– bitte wählen –')}</option>${field.options.map(option => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(t(option))}</option>`).join('')}</select></div>`;
    if (field.type === 'textarea') return `<div class="field so-wide">${label}<textarea id="${id}" data-sv-field="${field.id}" maxlength="${field.max}" rows="3">${esc(value || '')}</textarea></div>`;
    if (field.type === 'number') return `<div class="field">${label}<input id="${id}" data-sv-field="${field.id}" data-sv-number inputmode="decimal" autocomplete="off" value="${value == null ? '' : esc(String(value).replace('.', ','))}"><span class="so-field-error" hidden>${t('Bitte eine Zahl von {min} bis {max} eintragen.', {min:field.min, max:field.max})}</span></div>`;
    return `<div class="field">${label}<input id="${id}" data-sv-field="${field.id}" maxlength="${field.max}" autocomplete="off" value="${esc(value || '')}"></div>`;
  }

  function consumerRow(row = {}, editable = true) {
    if (!editable) return `<li>${esc(row.name)} · ${num(row.kw, 2)} kW · ${t(row.phases === 1 ? '1-phasig' : '3-phasig')}</li>`;
    return `<div class="so-consumer" data-sv-consumer><input aria-label="${esc(t('Verbraucher'))}" placeholder="${esc(t('Bezeichnung'))}" maxlength="60" value="${esc(row.name || '')}" data-c="name"><input aria-label="${esc(t('Leistung in kW'))}" placeholder="kW" inputmode="decimal" value="${row.kw == null ? '' : esc(String(row.kw).replace('.', ','))}" data-c="kw"><select aria-label="${esc(t('Phasen'))}" data-c="phases"><option value="3" ${row.phases !== 1 ? 'selected' : ''}>${t('3-phasig')}</option><option value="1" ${row.phases === 1 ? 'selected' : ''}>${t('1-phasig')}</option></select><button type="button" class="so-icon-button" data-action="so-remove-consumer" aria-label="${esc(t('Verbraucher entfernen'))}">${icon('x',16)}</button></div>`;
  }

  function consumersMarkup(list, editable) {
    if (!editable) return `<div class="so-readonly so-wide"><span>${t('Große Verbraucher')}</span>${list.length ? `<ul>${list.map(row => consumerRow(row, false)).join('')}</ul>` : '<strong>–</strong>'}</div>`;
    return `<div class="field so-wide"><label>${t('Große Verbraucher')} <span>(${t('Nennleistung, ohne Gleichzeitigkeit')})</span></label><div class="so-consumers" id="soConsumers">${list.map(row => consumerRow(row)).join('')}</div>
      <div class="so-presets">${presets.map(name => `<button type="button" class="so-chip" data-action="so-add-consumer" data-name="${esc(name)}">${icon('plus',12)} ${esc(t(name))}</button>`).join('')}<button type="button" class="so-chip" data-action="so-add-consumer" data-name="">${icon('plus',12)} ${t('Andere')}</button></div></div>`;
  }

  function surveyMarkup() {
    const editable = permissions.survey, values = surveyValues(), draft = readStore(localStorage, draftKey(currentID));
    const status = draft ? t('Lokaler Entwurf vom {time} · noch nicht gespeichert', {time:when(draft.savedAt)}) : current.surveyVersion ? savedStatus() : t('Noch nicht gespeichert');
    const conflict = draft && draft.base !== current.surveyVersion
      ? `<div class="notice warning" role="alert"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Aufnahme wurde inzwischen geändert')}</strong><p>${t('Version {n} von {name} ({time}). Dein Entwurf basiert auf Version {base}. Speichern ersetzt den Serverstand durch deinen Entwurf.', {n:current.surveyVersion, name:esc(current.surveyBy || t('jemand anderem')), time:when(current.surveyAt), base:draft.base})}</p></div></div>` : '';
    return `<form class="so-survey" id="soSurveyForm" novalidate>
      ${conflict}
      ${schema.survey.map(section => `<fieldset class="so-section"><legend>${esc(t(section.title))}</legend><div class="so-grid">${section.fields.map(field => fieldMarkup(field, values, editable)).join('')}</div></fieldset>`).join('')}
      ${editable ? `<div class="so-savebar"><span id="soSurveyStatus" role="status">${status}</span><p class="so-feedback" id="soSurveyFeedback" role="alert" hidden></p><div class="so-savebar-actions">${draft ? `<button type="button" class="button outline small" data-action="so-discard-draft">${t('Entwurf verwerfen')}</button>` : ''}<button type="button" class="button primary" data-action="so-save-survey">${icon('check',15)} ${t('Aufnahme speichern')}</button></div></div>` : `<p class="so-hint">${status}. ${t('Bearbeiten können Montage, Meister und Geschäftsführung.')}</p>`}
    </form>`;
  }

  function balanceMarkup() {
    const values = surveyValues(), r = OrderLoad.compute(values), a = current.assessment;
    const stale = a && a.surveyVersion !== current.surveyVersion;
    const dirty = hasDraft();
    const rowsHtml = [
      ['Heizstab', `${num(r.heaterKw)} kW · ${num(r.heaterA)} A ${t(r.heaterSingle ? 'an einer Phase' : 'je Phase')}`],
      ['Anschluss rechnerisch', r.capacityKw == null ? t('Sicherung fehlt') : t('{kw} kW bei {a} A (3 × 400 V)', {kw:num(r.capacityKw), a:num(r.fuseA, 0)})],
      ['Ungünstigster Fall (Summe Nennleistungen + Heizstab)', `${num(r.worstKw)} kW${pct(r.worstShare)}`],
      ['Ungünstigste Phase (1-phasige Verbraucher auf einer Phase)', `${num(r.worstPhaseA)} A${r.worstPhaseShare == null ? '' : pct(r.worstPhaseShare)}`],
      ['Gemessenes Maximum + Heizstab', r.measuredPlusKw == null ? t('keine Messung') : `${num(r.measuredPlusKw)} kW${pct(r.measuredShare)}`]
    ].map(([label, value]) => `<div class="so-calc-row"><span>${esc(t(label))}</span><strong>${esc(value)}</strong></div>`).join('');
    const assessment = a ? `<div class="notice ${a.result === 'nicht_ausreichend' ? 'warning' : 'info'}"><span class="notice-icon">${icon(a.result === 'ausreichend' ? 'check' : 'alert')}</span><div><strong>${esc(t(schema.results[a.result]))} · ${esc(a.name)}</strong><p>${when(a.at)} · ${t('bewertet auf Aufnahme-Version {n}', {n:a.surveyVersion})}${a.note ? ` · ${esc(a.note)}` : ''}</p>${stale ? `<p><b>${t('Die Aufnahme wurde danach geändert. Bewertung bitte erneuern.')}</b></p>` : ''}</div></div>` : `<p class="so-hint">${t('Noch keine Bewertung durch den Elektromeister.')}</p>`;
    const form = permissions.assess ? `<div class="so-assess">
      <fieldset class="so-choice"><legend>${t('Bewertung (nur Elektromeister)')}</legend>${Object.entries(schema.results).map(([key, label]) => `<label><input type="radio" name="soResult" value="${key}"><span>${esc(t(label))}</span></label>`).join('')}</fieldset>
      <div class="field"><label for="soAssessNote">${t('Begründung')} <span>(${t('Pflicht außer bei „Anschluss reicht“')})</span></label><textarea id="soAssessNote" rows="3" maxlength="2000"></textarea></div>
      <p class="so-feedback" id="soAssessFeedback" role="alert" hidden></p>
      <button type="button" class="button success" data-action="so-assess" ${dirty || !current.surveyVersion ? 'disabled' : ''}>${icon('check',15)} ${t('Bewertung speichern')}</button>
      ${dirty ? `<p class="so-hint">${t('Erst die Aufnahme speichern – bewertet wird immer eine gespeicherte Version.')}</p>` : !current.surveyVersion ? `<p class="so-hint">${t('Die Aufnahme ist noch nicht gespeichert.')}</p>` : ''}</div>` : '';
    return `<div class="notice warning so-calc-note"><span class="notice-icon">${icon('info')}</span><div><strong>${t('Rechenhilfe, keine Bewertung')}</strong><p>${t('Ohne Gleichzeitigkeitsfaktoren, cos φ = 1. Maßgeblich sind Messung, TAB des Netzbetreibers und die Entscheidung des Elektromeisters.')}${r.missing.length ? ` ${t('Es fehlt: {list}.', {list:esc(r.missing.map(item => t(item)).join(', '))})}` : ''}</p></div></div>
      <div class="so-calc" id="soCalc">${rowsHtml}</div>${assessment}${form}`;
  }

  function gridMarkup() {
    const g = current.grid || {status:'nicht_gestartet'}, cfg = schema.grid, a = current.assessment;
    const label = key => t(cfg.statuses[key] || key);
    const askOperator = a && ['netzbetreiber','nicht_ausreichend'].includes(a.result) && g.status === 'nicht_gestartet';
    const waiting = ['eingereicht','rueckfrage'].includes(g.status) && g.submittedAt ? daysSince(g.submittedAt) : null;
    const overdue = g.followUpAt && ['vorbereitet','eingereicht','rueckfrage'].includes(g.status) && g.followUpAt < today();
    const stages = [
      ['Vorbereitung', g.status !== 'nicht_gestartet', ''],
      ['Eingereicht', cfg.submitted.includes(g.status), g.submittedAt],
      ['Entscheidung', ['zugestimmt','zugestimmt_auflagen','abgelehnt','nicht_erforderlich'].includes(g.status), g.decisionAt],
      ['Inbetriebsetzung gemeldet', Boolean(g.commissioningAt), g.commissioningAt]
    ];
    const row = (name, value) => value ? `<div class="so-dl-row"><dt>${t(name)}</dt><dd>${value}</dd></div>` : '';
    const docs = cfg.documents.items.map(item => `<li class="${g.documents?.[item.id] ? 'ok' : ''}">${icon(g.documents?.[item.id] ? 'check' : 'clock',13)} ${esc(t(item.label))}</li>`).join('');
    const files = (current.files || []).filter(file => file.category === 'netzbetreiber').length;
    return `<div class="so-grid-head"><span class="status-pill ${gridTone[g.status]}">${esc(label(g.status))}</span>${permissions.grid ? `<button class="button outline small" data-action="so-grid">${icon('edit',14)} ${t('Bearbeiten')}</button>` : ''}</div>
      ${askOperator ? `<div class="notice warning"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Bewertung verlangt Anfrage beim Netzbetreiber')}</strong><p>${t('Der Elektromeister hat „{result}“ festgelegt. Vorgang beim Netzbetreiber vorbereiten.', {result:esc(t(schema.results[a.result]))})}</p></div></div>` : ''}
      ${!gridApproved() ? `<p class="so-hint">${icon('lock',12)} ${t('Montage erst nach Zustimmung des Netzbetreibers oder begründeter Entscheidung des Elektromeisters.')}</p>` : ''}
      <ol class="so-track">${stages.map(([name, done, when_]) => `<li class="${done ? 'done' : ''}"><span>${done ? icon('check',12) : ''}</span><strong>${t(name)}</strong>${when_ ? `<small>${day(when_)}</small>` : ''}</li>`).join('')}</ol>
      ${waiting != null ? `<p class="so-grid-wait">${t('Wartet seit {n} Tagen auf Antwort', {n:waiting})}</p>` : ''}
      <dl class="so-dl">
        ${row('Netzbetreiber', esc(g.operator || ''))}${row('Weg', esc(g.channel ? t(g.channel) : ''))}${row('Aktenzeichen', esc(g.reference || ''))}
        ${row('Wiedervorlage', g.followUpAt ? `<span class="${overdue ? 'so-overdue' : ''}">${day(g.followUpAt)}${overdue ? ' · ' + t('überfällig') : ''}</span>` : '')}
        ${row('Auflagen', esc(g.conditions || ''))}${row(g.status === 'nicht_erforderlich' ? 'Begründung' : 'Notiz', esc(g.note || ''))}
        ${row('Aktenzeichen Inbetriebsetzung', esc(g.commissioningReference || ''))}
      </dl>
      <div class="so-docs"><div class="so-docs-head"><strong>${t('Unterlagen')}</strong><span class="status-pill gray">${t('Entwurf')}</span></div><ul>${docs}</ul>
        <p class="so-hint">${esc(t(cfg.documents.notice))}</p>
        <p class="so-hint">${t('{n} Dateien in „Netzbetreiber“', {n:files})}${permissions.upload ? ` · <button type="button" class="text-button" data-action="so-grid-upload">${t('Unterlagen hochladen')}</button>` : ''}</p></div>
      ${g.updatedName ? `<p class="so-hint">${t('Zuletzt geändert von {name} · {time}', {name:esc(g.updatedName), time:when(g.updatedAt)})}</p>` : ''}`;
  }

  function showGrid() {
    const g = current.grid || {}, cfg = schema.grid;
    const statuses = Object.keys(cfg.statuses).filter(key => key !== 'nicht_erforderlich' || permissions.gridWaive || g.status === key);
    const operator = g.operator || current.survey?.netzbetreiber || '';
    const field = (id, name, input) => `<div class="field" data-grid-field="${id}"><label for="sg-${id}">${t(name)} <span class="so-req" hidden>(${t('Pflicht')})</span></label>${input}</div>`;
    openModal({
      eyebrow: `${current.id} · ${t('NETZBETREIBER')}`, title: t('Netzbetreiber-Vorgang'),
      body: `<div class="so-order-form so-grid-form">
        <div class="field so-wide"><label for="sg-status">${t('Status')}</label><select id="sg-status">${statuses.map(key => `<option value="${key}" ${key === (g.status || 'nicht_gestartet') ? 'selected' : ''}>${esc(t(cfg.statuses[key]))}</option>`).join('')}</select></div>
        ${field('operator', 'Netzbetreiber', `<input id="sg-operator" maxlength="120" value="${esc(operator)}">`)}
        ${field('channel', 'Weg', `<select id="sg-channel"><option value="">${t('– bitte wählen –')}</option>${cfg.channels.map(c => `<option value="${esc(c)}" ${c === g.channel ? 'selected' : ''}>${esc(t(c))}</option>`).join('')}</select>`)}
        ${field('submittedAt', 'Eingereicht am', `<input id="sg-submittedAt" type="date" value="${esc(g.submittedAt || '')}">`)}
        ${field('reference', 'Aktenzeichen', `<input id="sg-reference" maxlength="80" value="${esc(g.reference || '')}">`)}
        ${field('followUpAt', 'Wiedervorlage', `<input id="sg-followUpAt" type="date" value="${esc(g.followUpAt || '')}">`)}
        ${field('decisionAt', 'Entscheidung am', `<input id="sg-decisionAt" type="date" value="${esc(g.decisionAt || '')}">`)}
        <div class="so-wide">${field('conditions', 'Auflagen', `<textarea id="sg-conditions" rows="2" maxlength="2000">${esc(g.conditions || '')}</textarea>`)}</div>
        <div class="so-wide">${field('note', 'Notiz / Rückfrage / Begründung', `<textarea id="sg-note" rows="3" maxlength="2000">${esc(g.note || '')}</textarea>`)}</div>
        <fieldset class="so-wide sa-checks"><legend>${t('Unterlagen')} <span class="status-pill gray">${t('Entwurf')}</span></legend>${cfg.documents.items.map(item => `<label class="sa-check"><input type="checkbox" data-grid-doc="${item.id}" ${g.documents?.[item.id] ? 'checked' : ''}><span>${esc(t(item.label))}</span></label>`).join('')}</fieldset>
        ${field('commissioningAt', 'Inbetriebsetzung gemeldet am', `<input id="sg-commissioningAt" type="date" value="${esc(g.commissioningAt || '')}">`)}
        ${field('commissioningReference', 'Aktenzeichen Inbetriebsetzung', `<input id="sg-commissioningReference" maxlength="80" value="${esc(g.commissioningReference || '')}">`)}
      </div>
      <p class="so-hint">${t('„Nicht erforderlich“ darf nur der Elektromeister mit Begründung festlegen.')}</p>
      <p class="sa-feedback" id="soGridFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="so-save-grid" data-version="${current.gridVersion}">${icon('check',15)} ${t('Speichern')}</button>`
    });
    markGridRequired();
  }

  function markGridRequired() {
    const status = document.getElementById('sg-status')?.value;
    if (!status) return;
    const needed = gridRequired(status);
    document.querySelectorAll('[data-grid-field]').forEach(node => { node.querySelector('.so-req').hidden = !needed.includes(node.dataset.gridField); });
  }

  async function saveGrid(target) {
    if (saving) return;
    const value = id => document.getElementById('sg-' + id).value.trim();
    const grid = {status:value('status'), operator:value('operator'), channel:value('channel'), submittedAt:value('submittedAt') || null, reference:value('reference'),
      followUpAt:value('followUpAt') || null, decisionAt:value('decisionAt') || null, conditions:value('conditions'), note:value('note'),
      documents:Object.fromEntries([...document.querySelectorAll('[data-grid-doc]')].map(input => [input.dataset.gridDoc, input.checked])),
      commissioningAt:value('commissioningAt') || null, commissioningReference:value('commissioningReference')};
    const missing = gridRequired(grid.status).filter(key => !grid[key] || (['note','conditions'].includes(key) && grid[key].length < 3));
    if (missing.length) {
      const names = {operator:'Netzbetreiber', submittedAt:'Eingereicht am', followUpAt:'Wiedervorlage', decisionAt:'Entscheidung am', conditions:'Auflagen', note:'Notiz / Rückfrage / Begründung'};
      feedback('soGridFeedback', t('Bitte ausfüllen: {list}.', {list:missing.map(key => t(names[key])).join(', ')})); document.getElementById('sg-' + missing[0]).focus(); return;
    }
    if (grid.submittedAt && grid.decisionAt && grid.decisionAt < grid.submittedAt) { feedback('soGridFeedback', t('Die Entscheidung kann nicht vor der Einreichung liegen.')); return; }
    if ((grid.commissioningAt || grid.commissioningReference) && !schema.grid.approved.includes(grid.status)) { feedback('soGridFeedback', t(messages.grid_not_approved)); return; }
    saving = true; target.disabled = true; feedback('soGridFeedback', t('Wird gespeichert …'), 'info');
    try {
      const data = await call(`/api/orders/${encodeURIComponent(currentID)}/grid`, {body:{version:Number(target.dataset.version), grid}});
      closeModal(); current = data.order; replaceSummary(current); refreshSections();
      showToast(t('Netzbetreiber-Vorgang gespeichert'), esc(t(schema.grid.statuses[grid.status])), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); refreshSections(); target.dataset.version = current.gridVersion; }
      feedback('soGridFeedback', error.order ? `${error.message} ${t('Aktueller Stand wurde geladen; erneut speichern übernimmt deine Eingaben.')}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  // ---------- Initial verification protocol (form and views: inspection.js) ----------
  const testContext = () => ({cfg:schema.inspection, people:schema.people, instruments:ServerInstruments.active(), day});

  function testHeadMarkup() {
    const ins = current.inspection, cfg = schema.inspection;
    if (!ins) return `<div class="so-grid-head"><span class="status-pill gray">${t('Nicht begonnen')}</span></div>`;
    const closed = ins.status === 'abgeschlossen', draft = hasTestDraft();
    const label = closed ? `${t('Abgeschlossen')} · ${t(cfg.results[ins.result])}` : t(cfg.statuses[ins.status]);
    const tone = closed ? (ins.result === 'ohne_maengel' ? 'green' : 'red') : testTone[ins.status];
    const canClose = permissions.inspectFinal && !closed;
    const buttons = [
      `<button class="button outline small" data-action="so-test-print">${icon('file',14)} ${t('Drucken / PDF')}</button>`,
      canClose ? `<button class="button success small" data-action="so-test-finalize" ${montageDone() && !draft && !ins.missing.length ? '' : 'disabled'}>${icon('signature',14)} ${t('Abschließen')}</button>` : '',
      permissions.inspectFinal && closed ? `<button class="button outline small" data-action="so-test-reopen">${icon('edit',14)} ${t('Wieder öffnen')}</button>` : ''
    ].join('');
    const hints = closed
      ? `<div class="notice ${ins.result === 'ohne_maengel' ? 'info' : 'warning'}"><span class="notice-icon">${icon(ins.result === 'ohne_maengel' ? 'check' : 'alert')}</span><div><strong>${esc(t(cfg.results[ins.result]))} · ${esc(ins.finalizedName)}</strong><p>${when(ins.finalizedAt)}${ins.defects ? ` · ${esc(ins.defects)}` : ''}</p>${ins.result === 'maengel' ? `<p>${t('Mängel beheben, dann wieder öffnen, nachmessen und erneut abschließen.')}</p>` : ''}</div></div>`
      : `${ins.missing.length ? `<p class="so-hint">${t('Für den Abschluss fehlt: {list}', {list:esc(OrderInspection.missingText(ins.missing))})}</p>` : `<p class="so-hint">${icon('check',12)} ${t('Vollständig erfasst.')}</p>`}
        ${canClose && !montageDone() ? `<p class="so-step-lock">${icon('lock',13)} ${t(messages.montage_open)}</p>` : ''}
        ${canClose && draft ? `<p class="so-hint">${t('Erst speichern – abgeschlossen wird immer der gespeicherte Stand.')}</p>` : ''}`;
    return `<div class="so-grid-head"><span class="status-pill ${tone}">${esc(label)}${ins.revision > 1 ? ` · ${t('Revision {n}', {n:ins.revision})}` : ''}</span><div class="si-actions">${buttons}</div></div>
      ${hints}
      ${ins.updatedName ? `<p class="so-hint">${t('Zuletzt gespeichert von {name} · {time}', {name:esc(ins.updatedName), time:when(ins.updatedAt)})}</p>` : ''}`;
  }

  function testBodyMarkup() {
    const ins = current.inspection, cfg = schema.inspection;
    const notice = `<p class="so-hint">${icon('info',12)} ${esc(t(cfg.notice))}</p>`;
    const editable = permissions.inspect && ins?.status !== 'abgeschlossen';
    if (editable && (ins || testOpen || hasTestDraft())) {
      const draft = readStore(localStorage, testKey(currentID));
      const values = draft ? draft.values : ins || OrderInspection.defaults(current, user.username, schema.people);
      const conflict = draft && draft.base !== current.inspectionVersion
        ? `<div class="notice warning" role="alert"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Protokoll wurde inzwischen geändert')}</strong><p>${t('Gespeichert von {name} ({time}). Dein Entwurf basiert auf einem älteren Stand. Speichern ersetzt den Serverstand durch deinen Entwurf.', {name:esc(ins?.updatedName || t('jemand anderem')), time:when(ins?.updatedAt)})}</p></div></div>` : '';
      const status = draft ? t('Lokaler Entwurf vom {time} · noch nicht gespeichert', {time:when(draft.savedAt)}) : ins ? t('Gespeichert') : t('Noch nicht gespeichert');
      const savebar = `<div class="so-savebar"><span id="soTestStatus" role="status">${status}</span><p class="so-feedback" id="soTestFeedback" role="alert" hidden></p>
        <div class="so-savebar-actions">${draft ? `<button type="button" class="button outline small" data-action="so-test-discard">${t('Entwurf verwerfen')}</button>` : ''}
        <button type="button" class="button outline" data-action="so-test-save">${icon('save',15)} ${t('Speichern')}</button>
        <button type="button" class="button primary" data-action="so-test-ready">${icon('check',15)} ${t('Zur Freigabe übergeben')}</button></div></div>`;
      return notice + OrderInspection.formMarkup(values, {...testContext(), before:conflict, savebar});
    }
    if (editable) return `${notice}<p class="so-hint">${t('Nach der Montage messen und hier eintragen. Den Abschluss bestätigt der Elektromeister.')}</p><button class="button primary so-test-start" data-action="so-test-start">${icon('gauge',15)} ${t('Protokoll beginnen')}</button>`;
    if (ins) return notice + OrderInspection.readonlyMarkup(ins, testContext());
    return `${notice}<p class="so-hint">${t('Noch kein Protokoll. Erfassen können Monteur und Elektromeister.')}</p>`;
  }

  function renderTestBody() {
    const node = document.getElementById('soTestBody');
    if (!node) return;
    node.innerHTML = testBodyMarkup(); hydrateIcons(node);
    const head = document.getElementById('soTestHead'); head.innerHTML = testHeadMarkup(); hydrateIcons(head);
  }

  function rememberTest() {
    const form = document.getElementById('soTestForm');
    if (!currentID || !form) return;
    const {values} = OrderInspection.readForm(form, schema.inspection);
    const existing = readStore(localStorage, testKey(currentID));
    if (!writeStore(localStorage, testKey(currentID), {base:existing?.base ?? current.inspectionVersion, values, savedAt:new Date().toISOString()})) {
      feedback('soTestFeedback', t('Lokaler Speicher voll – Entwurf kann nicht gesichert werden. Bitte jetzt speichern.'));
    }
    const status = document.getElementById('soTestStatus');
    if (status) status.textContent = t('Lokaler Entwurf · noch nicht gespeichert');
    const head = document.getElementById('soTestHead');
    if (head && !existing) { head.innerHTML = testHeadMarkup(); hydrateIcons(head); }
  }

  async function saveTest(target, ready) {
    if (saving) return;
    const form = document.getElementById('soTestForm');
    const {values, invalid} = OrderInspection.readForm(form, schema.inspection);
    if (invalid.length) { feedback('soTestFeedback', t('Bitte prüfen: {list}.', {list:invalid.join(', ')})); form.querySelector('[aria-invalid=true]')?.focus(); return; }
    const draft = readStore(localStorage, testKey(currentID));
    if (draft && draft.base !== current.inspectionVersion && !confirmTestOverwrite) {
      confirmTestOverwrite = true; target.innerHTML = `${icon('check',15)} ${t('Trotzdem speichern')}`;
      feedback('soTestFeedback', t('Achtung: {name} hat das Protokoll inzwischen geändert. Speichern ersetzt diesen Stand durch deinen Entwurf.', {name:current.inspection?.updatedName || t('Jemand')}), 'info'); return;
    }
    const url = `/api/orders/${encodeURIComponent(currentID)}/inspection`;
    saving = true; form.querySelectorAll('.so-savebar .button').forEach(button => { button.disabled = true; }); feedback('soTestFeedback', t('Wird gespeichert …'), 'info');
    let message = '';
    try {
      let data;
      try { data = await call(url, {body:{version:current.inspectionVersion, inspection:values, ready}}); }
      catch (error) {
        if (error.code !== 'inspection_incomplete') throw error;
        // Not complete yet: keep the work on the server as a draft and say what is missing.
        data = await call(url, {body:{version:current.inspectionVersion, inspection:values, ready:false}});
        message = `${t('Als Entwurf gespeichert.')} ${t('Für die Freigabe fehlt: {list}', {list:OrderInspection.missingText(error.missing || [])})}`;
      }
      writeStore(localStorage, testKey(currentID), null); confirmTestOverwrite = false;
      current = data.order; replaceSummary(current); renderTestBody(); refreshSections();
      if (message) feedback('soTestFeedback', message);
      else showToast(t(ready ? 'Zur Freigabe übergeben' : 'Prüfprotokoll gespeichert'), esc(t(ready ? 'Der Elektromeister wird benachrichtigt.' : 'Entwurf auf dem Server gesichert.')), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); refreshSections(); }
      feedback('soTestFeedback', error.message);
    } finally {
      saving = false;
      document.querySelectorAll('#soTestForm .so-savebar .button').forEach(button => { button.disabled = false; });
    }
  }

  function showFinalize() {
    const ins = current.inspection, cfg = schema.inspection, defects = OrderInspection.hasDefects(ins);
    openModal({
      eyebrow: `${current.id} · ${t('PRÜFPROTOKOLL')}`, title: t('Prüfprotokoll abschließen'),
      body: `${OrderInspection.summaryMarkup(ins, cfg)}
        <fieldset class="so-choice"><legend>${t('Ergebnis')}</legend>${Object.entries(cfg.results).map(([key, label]) => {
          const allowed = (key === 'maengel') === defects;
          return `<label><input type="radio" name="soFinalResult" value="${key}" ${allowed ? 'checked' : 'disabled'}><span>${esc(t(label))}</span></label>`;
        }).join('')}</fieldset>
        <p class="so-hint">${t(defects ? 'Mindestens ein Punkt ist „n. i. O.“ – deshalb nur „Mit Mängeln“.' : 'Kein Punkt ist „n. i. O.“.')}</p>
        <div class="field so-assess"><label for="soFinalDefects">${t('Mängel und Maßnahmen')} <span>(${t('Pflicht bei „Mit Mängeln“')})</span></label><textarea id="soFinalDefects" rows="3" maxlength="2000"></textarea></div>
        <div class="notice warning"><span class="notice-icon">${icon('signature')}</span><div><strong>${t('Technische Verantwortung')}</strong><p>${t('Mit dem Abschluss bestätigst du als verantwortliche Elektrofachkraft die Erstprüfung. Danach ist das Protokoll schreibgeschützt; Änderungen nur über „Wieder öffnen“ mit Begründung.')}</p></div></div>
        <p class="sa-feedback" id="soFinalFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button success" data-action="so-test-confirm-finalize" data-version="${current.inspectionVersion}">${icon('signature',15)} ${t('Protokoll abschließen')}</button>`
    });
  }

  function showReopen() {
    openModal({
      eyebrow: `${current.id} · ${t('PRÜFPROTOKOLL')}`, title: t('Prüfprotokoll wieder öffnen'),
      body: `<p>${t('Die abgeschlossene Fassung bleibt im Verlauf erhalten und kann weiter gedruckt werden. Das Protokoll erhält eine neue Revision.')}</p>
        <div class="field so-assess"><label for="soReopenNote">${t('Begründung')} <span>(${t('Pflicht')})</span></label><textarea id="soReopenNote" rows="3" maxlength="2000"></textarea></div>
        <p class="sa-feedback" id="soReopenFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="so-test-confirm-reopen" data-version="${current.inspectionVersion}">${icon('edit',15)} ${t('Wieder öffnen')}</button>`
    });
  }

  async function closeTest(target, kind) {
    if (saving) return;
    const finalize = kind === 'finalize', feedbackID = finalize ? 'soFinalFeedback' : 'soReopenFeedback';
    const body = finalize
      ? {version:Number(target.dataset.version), result:document.querySelector('[name=soFinalResult]:checked')?.value, defects:document.getElementById('soFinalDefects').value}
      : {version:Number(target.dataset.version), note:document.getElementById('soReopenNote').value};
    const text = finalize ? body.defects : body.note, field = finalize ? 'soFinalDefects' : 'soReopenNote';
    if ((!finalize || body.result === 'maengel') && text.trim().length < 3) { feedback(feedbackID, t(messages.note_required)); document.getElementById(field).focus(); return; }
    saving = true; target.disabled = true; feedback(feedbackID, t('Wird gespeichert …'), 'info');
    try {
      const data = await call(`/api/orders/${encodeURIComponent(currentID)}/inspection/${kind}`, {body});
      closeModal(); current = data.order; replaceSummary(current); renderTestBody(); refreshSections();
      showToast(t(finalize ? 'Prüfprotokoll abgeschlossen' : 'Prüfprotokoll wieder geöffnet'), esc(finalize ? t(schema.inspection.results[body.result]) : t('Revision {n}', {n:current.inspection.revision})), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); renderTestBody(); refreshSections(); target.dataset.version = current.inspectionVersion; }
      feedback(feedbackID, error.missing ? `${error.message} ${t('Es fehlt: {list}.', {list:OrderInspection.missingText(error.missing)})}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  function filesMarkup() {
    const categories = schema.categories;
    const groups = Object.entries(categories).map(([key, label]) => {
      const files = (current.files || []).filter(file => file.category === key);
      if (!files.length) return '';
      return `<div class="so-file-group"><h4>${esc(t(label))} <span>${files.length}</span></h4><div class="so-files">${files.map(file => {
        const url = `/api/orders/${encodeURIComponent(current.id)}/files/${encodeURIComponent(file.id)}`;
        const image = ['image/jpeg','image/png','image/webp'].includes(file.mime);
        return `<a class="so-file" href="${url}" target="_blank" rel="noopener">${image ? `<img src="${url}" alt="${esc(file.name)}" loading="lazy">` : `<span class="so-file-icon">${icon('file-check',26)}</span>`}<span class="so-file-name">${esc(file.name)}</span><span class="so-file-meta">${esc(file.uploadedName)} · ${when(file.at)}</span></a>`;
      }).join('')}</div></div>`;
    }).join('');
    const queue = uploads.filter(item => item.orderID === current.id).map(item => `<li class="so-upload ${item.state}"><span>${esc(item.name)}</span><span>${item.state === 'sending' ? t('wird hochgeladen …') : item.state === 'failed' ? esc(item.error) : t('wartet')}</span>${item.state === 'failed' ? `<button type="button" class="button secondary small" data-action="so-retry-upload" data-upload="${item.key}">${t('Erneut')}</button><button type="button" class="button outline small" data-action="so-drop-upload" data-upload="${item.key}">${t('Verwerfen')}</button>` : ''}</li>`).join('');
    return `${permissions.upload ? `<div class="so-upload-bar"><div class="field"><label for="soCategory">${t('Kategorie')}</label><select id="soCategory">${Object.entries(categories).map(([key, label]) => `<option value="${key}">${esc(t(label))}</option>`).join('')}</select></div>
      <label class="button primary so-file-button">${icon('camera',15)} ${t('Foto aufnehmen')}<input type="file" accept="image/*" capture="environment" data-so-upload hidden></label>
      <label class="button outline so-file-button">${icon('upload',15)} ${t('Datei wählen')}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple data-so-upload hidden></label></div>` : ''}
      ${queue ? `<ul class="so-upload-queue">${queue}</ul>` : ''}
      ${groups || `<p class="so-hint">${t('Noch keine Fotos oder Dokumente. Wichtig: Hausanschlusskasten, Zählerschrank, Typenschild, Speicher.')}</p>`}
      <p class="so-hint">${t('Fotos werden vor dem Hochladen auf höchstens 2560 px verkleinert; Standortdaten der Kamera werden dabei entfernt. Höchstens 10 MB je Datei.')}</p>`;
  }

  function historyMarkup() {
    const detail = event => {
      const d = event.detail || {};
      if (event.action === 'step_changed') return `${esc(t(schema.steps.find(s => s.id === d.step)?.label || d.step))}${d.status ? ` → ${t(statusLabel[d.status])}` : ''}${d.assignee ? ` · ${esc(personName(d.assignee))}` : ''}${d.note ? ` · ${esc(d.note)}` : ''}`;
      if (event.action === 'assessed') return `${esc(t(schema.results[d.result] || ''))}${d.note ? ` · ${esc(d.note)}` : ''}`;
      if (event.action === 'file_added') return `${esc(t(schema.categories[d.category] || ''))} · ${esc(d.name || '')}`;
      if (event.action === 'survey_saved') return t('Version {n}', {n:d.surveyVersion});
      if (event.action === 'mood_changed') return `${esc(t(schema.moods?.[d.mood] || d.mood))}${d.note ? ` · ${esc(d.note)}` : ''}`;
      if (event.action === 'inspection_saved') return `${t('Revision {n}', {n:d.revision})} · ${esc(t(schema.inspection.statuses[d.status] || d.status))} · ${t('{n} Stromkreise', {n:d.circuits})}`;
      if (event.action === 'inspection_finalized') return `${t('Revision {n}', {n:d.revision})} · ${esc(t(schema.inspection.results[d.result] || d.result))}${d.defects ? ` · ${esc(d.defects)}` : ''}${d.protocol ? ` · <button type="button" class="text-button" data-action="so-test-print-event" data-event="${current.events.indexOf(event)}">${t('Diese Fassung drucken')}</button>` : ''}`;
      if (event.action === 'inspection_reopened') return `${t('Revision {n}', {n:d.revision})} · ${esc(d.note || '')}`;
      if (event.action === 'grid_changed') return `${d.previous && d.previous !== d.status ? esc(t(schema.grid.statuses[d.previous] || d.previous)) + ' → ' : ''}${esc(t(schema.grid.statuses[d.status] || d.status))}${d.reference ? ` · ${esc(d.reference)}` : ''}${d.note ? ` · ${esc(d.note)}` : ''}`;
      return '';
    };
    return `<ol class="sa-history">${[...current.events].reverse().map(event => `<li><strong>${eventLabel[event.action] ? t(eventLabel[event.action]) : esc(event.action)}</strong><span>${esc(event.actorName)} · ${when(event.at)}</span>${detail(event) ? `<p>${detail(event)}</p>` : ''}</li>`).join('')}</ol>`;
  }

  function renderDetail() {
    setPageMeta(`BÜLOW & DOLZ · ${t('AUFTRAG')}`, current ? current.title : t('Auftrag'));
    const back = `<button class="button outline small so-back" data-action="so-back">${icon('arrow-left',14)} ${t('Alle Aufträge')}</button>`;
    if (!current || !schema) return `<section class="section so-view" style="margin-top:0">${back}${detailError ? `<div class="card so-placeholder has-error" role="alert"><p>${esc(detailError)}</p><button class="button secondary small" data-action="so-reload">${icon('refresh',14)} ${t('Erneut laden')}</button></div>` : `<div class="card so-placeholder" role="status">${t('Auftrag wird geladen …')}</div>`}</section>`;
    return `<section class="section so-view so-detail" style="margin-top:0">
      ${back}
      ${detailError ? `<div class="notice warning" role="alert"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Server gerade nicht erreichbar')}</strong><p>${esc(detailError)}</p></div></div>` : ''}
      <div id="soHead">${headerMarkup()}</div>
      <nav class="so-jump" aria-label="${esc(t('Abschnitte'))}"><a href="#soStepsTitle">${t('Schritte')}</a><a href="#soSurveyTitle">${t('Aufnahme')}</a><a href="#soFilesTitle">${t('Fotos')}</a><a href="#soBalanceTitle">${t('Leistungsbilanz')}</a><a href="#soGridTitle">${t('Netzbetreiber')}</a><a href="#soTestTitle">${t('Prüfprotokoll')}</a><a href="#soHistoryTitle">${t('Verlauf')}</a></nav>
      <div class="so-columns">
        <div class="so-col">
          <section class="card so-block so-b-steps" aria-labelledby="soStepsTitle"><h3 id="soStepsTitle">${t('Schritte')}</h3><div id="soSteps">${stepsMarkup()}</div></section>
          <section class="card so-block so-b-balance" aria-labelledby="soBalanceTitle"><h3 id="soBalanceTitle">${t('Leistungsbilanz')}</h3><div id="soBalance">${balanceMarkup()}</div></section>
          <section class="card so-block so-b-grid" aria-labelledby="soGridTitle"><h3 id="soGridTitle">${t('Netzbetreiber')}</h3><div id="soGrid">${gridMarkup()}</div></section>
        </div>
        <div class="so-col">
          <section class="card so-block so-b-survey" aria-labelledby="soSurveyTitle"><h3 id="soSurveyTitle">${t('Aufnahme Hausanschluss')}</h3>${surveyMarkup()}</section>
          <section class="card so-block so-b-files" aria-labelledby="soFilesTitle"><h3 id="soFilesTitle">${t('Fotos und Dateien')}</h3><div id="soFiles">${filesMarkup()}</div></section>
          <section class="card so-block so-b-test" aria-labelledby="soTestTitle"><h3 id="soTestTitle">${t('Prüfprotokoll Erstprüfung')}</h3><div id="soTestHead">${testHeadMarkup()}</div><div id="soTestBody">${testBodyMarkup()}</div></section>
          <section class="card so-block so-b-history" aria-labelledby="soHistoryTitle"><h3 id="soHistoryTitle">${t('Verlauf')}</h3><div id="soHistory">${historyMarkup()}</div></section>
        </div>
      </div>
    </section>`;
  }

  // Updates every section except the survey form, so typing is never interrupted.
  function refreshSections() {
    if (state.view !== 'orders' || !current || !document.getElementById('soSteps')) return;
    const keepAssess = document.getElementById('soAssessNote')?.value, keepResult = document.querySelector('[name=soResult]:checked')?.value;
    document.getElementById('soHead').innerHTML = headerMarkup();
    document.getElementById('soSteps').innerHTML = stepsMarkup();
    document.getElementById('soBalance').innerHTML = balanceMarkup();
    document.getElementById('soGrid').innerHTML = gridMarkup();
    document.getElementById('soTestHead').innerHTML = testHeadMarkup();
    // The protocol form is only replaced while nobody types in it and no local draft exists.
    const form = document.getElementById('soTestForm');
    if (!form || (!hasTestDraft() && !form.contains(document.activeElement))) document.getElementById('soTestBody').innerHTML = testBodyMarkup();
    document.getElementById('soFiles').innerHTML = filesMarkup();
    document.getElementById('soHistory').innerHTML = historyMarkup();
    if (keepAssess != null && document.getElementById('soAssessNote')) document.getElementById('soAssessNote').value = keepAssess;
    if (keepResult) { const radio = document.querySelector(`[name=soResult][value="${keepResult}"]`); if (radio) radio.checked = true; }
    const status = document.getElementById('soSurveyStatus');
    if (status && !hasDraft()) status.textContent = savedStatus();
    hydrateIcons(document.querySelector('.so-detail'));
  }

  function savedStatus() { return t('Gespeichert · Version {n} · {name} · {time}', {n:current.surveyVersion, name:current.surveyBy || '', time:when(current.surveyAt)}); }

  function renderView() { return currentID ? renderDetail() : renderList(); }

  // ---------- Survey form ----------
  function parseNumber(text) {
    const cleaned = String(text).trim().replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
  }

  function readForm() {
    const values = {}, invalid = [];
    document.querySelectorAll('[data-sv-field]').forEach(input => {
      const field = schema.survey.flatMap(section => section.fields).find(item => item.id === input.dataset.svField);
      const error = input.parentElement.querySelector('.so-field-error');
      if (input.dataset.svNumber !== undefined) {
        const value = parseNumber(input.value);
        const bad = value != null && (Number.isNaN(value) || value < field.min || value > field.max);
        input.setAttribute('aria-invalid', bad); if (error) error.hidden = !bad;
        if (bad) invalid.push(t(field.label)); else if (value != null) values[field.id] = value;
      } else if (input.value.trim()) values[field.id] = input.value.trim();
    });
    const consumers = [];
    document.querySelectorAll('[data-sv-consumer]').forEach(row => {
      const name = row.querySelector('[data-c=name]').value.trim(), kwInput = row.querySelector('[data-c=kw]'), kw = parseNumber(kwInput.value);
      if (!name && kw == null) return;
      const bad = !name || kw == null || Number.isNaN(kw) || kw < 0 || kw > 200;
      kwInput.setAttribute('aria-invalid', bad);
      if (bad) invalid.push(`${t('Verbraucher')} ${name || t('(ohne Namen)')}`);
      else consumers.push({name, kw, phases:Number(row.querySelector('[data-c=phases]').value)});
    });
    if (consumers.length) values.verbraucher = consumers;
    return {values, invalid};
  }

  function rememberSurvey() {
    if (!currentID || !document.getElementById('soSurveyForm')) return;
    const {values} = readForm();
    const existing = readStore(localStorage, draftKey(currentID));
    const stable = value => JSON.stringify(Object.keys(value).sort().map(key => [key, value[key]]));
    const same = stable(values) === stable(current?.survey || {});
    if (same && (!existing || existing.base === current.surveyVersion)) writeStore(localStorage, draftKey(currentID), null);
    else if (!writeStore(localStorage, draftKey(currentID), {base:existing?.base ?? current.surveyVersion, values, savedAt:new Date().toISOString()})) {
      feedback('soSurveyFeedback', t('Lokaler Speicher voll – Entwurf kann nicht gesichert werden. Bitte jetzt speichern.'));
    }
    const status = document.getElementById('soSurveyStatus');
    if (status) status.textContent = hasDraft() ? t('Lokaler Entwurf · noch nicht gespeichert') : t('Gespeichert · Version {n}', {n:current.surveyVersion});
    const calc = document.getElementById('soBalance');
    if (calc) { const keep = document.getElementById('soAssessNote')?.value; calc.innerHTML = balanceMarkup(); hydrateIcons(calc); if (keep != null && document.getElementById('soAssessNote')) document.getElementById('soAssessNote').value = keep; }
  }

  function feedback(id, text, tone = 'error') {
    const node = document.getElementById(id);
    if (!node) { if (text && tone === 'error') showToast(t('Nicht gespeichert'), esc(text), 'warning'); return; }
    node.hidden = !text; node.textContent = text || ''; node.dataset.tone = tone;
  }

  async function saveSurvey(target) {
    if (saving) return;
    const {values, invalid} = readForm();
    if (invalid.length) { feedback('soSurveyFeedback', t('Bitte prüfen: {list}.', {list:invalid.join(', ')})); document.querySelector('[aria-invalid=true]')?.focus(); return; }
    const draft = readStore(localStorage, draftKey(currentID));
    if (draft && draft.base !== current.surveyVersion && !confirmOverwrite) {
      confirmOverwrite = true; target.innerHTML = `${icon('check',15)} ${t('Trotzdem speichern')}`;
      feedback('soSurveyFeedback', t('Achtung: {name} hat die Aufnahme inzwischen geändert. Speichern ersetzt diese Version durch deinen Entwurf.', {name:current.surveyBy || t('Jemand')}), 'info'); return;
    }
    saving = true; target.disabled = true; feedback('soSurveyFeedback', t('Wird gespeichert …'), 'info');
    try {
      const result = await call(`/api/orders/${encodeURIComponent(currentID)}/survey`, {body:{version:current.surveyVersion, survey:values}});
      writeStore(localStorage, draftKey(currentID), null); confirmOverwrite = false;
      current = result.order; replaceSummary(current); render();
      showToast(t('Aufnahme gespeichert'), t('Version {n}', {n:current.surveyVersion}), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); render(); }
      feedback('soSurveyFeedback', error.message);
    } finally { saving = false; const button = document.querySelector('[data-action=so-save-survey]'); if (button) button.disabled = false; }
  }

  function replaceSummary(order) {
    const summary = {...order}; delete summary.survey; delete summary.files; delete summary.events;
    const index = orders.findIndex(item => item.id === order.id);
    if (index >= 0) orders[index] = summary; else orders.unshift(summary);
    syncRows(); updateBadges();
  }

  async function assess(target) {
    if (saving) return;
    const result = document.querySelector('[name=soResult]:checked')?.value, note = document.getElementById('soAssessNote').value;
    if (!result) { feedback('soAssessFeedback', t('Bitte ein Ergebnis wählen.')); return; }
    if (result !== 'ausreichend' && note.trim().length < 3) { feedback('soAssessFeedback', t(messages.note_required)); document.getElementById('soAssessNote').focus(); return; }
    saving = true; target.disabled = true; feedback('soAssessFeedback', t('Wird gespeichert …'), 'info');
    try {
      const data = await call(`/api/orders/${encodeURIComponent(currentID)}/assessment`, {body:{surveyVersion:current.surveyVersion, result, note}});
      current = data.order; replaceSummary(current); refreshSections();
      showToast(t('Bewertung gespeichert'), esc(t(schema.results[result])), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); }
      feedback('soAssessFeedback', error.message); target.disabled = false;
      if (error.order) { refreshSections(); feedback('soAssessFeedback', error.message); }
    } finally { saving = false; }
  }

  // ---------- Dialogs: order master data and steps ----------
  function showOrderForm(order = null) {
    const c = order?.customer || {}, a = order?.address || {};
    openModal({
      eyebrow: order ? order.id : t('NEUER AUFTRAG'), title: t(order ? 'Auftrag bearbeiten' : 'Neuer Auftrag'),
      body: `<div class="so-order-form">
        <div class="field so-wide"><label for="soTitle">${t('Titel')}</label><input id="soTitle" maxlength="120" value="${esc(order?.title || t('Heizstab 12 kW – Hausanschluss prüfen'))}"></div>
        <div class="field"><label for="soCustomer">${t('Kunde')}</label><input id="soCustomer" maxlength="120" autocomplete="off" value="${esc(c.name || '')}"></div>
        <div class="field"><label for="soPhone">${t('Telefon')}</label><input id="soPhone" type="tel" maxlength="40" autocomplete="off" value="${esc(c.phone || '')}"></div>
        <div class="field so-wide"><label for="soEmail">${t('E-Mail')}</label><input id="soEmail" type="email" maxlength="120" autocomplete="off" value="${esc(c.email || '')}"></div>
        <div class="field so-wide"><label for="soStreet">${t('Straße')}</label><input id="soStreet" maxlength="120" autocomplete="off" value="${esc(a.street || '')}"></div>
        <div class="field"><label for="soPostcode">${t('PLZ')}</label><input id="soPostcode" inputmode="numeric" maxlength="10" autocomplete="off" value="${esc(a.postcode || '')}"></div>
        <div class="field"><label for="soCity">${t('Ort')}</label><input id="soCity" maxlength="80" autocomplete="off" value="${esc(a.city || '')}"></div>
        <div class="field so-wide"><label for="soNote">${t('Notiz')}</label><textarea id="soNote" rows="3" maxlength="2000">${esc(order?.note || '')}</textarea></div>
      </div>
      <div class="notice warning section"><span class="notice-icon">${icon('shield')}</span><div><strong>${t('Testbetrieb ohne Verschlüsselung')}</strong><p>${t('Kundendaten nur eintragen, wenn ihr das für diesen internen WLAN-Test bewusst entschieden habt.')}</p></div></div>
      <p class="sa-feedback" id="soFormFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="so-save-order" ${order ? `data-version="${order.version}"` : ''}>${icon('check',15)} ${t(order ? 'Speichern' : 'Anlegen')}</button>`
    });
  }

  async function saveOrder(target) {
    if (saving) return;
    const value = id => document.getElementById(id).value;
    const payload = {title:value('soTitle'), customer:{name:value('soCustomer'), phone:value('soPhone'), email:value('soEmail')}, address:{street:value('soStreet'), postcode:value('soPostcode'), city:value('soCity')}, note:value('soNote')};
    const missing = [['soTitle','Titel'],['soCustomer','Kunde'],['soCity','Ort']].filter(([id]) => !value(id).trim());
    if (missing.length) { feedback('soFormFeedback', t('Bitte ausfüllen: {list}.', {list:missing.map(([, label]) => t(label)).join(', ')})); document.getElementById(missing[0][0]).focus(); return; }
    saving = true; target.disabled = true; feedback('soFormFeedback', t('Wird gespeichert …'), 'info');
    try {
      const editing = target.dataset.version !== undefined;
      const data = await call(editing ? `/api/orders/${encodeURIComponent(currentID)}` : '/api/orders', {body:editing ? {...payload, version:Number(target.dataset.version)} : payload});
      closeModal(); current = data.order; currentID = current.id; writeStore(sessionStorage, `bd-order-open-${prefix}`, currentID);
      replaceSummary(current); render(); window.scrollTo({top:0});
      showToast(t(editing ? 'Auftrag gespeichert' : 'Auftrag angelegt'), esc(current.id), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); target.dataset.version = current.version; }
      feedback('soFormFeedback', error.order ? `${error.message} ${t('Aktueller Stand wurde geladen; erneut speichern übernimmt deine Eingaben.')}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  function showStep(stepID) {
    const step = schema.steps.find(item => item.id === stepID), entry = current.steps[stepID];
    openModal({
      eyebrow: `${current.id} · ${t('SCHRITT')}`, title: t(step.label),
      body: `<div class="so-order-form">
        ${step.derived ? `<p class="so-wide so-hint">${t(stepID === 'abnahme' ? 'Der Status ergibt sich automatisch aus der Elektro-Abnahme. Hier nur Zuständigkeit und Termin.' : 'Der Status ergibt sich automatisch aus der Bewertung des Elektromeisters. Hier nur Zuständigkeit und Termin.')}</p>` : `<div class="field so-wide"><label for="soStepStatus">${t('Status')}</label><select id="soStepStatus">${schema.statuses.map(status => `<option value="${status}" ${status === entry.status ? 'selected' : ''} ${stepID === 'montage' && !gridApproved() && ['in_arbeit','erledigt'].includes(status) && status !== entry.status ? 'disabled' : ''}>${t(statusLabel[status])}</option>`).join('')}</select></div>`}
        ${stepID === 'montage' && !gridApproved() ? `<p class="so-wide so-step-lock">${icon('lock',13)} ${t(messages.grid_approval_missing)}</p>` : ''}
        <div class="field"><label for="soStepAssignee">${t('Zuständig')}</label><select id="soStepAssignee"><option value="">${t('– niemand –')}</option>${schema.people.map(p => `<option value="${esc(p.username)}" ${p.username === entry.assignee ? 'selected' : ''}>${esc(p.name)} · ${esc(t(p.roleLabel))}</option>`).join('')}</select></div>
        <div class="field"><label for="soStepDue">${t('Fällig am')}</label><input id="soStepDue" type="date" value="${esc(entry.due || '')}"></div>
        <div class="field so-wide"><label for="soStepNote">${t('Notiz')} <span>(${t('Pflicht bei „Blockiert“')})</span></label><textarea id="soStepNote" rows="3" maxlength="1000">${esc(entry.note || '')}</textarea></div>
      </div>
      ${entry.updatedName ? `<p class="so-hint">${t('Zuletzt geändert von {name} · {time}', {name:esc(entry.updatedName), time:when(entry.updatedAt)})}</p>` : ''}
      <p class="sa-feedback" id="soStepFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="so-save-step" data-step="${stepID}" data-version="${entry.version}">${icon('check',15)} ${t('Speichern')}</button>`
    });
  }

  async function saveStep(target) {
    if (saving) return;
    const stepID = target.dataset.step, status = document.getElementById('soStepStatus')?.value, note = document.getElementById('soStepNote').value;
    if (status === 'blockiert' && note.trim().length < 3) { feedback('soStepFeedback', t(messages.note_required)); document.getElementById('soStepNote').focus(); return; }
    saving = true; target.disabled = true; feedback('soStepFeedback', t('Wird gespeichert …'), 'info');
    try {
      const data = await call(`/api/orders/${encodeURIComponent(currentID)}/steps/${stepID}`, {body:{version:Number(target.dataset.version), status:status || 'offen', assignee:document.getElementById('soStepAssignee').value || null, due:document.getElementById('soStepDue').value || null, note}});
      closeModal(); current = data.order; replaceSummary(current); refreshSections();
      showToast(t('Schritt gespeichert'), esc(t(schema.steps.find(s => s.id === stepID).label)), 'success');
    } catch (error) {
      if (error.order) { current = error.order; replaceSummary(current); refreshSections(); target.dataset.version = current.steps[stepID].version; }
      feedback('soStepFeedback', error.order ? `${error.message} ${t('Aktueller Stand: {status}, {name}. Erneut speichern übernimmt deine Eingaben.', {status:t(statusLabel[current.steps[stepID].status]), name:personName(current.steps[stepID].assignee) || t('niemand')})}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  async function requestAcceptance(target) {
    target.disabled = true;
    try {
      const data = await call('/api/acceptances', {body:{projectID:currentID, note:`Aus Auftrag ${current.title}`}});
      showToast(t('Abnahme angefordert'), esc(data.acceptance.id), 'success');
      await loadDetail(); ServerAcceptance.load();
    } catch (error) { showToast(t('Abnahme nicht angefordert'), esc(messages[error.code] ? t(messages[error.code]) : error.message), 'warning'); target.disabled = false; }
  }

  // ---------- Uploads ----------
  async function shrink(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1.5 * 1024 * 1024 || !window.createImageBitmap) return file;
    try {
      const bitmap = await createImageBitmap(file, {imageOrientation:'from-image'});
      const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {type:'image/jpeg'}) : file;
    } catch { return file; }
  }

  async function send(item) {
    item.state = 'sending'; item.error = ''; refreshFiles();
    try {
      const body = await shrink(item.file);
      if (body.size > (schema?.maxFile || 10485760)) throw {code:'file_too_large', message:t(messages.file_too_large)};
      const type = body.type || (/\.heic$/i.test(body.name) ? 'image/heic' : '');
      const data = await call(`/api/orders/${encodeURIComponent(item.orderID)}/files?category=${encodeURIComponent(item.category)}`, {raw:body, headers:{'Content-Type':type || 'application/octet-stream', 'X-BD-Filename':encodeURIComponent(body.name)}});
      uploads.splice(uploads.indexOf(item), 1);
      if (current?.id === item.orderID) { current = data.order; replaceSummary(current); }
    } catch (error) { item.state = 'failed'; item.error = error.message; }
    refreshFiles();
  }

  function refreshFiles() {
    const node = document.getElementById('soFiles');
    if (!node || !current) return;
    const category = document.getElementById('soCategory')?.value;
    node.innerHTML = filesMarkup(); hydrateIcons(node);
    if (category && document.getElementById('soCategory')) document.getElementById('soCategory').value = category;
    const history = document.getElementById('soHistory'); if (history) history.innerHTML = historyMarkup();
  }

  function queueFiles(input) {
    const category = document.getElementById('soCategory')?.value || 'sonstiges';
    for (const file of input.files) {
      const item = {key:crypto.randomUUID(), orderID:currentID, category, file, name:file.name || 'Foto', state:'waiting'};
      uploads.push(item); send(item);
    }
    input.value = '';
  }

  // ---------- Actions ----------
  function open(id) {
    if (state.view === 'orders' && id !== currentID) MobileBack.record();
    currentID = id; current = current?.id === id ? current : null; detailError = ''; confirmOverwrite = false; confirmTestOverwrite = false; testOpen = false;
    writeStore(sessionStorage, `bd-order-open-${prefix}`, id);
    if (state.view !== 'orders') setView('orders'); else { render(); window.scrollTo({top:0}); }
    loadDetail();
  }

  function action(name, target) {
    if (!enabled) return;
    if (name === 'so-open') open(target.dataset.order);
    else if (name === 'so-back') { if ((hasDraft() || hasTestDraft()) && !confirm(t('Es gibt einen ungespeicherten lokalen Entwurf. Er bleibt auf diesem Gerät erhalten. Trotzdem zur Liste?'))) return; MobileBack.record(); currentID = null; current = null; writeStore(sessionStorage, `bd-order-open-${prefix}`, null); render(); loadList(); }
    else if (name === 'so-reload') { currentID ? loadDetail() : (phase = phase === 'error' ? 'loading' : phase, render(), loadList()); }
    else if (name === 'so-filter') { filter = target.dataset.filter; render(); }
    else if (name === 'so-new') showOrderForm();
    else if (name === 'so-edit') showOrderForm(current);
    else if (name === 'so-save-order') saveOrder(target);
    else if (name === 'so-step') showStep(target.dataset.step);
    else if (name === 'so-save-step') saveStep(target);
    else if (name === 'so-save-survey') saveSurvey(target);
    else if (name === 'so-discard-draft') { if (confirm(t('Lokalen Entwurf verwerfen und gespeicherte Aufnahme anzeigen?'))) { writeStore(localStorage, draftKey(currentID), null); confirmOverwrite = false; render(); } }
    else if (name === 'so-add-consumer') { document.getElementById('soConsumers').insertAdjacentHTML('beforeend', consumerRow({name:target.dataset.name})); hydrateIcons(document.getElementById('soConsumers')); const rowsList = document.querySelectorAll('[data-sv-consumer]'); rowsList[rowsList.length - 1].querySelector(target.dataset.name ? '[data-c=kw]' : '[data-c=name]').focus(); rememberSurvey(); }
    else if (name === 'so-remove-consumer') { target.closest('[data-sv-consumer]').remove(); rememberSurvey(); }
    else if (name === 'so-assess') assess(target);
    else if (name === 'so-grid') showGrid();
    else if (name === 'so-save-grid') saveGrid(target);
    else if (name === 'so-grid-upload') { const select = document.getElementById('soCategory'); if (select) select.value = 'netzbetreiber'; document.getElementById('soFilesTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); document.querySelector('.so-file-button')?.focus({preventScroll:true}); }
    else if (name === 'so-request-acceptance') requestAcceptance(target);
    else if (name === 'so-test-start') { testOpen = true; renderTestBody(); document.querySelector('#soTestForm select, #soTestForm input')?.focus(); }
    else if (name === 'so-test-save') saveTest(target, false);
    else if (name === 'so-test-ready') saveTest(target, true);
    else if (name === 'so-test-discard') { if (confirm(t('Lokalen Entwurf verwerfen und gespeichertes Protokoll anzeigen?'))) { writeStore(localStorage, testKey(currentID), null); confirmTestOverwrite = false; renderTestBody(); } }
    else if (name === 'so-test-add-circuit') {
      const list = document.getElementById('siCircuits'), count = list.querySelectorAll('[data-si-circuit]').length;
      if (count >= 30) { feedback('soTestFeedback', t('Höchstens 30 Stromkreise je Protokoll.')); return; }
      list.insertAdjacentHTML('beforeend', OrderInspection.circuitMarkup({id:OrderInspection.newID()}, count, schema.inspection));
      hydrateIcons(list); list.lastElementChild.querySelector('[data-k=name]').focus(); rememberTest();
    }
    else if (name === 'so-test-remove-circuit') {
      const card = target.closest('[data-si-circuit]'), label = card.querySelector('[data-k=name]').value.trim();
      if (!confirm(t('Stromkreis „{name}“ mit allen Messwerten entfernen?', {name:label || t('(ohne Namen)')}))) return;
      const form = card.closest('form'); card.remove(); OrderInspection.renumber(form); rememberTest();
    }
    else if (name === 'so-test-finalize') showFinalize();
    else if (name === 'so-test-confirm-finalize') closeTest(target, 'finalize');
    else if (name === 'so-test-reopen') showReopen();
    else if (name === 'so-test-confirm-reopen') closeTest(target, 'reopen');
    else if (name === 'so-test-print') OrderInspection.print(current, current.inspection, testContext());
    else if (name === 'so-test-print-event') { const event = current.events[Number(target.dataset.event)]; if (event?.detail?.protocol) OrderInspection.print(current, event.detail.protocol, testContext()); }
    else if (name === 'so-open-acceptance') { ServerAcceptance.load().then(() => ServerAcceptance.open(target.dataset.acceptance)); }
    else if (name === 'so-retry-upload') { const item = uploads.find(entry => entry.key === target.dataset.upload); if (item) send(item); }
    else if (name === 'so-drop-upload') { const index = uploads.findIndex(entry => entry.key === target.dataset.upload); if (index >= 0) uploads.splice(index, 1); refreshFiles(); }
  }

  // Project ring (project-ring.js): read-only snapshot and the customer mood write.
  function snapshot() { return {orders, schema, permissions, phase, loadError}; }
  async function saveMood(id, version, mood, note) {
    try {
      const data = await call(`/api/orders/${encodeURIComponent(id)}/mood`, {body:{version, mood, note}});
      if (current?.id === id) current = data.order;
      replaceSummary(data.order);
      return data.order;
    } catch (error) {
      if (error.order) { if (current?.id === id) current = error.order; replaceSummary(error.order); }
      throw error;
    }
  }

  // Used by the back arrow: shows the list (null) or an order without recording a new step.
  function show(id) {
    currentID = id || null; current = current?.id === id ? current : null; detailError = ''; confirmOverwrite = false; confirmTestOverwrite = false; testOpen = false;
    writeStore(sessionStorage, `bd-order-open-${prefix}`, currentID);
    if (currentID) loadDetail(); else loadList();
  }

  function busy() { return saving || uploads.some(item => item.state !== 'failed'); }

  function start() {
    if (!enabled) return;
    document.addEventListener('input', event => {
      if (event.target.closest('#soSurveyForm')) rememberSurvey();
      if (event.target.closest('#soTestForm')) { const card = event.target.closest('[data-si-circuit]'); if (card) OrderInspection.updateCircuit(card, schema.inspection); rememberTest(); }
    });
    document.addEventListener('change', event => {
      if (event.target.matches('[data-so-upload]')) { queueFiles(event.target); return; }
      if (event.target.closest('#soSurveyForm')) rememberSurvey();
      if (event.target.id === 'si-pick') OrderInspection.pickInstrument(event.target.form);
      if (event.target.closest('#soTestForm')) { const card = event.target.closest('[data-si-circuit]'); if (card) OrderInspection.updateCircuit(card, schema.inspection); OrderInspection.updateCalibration(event.target.closest('form')); rememberTest(); }
      if (event.target.id === 'sg-status') markGridRequired();
    });
    window.addEventListener('beforeunload', event => { if (uploads.length || saving) { event.preventDefault(); event.returnValue = ''; } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { loadList(); loadDetail({quiet:true}); } });
    loadList();
    if (currentID) loadDetail({quiet:true});
    setInterval(() => {
      if (document.visibilityState !== 'visible' || busy()) return;
      loadList();
      if (state.view === 'orders' && currentID) loadDetail({quiet:true});
    }, 10000);
  }

  // Home screen launcher, only with the authenticated backend. Artwork: Tools/icon-studio.html (orders).
  if (enabled) workspaceAreas.splice(2, 0, {view:'orders', name:'Aufträge', icon:'hard-hat', tone:'electric', keywords:'Auftragsakte Heizstab Hausanschluss Aufnahme Baustelle Leistungsbilanz'});

  return {enabled, canCreate:() => Boolean(permissions.create), snapshot, saveMood, start, renderView, open, openOrder:open, show, currentOrder:() => currentID, action, busy, notificationRows, loadList};
})();
