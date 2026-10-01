// Extracted without behavior changes; see Docs/Modules for ownership.
function acceptedProjectIDs() {
  return new Set(activeProjects.map(project => project.id));
}

function availableProjects() {
  const accepted = acceptedProjectIDs();
  return projects.filter(project => !accepted.has(project.id));
}

function activeAssignments() {
  return activeProjects.filter(project => project.status !== 'done');
}

function operationsStatusTone(status) {
  if (status === 'Importbereit' || status === 'Importiert' || status === 'Verfügbar') return 'green';
  if (status === 'Mögliches Duplikat') return 'red';
  return 'amber';
}

function operationsProjectTable(items) {
  return `<div class="table-wrap operations-table"><table><thead><tr><th>Projekt</th><th>Standort</th><th>Termin</th><th>Verguetung</th><th>Projektmanagement</th><th></th></tr></thead><tbody>${items.map(project => `<tr><td><div class="company-cell"><span class="company-logo">${initials(project.city)}</span><div><strong>${escapeAttr(project.title)}</strong><span>${project.id}</span></div></div></td><td>${project.postal || ''} ${escapeAttr(project.city)}</td><td>${escapeAttr(project.start)}</td><td><strong>${money(project.price)}</strong></td><td>${project.coordinator || 'Bülow & Dolz Projektkoordination'}</td><td><div class="operations-actions"><button class="icon-button" data-action="open-project-chat" data-project="${project.id}" aria-label="Projektchat">${icon('mail',14)}</button><button class="button outline small" data-action="edit-project" data-project="${project.id}">Bearbeiten</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function renderProjectControl() {
  setPageMeta('BÜLOW & DOLZ', state.role === 'pm' ? 'Meine Projekte' : 'Projekte');
  const managerName = state.initialSetup?.fullName || '';
  let visible = state.role === 'pm' ? projects.filter(project => project.coordinator === managerName) : projects;
  if (state.role === 'pm' && !visible.length) visible = projects.slice(0, 6);
  const volume = visible.reduce((sum, project) => sum + project.price, 0);
  return `
    <section class="section" style="margin-top:0">
      <div class="operations-toolbar">
        <div><span class="eyebrow">PROJEKTSTAMM</span><h2 style="margin:5px 0 4px">Bauvorhaben bearbeiten</h2><p style="margin:0;color:var(--muted);font-size:12px">Status, Verguetung, Zeitraum und Projektmanagement.</p></div>
        ${state.role === 'admin' ? `<button class="button primary" data-action="goto" data-target="imports">${icon('refresh',15)} Projektimport</button>` : `<button class="button secondary" data-action="goto" data-target="chats">${icon('mail',15)} Projektchats</button>`}
      </div>
      <div class="grid four section">
        ${metricCard('layers', String(visible.length), 'Bauvorhaben', 'Im aktuellen Bereich', 'blue')}
        ${metricCard('euro', money(volume), 'Projektvolumen', 'Netto Verguetung', 'green')}
        ${metricCard('check-circle', String(visible.filter(project => project.readiness >= 90).length), 'Startklar', 'Reife ab 90%', 'green')}
        ${metricCard('users', String(new Set(visible.map(project => project.coordinator)).size), 'Verantwortliche', 'Projektmanagement', 'amber')}
      </div>
      <div class="section-header"><div><h3>Projektstamm</h3><p>${visible.length} Datensaetze mit synchronisierter Pflege.</p></div></div>
      ${operationsProjectTable(visible)}
    </section>
  `;
}

function renderImports() {
  setPageMeta('BÜLOW & DOLZ CONNECT', 'Projektimport');
  const operations = state.operations || structuredClone(defaultState.operations);
  const source = operations.importSource || 'Pipedrive';
  const candidates = (operations.importCandidates || []).filter(candidate => candidate.source === source);
  const lastImport = operations.lastImportAt ? formatOperationsDate(operations.lastImportAt) : 'Noch nicht abgerufen';
  return `
    <section class="section" style="margin-top:0">
      <div class="operations-toolbar">
        <div><span class="eyebrow">IMPORTWARTESCHLANGE</span><h2 style="margin:5px 0 4px">Neue Bauvorhaben pruefen</h2><p style="margin:0;color:var(--muted);font-size:12px">Quelldaten werden erst nach Validierung in den Projektstamm uebernommen.</p></div>
        <button class="button primary" data-action="import-all" data-source="${source}" ${candidates.some(candidate => candidate.status === 'Importbereit') ? '' : 'disabled'}>${icon('check-circle',15)} Alle validen importieren</button>
      </div>

      <div class="operations-source-tabs section">
        ${['MyHammer','Pipedrive','Locatick'].map(item => `<button class="${source === item ? 'active' : ''}" data-action="select-import-source" data-source="${item}">${item}</button>`).join('')}
      </div>

      <div class="connector-strip section" style="margin-top:12px">
        <span class="notice-icon">${icon(source === 'Pipedrive' ? 'users' : 'map-pin',17)}</span>
        <div><strong>${source} Connector</strong><span>Letzter Abruf: ${lastImport}</span></div>
        <span class="status-pill green">${source === 'MyHammer' ? 'Werkraum-Übernahme' : 'Mock verbunden'}</span>
        ${source === 'MyHammer' ? '<button class="button outline small" data-view="werkraum">Werkraum öffnen</button>' : `<button class="button outline small" data-action="refresh-imports" data-source="${source}">${icon('refresh',14)} Daten abrufen</button>`}
      </div>

      <div class="section-header section"><div><h3>Importvorschau</h3><p>${candidates.length} Datensaetze aus ${source}.</p></div></div>
      <div class="table-wrap operations-table"><table><thead><tr><th>Quelle</th><th>Bauvorhaben</th><th>Standort</th><th>Verguetung</th><th>Status</th><th></th></tr></thead><tbody>${candidates.map(candidate => `<tr><td><strong>${escapeAttr(candidate.externalID)}</strong><br><span style="color:var(--muted);font-size:10px">${escapeAttr(candidate.proposedProjectID)}</span></td><td><div class="company-cell"><span class="company-logo">${initials(candidate.city)}</span><div><strong>${escapeAttr(candidate.title)}</strong><span>${escapeAttr(candidate.customerName)}</span></div></div></td><td>${escapeAttr(candidate.postalCode)} ${escapeAttr(candidate.city)}</td><td><strong>${candidate.compensation ? money(candidate.compensation) : 'Offen'}</strong></td><td><span class="status-pill ${operationsStatusTone(candidate.status)}">${candidate.status}</span>${candidate.validationNotes?.length ? `<div style="margin-top:5px;color:var(--muted);font-size:9px">${escapeAttr(candidate.validationNotes[0])}</div>` : ''}</td><td><div class="operations-actions"><button class="button outline small" data-action="review-import" data-import="${escapeAttr(candidate.id)}">Pruefen</button><button class="button primary small" data-action="import-project" data-import="${escapeAttr(candidate.id)}" ${candidate.status === 'Importbereit' ? '' : 'disabled'}>Importieren</button></div></td></tr>`).join('')}</tbody></table></div>
    </section>
  `;
}

function renderProjects() {
  setPageMeta('BÜLOW & DOLZ BUILD', 'Meine Bauvorhaben');
  const assignments = activeAssignments();
  const inAssembly = assignments.filter(project => project.status === 'active').length;
  const inReview = assignments.filter(project => project.status === 'review').length;
  const projectVolume = assignments.reduce((sum, project) => sum + project.price, 0);
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header"><div><h2>Projektsteuerung</h2><p>Von der Vergabe ueber vier Foto-Gates bis zur gemeinsamen Abnahme.</p></div><button class="button primary small" data-action="goto" data-target="marketplace">${icon('briefcase',14)} Weitere Projekte</button></div>
      <div class="grid four">
        ${metricCard('hammer', String(inAssembly), 'In Montage', 'Aktueller Stand', 'blue')}
        ${metricCard('camera', '1', 'Foto-Gate offen', 'Gate 3', 'amber')}
        ${metricCard('clipboard-check', String(inReview), 'In Abnahme', 'Aktueller Stand', 'green')}
        ${metricCard('euro', money(projectVolume), 'Projektvolumen', `${assignments.length} ${assignments.length === 1 ? 'Projekt' : 'Projekte'}`, 'green')}
      </div>
      <article class="card pad section">
        <div class="section-header"><div><h3>Aktive und letzte Bauvorhaben</h3><p>Jedes Gate wird mit Pflichtfotos und Zeitstempel dokumentiert.</p></div></div>
        <div>${activeProjects.map(projectRow).join('')}</div>
      </article>
      <section class="section grid two">
        <article class="card pad"><div class="section-header"><div><h3>Vier-Gate-Prozess</h3><p>Fehler vor der Verdeckung erkennen.</p></div></div><div class="timeline">
          ${timelineItem('home','Gate 1 - Aufstellort','Fundament, Abstaende, R290, Kondensat.','Vor Start','done')}
          ${timelineItem('wrench','Gate 2 - Rohmontage','Leitungsweg, Durchfuehrung, Befestigung.','Rohbau','done')}
          ${timelineItem('camera','Gate 3 - Hydraulik offen','3-Wegeventil, MAG, Abscheider, Flussrichtung.','Vor Daemmung','active')}
          ${timelineItem('clipboard-check','Gate 4 - Abschluss','Daemmung, Messwerte, Normalbetrieb, Dokumente.','Uebergabe','')}
        </div></article>
        <article class="card pad"><div class="section-header"><div><h3>Abweichung melden</h3><p>Nicht improvisieren: technische Entscheidung vor Ausfuehrung dokumentieren.</p></div></div><div class="notice danger"><span class="notice-icon">${icon('alert')}</span><div><strong>STOP-Regel</strong><p>Wenn Bestand, Projektpaket oder Sicherheitsabstand nicht passt, Arbeit am betroffenen Punkt stoppen, Fotos hochladen und Freigabe anfordern.</p></div></div><button class="button danger full" style="margin-top:14px" data-action="deviation">${icon('camera',15)} Abweichung mit Fotos melden</button></article>
      </section>
    </section>
  `;
}

function projectRow(project) {
  return `<div class="project-row"><div class="project-row-title"><span class="project-row-icon">${icon('home',18)}</span><div><strong>${project.id} - ${escapeAttr(project.city)}</strong><span>${escapeAttr(project.title)}</span></div></div><div><span class="project-row-label">Zeitraum</span><span class="project-row-value">${project.date}</span></div><div><span class="project-row-label">Verguetung</span><span class="project-row-value">${money(project.price)}</span></div><div><span class="project-row-label">Foto-Gates</span><div class="gate-progress">${[1,2,3,4].map(n => `<span class="${n <= project.gates ? 'done' : n === project.gates + 1 ? 'active' : ''}"></span>`).join('')}</div></div><div><span class="status-pill ${project.status === 'done' ? 'green' : project.status === 'review' ? 'amber' : 'blue'}">${project.stage}</span></div><button class="icon-button" data-action="active-project" data-project="${project.id}">${icon('arrow-up-right',16)}</button></div>`;
}

function showOperationsProjectEditor(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;
  const managers = state.operations?.projectManagers || [];
  const selectedManager = managers.find(manager => manager.name === project.coordinator)?.id || managers[0]?.id || '';
  const readiness = project.tags?.[0] || 'In Feinplanung';
  openModal({
    eyebrow: project.id,
    title: 'Bauvorhaben bearbeiten',
    body: `
      <div class="form-grid">
        <div class="field full"><label>Projekttitel</label><input id="opsProjectTitle" value="${escapeAttr(project.title)}"></div>
        <div class="field"><label>Zeitraum</label><input id="opsProjectSchedule" value="${escapeAttr(project.start)}"></div>
        <div class="field"><label>Verguetung netto</label><input id="opsProjectCompensation" type="number" value="${project.price}"></div>
        <div class="field"><label>Baustellenstatus</label><select id="opsProjectReadiness">${['Baustelle bereit','Material disponiert','Kunde bestätigt','In Feinplanung'].map(item => `<option value="${item}" ${item === readiness ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
        <div class="field"><label>Projektmanager</label><select id="opsProjectManager">${managers.map(manager => `<option value="${manager.id}" ${manager.id === selectedManager ? 'selected' : ''}>${manager.name} · ${manager.region}</option>`).join('')}</select></div>
      </div>
      <div class="notice info" style="margin-top:15px"><span class="notice-icon">${icon('info')}</span><div><strong>Synchronisierte Projektpflege</strong><p>${BackendWorkspace.enabled ? 'Änderungen werden an den Webserver gesendet. Der Serverstatus bestätigt die Speicherung.' : 'Die Aenderung wird in App und Web demselben Bauvorhaben zugeordnet.'}</p></div></div>
    `,
    footer: `<button class="button outline" data-action="close-modal">Abbrechen</button><button class="button primary" data-action="save-project" data-project="${id}">${icon('check',15)} Speichern</button>`
  });
}

function saveOperationsProject(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;
  const title = document.getElementById('opsProjectTitle')?.value.trim() || '';
  const schedule = document.getElementById('opsProjectSchedule')?.value.trim() || '';
  const compensation = Number(document.getElementById('opsProjectCompensation')?.value || 0);
  const readiness = document.getElementById('opsProjectReadiness')?.value || 'In Feinplanung';
  const coordinatorID = document.getElementById('opsProjectManager')?.value || '';
  if (!title || !schedule || compensation <= 0) {
    showToast('Angaben unvollstaendig', 'Titel, Zeitraum und Verguetung muessen ausgefuellt sein.', 'warning');
    return;
  }
  const manager = state.operations.projectManagers.find(item => item.id === coordinatorID);
  project.title = title;
  project.start = schedule;
  project.price = compensation;
  project.tags = [readiness, ...(project.tags || []).slice(1)];
  project.readiness = { 'Baustelle bereit': 100, 'Material disponiert': 94, 'Kunde bestätigt': 90, 'In Feinplanung': 82 }[readiness] || 82;
  project.coordinator = manager?.name || project.coordinator;
  project.coordinatorPhone = manager?.phone || project.coordinatorPhone;
  state.operations.projectEdits[id] = { title, schedule, compensation, readiness, coordinatorID };
  saveState();
  closeModal();
  render();
  showToast(BackendWorkspace.enabled ? 'Änderung vorgemerkt' : 'Projekt gespeichert', `${id} wurde aktualisiert.`, 'success');
}

function showImportReview(id) {
  const candidate = state.operations?.importCandidates?.find(item => item.id === id);
  if (!candidate) return;
  const managers = state.operations.projectManagers || [];
  openModal({
    eyebrow: `${candidate.source} · ${escapeAttr(candidate.externalID)}`,
    title: 'Import pruefen',
    body: `
      <div class="detail-grid">
        <div class="detail-block"><span>Flex Projekt-ID</span><strong>${escapeAttr(candidate.proposedProjectID)}</strong></div>
        <div class="detail-block"><span>Standort</span><strong>${escapeAttr(candidate.postalCode)} ${escapeAttr(candidate.city)}</strong></div>
        <div class="detail-block"><span>Kunde</span><strong>${escapeAttr(candidate.customerName)}</strong></div>
        <div class="detail-block"><span>Zeitraum</span><strong>${escapeAttr(candidate.schedule)}</strong></div>
      </div>
      <div class="form-grid section">
        <div class="field"><label>Verguetung netto</label><input id="importCompensation" type="number" value="${candidate.compensation || ''}" placeholder="7500"></div>
        ${candidate.source === 'MyHammer' ? `<div class="field"><label for="importCity">Ort</label><input id="importCity" value="${escapeAttr(candidate.city)}"></div><div class="field"><label for="importPostal">Postleitzahl</label><input id="importPostal" value="${escapeAttr(candidate.postalCode)}"></div><div class="field"><label for="importSchedule">Vereinbarter Zeitraum</label><input id="importSchedule" value="${escapeAttr(candidate.schedule)}"></div><label class="checkbox-row field full"><input id="importScopeConfirmed" type="checkbox">Leistungsumfang, Ort, Termin und Auftrag geprüft</label>` : ''}
        <div class="field"><label>Projektmanager</label><select id="importManager">${managers.map(manager => `<option value="${manager.id}" ${manager.id === candidate.coordinatorID ? 'selected' : ''}>${manager.name} · ${manager.region}</option>`).join('')}</select></div>
      </div>
      ${candidate.validationNotes?.length ? `<div class="notice warning section"><span class="notice-icon">${icon('alert')}</span><div><strong>Pruefhinweise</strong><p>${escapeAttr(candidate.validationNotes.join(' · '))}</p></div></div>` : ''}
    `,
    footer: `<button class="button outline" data-action="close-modal">Abbrechen</button><button class="button primary" data-action="save-import-review" data-import="${escapeAttr(id)}">${icon('check',15)} Validierung speichern</button>`
  });
}

function saveImportReview(id) {
  const candidate = state.operations?.importCandidates?.find(item => item.id === id);
  if (!candidate) return;
  const compensation = Number(document.getElementById('importCompensation')?.value || 0);
  candidate.compensation = compensation;
  candidate.coordinatorID = document.getElementById('importManager')?.value || candidate.coordinatorID;
  candidate.status = compensation > 0 ? 'Importbereit' : 'Prüfung nötig';
  candidate.validationNotes = compensation > 0 ? [] : ['Projektvergütung fehlt'];
  if (candidate.source === 'MyHammer') {
    candidate.city = document.getElementById('importCity').value.trim();
    candidate.postalCode = document.getElementById('importPostal').value.trim();
    candidate.schedule = document.getElementById('importSchedule').value.trim();
    if (!candidate.city || !candidate.postalCode || !candidate.schedule || !document.getElementById('importScopeConfirmed').checked) {
      candidate.validationNotes.push('Ort, PLZ, Termin und Prüfung des Leistungsumfangs bestätigen');
    }
    candidate.status = candidate.validationNotes.length ? 'Prüfung nötig' : 'Importbereit';
  }
  saveState();
  closeModal();
  render();
  showToast('Validierung gespeichert', `${escapeAttr(candidate.externalID)} ist ${candidate.status.toLowerCase()}.`, compensation > 0 ? 'success' : 'warning');
}

function importOperationsCandidate(id, renderAfter = true) {
  const candidate = state.operations?.importCandidates?.find(item => item.id === id);
  if (!candidate || candidate.status !== 'Importbereit') return false;
  if (projects.some(project => project.id === candidate.proposedProjectID)) {
    candidate.status = 'Mögliches Duplikat';
    candidate.validationNotes = ['Projekt-ID existiert bereits'];
    saveState();
    if (renderAfter) render();
    return false;
  }
  const manager = state.operations.projectManagers.find(item => item.id === candidate.coordinatorID);
  candidate.status = 'Importiert';
  candidate.validationNotes = [];
  projects.unshift({
    id: candidate.proposedProjectID,
    city: candidate.city,
    region: candidate.region,
    postal: candidate.postalCode,
    start: candidate.schedule,
    price: Number(candidate.compensation),
    material: Math.round(candidate.compensation * .31 / 10) * 10,
    travel: 0,
    distance: 0,
    readiness: 82,
    complexity: 'Pruefung',
    scope: 'Turnkey',
    title: candidate.title,
    duration: '3 Tage',
    bids: 0,
    color: 'amber',
    tags: ['In Feinplanung', candidate.heatPump, candidate.propertyType],
    aiScore: 72,
    aiSummary: 'Neu importiert: Score bleibt vorläufig, bis Leistungsumfang und Baustellenreife geprüft sind.',
    aiFactors: [`Import aus ${candidate.source}`, money(Number(candidate.compensation)), 'Technische Prüfung offen'],
    tasks: [`Projektumfang aus ${candidate.source} pruefen`, 'Montagepaket vervollstaendigen', 'Kundenfreigabe dokumentieren'],
    docs: ['Projektsteckbrief', 'Montagecheckliste', 'Fotodokumentation'],
    risks: [`Importquelle ${escapeAttr(candidate.externalID)}`, 'Technische Pruefung vor Veroeffentlichung'],
    coordinator: manager?.name || 'Bülow & Dolz Projektkoordination',
    coordinatorPhone: manager?.phone || '',
    standard: Number(candidate.compensation) === 7500
  });
  saveState();
  if (renderAfter) render();
  return true;
}

function showProjectDetails(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  currentModalProject = project;
  const aiTone = projectAITone(project);
  openModal({
    eyebrow: project.id,
    title: `${escapeAttr(project.city)} - ${escapeAttr(project.title)}`,
    body: `
      <div class="bid-summary"><div><span>Verguetung netto</span><strong>${money(project.price)}</strong></div><div><span>Materialannahme</span><strong>${money(project.material)}</strong></div><div><span>Rest vor Lohn/Overhead</span><strong>${money(projectNet(project))}</strong></div></div>
      <div class="project-ai section">
        <div class="project-ai-head"><span class="project-ai-title">${icon('gauge',15)} KI-Score: ${projectAITitle(project)}</span><span class="ai-score-pill ${aiTone}">${projectAIScore(project)}%</span></div>
        <p>${projectAISummary(project)}</p>
        <div class="ai-factors">${projectAIFactors(project).map(factor => `<span class="tag">${escapeAttr(factor)}</span>`).join('')}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-block"><span>Startfenster</span><strong>${escapeAttr(project.start)}</strong></div>
        <div class="detail-block"><span>Dauer</span><strong>${project.duration}</strong></div>
        <div class="detail-block"><span>Einsatzort</span><strong>${escapeAttr(project.postal)} ${escapeAttr(project.city)}</strong></div>
        <div class="detail-block"><span>Baustellenreife</span><strong>${project.readiness}%</strong></div>
        <div class="detail-block"><span>Leistungspaket</span><strong>${project.scope}</strong></div>
        <div class="detail-block"><span>Entfernung Demo</span><strong>${project.distance} km</strong></div>
      </div>
      <div class="section"><div class="section-header"><div><h3>Leistungsumfang</h3></div></div><div class="scope-list">${project.tasks.map(t => `<div class="scope-item"><span class="bullet-icon">${icon('check',12)}</span><span>${t}</span></div>`).join('')}</div></div>
      <div class="section grid two"><div><div class="section-header"><div><h3>Projektpaket</h3></div></div><div class="scope-list">${project.docs.map(t => `<div class="scope-item"><span class="bullet-icon">${icon('file',12)}</span><span>${t}</span></div>`).join('')}</div></div><div><div class="section-header"><div><h3>Bekannte Risiken</h3></div></div><div class="scope-list">${project.risks.map(t => `<div class="scope-item"><span class="bullet-icon" style="background:var(--amber-soft);color:var(--amber)">${icon('alert',12)}</span><span>${t}</span></div>`).join('')}</div></div></div>
      <div class="notice warning section"><span class="notice-icon">${icon('alert')}</span><div><strong>Vor Angebotsabgabe pruefen</strong><p>Die Materialannahme ist ein Kalkulationswert. Der verbindliche Leistungsumfang ergibt sich aus dem freigegebenen Projektpaket und Zusatzleistungskatalog.</p></div></div>
    `,
    footer: `<button class="button outline" data-action="close-modal">Schliessen</button><button class="button primary" data-action="bid" data-project="${project.id}">Auf dieses Projekt bieten ${icon('arrow-right',15)}</button>`
  });
}

function bidTeamOptions() {
  const teams = sharedEnvelope?.state?.teams || [];
  return teams.length ? teams.map(team => [team.id, `${team.name} · ${team.availability}`]) : [['team1','Team Berlin 1'],['team2','Team Sachsen 1']];
}

function showBidForm(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  const existing = state.bids.find((item) => item.projectId === id);
  openModal({
    eyebrow: 'ANGEBOT ABGEBEN',
    title: `${project.id} - ${escapeAttr(project.city)}`,
    body: `
      <div class="bid-summary"><div><span>Bülow & Dolz Projektvergütung</span><strong>${money(project.price)}</strong></div><div><span>Materialannahme</span><strong>${money(project.material)}</strong></div><div><span>Kalk. Rest</span><strong>${money(projectNet(project))}</strong></div></div>
      <div class="notice info" style="margin-bottom:14px"><span class="notice-icon">${icon('info')}</span><div><strong>Qualitaet vor Preisunterbietung</strong><p>Bei Standardprojekten kann Bülow & Dolz einen Festpreis vorgeben. Partner bieten vor allem Team, Starttermin und Kapazitaet. Ein abweichender Preis muss begruendet werden.</p></div></div>
      <div class="form-grid">
        ${selectField('Ausfuehrendes Team', 'bidTeam', bidTeamOptions(), existing?.team || bidTeamOptions()[0][0])}
        ${field('Fruehester Start', 'bidStart', existing?.start || '2026-08-18', 'date')}
        ${field('Angebot netto', 'bidPrice', existing?.price || project.price, 'number')}
        ${selectField('Bestaetigtes Paket', 'bidScope', [[project.scope,project.scope],['review','Nur nach technischer Rueckfrage']], existing?.scope || project.scope)}
        <div class="field full"><label>Hinweis / Bedingung</label><textarea id="bidNote" placeholder="z. B. Anfahrt am Vortag, Materiallieferung bis 17.08. erforderlich">${existing?.note || ''}</textarea></div>
      </div>
      <div class="checkbox-row" style="margin-top:14px"><input type="checkbox" id="bidConfirm" ${existing ? 'checked' : ''}><span>Projektpaket, bekannte Risiken, Foto-Gates und Abnahmeprozess wurden geprueft.</span></div>
    `,
    footer: `<button class="button outline" data-action="close-modal">Abbrechen</button><button class="button primary" data-action="submit-bid" data-project="${project.id}">${existing ? 'Angebot aktualisieren' : 'Verbindlich senden'} ${icon('arrow-right',15)}</button>`
  });
}

function submitBid(projectId) {
  const confirm = document.getElementById('bidConfirm');
  if (!confirm?.checked) {
    showToast('Bestaetigung fehlt', 'Bitte Projektpaket und Bedingungen bestaetigen.', 'warning');
    return;
  }
  const price = Number(document.querySelector('[data-model="bidPrice"]')?.value || 0);
  const start = document.querySelector('[data-model="bidStart"]')?.value || '';
  const team = document.querySelector('[data-model="bidTeam"]')?.value || 'team1';
  const scope = document.querySelector('[data-model="bidScope"]')?.value || '';
  const note = document.getElementById('bidNote')?.value || '';
  const bid = { projectId, price, start, team, scope, note, sentAt: new Date().toISOString() };
  const index = state.bids.findIndex((item) => item.projectId === projectId);
  if (index >= 0) state.bids[index] = bid; else state.bids.push(bid);
  saveState();
  closeModal();
  showToast('Angebot gesendet', `${projectId} wurde an Bülow & Dolz übermittelt.`, 'success');
  render();
}
