// Arbeitszeit (server mode): clock, week with manual entries, review (Backend/timesheets.py).
// Everyone records their own time; Meister and Geschäftsführung approve or return other people's
// weeks. ArbZG hints are warnings for the reviewing person, not an automatic decision.
const ServerTime = (() => {
  const enabled = Boolean(window.BD_BACKEND?.enabled && window.BD_BACKEND.user);
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  const me = enabled ? BD_BACKEND.user.username : '';
  const prefix = enabled ? `${BD_BACKEND.workspaceID}-${me}` : '';
  const statusLabel = {offen:'Offen', eingereicht:'Eingereicht', freigegeben:'Freigegeben', zurueckgegeben:'Zurückgegeben'};
  const statusTone = {offen:'gray', eingereicht:'amber', freigegeben:'green', zurueckgegeben:'red'};
  const warnLabel = {max10h:'Über 10 Std. gearbeitet', pause30:'Pause unter 30 Min. (ab 6 Std.)', pause45:'Pause unter 45 Min. (ab 9 Std.)', rest11:'Ruhezeit unter 11 Std.'};
  const eventLabel = {added:'Nachgetragen', changed:'Geändert', deleted:'Gelöscht', clock_start:'Gestempelt: Start', clock_pause:'Pause', clock_resume:'Weiter', clock_stop:'Gestempelt: Ende',
    submitted:'Woche eingereicht', approved:'Freigegeben', returned:'Zurückgegeben', reopened:'Wieder geöffnet'};
  const messages = {
    offline:'Keine Verbindung zum Server. Nichts wurde gespeichert; deine Eingaben bleiben im Dialog.',
    forbidden_role:'Keine Berechtigung für diese Aktion.', own_week:'Die eigene Woche gibt eine andere Person frei.',
    reason_required:'Bitte eine Begründung eintragen.', overlap:'Überschneidet sich mit einem anderen Zeitblock.',
    invalid_range:'Ende muss nach dem Beginn am selben Tag liegen.', invalid_break:'Die Pause ist länger als der Zeitblock.',
    future_time:'Zeiten in der Zukunft können nicht nachgetragen werden.', week_locked:'Diese Woche ist eingereicht oder freigegeben und deshalb gesperrt.',
    still_running:'Die Stempeluhr läuft noch. Erst beenden.', already_running:'Die Stempeluhr läuft bereits.', not_running:'Die Stempeluhr läuft nicht.',
    already_paused:'Bereits in Pause.', not_paused:'Keine Pause aktiv.', version_conflict:'Inzwischen hat jemand anderes geändert. Aktueller Stand wurde geladen.',
    wrong_status:'Der Status der Woche hat sich geändert.', unknown_order:'Unbekannter Auftrag.', invalid_time:'Ungültige Uhrzeit.',
    storage_unavailable:'Serverspeicher nicht verfügbar. Nichts wurde gespeichert.'
  };
  let data = null, people = [], permissions = {review:false}, phase = 'loading', loadError = '', saving = false;
  let week = '', user = me, tab = 'mine', queue = [], inbox = {review:[], returned:[]};
  const rows = new Map();
  let receipts = {}; try { receipts = JSON.parse(localStorage.getItem(`bd-time-receipts-${prefix}`) || '{}'); } catch {}

  const hm = total => `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`;
  const hours = total => t('{h} Std.', {h:(total / 60).toLocaleString(I18n.locale(), {maximumFractionDigits:1})});
  const clockTime = value => value ? value.slice(11, 16) : '';
  const dayLabel = iso => new Date(iso + 'T12:00:00').toLocaleDateString(I18n.locale(), {weekday:'long', day:'numeric', month:'long'});
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function shiftWeek(value, step) {
    const [y, w] = value.split('-W').map(Number), monday = new Date(Date.UTC(y, 0, 4));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (w - 1 + step) * 7);
    const thursday = new Date(monday); thursday.setUTCDate(monday.getUTCDate() + 3);
    const year = thursday.getUTCFullYear(), first = new Date(Date.UTC(year, 0, 4));
    const number = 1 + Math.round(((thursday - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
    return `${year}-W${String(number).padStart(2, '0')}`;
  }
  const weekNumber = value => Number(value.split('-W')[1]);
  const orderName = id => { const order = ServerOrders.snapshot().orders.find(item => item.id === id); return order ? `${order.id} · ${order.customer?.name || order.title}` : id; };

  async function call(path, body) {
    let response;
    try {
      response = await fetch(path, {method:body ? 'POST' : 'GET', cache:'no-store', credentials:'same-origin',
        headers:{'Content-Type':'application/json', 'X-BD-CSRF':BD_BACKEND.csrf}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(12000)});
    } catch { throw {code:'offline', message:t(messages.offline)}; }
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok) {
      const code = response.status === 401 ? 'authentication_required' : result.error || 'server';
      throw {code, message:messages[code] ? t(messages[code]) : t('Serverfehler {status}. Nichts wurde gespeichert.', {status:response.status})};
    }
    return result;
  }

  async function load({quiet = false} = {}) {
    if (!enabled) return;
    try {
      const result = await call(`/api/time?${new URLSearchParams({...(week ? {week} : {}), user})}`);
      data = result.view; people = result.people; permissions = result.permissions; week = data.week; phase = 'ready'; loadError = '';
      if (permissions.review && tab === 'review') queue = (await call('/api/time/review')).weeks;
      if (state.view === 'time' && (!quiet || quietScreen())) window.render();
    } catch (error) { loadError = error.message; if (phase !== 'ready') phase = 'error'; if (state.view === 'time' && !quiet) window.render(); }
  }
  const quietScreen = () => document.getElementById('modalBackdrop').hidden && !document.activeElement?.matches('input,textarea,select');

  async function loadInbox() {
    if (!enabled) return;
    try {
      const before = JSON.stringify(inbox);
      inbox = await call('/api/time/inbox'); syncRows(); updateBadges();
      if (before !== JSON.stringify(inbox) && state.view === 'time' && quietScreen()) window.render();
    } catch {}
  }
  function syncRows() {
    const visible = new Set();
    const add = (id, row) => {
      visible.add(id);
      const target = rows.get(id) || {id};
      Object.assign(target, {area:'time', target:{view:'time'}, ...row});
      const receipt = receipts[id] || {};
      if (receipt.read) target.notificationReadFingerprint = receipt.read;
      if (receipt.archived) target.notificationArchivedFingerprint = receipt.archived;
      rows.set(id, target);
    };
    for (const item of inbox.review) add(`time-review:${item.username}:${item.week}`, {status:'eingereicht', updatedAt:item.at, rank:1, title:t('Arbeitszeit prüfen · {name}', {name:item.name}), text:t('KW {n} eingereicht', {n:weekNumber(item.week)})});
    for (const item of inbox.returned) add(`time-returned:${item.week}`, {status:'zurueckgegeben', updatedAt:item.at, rank:2, title:t('Arbeitszeit zurückgegeben · KW {n}', {n:weekNumber(item.week)}), text:`${item.byName || ''}: ${item.note || ''}`});
    for (const id of [...rows.keys()]) if (!visible.has(id)) rows.delete(id);
  }
  function notificationRows() {
    for (const row of rows.values()) receipts[row.id] = {read:row.notificationReadFingerprint, archived:row.notificationArchivedFingerprint};
    try { localStorage.setItem(`bd-time-receipts-${prefix}`, JSON.stringify(receipts)); } catch {}
    return [...rows.values()];
  }

  // ---------- Rendering ----------
  function clockCard() {
    if (user !== me || week !== currentWeek()) return '';
    const run = data.running;
    if (!run) {
      const orders = ServerOrders.snapshot().orders || [];
      return `<section class="tm-clock"><div class="tm-clock-face"><span class="tm-state">${t('Nicht gestempelt')}</span><strong>--:--</strong></div>
        <div class="tm-clock-actions"><select id="tmOrder" aria-label="${esc(t('Auftrag (optional)'))}"><option value="">${t('Ohne Auftrag')}</option>${orders.map(o => `<option value="${esc(o.id)}">${esc(`${o.id} · ${o.customer?.name || o.title}`)}</option>`).join('')}</select>
        <button class="tm-round start" data-action="tm-clock" data-clock="start">${icon('play',22)}<span>${t('Start')}</span></button></div></section>`;
    }
    const since = new Date(run.start.replace('T', ' ').replace(/-/g, '/'));
    const pause = run.pauseSince ? new Date(run.pauseSince.replace('T', ' ').replace(/-/g, '/')) : null;
    const elapsed = Math.max(0, Math.round(((pause || new Date()) - since) / 60000) - (run.breakMinutes || 0));
    return `<section class="tm-clock is-running ${pause ? 'is-paused' : ''}"><div class="tm-clock-face"><span class="tm-state">${pause ? t('Pause seit {time}', {time:clockTime(run.pauseSince)}) : t('Läuft seit {time}', {time:clockTime(run.start)})}</span>
        <strong id="tmElapsed" data-since="${esc(run.start)}" data-break="${run.breakMinutes || 0}" ${pause ? `data-pause="${esc(run.pauseSince)}"` : ''}>${hm(elapsed)}</strong>
        <small>${run.orderID ? esc(orderName(run.orderID)) : t('Ohne Auftrag')}${run.breakMinutes ? ` · ${t('Pause {n} Min.', {n:run.breakMinutes})}` : ''}</small></div>
      <div class="tm-clock-actions">${pause ? `<button class="tm-round resume" data-action="tm-clock" data-clock="resume">${icon('play',22)}<span>${t('Weiter')}</span></button>` : `<button class="tm-round pause" data-action="tm-clock" data-clock="pause">${icon('clock',22)}<span>${t('Pause')}</span></button>`}
        <button class="tm-round stop" data-action="tm-clock" data-clock="stop">${icon('check',22)}<span>${t('Ende')}</span></button></div></section>`;
  }

  function currentWeek() {
    const d = new Date(), thursday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7)));
    const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    return `${thursday.getUTCFullYear()}-W${String(1 + Math.round(((thursday - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
  }

  function weekMarkup() {
    const own = user === me, status = data.status, editable = own && !['eingereicht','freigegeben'].includes(status.status), today = todayISO();
    const days = data.days.map(day => {
      const entries = data.entries.filter(entry => entry.day === day.day);
      return `<section class="tm-day ${day.day === today ? 'is-today' : ''}"><header><h4>${esc(dayLabel(day.day))}</h4><strong>${day.minutes ? hm(day.minutes) : '–'}</strong></header>
        ${day.warnings.length ? `<p class="tm-warn">${icon('alert',13)} ${day.warnings.map(key => esc(t(warnLabel[key]))).join(' · ')}</p>` : ''}
        ${entries.map(entry => `<div class="tm-entry ${entry.end ? '' : 'is-running'}"><span class="tm-range">${clockTime(entry.start)} – ${entry.end ? clockTime(entry.end) : t('läuft')}</span>
          <span class="tm-detail">${entry.breakMinutes ? esc(t('Pause {n} Min.', {n:entry.breakMinutes})) : ''}${entry.orderID ? `${entry.breakMinutes ? ' · ' : ''}${esc(orderName(entry.orderID))}` : ''}${entry.note ? ` · ${esc(entry.note)}` : ''}</span>
          ${entry.source === 'nachtrag' ? `<span class="tm-badge">${t('Nachtrag')}</span>` : ''}
          ${editable && entry.end ? `<button class="so-icon-button" data-action="tm-edit" data-id="${esc(entry.id)}" aria-label="${esc(t('Zeitblock bearbeiten'))}">${icon('edit',15)}</button>` : ''}</div>`).join('')}
        ${editable && day.day <= today ? `<button class="tm-add" data-action="tm-add" data-day="${day.day}">${icon('plus',13)} ${t('Nachtragen')}</button>` : ''}
      </section>`;
    }).join('');
    const actions = [];
    if (own && ['offen','zurueckgegeben'].includes(status.status)) actions.push(`<button class="button primary" data-action="tm-week" data-step="submit" ${data.running && data.running.day >= data.days[0].day && data.running.day <= data.days[6].day ? 'disabled' : ''}>${icon('check',15)} ${t('Woche einreichen')}</button>`);
    if (!own && permissions.review && status.status === 'eingereicht') actions.push(`<button class="button outline" data-action="tm-week" data-step="return">${t('Zurückgeben')}</button><button class="button success" data-action="tm-week" data-step="approve">${icon('check',15)} ${t('Freigeben')}</button>`);
    if (!own && permissions.review && status.status === 'freigegeben') actions.push(`<button class="button outline" data-action="tm-week" data-step="reopen">${t('Wieder öffnen')}</button>`);
    if (own && status.status === 'eingereicht') actions.push(`<span class="so-hint">${t('Wartet auf Prüfung durch Meister oder Geschäftsführung.')}</span>`);
    return `<div class="tm-weekbar"><button class="so-icon-button" data-action="tm-shift" data-step="-1" aria-label="${esc(t('Vorherige Woche'))}">${icon('arrow-left',16)}</button>
        <strong>${t('KW {n}', {n:weekNumber(week)})} · ${esc(new Date(data.days[0].day + 'T12:00:00').toLocaleDateString(I18n.locale(), {day:'numeric', month:'short'}))} – ${esc(new Date(data.days[6].day + 'T12:00:00').toLocaleDateString(I18n.locale(), {day:'numeric', month:'short'}))}</strong>
        <button class="so-icon-button" data-action="tm-shift" data-step="1" aria-label="${esc(t('Nächste Woche'))}">${icon('arrow-right',16)}</button>
        <span class="status-pill ${statusTone[status.status]}">${t(statusLabel[status.status])}</span></div>
      ${status.status === 'zurueckgegeben' && status.note ? `<div class="notice warning"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Zurückgegeben von {name}', {name:esc(status.byName || '')})}</strong><p>${esc(status.note)}</p></div></div>` : ''}
      ${status.status === 'freigegeben' ? `<p class="so-hint">${icon('check',12)} ${t('Freigegeben von {name} · {time}', {name:esc(status.byName || ''), time:new Date(status.at).toLocaleString(I18n.locale())})}</p>` : ''}
      <div class="tm-days">${days}</div>
      <div class="tm-total"><span>${t('Woche gesamt')}</span><strong>${hm(data.total)} ${t('Std.')}</strong></div>
      <div class="tm-actions">${actions.join('')}</div>
      ${data.events.length ? `<details class="pm-history"><summary>${t('Verlauf')}</summary><ol class="sa-history">${[...data.events].reverse().map(event => `<li><strong>${esc(t(eventLabel[event.action] || event.action))}</strong><span>${esc(event.actorName)} · ${new Date(event.at).toLocaleString(I18n.locale())}</span>${event.detail.reason || event.detail.note ? `<p>${esc(event.detail.reason || event.detail.note)}</p>` : ''}</li>`).join('')}</ol></details>` : ''}`;
  }

  function render() {
    setPageMeta('BÜLOW & DOLZ', t('Arbeitszeit'));
    const head = `<div class="section-header"><div><h2>${t('Arbeitszeit')}</h2><p>${t('Stempeln, nachtragen und wöchentlich einreichen. Freigabe durch Meister oder Geschäftsführung.')}</p></div></div>`;
    if (phase !== 'ready' || !data) return `<section class="section tm-view" style="margin-top:0">${head}<div class="card so-placeholder">${esc(loadError || t('Arbeitszeiten werden geladen …'))}</div></section>`;
    const tabs = permissions.review ? `<div class="so-filter" role="group" aria-label="${esc(t('Ansicht'))}"><button class="${tab === 'mine' ? 'active' : ''}" data-action="tm-tab" data-tab="mine" aria-pressed="${tab === 'mine'}">${t('Zeiten')}</button><button class="${tab === 'review' ? 'active' : ''}" data-action="tm-tab" data-tab="review" aria-pressed="${tab === 'review'}">${t('Prüfen')}${inbox.review.length ? ` <b class="tm-count">${inbox.review.length}</b>` : ''}</button></div>` : '';
    if (tab === 'review') {
      return `<section class="section tm-view" style="margin-top:0">${head}${tabs}
        <div class="tm-queue">${queue.map(item => `<button class="pr-row" data-action="tm-open" data-user="${esc(item.username)}" data-week="${esc(item.week)}">
          <span class="pr-avatar mood-none">${esc(item.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase())}</span>
          <span class="pr-row-copy"><strong>${esc(item.name)}</strong><small>${t('KW {n}', {n:weekNumber(item.week)})} · ${hm(item.total)} ${t('Std.')}</small></span>
          <span class="pr-row-meta">${item.days.some(day => day.warnings.length) ? `<span class="tm-badge warn">${icon('alert',12)} ${t('Hinweise')}</span>` : ''}${icon('arrow-right',16)}</span></button>`).join('') || `<p class="workspace-empty">${t('Keine Woche wartet auf Prüfung.')}</p>`}</div></section>`;
    }
    const picker = permissions.review ? `<label class="tm-person">${t('Person')} <select id="tmPerson">${people.map(p => `<option value="${esc(p.username)}" ${p.username === user ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : '';
    return `<section class="section tm-view" style="margin-top:0">${head}<div class="tm-top">${tabs}${picker}</div>${clockCard()}${weekMarkup()}
      <p class="assist-note">${icon('info',14)} ${t('Hinweise nach Arbeitszeitgesetz sind Orientierung für die Prüfung, keine Rechtsberatung. Nachträge und Änderungen stehen mit Begründung im Verlauf.')}</p></section>`;
  }

  // ---------- Dialogs ----------
  function showEntry(day, entry = null) {
    const orders = ServerOrders.snapshot().orders || [];
    openModal({eyebrow:t('ARBEITSZEIT'), title:t(entry ? 'Zeitblock bearbeiten' : 'Zeit nachtragen'), body:`<div class="so-order-form">
        <p class="so-wide so-hint">${esc(dayLabel(entry ? entry.day : day))}</p>
        <div class="field"><label for="tm-start">${t('Beginn')}</label><input id="tm-start" type="time" value="${esc(entry ? clockTime(entry.start) : '07:00')}"></div>
        <div class="field"><label for="tm-end">${t('Ende')}</label><input id="tm-end" type="time" value="${esc(entry ? clockTime(entry.end) : '16:00')}"></div>
        <div class="field"><label for="tm-break">${t('Pause (Min.)')}</label><input id="tm-break" type="number" inputmode="numeric" min="0" step="5" value="${entry ? entry.breakMinutes : 30}"></div>
        <div class="field"><label for="tm-order">${t('Auftrag (optional)')}</label><select id="tm-order"><option value="">${t('Ohne Auftrag')}</option>${orders.map(o => `<option value="${esc(o.id)}" ${entry?.orderID === o.id ? 'selected' : ''}>${esc(`${o.id} · ${o.customer?.name || o.title}`)}</option>`).join('')}</select></div>
        <div class="field so-wide"><label for="tm-note">${t('Notiz')}</label><input id="tm-note" maxlength="500" value="${esc(entry?.note || '')}"></div>
        <div class="field so-wide"><label for="tm-reason">${t('Begründung')} <span>(${t('Pflicht – steht im Verlauf')})</span></label><input id="tm-reason" maxlength="500"></div>
      </div><p class="sa-feedback" id="tmFeedback" role="alert" hidden></p>`,
      footer:`${entry ? `<button class="button danger" data-action="tm-delete" data-id="${esc(entry.id)}" data-version="${entry.version}">${t('Löschen')}</button>` : ''}<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button primary" data-action="tm-save" data-day="${esc(entry ? entry.day : day)}" ${entry ? `data-id="${esc(entry.id)}" data-version="${entry.version}"` : ''}>${icon('check',15)} ${t('Speichern')}</button>`});
  }

  function showDecision(step) {
    const titles = {submit:'Woche einreichen', approve:'Woche freigeben', return:'Woche zurückgeben', reopen:'Woche wieder öffnen'};
    const required = ['return','reopen'].includes(step);
    const warnings = data.days.filter(day => day.warnings.length);
    openModal({eyebrow:`${t('ARBEITSZEIT')} · ${t('KW {n}', {n:weekNumber(week)})}`, title:t(titles[step]), body:`
      <p>${esc(data.name)} · ${hm(data.total)} ${t('Std.')}</p>
      ${warnings.length && step !== 'submit' ? `<div class="notice warning"><span class="notice-icon">${icon('alert')}</span><div><strong>${t('Hinweise nach Arbeitszeitgesetz')}</strong><p>${warnings.map(day => `${esc(dayLabel(day.day))}: ${day.warnings.map(key => esc(t(warnLabel[key]))).join(', ')}`).join('<br>')}</p></div></div>` : ''}
      <div class="field"><label for="tm-decision-note">${t(required ? 'Begründung' : 'Notiz')} ${required ? `<span>(${t('Pflicht')})</span>` : ''}</label><textarea id="tm-decision-note" rows="3" maxlength="500"></textarea></div>
      <p class="sa-feedback" id="tmFeedback" role="alert" hidden></p>`,
      footer:`<button class="button outline" data-action="close-modal">${t('Abbrechen')}</button><button class="button ${step === 'approve' ? 'success' : 'primary'}" data-action="tm-decide" data-step="${step}" data-version="${data.status.version}">${icon('check',15)} ${t(titles[step])}</button>`});
  }

  function feedback(text, tone = 'error') { const node = document.getElementById('tmFeedback'); if (node) { node.hidden = !text; node.textContent = text; node.dataset.tone = tone; } else if (text && tone === 'error') showToast(t('Nicht gespeichert'), esc(text), 'warning'); }

  async function run(target, path, body, done) {
    if (saving) return;
    saving = true; if (target) target.disabled = true; feedback(t('Wird gespeichert …'), 'info');
    try {
      const result = await call(path, body);
      data = result.view; week = data.week;
      if (!document.getElementById('modalBackdrop').hidden) closeModal();
      window.render(); loadInbox();
      if (done) showToast(done, '', 'success');
    } catch (error) { feedback(error.message); if (['version_conflict','wrong_status','week_locked'].includes(error.code)) load({quiet:true}); }
    finally { saving = false; if (target) target.disabled = false; }
  }

  function entryBody(day) {
    const value = id => document.getElementById(id).value.trim();
    const start = value('tm-start'), end = value('tm-end'), brk = Number(value('tm-break') || 0);
    return {entry:{start:`${day}T${start}`, end:`${day}T${end}`, breakMinutes:Number.isInteger(brk) ? brk : -1, orderID:value('tm-order') || null, note:value('tm-note')}, reason:value('tm-reason')};
  }

  function action(name, target) {
    if (name === 'tm-clock') run(target, '/api/time/clock', {action:target.dataset.clock, ...(target.dataset.clock === 'start' ? {orderID:document.getElementById('tmOrder')?.value || null} : {})},
      t({start:'Gestempelt: Start', pause:'Pause', resume:'Weiter', stop:'Gestempelt: Ende'}[target.dataset.clock]));
    else if (name === 'tm-shift') { week = shiftWeek(week, Number(target.dataset.step)); load(); }
    else if (name === 'tm-tab') { tab = target.dataset.tab; if (tab === 'mine') user = me; load(); }
    else if (name === 'tm-open') { tab = 'mine'; user = target.dataset.user; week = target.dataset.week; load(); }
    else if (name === 'tm-add') showEntry(target.dataset.day);
    else if (name === 'tm-edit') showEntry(null, data.entries.find(entry => entry.id === target.dataset.id));
    else if (name === 'tm-save') {
      const body = entryBody(target.dataset.day);
      if (body.reason.length < 3) { feedback(t(messages.reason_required)); document.getElementById('tm-reason').focus(); return; }
      if (body.entry.end <= body.entry.start) { feedback(t(messages.invalid_range)); return; }
      run(target, target.dataset.id ? `/api/time/entries/${encodeURIComponent(target.dataset.id)}` : '/api/time/entries', target.dataset.id ? {version:Number(target.dataset.version), ...body} : body, t('Zeit gespeichert'));
    }
    else if (name === 'tm-delete') {
      const reason = document.getElementById('tm-reason').value.trim();
      if (reason.length < 3) { feedback(t(messages.reason_required)); document.getElementById('tm-reason').focus(); return; }
      run(target, `/api/time/entries/${encodeURIComponent(target.dataset.id)}/delete`, {version:Number(target.dataset.version), reason}, t('Zeitblock gelöscht'));
    }
    else if (name === 'tm-week') showDecision(target.dataset.step);
    else if (name === 'tm-decide') {
      const step = target.dataset.step, note = document.getElementById('tm-decision-note').value.trim();
      if (['return','reopen'].includes(step) && note.length < 3) { feedback(t(messages.reason_required)); return; }
      run(target, `/api/time/weeks/${encodeURIComponent(user)}/${encodeURIComponent(week)}/${step}`, {version:Number(target.dataset.version), note},
        t({submit:'Woche eingereicht', approve:'Freigegeben', return:'Zurückgegeben', reopen:'Wieder geöffnet'}[step]));
    }
  }

  function tick() {
    const node = document.getElementById('tmElapsed');
    if (!node || node.dataset.pause) return;
    const since = new Date(node.dataset.since.replace('T', ' ').replace(/-/g, '/'));
    node.textContent = hm(Math.max(0, Math.round((new Date() - since) / 60000) - Number(node.dataset.break || 0)));
  }

  function start() {
    if (!enabled) return;
    document.addEventListener('change', event => { if (event.target.id === 'tmPerson') { user = event.target.value; load(); } });
    load({quiet:true}); loadInbox();
    setInterval(tick, 15000);
    setInterval(() => { if (document.visibilityState === 'visible') { loadInbox(); if (state.view === 'time') load({quiet:true}); } }, 30000);
  }

  if (enabled) workspaceAreas.splice(workspaceAreas.findIndex(area => area.view === 'schedule') + 1, 0, {view:'time', name:'Arbeitszeit', icon:'clock', tone:'amber', keywords:'Stempeln Zeiterfassung Stunden Arbeitszeit Pause Wochenzettel'});
  return {enabled, start, load, render, action, notificationRows, isRunning:() => Boolean(data?.running && user === me)};
})();
