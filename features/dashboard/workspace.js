// The home screen links to existing workflows; it does not grant permissions.
const workspaceAreas = [
  {view:'werkraum', name:'Anfragen', icon:'briefcase', tone:'azure', keywords:'Vertrieb Werkraum Angebote Kunden'},
  {view:'control', name:'Projekte', icon:'layers', tone:'blue', keywords:'Baustellen Aufträge Projektpflege'},
  {view:'acceptance', name:'Abnahmen', icon:'clipboard-check', tone:'teal', keywords:'Qualität QM Freigabe Prüfung'},
  {view:'chats', name:'Nachrichten', icon:'mail', tone:'green', keywords:'Chat Kommunikation Projektchats'},
  {view:'finance', name:'Finanzen', icon:'euro', tone:'graphite', keywords:'Lexware Kalkulation Rechnungen'},
  {view:'partners', name:'Partner', icon:'users', tone:'rose', keywords:'Unternehmen Partnerpipeline'},
  {view:'smartops', name:'Assistenz', icon:'zap', tone:'electric', keywords:'KI Copilot Planung Intelligence'},
  {view:'imports', name:'Import', icon:'upload', tone:'neutral', keywords:'Pipedrive Locatick Daten Projektimport'}
];

function workspaceAppArtwork(area) {
  const base = 'assets/workspace-icons/retina-v1/'+area.view;
  return workspaceFallbackArtwork(area)+`<img class="workspace-app-render" src="${base}-256.webp" srcset="${base}-128.webp 128w, ${base}-256.webp 256w, ${base}-512.webp 512w" sizes="(max-width: 700px) 62px, 80px" width="80" height="80" alt="" aria-hidden="true" decoding="async" draggable="false">`;
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
  if (deviations.length) items.push({icon:'alert', title:'Abweichungen prüfen', detail:`${deviations.length} offene Vorgänge`, action:'smart-module', attribute:'data-module="deviations"', urgent:deviations.some(item => item.priority === 'Kritisch')});
  const imports = (state.operations?.importCandidates || []).filter(item => ['Prüfung nötig', 'Mögliches Duplikat'].includes(item.status));
  if (imports.length) items.push({icon:'file-check', title:'Importdaten prüfen', detail:`${imports.length} Datensätze mit Klärungsbedarf`, action:'goto', attribute:'data-target="imports"'});
  const messages = (state.operations?.projectMessages || []).filter(item => !item.isRead && item.senderName !== state.initialSetup?.fullName);
  if (messages.length) items.push({icon:'mail', title:'Nachrichten beantworten', detail:`${messages.length} ungelesene Nachrichten`, action:'goto', attribute:'data-target="chats"'});
  return items;
}

function renderWorkspaceHome({preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ', 'Arbeitsplatz');
  const pending = workspacePendingItems();
  const date = new Intl.DateTimeFormat('de-DE', {weekday:'long', day:'numeric', month:'long'}).format(new Date());
  return `<div class="workspace-home">
    <div class="workspace-heading">
      <div><p class="workspace-date">${date}</p><h2 data-time-greeting>${escapeAttr(timeGreeting())}</h2></div>
      <div class="workspace-search" role="search">
        ${icon('search',18)}<input id="workspaceSearch" type="search" aria-label="Bereich oder Projekt suchen" placeholder="Bereich oder Projekt suchen" autocomplete="off">
        <button id="workspaceSearchClear" type="button" title="Suche leeren" aria-label="Suche leeren" hidden>${icon('x',16)}</button>
      </div>
    </div>
    <section class="workspace-section" aria-labelledby="workspaceAreasTitle">
      <div class="workspace-apps-heading"><h3 id="workspaceAreasTitle">Arbeitsbereiche</h3><div class="workspace-arrange-controls">
        <button type="button" data-workspace-arrange="edit" aria-label="Arbeitsbereiche anordnen" title="Arbeitsbereiche anordnen">${icon('grid',18)}</button>
        <button type="button" data-workspace-arrange="reset" aria-label="Standardanordnung wiederherstellen" title="Standardanordnung wiederherstellen" hidden>${icon('refresh',18)}</button>
        <button type="button" data-workspace-arrange="cancel" aria-label="Anordnung verwerfen" title="Anordnung verwerfen" hidden>${icon('x',18)}</button>
        <button type="button" data-workspace-arrange="done" hidden>Fertig</button>
      </div></div>
      <span class="workspace-arrange-status" id="workspaceArrangeHelp">Mit Pfeiltasten verschieben. Fertig speichert, Escape verwirft die Anordnung.</span>
      <span class="workspace-arrange-status" id="workspaceArrangeStatus" role="status" aria-live="polite"></span>
      <div class="workspace-apps">
        ${WorkspaceArrange.areas(workspaceAreas).map(area => `<button type="button" class="workspace-app" data-action="goto" data-target="${area.view}" data-workspace-search="${escapeAttr(area.name+' '+area.keywords)}">
          <span class="workspace-app-visual"><span class="workspace-app-icon tone-${area.tone}" aria-hidden="true">${workspaceAppArtwork(area)}<span class="workspace-icon-contrast">${icon(area.icon,56)}</span></span><span class="workspace-notification-badge" aria-hidden="true" hidden></span></span><span class="workspace-app-label">${area.name}</span>
        </button>`).join('')}
      </div>
      <p class="workspace-empty" id="workspaceAreasEmpty" hidden>Kein passender Arbeitsbereich.</p>
    </section>
    <p class="workspace-search-status" id="workspaceSearchStatus" role="status" aria-live="polite"></p>
    ${WorkspaceFocus.render({preview})}
    <div class="workspace-columns">
      <section class="workspace-section workspace-attention" aria-labelledby="workspaceAttentionTitle">
        <div class="workspace-section-heading"><h3 id="workspaceAttentionTitle">Aufmerksamkeit</h3><span>${pending.length ? pending.length+' Themen' : 'Alles im Blick'}</span></div>
        <div class="workspace-list">
          ${pending.map(item => `<button type="button" class="workspace-row" data-action="${item.action}" ${item.attribute}>
            <span class="workspace-row-icon ${item.urgent ? 'is-urgent' : ''}">${icon(item.icon,20)}</span>
            <span class="workspace-row-copy"><strong>${item.title}</strong><small>${item.detail}${item.urgent ? ' · Kritischer Vorgang' : ''}</small></span>${icon('arrow-right',16)}
          </button>`).join('') || '<p class="workspace-empty">Keine offenen Abweichungen, Importprüfungen oder Nachrichten.</p>'}
        </div>
      </section>
      <section class="workspace-section workspace-projects" aria-labelledby="workspaceProjectsTitle">
        <div class="workspace-section-heading"><h3 id="workspaceProjectsTitle">Projekte</h3><button class="text-button" data-action="goto" data-target="control">Alle Projekte ${icon('arrow-right',14)}</button></div>
        <div class="workspace-list">
          ${projects.map((project,index) => `<button type="button" class="workspace-row workspace-project" data-action="project-details" data-project="${escapeAttr(project.id)}" data-workspace-search="${escapeAttr([project.id,project.city,project.title,project.coordinator].filter(Boolean).join(' '))}" ${index >= 3 ? 'hidden' : ''}>
            <span class="workspace-row-icon">${icon('building',20)}</span><span class="workspace-row-copy"><strong>${escapeAttr(project.city)}</strong><small>${escapeAttr(project.id)}</small></span>${icon('arrow-right',16)}
          </button>`).join('')}
        </div>
        <p class="workspace-empty" id="workspaceProjectsEmpty" ${projects.length ? 'hidden' : ''}>Keine Projekte vorhanden.</p>
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
    element.hidden = !element.dataset.workspaceSearch.toLocaleLowerCase('de-DE').includes(query);
    if (!element.hidden) areas++;
  });
  home.querySelectorAll('.workspace-project').forEach((element,index) => {
    element.hidden = query ? !element.dataset.workspaceSearch.toLocaleLowerCase('de-DE').includes(query) : index >= 3;
    if (!element.hidden) matches++;
  });
  home.querySelector('#workspaceAreasEmpty').hidden = areas > 0;
  const empty = home.querySelector('#workspaceProjectsEmpty');
  empty.hidden = matches > 0;
  empty.textContent = query ? 'Keine passenden Projekte.' : 'Keine Projekte vorhanden.';
  home.querySelector('.workspace-attention').hidden = Boolean(query);
  home.querySelector('#workspaceSearchClear').hidden = !value;
  home.querySelector('#workspaceSearchStatus').textContent = query ? `${areas} Arbeitsbereiche · ${matches} Projekte` : '';
  home.classList.toggle('is-searching', Boolean(query));
  home.querySelector('[data-workspace-arrange="edit"]').disabled=Boolean(query);
}
