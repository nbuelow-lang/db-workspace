let notificationFilter = 'all';
let notificationGrouping = 'area';
const notificationExpanded = new Set();

// Browser-only previews do not persist the acceptance queue itself.
function restoreLocalNotificationReceipts(loaded) {
  const receipts=loaded.notificationQueueReceipts || {};
  for (const row of acceptanceQueue) {
    const receipt=receipts[row.id];
    if (!receipt) continue;
    if (typeof receipt.read==='string') row.notificationReadFingerprint=receipt.read;
    if (typeof receipt.archived==='string') row.notificationArchivedFingerprint=receipt.archived;
  }
}

function captureLocalNotificationReceipts() {
  state.notificationQueueReceipts=Object.fromEntries(acceptanceQueue.map(row=>[row.id,{
    read:row.notificationReadFingerprint, archived:row.notificationArchivedFingerprint
  }]));
}

function notificationEntries() {
  return NotificationCenterModel.entries(state, ServerAcceptance.enabled ? ServerAcceptance.notificationRows() : acceptanceQueue, ServerOrders.enabled ? [...ServerOrders.notificationRows(), ...ServerInstruments.notificationRows(), ...ServerTime.notificationRows()] : []);
}

function updateNotificationBadges(root = document) {
  const counts = NotificationCenterModel.badges(notificationEntries());
  root.querySelectorAll('.workspace-app').forEach(button => {
    const target = button.dataset.target;
    const count = target.startsWith('folder:') ? workspaceFolderMembers(target).reduce((sum, area) => sum + (counts[area.view] || 0), 0) : counts[target] || 0;
    const badge = button.querySelector('.workspace-notification-badge');
    if (badge) { badge.hidden = !count; badge.textContent = count > 99 ? '99+' : String(count); }
    const name = I18n.t(NotificationCenterModel.areas[target]?.name || workspaceAreas.find(area => area.view === target)?.name || '');
    button.setAttribute('aria-label', count ? I18n.t('{name}, {n} ungelesene Hinweise', {name, n:count}) : name);
  });
  const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const bell = root.querySelector('#notificationButton');
  if (bell) {
    bell.setAttribute('aria-label', I18n.t('Mitteilungen, {n} ungelesen', {n:count}));
    const dot = bell.querySelector('.notification-dot');
    if (dot) { dot.hidden = !count; dot.textContent = count > 99 ? '99+' : String(count); }
  }
}

function canSendInstallerNotifications() { return ['admin', 'pm', 'quality'].includes(state.role); }
function notificationPriority(item) { return `<span class="nc-priority rank-${item.rank}">${escapeAttr(I18n.t(item.priority))}</span>`; }

// iOS-like cards: app icon of the area, app name, relative time, title and preview.
const notificationAppImages = ['werkraum','control','acceptance','chats','finance','partners','smartops','imports','orders','instruments','schedule','customers','time'];
function notificationAppIcon(area) {
  return notificationAppImages.includes(area)
    ? `<img class="nc-app-icon" src="assets/workspace-icons/retina-v1/${area}-128.webp?v=${workspaceArtRevision[area] || 1}" width="22" height="22" alt="" draggable="false">`
    : `<span class="nc-app-icon nc-app-glyph">${icon(NotificationCenterModel.areas[area]?.icon || 'bell', 13)}</span>`;
}
function notificationAgo(item) {
  if (!item.timestamp) return item.time || '';
  const minutes = (Date.now() - item.timestamp) / 60000;
  if (minutes < 1) return I18n.t('jetzt');
  if (minutes < 60) return I18n.t('vor {n} Min.', {n:Math.round(minutes)});
  if (minutes < 24 * 60) return I18n.t('vor {n} Std.', {n:Math.round(minutes / 60)});
  if (minutes < 48 * 60) return I18n.t('gestern');
  return new Date(item.timestamp).toLocaleDateString(I18n.locale(), {day:'numeric', month:'short'});
}
function notificationCardBody(item) {
  const area = I18n.t(NotificationCenterModel.areas[item.area]?.name || '');
  return `<span class="nc-card-top">${notificationAppIcon(item.area)}<span class="nc-app">${escapeAttr(area)}</span><span class="nc-time">${escapeAttr(notificationAgo(item))}</span></span>
    <span class="nc-copy"><strong>${escapeAttr(item.title)}</strong><span class="nc-preview">${escapeAttr(item.text)}</span>
    ${item.rank >= 2 || item.projectID ? `<span class="nc-meta">${item.rank >= 2 ? notificationPriority(item) : ''}${item.projectID ? `<span>${escapeAttr(item.projectID)}</span>` : ''}</span>` : ''}</span>`;
}
function notificationRow(item) {
  const key = escapeAttr(item.key);
  return `<li class="nc-row ${item.isRead ? '' : 'is-unread'} rank-${item.rank}" data-key="${key}">
    <div class="nc-swipe-actions">
      ${!item.isRead ? `<button class="nc-swipe-read" data-action="nc-read" data-key="${key}" aria-label="${escapeAttr(item.title)}: ${escapeAttr(I18n.t('als gelesen markieren'))}">${icon('check',18)}<span>${I18n.t('Gelesen')}</span></button>` : ''}
      <button class="nc-swipe-archive" data-action="${item.archived ? 'nc-restore' : 'nc-archive'}" data-key="${key}" ${item.rank === 3 ? 'disabled' : ''} aria-label="${escapeAttr(item.title)}: ${escapeAttr(I18n.t(item.archived ? 'Wiederherstellen' : 'Archivieren'))}">${icon('layers',18)}<span>${I18n.t(item.archived ? 'Zurück' : 'Archiv')}</span></button>
    </div>
    <div class="nc-card">
      <button class="nc-entry" data-action="nc-open" data-key="${key}" data-notification="${key}"><span class="nc-read-dot" aria-label="${I18n.t(item.isRead ? 'Gelesen' : 'Ungelesen')}"></span>${notificationCardBody(item)}</button>
      <button class="nc-more" data-action="open-notification" data-notification="${key}" title="${escapeAttr(I18n.t('Optionen'))}" aria-label="${escapeAttr(item.title)}: ${escapeAttr(I18n.t('Optionen'))}">${icon('more-horizontal',18)}</button>
    </div>
  </li>`;
}

function showNotifications(filter = notificationFilter, focusKey = '') {
  notificationFilter = ['all','unread','urgent','archive'].includes(filter) ? filter : 'all';
  const backdrop = document.getElementById('modalBackdrop'), opening = backdrop.hidden || !document.querySelector('.nc-center');
  const keepScroll = opening ? 0 : document.getElementById('modalBody').scrollTop;
  const entries = notificationEntries();
  const active = NotificationCenterModel.filter(entries);
  const unread = active.filter(item => !item.isRead).length;
  const critical = active.filter(item => item.rank === 3).length;
  const groups = NotificationCenterModel.groups(NotificationCenterModel.filter(entries, notificationFilter), notificationGrouping);
  const date = new Intl.DateTimeFormat(I18n.locale(), {weekday:'long', day:'numeric', month:'long'}).format(new Date());
  openModal({
    eyebrow: date, title: I18n.t('Mitteilungen'),
    body: `<div class="nc-center">
      <p class="nc-summary" role="status">${I18n.t('{n} ungelesen', {n:unread})}${critical ? ` <span>· ${I18n.t('{n} kritisch', {n:critical})}</span>` : ''}</p>
      <div class="nc-filters" role="group" aria-label="${escapeAttr(I18n.t('Mitteilungen filtern'))}">${[['all','Alle'],['unread','Ungelesen'],['urgent','Dringend'],['archive','Archiv']].map(([id,label]) => `<button data-action="filter-notifications" data-filter="${id}" aria-pressed="${notificationFilter===id}">${I18n.t(label)}</button>`).join('')}</div>
      <div class="nc-grouping"><label for="notificationGrouping">${I18n.t('Stapeln nach')}</label><select id="notificationGrouping">${[['area','Arbeitsbereich'],['project','Bauvorhaben']].map(([id,label]) => `<option value="${id}" ${notificationGrouping===id?'selected':''}>${I18n.t(label)}</option>`).join('')}</select></div>
      <div class="nc-stacks">${groups.map((group,index) => {
        const key = notificationGrouping+':'+group.key;
        const project = notificationGrouping==='project' && projects.find(item=>item.id===group.key);
        const name = project ? `${project.city} · ${group.key}` : I18n.t(group.title);
        // A single notification is shown as its card; several form a stack that fans out on tap.
        if (group.items.length === 1) return `<section class="nc-stack is-single" style="--i:${index}"><ul class="nc-items">${notificationRow(group.items[0])}</ul></section>`;
        const expanded = notificationExpanded.has(key);
        const count = group.items.filter(item=>!item.isRead).length, top = group.items[0];
        return `<section class="nc-stack is-stacked ${expanded?'is-expanded':''}" style="--i:${index}" data-depth="${Math.min(group.items.length - 1, 2)}">
          ${expanded ? `<div class="nc-stack-bar"><h3>${escapeAttr(name)}</h3>
            <button class="nc-stack-header nc-collapse" data-action="nc-toggle-stack" data-group="${escapeAttr(key)}" aria-expanded="true" aria-controls="nc-stack-${index}">${I18n.t('Weniger anzeigen')}</button>
            ${count?`<button class="nc-stack-read" data-action="nc-stack-read" data-group="${escapeAttr(key)}" title="${escapeAttr(I18n.t('Stapel als gelesen markieren'))}" aria-label="${escapeAttr(I18n.t('Stapel als gelesen markieren'))}">${icon('check',16)}</button>`:''}</div>`
          : `<button class="nc-stack-header nc-card ${count ? 'is-unread' : ''} rank-${top.rank}" data-action="nc-toggle-stack" data-group="${escapeAttr(key)}" aria-expanded="false" aria-controls="nc-stack-${index}" aria-label="${escapeAttr(`${name}: ${I18n.t('{n} Mitteilungen', {n:group.items.length})}`)}">
              <span class="nc-entry-like">${notificationCardBody(top)}</span>
              <span class="nc-stack-count">${I18n.t('{n} weitere', {n:group.items.length - 1})}${count?` · ${I18n.t('{n} ungelesen', {n:count})}`:''}</span></button>`}
          <div id="nc-stack-${index}" ${expanded?'':'hidden'}><ul class="nc-items">${group.items.map(notificationRow).join('')}</ul></div>
        </section>`;
      }).join('') || `<div class="nc-empty">${icon('check-circle',32)}<h3>${I18n.t(notificationFilter==='unread'?'Alles gelesen':'Keine Mitteilungen')}</h3><p>${I18n.t(notificationFilter==='archive'?'Das Archiv ist leer.':'In diesem Filter liegen keine Hinweise vor.')}</p></div>`}</div>
      <p class="nc-hint">${I18n.t('Tippen öffnet den Vorgang. Nach links wischen: gelesen oder archivieren.')}</p>
    </div>`,
    footer: `<button class="button outline" data-action="mark-all-notifications" ${unread?'':'disabled'}>${icon('check',16)} ${I18n.t('Alle als gelesen')}</button>${canSendInstallerNotifications()?`<button class="button primary" data-action="compose-notification">${icon('mail',16)} ${I18n.t('Verfassen')}</button>`:''}`
  });
  backdrop.classList.add('is-nc');
  if (opening && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    backdrop.classList.remove('nc-enter'); void backdrop.offsetWidth; backdrop.classList.add('nc-enter');
    setTimeout(() => backdrop.classList.remove('nc-enter'), 700);
  }
  document.getElementById('modalBody').scrollTop = keepScroll;
  const grouping = document.getElementById('notificationGrouping');
  grouping.addEventListener('change', () => { notificationGrouping = grouping.value; showNotifications(); document.getElementById('notificationGrouping').focus(); });
  const focus = [...document.querySelectorAll('[data-action="nc-toggle-stack"]')].find(el=>el.dataset.group===focusKey);
  (focus || document.querySelector(`.nc-filters [data-filter="${notificationFilter}"]`)).focus({preventScroll:true});
}

function showNotificationDetail(id) {
  const item = notificationEntries().find(item => item.key === id || item.key === 'notification:'+id);
  if (!item) return;
  NotificationCenterModel.read(item);
  saveState(); updateBadges();
  openModal({
    eyebrow: I18n.t(NotificationCenterModel.areas[item.area].name), title: item.title,
    body: `<div class="nc-detail">${notificationPriority(item)}<p>${escapeAttr(item.text)}</p><dl><div><dt>${I18n.t('Bauvorhaben')}</dt><dd>${escapeAttr(item.projectID || I18n.t('Ohne Projektbezug'))}</dd></div><div><dt>${I18n.t('Absender')}</dt><dd>${escapeAttr(item.record.senderName || 'Bülow & Dolz · System')}</dd></div><div><dt>${I18n.t('Status')}</dt><dd>${I18n.t('Gelesen')}${item.archived?` · ${I18n.t('Archiviert')}`:''}</dd></div></dl>
      <div class="nc-detail-actions"><button class="button outline" data-action="nc-unread" data-key="${escapeAttr(item.key)}">${icon('mail',16)} ${I18n.t('Ungelesen')}</button><button class="button outline" data-action="${item.archived?'nc-restore':'nc-archive'}" data-key="${escapeAttr(item.key)}" ${item.rank===3?`disabled title="${escapeAttr(I18n.t('Kritische Vorgänge müssen zuerst geklärt werden'))}"`:''}>${icon('layers',16)} ${I18n.t(item.archived?'Wiederherstellen':'Archivieren')}</button></div>${item.rank===3?`<p class="nc-critical-note">${I18n.t('Kritischer Vorgang: Klärung erforderlich. Lesen ersetzt keine Freigabe.')}</p>`:''}</div>`,
    footer: `<button class="button outline" data-action="notifications">${icon('arrow-left',16)} ${I18n.t('Zurück')}</button><button class="button primary" data-action="nc-open-source" data-key="${escapeAttr(item.key)}">${I18n.t('Vorgang öffnen')} ${icon('arrow-right',16)}</button>`
  });
  document.querySelector('#modalFooter [data-action="notifications"]').focus({preventScroll:true});
}

function notificationCenterAction(action, target) {
  const entries = notificationEntries();
  const item = entries.find(item=>item.key===target.dataset.key);
  if (action==='nc-toggle-stack') {
    const group=target.dataset.group;
    if (notificationExpanded.has(group)) notificationExpanded.delete(group); else notificationExpanded.add(group);
    showNotifications(notificationFilter,group); return;
  }
  if (action==='nc-open' && item) { NotificationCenterModel.read(item); saveState(); updateBadges(); action='nc-open-source'; }
  if (action==='nc-open-source' && item) {
    closeModal();
    if (item.target.chat || (item.area==='chats' && item.projectID)) { state.view='chats'; selectOperationsChat(item.target.chat || item.projectID); }
    else if (item.target.module) showSmartModule(item.target.module);
    else if (item.target.import) showImportReview(item.target.import);
    else if (item.target.acceptance) showAcceptanceDetails(item.target.acceptance);
    else if (item.target.order) ServerOrders.openOrder(item.target.order);
    else setView(item.target.view || item.area);
    return;
  }
  if (action==='nc-stack-read' || action==='nc-mark-all') {
    const visible=NotificationCenterModel.filter(entries, action==='nc-mark-all'?'all':notificationFilter);
    const selected=action==='nc-mark-all'?visible:visible.filter(entry=>notificationGrouping+':'+(notificationGrouping==='area'?entry.area:entry.projectID||'general')===target.dataset.group);
    selected.forEach(entry=>NotificationCenterModel.read(entry));
  } else if (item) {
    if (action==='nc-read') NotificationCenterModel.read(item);
    if (action==='nc-unread') { NotificationCenterModel.archive(item,false); NotificationCenterModel.read(item,false); notificationFilter='unread'; }
    if (action==='nc-archive') NotificationCenterModel.archive(item);
    if (action==='nc-restore') NotificationCenterModel.archive(item,false);
  }
  saveState(); updateBadges(); showNotifications(notificationFilter,target.dataset.group);
}

// Keep keyboard navigation inside the notification dialog, without changing other modals.
document.addEventListener('keydown', event => {
  if (event.key!=='Tab' || document.getElementById('modalBackdrop').hidden || !document.querySelector('.nc-center, .nc-detail')) return;
  const controls=[...document.querySelectorAll('#modal button:not(:disabled), #modal select')].filter(el=>el.getClientRects().length);
  const first=controls[0], last=controls[controls.length-1];
  if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
});

function showNotificationComposer() {
  if (!canSendInstallerNotifications()) return;
  const shared = sharedEnvelope?.state || {};
  const availableProjects = shared.projects?.length ? shared.projects : projects;
  const teams = shared.teams || [];
  openModal({
    eyebrow: 'PROJEKTKOMMUNIKATION', title: 'Mitteilung verfassen',
    body: `<div class="form-grid">
      ${selectField('Bauvorhaben','notificationProject',availableProjects.map(project=>[escapeAttr(project.id),`${escapeAttr(project.id)} · ${escapeAttr(project.city)}`]),escapeAttr(availableProjects[0]?.id || ''))}
      ${selectField('Empfänger','notificationTeam',[['channel','Projektkanal'],...teams.map(team=>[escapeAttr(team.id),escapeAttr(team.name)])],'channel')}
      ${selectField('Priorität','notificationPriority',[['Normal','Normal'],['Wichtig','Wichtig'],['Dringend','Dringend']],'Wichtig')}
      ${field('Betreff','notificationTitle','','text',true)}
      <div class="field full"><label for="notificationMessage">Nachricht</label><textarea id="notificationMessage" placeholder="Projektinformation"></textarea></div></div>
      <p class="nc-composer-note">Wird im Projektchat gespeichert. Keine Push-Zustellung außerhalb der Plattform. Im Testbetrieb ist der Projektkanal gemeinsam sichtbar.</p>`,
    footer: `<button class="button outline" data-action="notifications">Abbrechen</button><button class="button primary" data-action="send-notification">${icon('mail',16)} Senden</button>`
  });
}

function sendInstallerNotification() {
  if (!canSendInstallerNotifications()) return;
  const value = name => document.querySelector(`[data-model="${name}"]`)?.value.trim() || '';
  const projectID=value('notificationProject'), teamID=value('notificationTeam'), priority=value('notificationPriority');
  const title=value('notificationTitle'), message=document.getElementById('notificationMessage')?.value.trim() || '';
  const shared=sharedEnvelope?.state || {};
  const project=(shared.projects?.length?shared.projects:projects).find(item=>item.id===projectID);
  const team=(shared.teams || []).find(item=>item.id===teamID);
  if (!project || (!team && teamID!=='channel') || !title || !message) { showToast('Angaben fehlen','Bitte Bauvorhaben, Empfänger, Betreff und Nachricht ausfüllen.','warning'); return; }
  const token=Date.now()+'-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const now=Date.now()/1000-swiftReferenceDateOffset;
  const senderName=state.initialSetup?.fullName || 'Bülow & Dolz Projektkoordination';
  const messageID='message-'+token;
  state.notifications ||= [];
  state.operations ||= {};
  state.operations.projectMessages ||= [];
  state.notifications.unshift({id:'notification-'+token,messageID,kind:'chat',title,text:message,time:'Gerade eben',isRead:false,priority,projectID,recipientTeamID:team?.id || '',recipientName:team?.name || 'Projektkanal',recipientRole:'Projektbeteiligte',deliveryStatus:'Im Projektkanal gespeichert',sentAt:now,senderName});
  state.operations.projectMessages.push({id:messageID,projectID,senderName,senderRole:'Projektkoordination',body:message,priority,sentAt:now,isRead:false});
  saveState(); closeModal(); render();
  showToast('Mitteilung gespeichert',escapeAttr(`${projectID} · ${team?.name || 'Projektkanal'}`),'success');
}
