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
  return NotificationCenterModel.entries(state, acceptanceQueue);
}

function updateNotificationBadges(root = document) {
  const counts = NotificationCenterModel.badges(notificationEntries());
  root.querySelectorAll('.workspace-app').forEach(button => {
    const count = counts[button.dataset.target] || 0;
    const badge = button.querySelector('.workspace-notification-badge');
    if (badge) { badge.hidden = !count; badge.textContent = count > 99 ? '99+' : String(count); }
    const name = NotificationCenterModel.areas[button.dataset.target]?.name || '';
    button.setAttribute('aria-label', count ? `${name}, ${count} ungelesene Hinweise` : name);
  });
  const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const bell = root.querySelector('#notificationButton');
  if (bell) {
    bell.setAttribute('aria-label', `Mitteilungen, ${count} ungelesen`);
    const dot = bell.querySelector('.notification-dot');
    if (dot) { dot.hidden = !count; dot.textContent = count > 99 ? '99+' : String(count); }
  }
}

function canSendInstallerNotifications() { return ['admin', 'pm', 'quality'].includes(state.role); }
function notificationPriority(item) { return `<span class="nc-priority rank-${item.rank}">${escapeAttr(item.priority)}</span>`; }

function notificationRow(item) {
  return `<li class="nc-row ${item.isRead ? '' : 'is-unread'}">
    <button class="nc-entry" data-action="open-notification" data-notification="${escapeAttr(item.key)}">
      <span class="nc-read-dot" aria-label="${item.isRead ? 'Gelesen' : 'Ungelesen'}"></span>
      <span class="nc-copy"><strong>${escapeAttr(item.title)}</strong><span class="nc-preview">${escapeAttr(item.text)}</span>
        <span class="nc-meta">${notificationPriority(item)}${item.projectID ? `<span>${escapeAttr(item.projectID)}</span>` : ''}${item.time ? `<span>${escapeAttr(item.time)}</span>` : ''}</span>
      </span>
    </button>
    ${!item.isRead ? `<button class="nc-icon-button" data-action="nc-read" data-key="${escapeAttr(item.key)}" title="Als gelesen markieren" aria-label="${escapeAttr(item.title)}: als gelesen markieren">${icon('check',18)}</button>` : ''}
  </li>`;
}

function showNotifications(filter = notificationFilter, focusKey = '') {
  notificationFilter = ['all','unread','urgent','archive'].includes(filter) ? filter : 'all';
  const entries = notificationEntries();
  const active = NotificationCenterModel.filter(entries);
  const unread = active.filter(item => !item.isRead).length;
  const critical = active.filter(item => item.rank === 3).length;
  const groups = NotificationCenterModel.groups(NotificationCenterModel.filter(entries, notificationFilter), notificationGrouping);
  openModal({
    eyebrow: 'BÜLOW & DOLZ', title: 'Mitteilungen',
    body: `<div class="nc-center">
      <p class="nc-summary" role="status">${unread} ungelesen${critical ? ` <span>· ${critical} kritisch</span>` : ''}</p>
      <div class="nc-filters" role="group" aria-label="Mitteilungen filtern">${[['all','Alle'],['unread','Ungelesen'],['urgent','Dringend'],['archive','Archiv']].map(([id,label]) => `<button data-action="filter-notifications" data-filter="${id}" aria-pressed="${notificationFilter===id}">${label}</button>`).join('')}</div>
      <div class="nc-grouping"><label for="notificationGrouping">Stapeln nach</label><select id="notificationGrouping">${[['area','Arbeitsbereich'],['project','Bauvorhaben']].map(([id,label]) => `<option value="${id}" ${notificationGrouping===id?'selected':''}>${label}</option>`).join('')}</select></div>
      <div class="nc-stacks">${groups.map((group,index) => {
        const key = notificationGrouping+':'+group.key;
        const expanded = notificationExpanded.has(key);
        const count = group.items.filter(item=>!item.isRead).length;
        const project = notificationGrouping==='project' && projects.find(item=>item.id===group.key);
        const name = project ? `${project.city} · ${group.key}` : group.title;
        return `<section class="nc-stack ${expanded?'is-expanded':''} ${group.items.length>1?'is-stacked':''}">
          <button class="nc-stack-header" data-action="nc-toggle-stack" data-group="${escapeAttr(key)}" aria-expanded="${expanded}" aria-controls="nc-stack-${index}">
            <span class="nc-stack-icon">${icon(group.icon,22)}</span><span class="nc-copy"><strong>${escapeAttr(name)}</strong><small>${group.items.length} ${group.items.length===1?'Mitteilung':'Mitteilungen'}${count?` · ${count} ungelesen`:''}</small><span class="nc-preview">${escapeAttr(group.items[0].title)}</span></span>
            <span class="nc-stack-end">${notificationPriority(group.items[0])}${icon('chevron-down',16)}</span>
          </button>
          <div id="nc-stack-${index}" ${expanded?'':'hidden'}><ul class="nc-items">${group.items.map(notificationRow).join('')}</ul>${count?`<button class="nc-stack-read" data-action="nc-stack-read" data-group="${escapeAttr(key)}">${icon('check',16)} Stapel als gelesen markieren</button>`:''}</div>
        </section>`;
      }).join('') || `<div class="nc-empty">${icon('check-circle',32)}<h3>${notificationFilter==='unread'?'Alles gelesen':'Keine Mitteilungen'}</h3><p>${notificationFilter==='archive'?'Das Archiv ist leer.':'In diesem Filter liegen keine Hinweise vor.'}</p></div>`}</div>
    </div>`,
    footer: `<button class="button outline" data-action="mark-all-notifications" ${unread?'':'disabled'}>${icon('check',16)} Alle als gelesen</button>${canSendInstallerNotifications()?`<button class="button primary" data-action="compose-notification">${icon('mail',16)} Verfassen</button>`:''}`
  });
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
    eyebrow: NotificationCenterModel.areas[item.area].name, title: item.title,
    body: `<div class="nc-detail">${notificationPriority(item)}<p>${escapeAttr(item.text)}</p><dl><div><dt>Bauvorhaben</dt><dd>${escapeAttr(item.projectID || 'Ohne Projektbezug')}</dd></div><div><dt>Absender</dt><dd>${escapeAttr(item.record.senderName || 'Bülow & Dolz · System')}</dd></div><div><dt>Status</dt><dd>Gelesen${item.archived?' · Archiviert':''}</dd></div></dl>
      <div class="nc-detail-actions"><button class="button outline" data-action="nc-unread" data-key="${escapeAttr(item.key)}">${icon('mail',16)} Ungelesen</button><button class="button outline" data-action="${item.archived?'nc-restore':'nc-archive'}" data-key="${escapeAttr(item.key)}" ${item.rank===3?'disabled title="Kritische Vorgänge müssen zuerst geklärt werden"':''}>${icon('layers',16)} ${item.archived?'Wiederherstellen':'Archivieren'}</button></div>${item.rank===3?'<p class="nc-critical-note">Kritischer Vorgang: Klärung erforderlich. Lesen ersetzt keine Freigabe.</p>':''}</div>`,
    footer: `<button class="button outline" data-action="notifications">${icon('arrow-left',16)} Zurück</button><button class="button primary" data-action="nc-open-source" data-key="${escapeAttr(item.key)}">Vorgang öffnen ${icon('arrow-right',16)}</button>`
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
  if (action==='nc-open-source' && item) {
    closeModal();
    if (item.target.chat || (item.area==='chats' && item.projectID)) { state.view='chats'; selectOperationsChat(item.target.chat || item.projectID); }
    else if (item.target.module) showSmartModule(item.target.module);
    else if (item.target.import) showImportReview(item.target.import);
    else if (item.target.acceptance) showAcceptanceDetails(item.target.acceptance);
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
