// The home screen links to existing workflows; it does not grant permissions.
const workspaceAreas = [
  {view:'werkraum', name:'Anfragen', icon:'briefcase', tone:'azure', keywords:'Vertrieb Werkraum Angebote Kunden'},
  {view:'control', name:'Projekte', icon:'layers', tone:'blue', keywords:'Baustellen Aufträge Projektpflege'},
  {view:'acceptance', name:'Abnahmen', icon:'clipboard-check', tone:'teal', keywords:'Qualität QM Freigabe Prüfung'},
  {view:'chats', name:'Nachrichten', icon:'mail', tone:'green', keywords:'Chat Kommunikation Projektchats'},
  {view:'finance', name:'Finanzen', icon:'euro', tone:'graphite', keywords:'Lexware Kalkulation Rechnungen'},
  {view:'partners', name:'Partner', icon:'users', tone:'rose', keywords:'Unternehmen Partnerpipeline', folder:'more'},
  {view:'smartops', name:'Morning Control', icon:'bar-chart', tone:'electric', keywords:'Briefing Tagesstand Aufgaben Assistenz Morgen'},
  {view:'imports', name:'Import', icon:'upload', tone:'neutral', keywords:'Pipedrive Locatick Daten Projektimport', folder:'more'},
  // Folder tile: groups rarely used areas (members carry folder:'more'); opens a sheet with them.
  {view:'folder:more', name:'Weitere', icon:'grid', tone:'neutral', keywords:'Ordner Partner Import Mehr', isFolder:true}
];
const workspaceFolderMembers = id => workspaceAreas.filter(area => area.folder === id.replace('folder:', ''));

// Bump an entry after re-rendering that icon (Tools/render-workspace-icons.cjs) so browsers drop the cached image.
const workspaceArtRevision = {werkraum:3, orders:2, smartops:2, partners:2, imports:2};

function workspaceAppArtwork(area) {
  if (area.isFolder) return `<span class="workspace-folder-art">${workspaceFolderMembers(area.view).slice(0, 4).map(member => `<img src="assets/workspace-icons/retina-v1/${member.view}-128.webp?v=${workspaceArtRevision[member.view] || 1}" width="24" height="24" alt="" draggable="false">`).join('')}</span>`;
  if (area.render === false) return workspaceFallbackArtwork(area);
  const base = 'assets/workspace-icons/retina-v1/'+area.view, v = `?v=${workspaceArtRevision[area.view] || 1}`;
  return workspaceFallbackArtwork(area)+`<img class="workspace-app-render" src="${base}-256.webp${v}" srcset="${base}-128.webp${v} 128w, ${base}-256.webp${v} 256w, ${base}-512.webp${v} 512w" sizes="(max-width: 700px) 62px, 80px" width="80" height="80" alt="" aria-hidden="true" decoding="async" draggable="false">`;
}

// Keep a code-native fallback for failed image loads and high-contrast modes.
function workspaceFallbackArtwork(area) {
  const glyph = icon(area.icon, 56);
  switch (area.view) {
    case 'control':
      return '<span class="app-art art-projects"><i class="project-sheet back"></i><i class="project-sheet front"><i></i><i></i><i></i></i></span>';
    case 'acceptance':
      return `<span class="app-art art-acceptance"><i class="checklist-lines"></i><span class="approval-seal">${icon('check',32)}</span></span>`;
    case 'finance':
      return `<span class="app-art art-finance"><i class="wallet-card one"></i><i class="wallet-card two"></i><i class="wallet-card three"></i><span class="wallet-pocket">${glyph}</span></span>`;
    case 'imports':
      return `<span class="app-art art-import"><i class="import-sheet"></i>${glyph}<i class="import-tray"></i></span>`;
    default:
      return `<span class="app-art art-${area.view}">${glyph}</span>`;
  }
}

function handleWorkspaceImageError(event) {
  if (event.target instanceof HTMLImageElement && event.target.classList.contains('workspace-app-render')) event.target.hidden = true;
}

function workspacePendingItems() {
  const items = [];
  const deviations = (state.deviationCases || []).filter(item => item.status !== 'Erledigt');
  if (deviations.length) items.push({icon:'alert', title:I18n.t('Abweichungen prüfen'), detail:I18n.t('{n} offene Vorgänge', {n:deviations.length}), action:'smart-module', attribute:'data-module="deviations"', urgent:deviations.some(item => item.priority === 'Kritisch')});
  const imports = (state.operations?.importCandidates || []).filter(item => ['Prüfung nötig', 'Mögliches Duplikat'].includes(item.status));
  if (imports.length) items.push({icon:'file-check', title:I18n.t('Importdaten prüfen'), detail:I18n.t('{n} Datensätze mit Klärungsbedarf', {n:imports.length}), action:'goto', attribute:'data-target="imports"'});
  const messages = (state.operations?.projectMessages || []).filter(item => !item.isRead && item.senderName !== state.initialSetup?.fullName);
  if (messages.length) items.push({icon:'mail', title:I18n.t('Nachrichten beantworten'), detail:I18n.t('{n} ungelesene Nachrichten', {n:messages.length}), action:'goto', attribute:'data-target="chats"'});
  return items;
}

// Attention list and project list live in the Morning Control briefing (features/intelligence);
// the start page stays clear and shows projects only as search results.
function workspaceAttentionMarkup() {
  const pending = workspacePendingItems();
  return `<section class="workspace-section workspace-attention" aria-labelledby="workspaceAttentionTitle">
    <div class="workspace-section-heading"><h3 id="workspaceAttentionTitle">${I18n.t('Aufmerksamkeit')}</h3><span>${pending.length ? I18n.t('{n} Themen', {n:pending.length}) : I18n.t('Alles im Blick')}</span></div>
    <div class="workspace-list">
      ${pending.map(item => `<button type="button" class="workspace-row" data-action="${item.action}" ${item.attribute}>
        <span class="workspace-row-icon ${item.urgent ? 'is-urgent' : ''}">${icon(item.icon,20)}</span>
        <span class="workspace-row-copy"><strong>${item.title}</strong><small>${item.detail}${item.urgent ? ' · '+I18n.t('Kritischer Vorgang') : ''}</small></span>${icon('arrow-right',16)}
      </button>`).join('') || `<p class="workspace-empty">${I18n.t('Keine offenen Abweichungen, Importprüfungen oder Nachrichten.')}</p>`}
    </div>
  </section>`;
}

function workspaceProjectRows({all = false} = {}) {
  return projects.slice(0, all ? projects.length : 3).map(project => `<button type="button" class="workspace-row workspace-project" data-action="project-details" data-project="${escapeAttr(project.id)}" data-workspace-search="${escapeAttr([project.id,project.city,project.title,project.coordinator].filter(Boolean).join(' '))}" ${all ? 'hidden' : ''}>
    <span class="workspace-row-icon">${icon('building',20)}</span><span class="workspace-row-copy"><strong>${escapeAttr(project.city)}</strong><small>${escapeAttr(project.id)}</small></span>${icon('arrow-right',16)}
  </button>`).join('');
}

function workspaceProjectsMarkup() {
  return `<section class="workspace-section workspace-projects" aria-labelledby="briefingProjectsTitle">
    <div class="workspace-section-heading"><h3 id="briefingProjectsTitle">${I18n.t('Projekte')}</h3><button class="text-button" data-action="goto" data-target="control">${I18n.t('Alle Projekte')} ${icon('arrow-right',14)}</button></div>
    <div class="workspace-list">${workspaceProjectRows() || `<p class="workspace-empty">${I18n.t('Keine Projekte vorhanden.')}</p>`}</div>
  </section>`;
}

function renderWorkspaceHome({preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ', I18n.t('Arbeitsplatz'));
  const date = new Intl.DateTimeFormat(I18n.locale(), {weekday:'long', day:'numeric', month:'long'}).format(new Date());
  return `<div class="workspace-home">
    <div class="workspace-heading">
      <div><p class="workspace-date">${date}</p><h2 data-time-greeting>${escapeAttr(timeGreeting())}</h2></div>
      <div class="workspace-search" role="search">
        ${icon('search',18)}<input id="workspaceSearch" type="search" aria-label="${escapeAttr(I18n.t('Bereich oder Projekt suchen'))}" placeholder="${escapeAttr(I18n.t('Bereich oder Projekt suchen'))}" autocomplete="off">
        <button id="workspaceSearchClear" type="button" title="${escapeAttr(I18n.t('Suche leeren'))}" aria-label="${escapeAttr(I18n.t('Suche leeren'))}" hidden>${icon('x',16)}</button>
      </div>
    </div>
    <section class="workspace-section" aria-labelledby="workspaceAreasTitle">
      <div class="workspace-apps-heading"><h3 id="workspaceAreasTitle">${I18n.t('Arbeitsbereiche')}</h3><div class="workspace-arrange-controls">
        <button type="button" data-workspace-arrange="edit" aria-label="Arbeitsbereiche anordnen" title="Arbeitsbereiche anordnen">${icon('grid',18)}</button>
        <button type="button" data-workspace-arrange="reset" aria-label="Standardanordnung wiederherstellen" title="Standardanordnung wiederherstellen" hidden>${icon('refresh',18)}</button>
        <button type="button" data-workspace-arrange="cancel" aria-label="Anordnung verwerfen" title="Anordnung verwerfen" hidden>${icon('x',18)}</button>
        <button type="button" data-workspace-arrange="done" hidden>${I18n.t('Fertig')}</button>
      </div></div>
      <span class="workspace-arrange-status" id="workspaceArrangeHelp">${I18n.t('Mit Pfeiltasten verschieben. Fertig speichert, Escape verwirft die Anordnung.')}</span>
      <span class="workspace-arrange-status" id="workspaceArrangeStatus" role="status" aria-live="polite"></span>
      <div class="workspace-apps">
        ${WorkspaceArrange.areas(workspaceAreas).map(area => `<button type="button" class="workspace-app${area.isFolder ? ' is-folder' : ''}${area.folder ? ' is-folder-member' : ''}" data-action="${area.isFolder ? 'workspace-folder' : 'goto'}" data-target="${area.view}" data-workspace-search="${escapeAttr(I18n.t(area.name)+' '+area.name+' '+area.keywords)}" ${area.folder ? 'hidden' : ''}>
          <span class="workspace-app-visual"><span class="workspace-app-icon tone-${area.tone}" aria-hidden="true">${workspaceAppArtwork(area)}<span class="workspace-icon-contrast">${icon(area.icon,56)}</span></span><span class="workspace-notification-badge" aria-hidden="true" hidden></span></span><span class="workspace-app-label">${escapeAttr(I18n.t(area.name))}</span>
        </button>`).join('')}
      </div>
      <p class="workspace-empty" id="workspaceAreasEmpty" hidden>${I18n.t('Kein passender Arbeitsbereich.')}</p>
    </section>
    <p class="workspace-search-status" id="workspaceSearchStatus" role="status" aria-live="polite"></p>
    ${WorkspaceFocus.render({preview})}
    <div class="workspace-columns workspace-search-results" hidden>
      <section class="workspace-section workspace-projects" aria-labelledby="workspaceProjectsTitle">
        <div class="workspace-section-heading"><h3 id="workspaceProjectsTitle">${I18n.t('Projekte')}</h3></div>
        <div class="workspace-list">${workspaceProjectRows({all:true})}</div>
        <p class="workspace-empty" id="workspaceProjectsEmpty" hidden>${I18n.t('Keine passenden Projekte.')}</p>
      </section>
    </div>
  </div>`;
}

function filterWorkspace(value) {
  const query = value.trim().toLocaleLowerCase('de-DE');
  const home = document.querySelector('.workspace-home');
  if (!home) return;
  let areas = 0, matches = 0;
  home.querySelectorAll('.workspace-app').forEach(element => {
    const member = element.classList.contains('is-folder-member'), folder = element.classList.contains('is-folder');
    element.hidden = query ? folder || !element.dataset.workspaceSearch.toLocaleLowerCase('de-DE').includes(query) : member;
    if (!element.hidden) areas++;
  });
  home.querySelectorAll('.workspace-project').forEach(element => {
    element.hidden = !query || !element.dataset.workspaceSearch.toLocaleLowerCase('de-DE').includes(query);
    if (!element.hidden) matches++;
  });
  home.querySelector('#workspaceAreasEmpty').hidden = areas > 0;
  home.querySelector('.workspace-search-results').hidden = !query;
  home.querySelector('#workspaceProjectsEmpty').hidden = matches > 0;
  home.querySelector('#workspaceSearchClear').hidden = !value;
  home.querySelector('#workspaceSearchStatus').textContent = query ? I18n.t('{areas} Arbeitsbereiche · {matches} Projekte', {areas, matches}) : '';
  home.classList.toggle('is-searching', Boolean(query));
  home.querySelector('[data-workspace-arrange="edit"]').disabled=Boolean(query);
}

// Folder sheet: the grouped areas as regular launchers (goto closes the sheet).
function showWorkspaceFolder(id) {
  const folder = workspaceAreas.find(area => area.view === id);
  if (!folder) return;
  const counts = NotificationCenterModel.badges(notificationEntries());
  openModal({eyebrow:'BÜLOW & DOLZ', title:I18n.t(folder.name), body:`<div class="workspace-apps workspace-folder-apps">${workspaceFolderMembers(id).map(area => `<button type="button" class="workspace-app" data-action="goto" data-target="${area.view}">
    <span class="workspace-app-visual"><span class="workspace-app-icon tone-${area.tone}" aria-hidden="true">${workspaceAppArtwork(area)}<span class="workspace-icon-contrast">${icon(area.icon,56)}</span></span>${counts[area.view] ? `<span class="workspace-notification-badge" aria-hidden="true">${counts[area.view]}</span>` : ''}</span><span class="workspace-app-label">${escapeAttr(I18n.t(area.name))}</span></button>`).join('')}</div>
    <p class="so-hint">${I18n.t('Selten genutzte Bereiche. Über die Suche auf der Startseite bleiben sie direkt erreichbar.')}</p>`,
    footer:`<button class="button outline" data-action="close-modal">${I18n.t('Schließen')}</button>`});
}
