// Einsatzplan (server mode): week view of open order steps by assignee and due date.
// Read-only planning view; dates and assignees are changed in the order (step dialog), which keeps
// versions, rights and history in one place (Backend/orders.py).
const Schedule = (() => {
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  const SHORT = {aufnahme:'Aufnahme', leistungsbilanz:'Bilanz', netzbetreiber:'Netz', angebot:'Angebot', montage:'Montage', pruefung:'Prüfung', abnahme:'Abnahme'};
  const tone = {offen:'blue', in_arbeit:'amber', blockiert:'red'};
  let week = 0, mine = false;

  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function monday(offset) {
    const date = new Date(); date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7);
    return date;
  }
  function days(offset) { const start = monday(offset); return [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }

  // Open steps with a due date or an assignee; derived steps keep their computed status.
  function items(orders, steps) {
    const list = [];
    for (const order of orders) for (const step of steps) {
      const entry = order.steps[step.id];
      if (!entry || ['erledigt','entfaellt'].includes(entry.status) || (!entry.due && !entry.assignee)) continue;
      list.push({order, step, entry, due:entry.due || '', assignee:entry.assignee || ''});
    }
    return list.sort((a, b) => a.due.localeCompare(b.due) || String(a.order.customer?.name).localeCompare(String(b.order.customer?.name), 'de'));
  }

  function chip(item, {person = false, people = []} = {}) {
    const name = people.find(p => p.username === item.assignee)?.name || t('Nicht zugewiesen');
    return `<button type="button" class="sc-chip tone-${tone[item.entry.status] || 'blue'}" data-action="sc-open" data-order="${esc(item.order.id)}" title="${esc(`${item.order.title} · ${t(item.step.label)}`)}">
      <strong>${esc(item.order.customer?.name || item.order.title)}</strong><span>${esc(t(SHORT[item.step.id] || item.step.label))} · ${esc(item.order.address?.city || '')}</span>${person ? `<em>${esc(name)}</em>` : ''}</button>`;
  }

  function render() {
    setPageMeta('BÜLOW & DOLZ', t('Einsatzplan'));
    const {orders, schema, phase, loadError} = ServerOrders.snapshot();
    const head = `<div class="section-header"><div><h2>${t('Einsatzplan')}</h2><p>${t('Offene Schritte nach Person und Fälligkeit. Termine und Zuständigkeit änderst du im Auftrag.')}</p></div></div>`;
    if (phase !== 'ready' || !schema) return `<section class="section sc-view" style="margin-top:0">${head}<div class="card so-placeholder">${esc(loadError || t('Aufträge werden vom Server geladen …'))}</div></section>`;
    const user = BD_BACKEND.user.username, today = iso(new Date()), week7 = days(week), range = week7.map(iso);
    const all = items(orders, schema.steps).filter(item => !mine || item.assignee === user);
    const overdue = all.filter(item => item.due && item.due < today).sort((a, b) => a.due.localeCompare(b.due));
    const undated = all.filter(item => !item.due);
    const inWeek = all.filter(item => range.includes(item.due));
    const rows = [...new Set(inWeek.map(item => item.assignee))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
    const people = schema.people, name = username => username ? people.find(p => p.username === username)?.name || username : t('Nicht zugewiesen');
    const dayName = date => date.toLocaleDateString(I18n.locale(), {weekday:'short'}), dayNum = date => date.toLocaleDateString(I18n.locale(), {day:'2-digit', month:'2-digit'});
    const label = `${week7[0].toLocaleDateString(I18n.locale(), {day:'numeric', month:'short'})} – ${week7[6].toLocaleDateString(I18n.locale(), {day:'numeric', month:'short', year:'numeric'})}`;
    // Two different orders for one person on one day are flagged for a check (travel, capacity).
    const clash = (username, date) => new Set(inWeek.filter(item => item.assignee === username && item.due === date).map(item => item.order.id)).size > 1 && username;
    const grid = rows.length ? `<div class="sc-grid" role="table" aria-label="${esc(t('Wochenplan'))}">
      <div class="sc-row sc-head" role="row"><span role="columnheader">${t('Person')}</span>${week7.map(date => `<span role="columnheader" class="${iso(date) === today ? 'is-today' : ''}">${esc(dayName(date))}<b>${esc(dayNum(date))}</b></span>`).join('')}</div>
      ${rows.map(username => `<div class="sc-row" role="row"><span role="rowheader" class="sc-person">${esc(name(username))}</span>${range.map(date => {
        const cell = inWeek.filter(item => item.assignee === username && item.due === date);
        return `<div role="cell" class="sc-cell ${date === today ? 'is-today' : ''} ${clash(username, date) ? 'is-clash' : ''}">${clash(username, date) ? `<span class="sc-clash">${icon('alert',12)} ${t('Doppelt belegt')}</span>` : ''}${cell.map(item => chip(item)).join('')}</div>`;
      }).join('')}</div>`).join('')}
    </div>` : `<p class="workspace-empty">${t('In dieser Woche ist nichts terminiert.')}</p>`;
    const agenda = week7.map(date => {
      const list = inWeek.filter(item => item.due === iso(date));
      return `<section class="sc-day ${iso(date) === today ? 'is-today' : ''}"><h4>${esc(date.toLocaleDateString(I18n.locale(), {weekday:'long', day:'numeric', month:'long'}))}</h4>${list.map(item => chip(item, {person:true, people})).join('') || `<p class="so-hint">${t('Keine Termine')}</p>`}</section>`;
    }).join('');
    return `<section class="section sc-view" style="margin-top:0">${head}
      <div class="sc-toolbar"><div class="sc-week"><button type="button" class="so-icon-button" data-action="sc-week" data-step="-1" aria-label="${esc(t('Vorherige Woche'))}">${icon('arrow-left',16)}</button><strong>${esc(label)}</strong><button type="button" class="so-icon-button" data-action="sc-week" data-step="1" aria-label="${esc(t('Nächste Woche'))}">${icon('arrow-right',16)}</button>${week ? `<button type="button" class="button outline small" data-action="sc-week" data-step="0">${t('Heute')}</button>` : ''}</div>
        <div class="so-filter" role="group" aria-label="${esc(t('Filter'))}"><button class="${mine ? '' : 'active'}" data-action="sc-mine" data-mine="0" aria-pressed="${!mine}">${t('Alle')}</button><button class="${mine ? 'active' : ''}" data-action="sc-mine" data-mine="1" aria-pressed="${mine}">${t('Meine')}</button></div></div>
      ${overdue.length ? `<div class="sc-overdue" role="region" aria-label="${esc(t('Überfällig'))}"><h3>${icon('alert',16)} ${t('Überfällig')} <span>${overdue.length}</span></h3><div class="sc-chips">${overdue.map(item => `<div class="sc-overdue-item"><small>${esc(new Date(item.due + 'T12:00:00').toLocaleDateString(I18n.locale()))}</small>${chip(item, {person:true, people})}</div>`).join('')}</div></div>` : ''}
      <div class="sc-desktop">${grid}</div>
      <div class="sc-agenda">${agenda}</div>
      ${undated.length ? `<details class="sc-undated"><summary>${t('Zugewiesen, ohne Termin')} <span>${undated.length}</span></summary><div class="sc-chips">${undated.map(item => chip(item, {person:true, people})).join('')}</div></details>` : ''}
    </section>`;
  }

  function action(name, target) {
    if (name === 'sc-open') ServerOrders.open(target.dataset.order);
    else if (name === 'sc-week') { const step = Number(target.dataset.step); week = step ? week + step : 0; window.render(); }
    else if (name === 'sc-mine') { mine = target.dataset.mine === '1'; window.render(); }
  }

  if (window.BD_BACKEND?.enabled && window.BD_BACKEND.user) workspaceAreas.splice(3, 0, {view:'schedule', name:'Einsatzplan', icon:'calendar', tone:'blue', keywords:'Kalender Woche Termine Monteure Planung Disposition'});
  return {render, action};
})();
