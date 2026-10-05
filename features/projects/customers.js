// Kunden (server mode): customer file assembled from the job files – no separate customer store yet.
// Orders belong to one customer when name and a contact detail (e-mail, phone or city) match.
const Customers = (() => {
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  let query = '', selected = '';

  const norm = value => String(value || '').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  const keyOf = order => [norm(order.customer?.name), norm(order.customer?.email) || norm(order.customer?.phone).replace(/[^\d+]/g, '') || norm(order.address?.city)].join('|');
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function groups(orders) {
    const map = new Map();
    for (const order of orders) {
      const key = keyOf(order);
      if (!map.has(key)) map.set(key, {key, name:order.customer?.name || '', orders:[]});
      map.get(key).orders.push(order);
    }
    for (const group of map.values()) {
      group.orders.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      const latest = group.orders[0];
      group.contact = group.orders.map(order => order.customer || {}).reduce((acc, c) => ({phone:acc.phone || c.phone, email:acc.email || c.email}), {});
      group.addresses = [...new Set(group.orders.map(order => [order.address?.street, [order.address?.postcode, order.address?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')).filter(Boolean))];
      group.mood = group.orders.find(order => order.mood?.value)?.mood || null;
      group.updatedAt = latest.updatedAt;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  function detail(group, steps) {
    const phase = order => steps.find(step => !['erledigt','entfaellt'].includes(order.steps[step.id]?.status));
    const tel = group.contact.phone ? `<a href="tel:${esc(group.contact.phone.replace(/[^+\d]/g, ''))}">${esc(group.contact.phone)}</a>` : '';
    const mail = group.contact.email ? `<a href="mailto:${esc(group.contact.email)}">${esc(group.contact.email)}</a>` : '';
    return `<article class="cu-detail">
      <header><span class="pr-avatar mood-${group.mood?.value || 'none'}">${esc(initials(group.name))}</span><div><h3>${esc(group.name)}</h3><p>${t('{n} Aufträge', {n:group.orders.length})}</p></div>
        <button type="button" class="so-icon-button" data-action="cu-select" data-key="" aria-label="${esc(t('Auswahl aufheben'))}">${icon('x',16)}</button></header>
      <dl class="so-dl">${tel ? `<div class="so-dl-row"><dt>${t('Telefon')}</dt><dd>${tel}</dd></div>` : ''}${mail ? `<div class="so-dl-row"><dt>${t('E-Mail')}</dt><dd>${mail}</dd></div>` : ''}
        ${group.addresses.map(address => `<div class="so-dl-row"><dt>${t('Adresse')}</dt><dd>${esc(address)}</dd></div>`).join('')}
        <div class="so-dl-row"><dt>${t('Kundenstimmung')}</dt><dd>${ProjectRing.moodChip(group.mood)}</dd></div>
        ${group.mood?.note ? `<div class="so-dl-row"><dt>${t('Notiz')}</dt><dd>${esc(group.mood.note)}</dd></div>` : ''}</dl>
      <h4>${t('Aufträge')}</h4>
      <div class="cu-orders">${group.orders.map(order => { const step = phase(order); return `<button type="button" class="pr-row" data-action="cu-open" data-order="${esc(order.id)}">
        <span class="pr-row-copy"><strong>${esc(order.title)}</strong><small>${esc(order.id)} · ${esc(order.address?.city || '')}</small></span>
        <span class="pr-row-meta"><span class="pr-phase">${esc(step ? t(step.label) : t('Fertig'))}</span>${ProjectRing.moodChip(order.mood)}</span></button>`; }).join('')}</div>
    </article>`;
  }

  function render() {
    setPageMeta('BÜLOW & DOLZ', t('Kunden'));
    const {orders, schema, phase, loadError} = ServerOrders.snapshot();
    const head = `<div class="section-header"><div><h2>${t('Kunden')}</h2><p>${t('Aus den Aufträgen zusammengeführt: Kontakt, alle Aufträge und Stimmung.')}</p></div></div>`;
    if (phase !== 'ready' || !schema) return `<section class="section cu-view" style="margin-top:0">${head}<div class="card so-placeholder">${esc(loadError || t('Aufträge werden vom Server geladen …'))}</div></section>`;
    const all = groups(orders), q = norm(query);
    const visible = q ? all.filter(group => [group.name, group.contact.phone, group.contact.email, ...group.addresses, ...group.orders.map(order => order.id)].some(value => norm(value).includes(q))) : all;
    const chosen = all.find(group => group.key === selected);
    return `<section class="section cu-view" style="margin-top:0">${head}
      ${all.length ? `<div class="cu-layout"><div class="cu-list-col">
        <div class="workspace-search cu-search" role="search">${icon('search',18)}<input id="customerSearch" type="search" value="${esc(query)}" placeholder="${esc(t('Name, Ort, Telefon oder Auftrag'))}" aria-label="${esc(t('Kunden suchen'))}" autocomplete="off"></div>
        <p class="so-hint" role="status">${t('{n} Kunden', {n:visible.length})}</p>
        <div class="cu-list">${visible.map(group => `<button type="button" class="pr-row ${selected === group.key ? 'is-selected' : ''}" data-action="cu-select" data-key="${esc(group.key)}">
          <span class="pr-avatar mood-${group.mood?.value || 'none'}">${esc(initials(group.name))}</span>
          <span class="pr-row-copy"><strong>${esc(group.name)}</strong><small>${esc(group.addresses[0] || '')}</small></span>
          <span class="pr-row-meta"><span class="pr-steps">${t('{n} Aufträge', {n:group.orders.length})}</span></span></button>`).join('') || `<p class="workspace-empty">${t('Kein Kunde passt zur Suche.')}</p>`}</div>
      </div><div class="cu-detail-col">${chosen ? detail(chosen, schema.steps) : `<p class="so-hint">${t('Kunden antippen, um Kontakt und Aufträge zu sehen.')}</p>`}</div></div>`
      : emptyState('users', t('Noch keine Kunden'), t('Kunden entstehen automatisch mit dem ersten Auftrag.'))}
      <p class="assist-note">${icon('info',14)} ${t('Zusammenführung nach Name und Kontakt (E-Mail, Telefon oder Ort). Gleichnamige Kunden ohne Kontaktangaben können zusammenfallen.')}</p>
    </section>`;
  }

  function action(name, target) {
    if (name === 'cu-select') { selected = selected === target.dataset.key ? '' : target.dataset.key || ''; window.render(); if (selected && matchMedia('(max-width: 900px)').matches) document.querySelector('.cu-detail')?.scrollIntoView({block:'start'}); }
    else if (name === 'cu-open') ServerOrders.open(target.dataset.order);
  }

  // Typing filters in place so the search field keeps focus.
  function start() {
    document.addEventListener('input', event => {
      if (event.target.id !== 'customerSearch') return;
      query = event.target.value;
      const caret = event.target.selectionStart;
      window.render();
      const field = document.getElementById('customerSearch');
      if (field) { field.focus(); field.setSelectionRange(caret, caret); }
    });
  }

  if (window.BD_BACKEND?.enabled && window.BD_BACKEND.user) workspaceAreas.splice(4, 0, {view:'customers', name:'Kunden', icon:'users', tone:'rose', keywords:'Kundenkartei Kontakte Stimmung Adressen'});
  return {render, action, start};
})();
