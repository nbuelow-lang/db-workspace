// Assistenz: daily briefing page and the always reachable companion button.
// Rule-based on data the app already has (notification entries, workspace state); nothing leaves the
// network. Voice input is not built yet: microphones need HTTPS and free questions need a decision on an AI service.
const Assistant = (() => {
  const t = (text, vars) => I18n.t(text, vars);
  const esc = value => escapeAttr(value);
  let fab = null, panel = null, open = false, dodgeFrame = null;

  // Open, not archived entries; urgent first, then unread, then newest (order from NotificationCenterModel).
  function items() { return NotificationCenterModel.filter(notificationEntries(), 'all'); }
  function summary() {
    const list = items();
    return {list, urgent:list.filter(item => item.rank >= 2).length, unread:list.filter(item => !item.isRead).length,
      mine:list.filter(item => item.source === 'task').length};
  }
  const badgeCount = () => summary().urgent;

  function itemRow(item, compact = false) {
    const area = NotificationCenterModel.areas[item.area];
    return `<button type="button" class="assist-item ${item.rank >= 2 ? 'is-urgent' : ''} ${item.isRead ? '' : 'is-unread'}" data-action="as-open" data-key="${esc(item.key)}">
      <span class="assist-item-icon" aria-hidden="true">${icon(area?.icon || 'bell', 18)}</span>
      <span class="assist-item-copy"><strong>${esc(item.title)}</strong>${compact ? '' : `<small>${esc(item.text)}</small>`}
        <span class="assist-item-meta"><span class="nc-priority rank-${item.rank}">${esc(t(item.priority))}</span><span>${esc(t(area?.name || ''))}</span>${item.time ? `<span>${esc(item.time)}</span>` : ''}</span></span>
      ${icon('arrow-right', 16)}
    </button>`;
  }

  // ---------- Briefing page (view smartops) ----------
  function renderBriefing() {
    setPageMeta('BÜLOW & DOLZ', t('Morning Control'));
    const s = summary(), date = new Intl.DateTimeFormat(I18n.locale(), {weekday:'long', day:'numeric', month:'long'}).format(new Date());
    const next = s.list.slice(0, 8);
    const line = s.list.length
      ? t('{n} offene Punkte, davon {u} dringend.', {n:s.list.length, u:s.urgent})
      : t('Nichts Offenes. Gute Gelegenheit für Planung oder Rückrufe.');
    const metric = (value, label, filter, tone = '') => `<button type="button" class="assist-metric ${tone}" data-action="as-notifications" data-filter="${filter}"><strong>${value}</strong><span>${t(label)}</span></button>`;
    return `<div class="assist-page">
      <section class="assist-hero">
        <p class="workspace-date">${esc(date)} · ${t('Briefing')}</p>
        <h2>${esc(timeGreeting())}</h2>
        <p>${esc(line)}</p>
        <div class="assist-metrics">
          ${metric(s.urgent, 'Dringend', 'urgent', s.urgent ? 'is-urgent' : '')}
          ${metric(s.unread, 'Ungelesen', 'unread')}
          ${metric(s.list.length, 'Offen gesamt', 'all')}
        </div>
      </section>
      <section class="workspace-section assist-next" aria-labelledby="assistNextTitle">
        <div class="workspace-section-heading"><h3 id="assistNextTitle">${t('Als Nächstes')}</h3>${s.list.length > next.length ? `<button class="text-button" data-action="as-notifications" data-filter="all">${t('Alle {n} anzeigen', {n:s.list.length})} ${icon('arrow-right',14)}</button>` : ''}</div>
        <div class="assist-list">${next.map(item => itemRow(item)).join('') || `<p class="workspace-empty">${t('Keine offenen Aufgaben oder Mitteilungen.')}</p>`}</div>
      </section>
      <div class="workspace-columns briefing-columns">${workspaceAttentionMarkup()}${workspaceProjectsMarkup()}</div>
      <p class="assist-note">${icon('info',14)} ${t('Zusammengestellt aus Aufgaben, Mitteilungen und dem gemeinsamen Arbeitsstand. Keine KI-Bewertung; Entscheidungen bleiben bei euch.')}</p>
    </div>`;
  }

  // ---------- Companion ----------
  function quickActions() {
    const actions = [
      ['as-briefing', 'bar-chart', 'Briefing'],
      ['as-notifications', 'bell', 'Mitteilungen'],
      ['as-search', 'search', 'Suchen'],
      ['as-home', 'grid', 'Startseite']
    ];
    if (ServerOrders.enabled) actions.splice(2, 0, ['as-orders', 'hard-hat', 'Aufträge'], ['as-time', 'clock', 'Arbeitszeit']);
    if (ServerOrders.enabled && ServerOrders.canCreate()) actions.splice(3, 0, ['as-new-order', 'plus', 'Neuer Auftrag']);
    return actions.map(([action, iconName, label]) => `<button type="button" class="assist-quick" data-action="${action}">${icon(iconName,18)}<span>${t(label)}</span></button>`).join('');
  }

  function renderPanel() {
    const s = summary(), next = s.list.slice(0, 3);
    panel.innerHTML = `<header class="assist-panel-head">
        <span class="assist-avatar" aria-hidden="true">${icon('zap',20)}</span>
        <div><h2 id="assistantPanelTitle">${t('Assistenz')}</h2><p>${esc(timeGreeting())} · ${esc(s.list.length ? t('{n} offene Punkte, davon {u} dringend.', {n:s.list.length, u:s.urgent}) : t('Nichts Offenes.'))}</p></div>
        <button type="button" class="assist-close" data-action="as-close" aria-label="${esc(t('Schließen'))}">${icon('x',18)}</button>
      </header>
      <section aria-labelledby="assistantNextTitle"><h3 id="assistantNextTitle">${t('Als Nächstes')}</h3>
        <div class="assist-list">${next.map(item => itemRow(item, true)).join('') || `<p class="workspace-empty">${t('Keine offenen Aufgaben oder Mitteilungen.')}</p>`}</div></section>
      <section aria-labelledby="assistantQuickTitle"><h3 id="assistantQuickTitle">${t('Schnellzugriff')}</h3><div class="assist-quick-grid">${quickActions()}</div></section>
      <p class="assist-note">${icon('info',13)} ${t('Spracheingabe folgt, sobald die Verbindung verschlüsselt (HTTPS) ist.')}</p>`;
    hydrateIcons(panel);
  }

  function setOpen(value, {focusFab = true} = {}) {
    if (!panel) return;
    open = value;
    if (open) renderPanel();
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    fab.classList.toggle('is-open', open);
    if (open) panel.querySelector('.assist-item, .assist-quick')?.focus({preventScroll:true});
    else if (focusFab && document.activeElement && panel.contains(document.activeElement)) fab.focus({preventScroll:true});
  }

  function refresh() {
    if (!fab) return;
    const count = badgeCount(), badge = fab.querySelector('.assist-fab-badge');
    badge.hidden = !count; badge.textContent = count > 99 ? '99+' : String(count);
    fab.setAttribute('aria-label', count ? t('Assistenz öffnen, {n} dringend', {n:count}) : t('Assistenz öffnen'));
    fab.title = t('Assistenz');
    const gate = document.getElementById('setupGate');
    fab.hidden = Boolean(gate && !gate.hidden);
    if (open) renderPanel();
    dodge();
  }

  // Keeps the button clear of sticky save bars at the bottom of long forms.
  function dodge() {
    if (dodgeFrame || !fab) return;
    dodgeFrame = requestAnimationFrame(() => {
      dodgeFrame = null;
      fab.style.removeProperty('--assist-lift');
      const own = fab.getBoundingClientRect();
      let lift = 0;
      for (const bar of document.querySelectorAll('.so-savebar')) {
        const r = bar.getBoundingClientRect();
        if (r.width && r.right > own.left && r.left < own.right && r.bottom > own.top && r.top < own.bottom) lift = Math.max(lift, own.bottom - r.top + 12);
      }
      if (lift) fab.style.setProperty('--assist-lift', `-${Math.round(lift)}px`);
    });
  }

  function goSearch() {
    setView(state.role === 'finance' ? 'finance' : 'dashboard');
    requestAnimationFrame(() => document.getElementById('workspaceSearch')?.focus());
  }

  function action(name, target) {
    if (name === 'as-close') { setOpen(false); return; }
    setOpen(false, {focusFab:false});
    if (name === 'as-open') {
      if (!document.getElementById('modalBackdrop').hidden) closeModal();
      notificationCenterAction('nc-open-source', target);
    }
    else if (name === 'as-notifications') showNotifications(target.dataset.filter || 'all');
    else if (name === 'as-briefing') setView('smartops');
    else if (name === 'as-home') setView(state.role === 'finance' ? 'finance' : 'dashboard');
    else if (name === 'as-search') goSearch();
    else if (name === 'as-orders') setView('orders');
    else if (name === 'as-time') setView('time');
    else if (name === 'as-new-order') { setView('orders'); ServerOrders.action('so-new', target); }
  }

  function init() {
    fab = document.getElementById('assistantFab');
    panel = document.getElementById('assistantPanel');
    if (!fab || !panel) return;
    fab.addEventListener('click', event => { event.stopPropagation(); setOpen(!open); });
    document.addEventListener('click', event => { if (open && !panel.contains(event.target) && !fab.contains(event.target)) setOpen(false, {focusFab:false}); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); } });
    window.addEventListener('scroll', dodge, {passive:true});
    window.addEventListener('resize', dodge);
    refresh();
  }

  return {init, refresh, renderBriefing, action, badgeCount, isOpen:() => open, close:() => setOpen(false, {focusFab:false})};
})();
