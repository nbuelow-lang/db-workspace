// Extracted without behavior changes; see Docs/Modules for ownership.
const smartModules = [
  { id:'copilot', title:'Baustellen-Copilot', icon:'zap', detail:'Nächste Schritte, Risiken und Tagesablauf auf der Baustelle.' },
  { id:'photo', title:'KI-gestützte Foto-Gates', icon:'camera', detail:'Pflichtmotive und Bildqualität vor der QM-Prüfung kontrollieren.' },
  { id:'autopilot', title:'Bauvorhaben-Autopilot', icon:'refresh', detail:'Routineentscheidungen begründet vorschlagen und kontrolliert ausführen.' },
  { id:'matching', title:'Intelligentes Team-Matching', icon:'users', detail:'Teams nach Region, Qualifikation, Qualität und Kapazität bewerten.' },
  { id:'scheduling', title:'Automatische Einsatzplanung', icon:'calendar', detail:'Termine, Fahrzeiten, Kapazitäten und Konflikte zusammenführen.' },
  { id:'offline', title:'Offline-Baustellenmodus', icon:'lock', detail:'Projektakte und Checklisten bei fehlendem Netz lokal weiterführen.' },
  { id:'translation', title:'Übersetzungs-Chat & Call', icon:'globe', detail:'Projektchat in neun Sprachen und Realtime-Audio für unterstützte Ziele.' },
  { id:'deviations', title:'Abweichungen & Eskalationen', icon:'alert', detail:'STOP-Regeln, Verantwortliche, Fristen und Eskalationen steuern.' },
  { id:'billing', title:'Automatische Abrechnung', icon:'euro', detail:'Nach bestandener QM-Abnahme automatisch abrechnungsbereit.' },
  { id:'livefile', title:'Live-Projektakte', icon:'file', detail:'Status, Chats, Foto-Gates und Entscheidungen in einem Zeitstrahl.' },
  { id:'academy', title:'Adaptive Flex Academy', icon:'book', detail:'Trainings aus Qualitätsbefunden und Teamprofilen priorisieren.' },
  { id:'morning', title:'Morning Control', icon:'bar-chart', detail:'Entscheidungsbriefing für Administration und Geschäftsführung.' }
];

function smartCriticalCount() {
  return (state.deviationCases || []).filter(item => item.status !== 'Erledigt' && item.priority === 'Kritisch').length
    + (state.photoGateAssessments || []).filter(item => ['QM-Prüfung nötig','Nacharbeit'].includes(item.status)).length;
}

function smartModuleCount(id) {
  const maps = {
    copilot: (state.copilotTasks || []).filter(item => item.status !== 'Erledigt').length,
    photo: (state.photoGateAssessments || []).filter(item => item.status !== 'Bestanden').length,
    autopilot: (state.autopilotProposals || []).filter(item => !['Ausgeführt','Erledigt'].includes(item.status)).length,
    matching: (state.teamMatchSuggestions || []).filter(item => item.status !== 'Freigegeben').length,
    scheduling: (state.deploymentPlans || []).filter(item => item.status !== 'Freigegeben').length,
    offline: Number(state.pendingOfflineChanges || 0),
    translation: (state.operations?.projectMessages || []).filter(item => item.translatedBody).length,
    deviations: (state.deviationCases || []).filter(item => item.status !== 'Erledigt').length,
    billing: (state.automatedInvoices || []).filter(item => item.status === 'Abrechnungsbereit').length,
    livefile: (state.operations?.projectMessages || []).length + (state.photoGateAssessments || []).length,
    academy: (state.academyRecommendations || []).filter(item => item.status !== 'In Arbeit').length,
    morning: smartCriticalCount()
  };
  return maps[id] || 0;
}

function renderSmartOperations() {
  setPageMeta('BÜLOW & DOLZ INTELLIGENCE', 'Operatives Kontrollzentrum');
  const readyVolume = (state.automatedInvoices || []).filter(item => ['Abrechnungsbereit','Freigegeben'].includes(item.status)).reduce((sum,item) => sum + Number(item.amount || 0),0);
  return `
    <section class="smart-hero">
      <span class="eyebrow" style="color:#fff">MORNING CONTROL · LIVE</span>
      <h2>${timeGreeting()}</h2>
      <p>Die wichtigsten Entscheidungen aus Projekten, Qualität, Disposition und Abrechnung. Automationen führen kritische Schritte nur nach einer sichtbaren Freigabe aus.</p>
      <div class="smart-metrics">
        <div class="smart-metric"><strong>${smartCriticalCount()}</strong><span>Kritische Vorgänge</span></div>
        <div class="smart-metric"><strong>${(state.autopilotProposals || []).filter(item => item.status !== 'Ausgeführt').length}</strong><span>Autopilot wartet</span></div>
        <div class="smart-metric"><strong>${activeAssignments().length}</strong><span>Aktive Montagen</span></div>
        <div class="smart-metric"><strong>${money(readyVolume)}</strong><span>Abrechnungsbereit</span></div>
      </div>
    </section>
    <section class="section">
      <div class="section-header"><div><h2>Flex Intelligence</h2><p>Zwölf Arbeitsbereiche, ein synchronisierter Projektstand.</p></div><span class="status-pill ${state.offlineModeEnabled ? 'amber' : 'green'}">${BackendWorkspace.enabled ? 'Web · Server-Testbetrieb' : state.offlineModeEnabled ? `Offline · ${state.pendingOfflineChanges || 0} lokal` : 'App & Web verbunden'}</span></div>
      <div class="smart-module-grid">${smartModules.map(module => `
        <button class="smart-module" data-action="smart-module" data-module="${module.id}">
          <div class="smart-module-head"><span class="smart-module-icon">${icon(module.icon,19)}</span><span class="status-pill ${smartModuleCount(module.id) ? 'amber' : 'green'}">${smartModuleCount(module.id)}</span></div>
          <h3>${module.title}</h3><p>${module.detail}</p>
          <footer><span>ÖFFNEN</span><span>${icon('arrow-up-right',13)}</span></footer>
        </button>`).join('')}</div>
    </section>`;
}

function smartTone(status) {
  if (['Bestanden','Freigegeben','Ausgeführt','Erledigt','Ausgezahlt'].includes(status)) return 'green';
  if (['Eskaliert','Nacharbeit','Kritisch'].includes(status)) return 'red';
  if (['QM-Prüfung nötig','In Arbeit','Abrechnungsbereit','Hoch'].includes(status)) return 'amber';
  return 'blue';
}

function smartRows(items, collection, copy) {
  if (!items.length) return emptyState('check-circle','Alles erledigt','Für diesen Bereich liegen aktuell keine offenen Vorgänge vor.');
  return `<div class="smart-list">${items.map(item => `<article class="smart-row">
    <div class="smart-row-head"><div><h4>${escapeAttr(item.title || item.gateName || item.projectID)}</h4><p>${escapeAttr(item.projectID || item.teamID || '')}</p></div><span class="status-pill ${smartTone(item.status || item.priority)}">${escapeAttr(item.status || item.priority || 'Offen')}</span></div>
    <p>${escapeAttr(item.detail || item.rationale || item.reason || item.impact || '')}</p>
    ${item.findings?.length ? `<div class="smart-row-meta">${item.findings.map(finding => `<span class="tag">${escapeAttr(finding)}</span>`).join('')}</div>` : ''}
    ${item.factors?.length ? `<div class="smart-row-meta">${item.factors.map(factor => `<span class="tag">${escapeAttr(factor)}</span>`).join('')}</div>` : ''}
    ${copy ? copy(item,collection) : ''}
  </article>`).join('')}</div>`;
}

function smartActionButton(label, collection, id, status, module, tone = 'primary') {
  return `<button class="button ${tone} small" data-action="smart-update" data-collection="${collection}" data-item="${id}" data-status="${status}" data-module="${module}">${label}</button>`;
}

function smartModuleBody(module) {
  switch (module) {
    case 'copilot': return smartRows(state.copilotTasks || [],'copilotTasks',(item) => `<div class="smart-row-meta"><span class="tag">${item.dueLabel}</span><span class="tag">${item.priority}</span></div>${smartActionButton(item.status === 'Erledigt' ? 'Erledigt' : item.nextStep,'copilotTasks',item.id,'Erledigt','copilot')}`);
    case 'photo': return smartRows(state.photoGateAssessments || [],'photoGateAssessments',(item) => `<div class="smart-row-meta"><span class="tag">${item.capturedPhotos}/${item.requiredPhotos} Fotos</span><span class="tag">KI-Score ${item.qualityScore} %</span></div>${['Bestanden','Nacharbeit'].includes(item.status) ? '' : `${smartActionButton('Nacharbeit','photoGateAssessments',item.id,'Nacharbeit','photo','outline')} ${smartActionButton('QM-Freigabe','photoGateAssessments',item.id,'Bestanden','photo')}`}`);
    case 'autopilot': return smartRows(state.autopilotProposals || [],'autopilotProposals',(item) => `<div class="notice info" style="margin:10px 0"><span class="notice-icon">${icon('zap')}</span><div><strong>Auswirkung</strong><p>${escapeAttr(item.impact)}</p></div></div>${smartActionButton('Kontrolliert ausführen','autopilotProposals',item.id,'Ausgeführt','autopilot')}`);
    case 'matching': return smartRows(state.teamMatchSuggestions || [],'teamMatchSuggestions',(item) => `<div class="smart-score">${item.score} % Match</div>${smartActionButton('Team zuordnen','teamMatchSuggestions',item.id,'Freigegeben','matching')}`);
    case 'scheduling': return smartRows(state.deploymentPlans || [],'deploymentPlans',(item) => `<div class="smart-row-meta"><span class="tag">${item.dateLabel}</span><span class="tag">${item.timeWindow}</span><span class="tag">${item.travelMinutes} Min Anfahrt</span></div>${item.conflict ? `<div class="notice warning"><span class="notice-icon">${icon('alert')}</span><div><strong>Konflikt</strong><p>${escapeAttr(item.conflict)}</p></div></div>` : smartActionButton('Einsatz bestätigen','deploymentPlans',item.id,'Freigegeben','scheduling')}`);
    case 'offline': return `<div class="translation-console"><article class="card pad"><h3>Offline-Baustellenmodus</h3><p style="color:var(--muted)">Projektakte, Checklisten und Nachrichten lokal weiterführen.</p><button class="button ${state.offlineModeEnabled ? 'danger' : 'primary'} full" data-action="offline-toggle">${state.offlineModeEnabled ? 'Online gehen & synchronisieren' : 'Offline-Modus aktivieren'}</button></article><article class="card pad"><span class="eyebrow">LOKALE WARTESCHLANGE</span><div class="smart-score">${state.pendingOfflineChanges || 0}</div><p style="color:var(--muted)">Änderungen warten auf die nächste Verbindung.</p></article></div>`;
    case 'translation': return renderTranslationConsole();
    case 'deviations': return smartRows(state.deviationCases || [],'deviationCases',(item) => `<div class="smart-row-meta"><span class="tag">${item.owner}</span><span class="tag">${item.deadline}</span><span class="tag">${item.source}</span></div>${smartActionButton('Lösung dokumentieren','deviationCases',item.id,'Erledigt','deviations')}`);
    case 'billing': return smartRows(state.automatedInvoices || [],'automatedInvoices',(item) => `<div class="smart-score">${money(item.amount)}</div><p>QM-Qualitätsscore: ${item.qualityScore} %</p>${item.status === 'Abrechnungsbereit' ? smartActionButton('Auszahlung freigeben','automatedInvoices',item.id,'Freigegeben','billing') : ''}`);
    case 'livefile': return renderLiveProjectFile();
    case 'academy': return smartRows(state.academyRecommendations || [],'academyRecommendations',(item) => `${smartActionButton('Training zuweisen','academyRecommendations',item.id,'In Arbeit','academy')}`);
    case 'morning': return `<div class="grid four">${metricCard('alert',String(smartCriticalCount()),'Kritische Vorgänge','Sofort','red')}${metricCard('users',String((state.teamMatchSuggestions || []).length),'Team-Matches','Heute','green')}${metricCard('refresh',String((state.operations?.importCandidates || []).filter(item => item.status !== 'Importiert').length),'Importprüfung','Pipedrive / Locatick','amber')}${metricCard('euro',money((state.automatedInvoices || []).filter(item => item.status === 'Abrechnungsbereit').reduce((sum,item)=>sum+item.amount,0)),'Freigabevolumen','Nach QM','green')}</div>${smartRows((state.deviationCases || []).filter(item => item.status !== 'Erledigt'),'deviationCases',(item)=>smartActionButton('Entscheiden','deviationCases',item.id,'Erledigt','morning'))}`;
    default: return '';
  }
}

function showSmartModule(moduleID) {
  const module = smartModules.find(item => item.id === moduleID);
  if (!module) return;
  openModal({ eyebrow:'FLEX INTELLIGENCE', title:module.title, body:`<p style="margin-top:0;color:var(--muted)">${module.detail}</p>${smartModuleBody(moduleID)}`, footer:`<button class="button outline" data-action="close-modal">Schließen</button>` });
}

function renderLiveProjectFile() {
  const messages = state.operations?.projectMessages || [];
  const records = [
    ...messages.slice(-5).map(item => ({title:`Chat · ${item.senderName}`,detail:item.translatedBody || item.body,meta:item.projectID,status:'Projektkommunikation'})),
    ...(state.photoGateAssessments || []).map(item => ({title:item.gateName,detail:`${item.capturedPhotos}/${item.requiredPhotos} Fotos · Score ${item.qualityScore} %`,meta:item.projectID,status:item.status})),
    ...(state.deviationCases || []).map(item => ({title:item.title,detail:item.detail,meta:`${item.projectID} · ${item.deadline}`,status:item.status})),
    ...(state.automatedInvoices || []).map(item => ({title:`Abrechnung ${money(item.amount)}`,detail:`QM-Score ${item.qualityScore} %`,meta:item.projectID,status:item.status}))
  ];
  return smartRows(records.map((item,index)=>({id:`record-${index}`,...item,projectID:item.meta})),'',()=> '');
}

function updateSmartItem(collection, id, status, module) {
  const items = state[collection] || [];
  const item = items.find(entry => entry.id === id);
  if (!item) return;
  item.status = status;
  if (collection === 'photoGateAssessments') {
    item.reviewedBy = state.initialSetup?.fullName || 'Bauleitung / QM';
    if (status === 'Nacharbeit' && !(state.deviationCases || []).some(entry => entry.source === item.id)) {
      state.deviationCases.unshift({id:`deviation-${Date.now()}`,projectID:item.projectID,title:`Nacharbeit aus ${item.gateName}`,detail:(item.findings || []).join(' · '),priority:'Hoch',owner:'Bauleitung / QM',deadline:'Innerhalb 4 Stunden',source:item.id,status:'Eskaliert'});
    }
  }
  if (collection === 'autopilotProposals' && status === 'Ausgeführt') {
    state.notifications.unshift({id:`notification-autopilot-${Date.now()}`,kind:'project',title:item.title,text:item.impact,time:'Gerade eben',isRead:false,priority:'Wichtig',projectID:item.projectID,deliveryStatus:'Zugestellt',senderName:'Bülow & Dolz Autopilot'});
  }
  saveState();
  updateBadges();
  showSmartModule(module);
  showToast('Status aktualisiert', `${item.title || item.gateName || item.projectID}: ${status}`, 'success');
}
