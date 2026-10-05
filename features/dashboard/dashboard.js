// Role-specific start pages; the admin workplace lives in workspace.js.
function renderDashboard(role, options = {}) {
  if (role === 'admin') return renderAdminDashboard(options);
  if (role === 'pm') return renderPMDashboard(options);
  if (role === 'quality') return renderQualityDashboard(options);
  return renderPartnerDashboard(options);
}

function timeGreeting(date = new Date()) {
  const firstName = (state.initialSetup?.fullName || state.onboarding?.data?.contact || 'Nicolai')
    .trim()
    .split(/\s+/)[0];
  const hour = date.getHours();
  let greeting = 'Willkommen zurück';

  if (hour >= 5 && hour < 10) greeting = 'Guten Morgen';
  else if (hour >= 10 && hour < 12) greeting = 'Guten Vormittag';
  else if (hour >= 12 && hour < 14) greeting = 'Schönen Mittag';
  else if (hour >= 14 && hour < 18) greeting = 'Guten Nachmittag';
  else if (hour >= 18 && hour < 22) greeting = 'Guten Abend';

  return `${I18n.t(greeting)}, ${firstName}`;
}

function updateTimeGreeting() {
  document.querySelectorAll('[data-time-greeting]').forEach((element) => {
    element.textContent = timeGreeting();
  });
}

function renderPartnerDashboard({preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ', 'Partner Cockpit');
  const progress = onboardingProgress();
  const available = availableProjects();
  const assignments = activeAssignments();
  const activeVolume = assignments.reduce((sum, project) => sum + project.price, 0);
  const standardCompensation = projects.find(project => project.standard)?.price || 7500;
  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <span class="eyebrow" style="color:#ffffff">INSTALLATIONSPARTNER-PROGRAMM</span>
          <div class="hero-greeting" data-time-greeting>${timeGreeting()}</div>
          <h2>Planbare Auftraege.<br>Klare Standards. Schnelle Abnahme.</h2>
          <p>Elektrotechnik gemeinsam umsetzen. Von der Anfrage über die Einsatzplanung bis zur dokumentierten technischen Freigabe.</p>
          <div class="hero-actions">
            <button class="button white" data-action="goto" data-target="marketplace">${icon('briefcase',16)} Bauvorhaben ansehen</button>
            <button class="button ghost-white" data-action="goto" data-target="onboarding">${icon('user-check',16)} Onboarding fortsetzen</button>
          </div>
        </div>
        <div class="hero-status">
          <div class="hero-status-card">
            <div class="row"><strong>Partner-Freigabe</strong><span>${progress}% abgeschlossen</span></div>
            <div class="progress"><span style="width:${progress}%"></span></div>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini"><strong>${available.length}</strong><span>offene Projekte</span></div>
            <div class="hero-mini"><strong>${assignments.length}</strong><span>aktive Baustellen</span></div>
            <div class="hero-mini"><strong>${money(standardCompensation)}</strong><span>Basis Standardfall</span></div>
            <div class="hero-mini"><strong>48 h</strong><span>Ziel Abnahme</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section grid four">
      ${metricCard('briefcase', String(available.length), 'Verfuegbare Bauvorhaben', `${state.bids.length} Angebote gesendet`, 'blue')}
      ${metricCard('euro', money(activeVolume), 'Aktives Auftragsvolumen', `${assignments.length} ${assignments.length === 1 ? 'Projekt' : 'Projekte'}`, 'green')}
      ${metricCard('clipboard-check', '92%', 'Erstabnahmequote', '+4 Pkt.', 'amber')}
      ${metricCard('clock', '1,4 Tage', 'Mittlere Pruefzeit', '-0,6 Tage', 'green')}
    </section>

    <section class="section grid two">
      <article class="card pad">
        <div class="section-header">
          <div><h3>Ihre naechsten Schritte</h3><p>Von der Registrierung bis zur Volumenfreigabe.</p></div>
          <button class="text-button" data-action="goto" data-target="onboarding">Alle Schritte</button>
        </div>
        <div class="timeline">
          ${timelineItem('check-circle', 'Unternehmensdaten', 'Basisdaten und Ansprechpartner geprueft.', 'Erledigt', 'done')}
          ${timelineItem('shield', 'Compliance-Dokumente', 'Versicherung und EU-Dienstleistungsnachweis geprueft.', 'Erledigt', 'done')}
          ${timelineItem('users', 'Teams & Kapazitaet', 'Team 1 anlegen und Qualifikationen zuordnen.', 'Jetzt', 'active')}
          ${timelineItem('book', 'Bülow & Dolz Academy', 'R290, Foto-Gates und Montagesystem absolvieren.', 'Danach', '')}
          ${timelineItem('award', 'Pilotanlagen', 'Drei begleitete Bauvorhaben erfolgreich abschliessen.', 'Freigabe', '')}
        </div>
      </article>

      <article class="card pad">
        <div class="section-header">
          <div><h3>Aktivitaeten</h3><p>Neuigkeiten zu Projekten, Dokumenten und Abnahmen.</p></div>
          <button class="text-button" data-action="notifications">Alle anzeigen</button>
        </div>
        <div class="activity-list">
          ${activityItem('briefcase', '3 neue Standardprojekte', 'Berlin und Brandenburg - Start ab 18.08.', '8 Min.')}
          ${activityItem('file-check', 'Versicherung freigegeben', 'Gueltig bis 31.12.2027', '2 Std.')}
          ${activityItem('clipboard-check', 'Abnahme Oranienburg terminiert', 'Bülow & Dolz SHK + Elektro am 16.08., 09:30 Uhr', '4 Std.')}
          ${activityItem('book', 'Academy-Modul verfuegbar', 'R290-Sicherheit - ca. 18 Minuten', 'Gestern')}
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-header">
        <div><h2>Passende Bauvorhaben</h2><p>Auf Basis Ihrer Regionen, Kapazitaet und Freigabestufe.</p></div>
        <button class="button secondary small" data-action="goto" data-target="marketplace">Zum Marktplatz ${icon('arrow-right',14)}</button>
      </div>
      <div class="project-grid">
        ${projects.slice(0, 3).map(projectCard).join('')}
      </div>
    </section>

    <section class="section">
      <div class="notice warning">
        <span class="notice-icon">${icon('alert')}</span>
        <div><strong>Wichtiger Zulassungshinweis</strong><p>Die technische Qualitätsprüfung durch Bülow & Dolz ersetzt nicht automatisch eine erforderliche Eintragung, Dienstleistungsanzeige oder Berufsqualifikation des eigenständigen Subunternehmens. Bülow & Dolz prüft dies je Leistungsumfang und Einsatzmodell vor der Projektfreigabe.</p></div>
      </div>
    </section>
  `;
}

function renderAdminDashboard(options = {}) {
  return renderWorkspaceHome(options);
}

function renderPMDashboard({preview=false} = {}) {
  if (!preview) setPageMeta('BÜLOW & DOLZ PM', 'Projektmanagement Cockpit');
  const managerName = state.initialSetup?.fullName || 'Nicolai Bülow';
  let portfolio = projects.filter(project => project.coordinator === managerName);
  if (!portfolio.length) portfolio = projects.slice(0, 4);
  const openMessages = (state.operations?.projectMessages || []).filter(message => !message.isRead && message.senderName !== managerName).length;
  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <span class="eyebrow" style="color:#ffffff">PROJEKTMANAGEMENT</span>
          <h2>${timeGreeting()}<br>Ihr Portfolio ist bereit.</h2>
          <p>Termine, Projektstatus, Verantwortliche und Rueckfragen aus Ihren Bauvorhaben.</p>
          <div class="hero-actions">
            <button class="button white" data-action="goto" data-target="control">${icon('layers',16)} Projektpflege</button>
            <button class="button ghost-white" data-action="goto" data-target="chats">${icon('mail',16)} Projektchats</button>
          </div>
        </div>
        <div class="hero-status">
          <div class="hero-status-card"><div class="row"><strong>Portfolio diese Woche</strong><span>${portfolio.length} Bauvorhaben</span></div><div class="progress"><span style="width:${Math.min(100, portfolio.length * 18)}%"></span></div></div>
          <div class="hero-mini-grid">
            <div class="hero-mini"><strong>${portfolio.length}</strong><span>zugeordnet</span></div>
            <div class="hero-mini"><strong>${activeAssignments().length}</strong><span>in Ausfuehrung</span></div>
            <div class="hero-mini"><strong>${openMessages}</strong><span>Rueckfragen</span></div>
            <div class="hero-mini"><strong>48 h</strong><span>Abnahmeziel</span></div>
          </div>
        </div>
      </div>
    </section>
    <section class="section grid four">
      ${metricCard('layers', String(portfolio.length), 'Mein Portfolio', 'Aktueller Datenstand', 'blue')}
      ${metricCard('calendar', String(portfolio.filter(project => project.readiness >= 90).length), 'Startklar', 'Baustellenreife ab 90%', 'green')}
      ${metricCard('mail', String(openMessages), 'Offene Nachrichten', 'Projektbezogen', 'amber')}
      ${metricCard('users', String(state.operations?.projectManagers?.length || 0), 'PM-Team', 'Bülow & Dolz intern', 'blue')}
    </section>
    <section class="section">
      <div class="section-header"><div><h2>Meine priorisierten Bauvorhaben</h2><p>Status, Termin und Projektkoordination.</p></div><button class="button secondary small" data-action="goto" data-target="control">Alle bearbeiten</button></div>
      ${operationsProjectTable(portfolio.slice(0, 6))}
    </section>
  `;
}
