// Prüfmittel (server mode): instruments with calibration due dates (Backend/instruments.py).
// Editors (admin, meister) get reminders for expired and soon-due instruments; the inspection
// protocol can take instrument, serial number and calibration date from this list.
const ServerInstruments = (() => {
  const enabled = Boolean(window.BD_BACKEND?.enabled && window.BD_BACKEND.user);
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  const prefix = enabled ? `${BD_BACKEND.workspaceID}-${BD_BACKEND.user.username}` : '';
  const statusLabel = {abgelaufen:'Kalibrierung abgelaufen', bald:'Bald fällig', gueltig:'Gültig', ausgemustert:'Ausgemustert'};
  const statusTone = {abgelaufen:'red', bald:'amber', gueltig:'green', ausgemustert:'gray'};
  const eventLabel = {created:'Angelegt', updated:'Geändert', calibrated:'Kalibrierung eingetragen', retired:'Ausgemustert'};
  const messages = {
    offline:'Keine Verbindung zum Server. Nichts wurde gespeichert; deine Eingaben bleiben im Dialog.',
    forbidden_role:'Prüfmittel pflegen Elektromeister und Geschäftsführung.',
    version_conflict:'Inzwischen hat jemand anderes geändert. Deine Eingaben sind nicht gespeichert und bleiben erhalten.',
    serial_exists:'Diese Seriennummer ist bereits erfasst.', calibration_required:'Bitte das Datum „Kalibriert bis“ eintragen.',
    name_required:'Bitte die Bezeichnung eintragen.', serial_required:'Bitte die Seriennummer eintragen.',
    note_required:'Bitte eine Begründung eintragen.', unknown_person:'Unbekannte Person.', invalid_instrument:'Eine Angabe ist ungültig.',
    storage_unavailable:'Serverspeicher nicht verfügbar. Nichts wurde gespeichert.'
  };
  let items = [], permissions = {edit:false}, phase = 'loading', loadError = '', saving = false;
  const rows = new Map();
  let receipts = {}; try { receipts = JSON.parse(localStorage.getItem(`bd-instrument-receipts-${prefix}`) || '{}'); } catch {}
  const day = value => value ? new Date(value + 'T12:00:00').toLocaleDateString(I18n.locale(), {day:'2-digit', month:'2-digit', year:'numeric'}) : '–';

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
      throw {code, record:data.instrument, message:messages[code] ? t(messages[code]) : t('Serverfehler {status}. Nichts wurde gespeichert.', {status:response.status})};
    }
    return data;
  }

  async function load() {
    if (!enabled) return;
    try {
      const data = await call('/api/instruments');
      const changed = JSON.stringify(data.instruments) !== JSON.stringify(items) || phase !== 'ready';
      items = data.instruments; permissions = data.permissions; phase = 'ready'; loadError = '';
      syncRows();
      if (changed && state.view === 'instruments' && document.getElementById('modalBackdrop').hidden) render(); else updateBadges();
    } catch (error) { loadError = error.message; if (phase !== 'ready') phase = 'error'; if (state.view === 'instruments') render(); }
  }

  // Reminders for editors: expired (urgent) and due within 30 days.
  function syncRows() {
    const visible = new Set();
    if (permissions.edit) for (const item of items) {
      if (!['abgelaufen','bald'].includes(item.status)) continue;
      const id = `instrument:${item.id}`; visible.add(id);
      const row = rows.get(id) || {id};
      Object.assign(row, {area:'instruments', target:{view:'instruments'}, status:item.status, updatedAt:item.updatedAt, deadline:item.calibratedUntil,
        rank:item.status === 'abgelaufen' ? 2 : 1, title:`${t(statusLabel[item.status])} · ${item.name}`, text:`SN ${item.serial} · ${t('Kalibriert bis {date}', {date:day(item.calibratedUntil)})}`});
      const receipt = receipts[id] || {};
      if (receipt.read) row.notificationReadFingerprint = receipt.read;
      if (receipt.archived) row.notificationArchivedFingerprint = receipt.archived;
      rows.set(id, row);
    }
    for (const id of [...rows.keys()]) if (!visible.has(id)) rows.delete(id);
  }
  function notificationRows() {
    for (const row of rows.values()) receipts[row.id] = {read:row.notificationReadFingerprint, archived:row.notificationArchivedFingerprint};
    try { localStorage.setItem(`bd-instrument-receipts-${prefix}`, JSON.stringify(receipts)); } catch {}
    return [...rows.values()];
  }

  function render() {
    setPageMeta('BÜLOW & DOLZ', t('Prüfmittel'));
    const people = ServerOrders.snapshot().schema?.people || [];
    const person = username => people.find(p => p.username === username)?.name || '';
    const head = `<div class="section-header"><div><h2>${t('Prüfmittel')}</h2><p>${t('Messgeräte mit Seriennummer und Kalibrierfrist. Das Prüfprotokoll übernimmt die Angaben von hier.')}</p></div>${permissions.edit ? `<button class="button primary small" data-action="pm-new">${icon('plus',14)} ${t('Prüfmittel anlegen')}</button>` : ''}</div>`;
    if (phase !== 'ready') return `<section class="section pm-view" style="margin-top:0">${head}<div class="card so-placeholder" ${phase === 'error' ? 'role="alert"' : 'role="status"'}>${esc(loadError || t('Prüfmittel werden geladen …'))}</div></section>`;
    const count = key => items.filter(item => item.status === key).length;
    return `<section class="section pm-view" style="margin-top:0">${head}
      <div class="pm-summary">${['abgelaufen','bald','gueltig'].map(key => `<div class="pm-stat tone-${statusTone[key]}"><strong>${count(key)}</strong><span>${t(statusLabel[key])}</span></div>`).join('')}</div>
      <div class="pm-list">${items.map(item => `<article class="pm-item status-${item.status}">
        <span class="pm-icon" aria-hidden="true">${icon('gauge',20)}</span>
        <div class="pm-copy"><strong>${esc(item.name)}</strong><small>${esc([item.manufacturer, `SN ${item.serial}`].filter(Boolean).join(' · '))}</small>
          <small>${esc([item.holder ? person(item.holder) : '', item.location].filter(Boolean).join(' · '))}</small></div>
        <div class="pm-due"><span class="status-pill ${statusTone[item.status]}">${t(statusLabel[item.status])}</span><small>${t('Kalibriert bis {date}', {date:day(item.calibratedUntil)})}</small></div>
        ${permissions.edit ? `<button class="button outline small" data-action="pm-edit" data-id="${esc(item.id)}">${icon('edit',14)} ${t('Bearbeiten')}</button>` : ''}
      </article>`).join('') || emptyState('gauge', t('Noch keine Prüfmittel'), t(permissions.edit ? 'Lege die Messgeräte mit Seriennummer und Kalibrierdatum an.' : 'Prüfmittel legen Elektromeister und Geschäftsführung an.'))}</div>
      <p class="assist-note">${icon('info',14)} ${t('Erinnerung ab 30 Tagen vor Ablauf. Ob ein Gerät verwendet werden darf, entscheidet die verantwortliche Elektrofachkraft.')}</p>
    </section>`;
  }

  function showForm(item = null) {
    const people = ServerOrders.snapshot().schema?.people || [];
    const v = item || {active:true};
    const field = (id, label, input, wide = false) => `<div class="field${wide ? ' so-wide' : ''}"><label for="pm-${id}">${t(label)}</label>${input}</div>`;
    openModal({
      eyebrow: item ? `${item.id} · ${t('PRÜFMITTEL')}` : t('PRÜFMITTEL'), title: t(item ? 'Prüfmittel bearbeiten' : 'Prüfmittel anlegen'),
      body: `<div class="so-order-form">
        ${field('name', 'Bezeichnung (z. B. Installationstester)', `<input id="pm-name" maxlength="80" value="${esc(v.name || '')}">`, true)}
        ${field('manufacturer', 'Hersteller / Typ', `<input id="pm-manufacturer" maxlength="80" value="${esc(v.manufacturer || '')}">`)}
        ${field('serial', 'Seriennummer', `<input id="pm-serial" maxlength="40" value="${esc(v.serial || '')}">`)}
        ${field('calibratedUntil', 'Kalibriert bis', `<input id="pm-calibratedUntil" type="date" value="${esc(v.calibratedUntil || '')}">`)}
        ${field('holder', 'Bei wem', `<select id="pm-holder"><option value="">${t('– niemand –')}</option>${people.map(p => `<option value="${esc(p.username)}" ${p.username === v.holder ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`)}
        ${field('location', 'Ort (z. B. Fahrzeug, Lager)', `<input id="pm-location" maxlength="80" value="${esc(v.location || '')}">`, true)}
        ${item ? `<label class="sa-check so-wide"><input type="checkbox" id="pm-retired" ${v.active ? '' : 'checked'}><span>${t('Ausgemustert (Begründung in der Notiz)')}</span></label>` : ''}
        ${field('note', 'Notiz', `<textarea id="pm-note" rows="2" maxlength="1000">${esc(v.note || '')}</textarea>`, true)}
      </div>
      ${item?.events?.length ? `<details class="pm-history"><summary>${t('Verlauf')}</summary><ol class="sa-history">${[...item.events].reverse().map(e => `<li><strong>${t(eventLabel[e.action] || e.action)}</strong><span>${esc(e.actorName)} · ${new Date(e.at).toLocaleString(I18n.locale())}</span>${e.detail.calibratedUntil ? `<p>${t('Kalibriert bis {date}', {date:day(e.detail.calibratedUntil)})}${e.detail.note ? ` · ${esc(e.detail.note)}` : ''}</p>` : ''}</li>`).join('')}</ol></details>` : ''}
      <p class="sa-feedback" id="pmFeedback" role="alert" hidden></p>`,
      footer: `<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="pm-save" ${item ? `data-id="${esc(item.id)}" data-version="${item.version}"` : ''}>${icon('check',15)} ${t('Speichern')}</button>`
    });
  }

  function feedback(text, tone = 'error') { const node = document.getElementById('pmFeedback'); if (node) { node.hidden = !text; node.textContent = text; node.dataset.tone = tone; } }

  async function save(target) {
    if (saving) return;
    const value = id => document.getElementById('pm-' + id).value.trim();
    const instrument = {name:value('name'), manufacturer:value('manufacturer'), serial:value('serial'), calibratedUntil:value('calibratedUntil'),
      holder:value('holder'), location:value('location'), note:value('note'), active:!document.getElementById('pm-retired')?.checked};
    const missing = [['name','Bezeichnung'],['serial','Seriennummer'],['calibratedUntil','Kalibriert bis']].filter(([key]) => !instrument[key]);
    if (missing.length) { feedback(t('Bitte ausfüllen: {list}.', {list:missing.map(([, label]) => t(label)).join(', ')})); document.getElementById('pm-' + missing[0][0]).focus(); return; }
    if (!instrument.active && instrument.note.length < 3) { feedback(t(messages.note_required)); document.getElementById('pm-note').focus(); return; }
    saving = true; target.disabled = true; feedback(t('Wird gespeichert …'), 'info');
    try {
      const editing = Boolean(target.dataset.id);
      await call(editing ? `/api/instruments/${encodeURIComponent(target.dataset.id)}` : '/api/instruments', editing ? {version:Number(target.dataset.version), instrument} : {instrument});
      closeModal(); await load(); window.render();
      showToast(t('Prüfmittel gespeichert'), esc(instrument.name), 'success');
    } catch (error) {
      if (error.record) target.dataset.version = error.record.version;
      feedback(error.record && error.code === 'version_conflict' ? `${error.message} ${t('Aktueller Stand wurde geladen; erneut speichern übernimmt deine Eingaben.')}` : error.message);
    } finally { saving = false; target.disabled = false; }
  }

  function action(name, target) {
    if (name === 'pm-new') showForm();
    else if (name === 'pm-edit') showForm(items.find(item => item.id === target.dataset.id));
    else if (name === 'pm-save') save(target);
  }

  function start() {
    if (!enabled) return;
    load();
    setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
  }

  // Active instruments for the inspection protocol (newest calibration first).
  const active = () => items.filter(item => item.active).sort((a, b) => b.calibratedUntil.localeCompare(a.calibratedUntil));
  if (enabled) workspaceAreas.splice(workspaceAreas.findIndex(area => area.view === 'smartops') + 1, 0, {view:'instruments', name:'Prüfmittel', icon:'gauge', tone:'teal', keywords:'Messgeräte Kalibrierung DGUV Prüfgerät Seriennummer'});
  return {enabled, start, load, render, action, notificationRows, active};
})();
