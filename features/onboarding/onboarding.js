// Extracted without behavior changes; see Docs/Modules for ownership.
function onboardingProgress() {
  const completed = new Set(state.onboarding.completed || []);
  return Math.round((completed.size / 6) * 100);
}

function renderOnboarding() {
  setPageMeta('BÜLOW & DOLZ ACADEMY', 'Partner-Onboarding');
  const step = state.onboarding.currentStep || 1;
  const progress = onboardingProgress();
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header">
        <div><h2>Von der Bewerbung zur Volumenfreigabe</h2><p>Alle Nachweise, Teams, Schulungen und Pilotanlagen in einem gefuehrten Prozess.</p></div>
        <span class="status-pill blue">${progress}% abgeschlossen</span>
      </div>
      <div class="notice warning" style="margin-bottom:16px">
        <span class="notice-icon">${icon('alert')}</span>
        <div><strong>Bauleitung / QM ist die dokumentierte Qualitätsinstanz, kein pauschaler Zulassungsersatz.</strong><p>Eigenständige Subunternehmen müssen je Gewerk, Niederlassung und Leistungsumfang die erforderliche handwerksrechtliche Berechtigung, EU-/EWR-Dienstleistungsanzeige oder eine zulassungsfreie Leistungsabgrenzung nachweisen. Das wird vor der Projektfreigabe geprüft.</p></div>
      </div>
      <div class="onboarding-layout">
        <aside class="card pad stepper-card">
          <div class="section-header" style="margin-bottom:10px"><div><h3>Onboarding</h3><p>6 Stufen bis Certified.</p></div></div>
          <div class="step-list">
            ${onboardingStepButton(1, 'Unternehmen', 'Stammdaten & Kontakt', step)}
            ${onboardingStepButton(2, 'Compliance', 'Zulassung & Dokumente', step)}
            ${onboardingStepButton(3, 'Teams', 'Kompetenz & Kapazitaet', step)}
            ${onboardingStepButton(4, 'Regionen', 'Gebiete & Verfuegbarkeit', step)}
            ${onboardingStepButton(5, 'Academy', 'Training & Wissenscheck', step)}
            ${onboardingStepButton(6, 'Pilot & Freigabe', '3 Anlagen + Audit', step)}
          </div>
          <div class="progress" style="background:var(--surface-3);margin-top:16px"><span style="width:${progress}%;background:var(--blue-2)"></span></div>
        </aside>
        <section class="card form-card">${renderOnboardingStep(step)}</section>
      </div>
    </section>
  `;
}

function onboardingStepButton(number, title, subtitle, current) {
  const done = (state.onboarding.completed || []).includes(number);
  return `<button class="step-button ${current === number ? 'active' : ''} ${done ? 'done' : ''}" data-action="onboarding-step" data-step="${number}"><span class="step-number">${done ? icon('check',14) : number}</span><span class="step-copy"><strong>${title}</strong><span>${subtitle}</span></span>${done ? `<span class="step-check">${icon('check-circle',18)}</span>` : ''}</button>`;
}

function renderOnboardingStep(step) {
  const data = state.onboarding.data;
  const steps = {
    1: `
      ${formHeader('01', 'Unternehmensprofil', 'Diese Angaben erscheinen spaeter im Partnerprofil und in Ihren Angeboten.')}
      <div class="form-grid">
        ${field('Firmenname', 'company', data.company, 'text', true)}
        ${selectField('Sitz / Land', 'country', [['DE','Deutschland'],['PL','Polen'],['CZ','Tschechien'],['SK','Slowakei'],['RO','Rumaenien'],['EE','Estland']], data.country)}
        ${field('Rechtsform', 'legalForm', data.legalForm)}
        ${field('USt-IdNr. / Steuer-ID', 'taxId', data.taxId)}
        ${field('Ansprechpartner', 'contact', data.contact)}
        ${field('E-Mail', 'email', data.email, 'email')}
        ${field('Telefon', 'phone', data.phone, 'tel')}
        ${selectField('Bevorzugte Sprache', 'language', [['de','Deutsch'],['pl','Polski'],['en','English'],['cz','Cesky']], 'de')}
        <div class="field full"><label>Kurzprofil</label><textarea data-model="profile">Wir montieren Heizungs- und Waermepumpenanlagen mit mehreren mobilen Teams und suchen planbare Serienprojekte.</textarea><small>Max. 500 Zeichen. Keine Werbeaussagen ohne Nachweis.</small></div>
      </div>
      ${formNav(step)}
    `,
    2: `
      ${formHeader('02', 'Zulassung & Compliance', 'Dokumente werden durch Bülow & Dolz Compliance geprueft und mit Ablaufdatum ueberwacht.')}
      <div class="notice info" style="margin-bottom:16px"><span class="notice-icon">${icon('shield')}</span><div><strong>Leistungsbezogene Pruefung</strong><p>Installateur- und Heizungsbauer sowie Elektrotechniker sind zulassungspflichtige Handwerke. Bei EU-/EWR-Unternehmen kann fuer voruebergehende Einsaetze eine Dienstleistungsanzeige relevant sein. Bülow & Dolz legt erst nach Pruefung fest, welche Leistungspakete angeboten werden duerfen.</p></div></div>
      <div class="form-grid">
        ${selectField('Aktueller Qualifikationsweg', 'qualification', [['de-roll','Deutsche Handwerksrolle / gleichwertig'],['eu-service','EU-/EWR-Dienstleistungsanzeige'],['limited','Nur abgegrenzte Hilfs-/Nebenleistungen'],['review','Noch ungeprueft']], data.qualification)}
        ${selectField('Gewuenschtes Leistungspaket', 'servicePackage', [['turnkey','Turnkey SHK + koordinierte Elektroarbeiten'],['shk','SHK-Core'],['electro','Elektro-Paket'],['preworks','Fundament / Pre-Works']], 'turnkey')}
      </div>
      <div class="upload-grid" style="margin-top:15px">
        ${uploadTile('Gewerbe- / Registerauszug', 'PDF, max. 10 MB', true)}
        ${uploadTile('Betriebshaftpflicht', 'Deckung + Ablaufdatum', true)}
        ${uploadTile('Handwerksrolle / Berufsqualifikation', 'oder EU-/EWR-Nachweis', false)}
        ${uploadTile('Dienstleistungsanzeige', 'falls grenzueberschreitend', false)}
        ${uploadTile('A1 / Sozialversicherung', 'je eingesetzter Person', false)}
        ${uploadTile('Freistellungsbescheinigung', 'Bauabzugsteuer', true)}
      </div>
      <div class="checkbox-row" style="margin-top:16px"><input type="checkbox" checked><span>Ich bestaetige, dass nur gemeldete Teams eingesetzt werden und keine nicht freigegebenen Sub-Subunternehmer zum Einsatz kommen.</span></div>
      ${formNav(step)}
    `,
    3: `
      ${formHeader('03', 'Teams & Kapazitaet', 'Legen Sie reale Montageteams an. Bauvorhaben werden immer einem konkreten Team zugeordnet.')}
      <div class="grid two">
        ${teamCard('Team Berlin 1', ['KN','MP','TZ'], ['SHK', 'R290', 'Deutsch B1'], '6 Montagen / Monat')}
        ${teamCard('Team Sachsen 1', ['AK','JS'], ['SHK', 'Elektrohelfer', 'Polski'], '4 Montagen / Monat')}
      </div>
      <button class="button outline small" style="margin-top:12px" data-action="add-team">${icon('users',14)} Weiteres Team anlegen</button>
      <div class="form-grid three" style="margin-top:18px">
        ${field('Gesamtkapazitaet / Monat', 'capacity', data.capacity, 'number')}
        ${field('Max. parallele Baustellen', 'parallel', 2, 'number')}
        ${field('Max. Fahrdistanz (km)', 'maxDistance', data.maxDistance, 'number')}
      </div>
      <div class="field full" style="margin-top:14px"><label>Verfuegbare Kompetenzen</label><div class="chip-group">${['Rueckbau','Rohrbau','Hydraulik','Daemmung','Inbetriebnahme','Elektro','Fundament','Hybrid'].map((chip, i) => `<button class="chip ${i < 5 ? 'selected' : ''}" data-action="toggle-chip">${chip}</button>`).join('')}</div></div>
      ${formNav(step)}
    `,
    4: `
      ${formHeader('04', 'Einsatzgebiete & Verfuegbarkeit', 'Waehlen Sie nur Regionen, die mit Ihrer Teamlogistik wirklich abdeckbar sind.')}
      <div class="field"><label>Regionen</label><div class="chip-group">${['Berlin','Brandenburg','Sachsen','Sachsen-Anhalt','Thueringen','Mecklenburg-Vorpommern','Niedersachsen','NRW','Hessen','Bayern'].map((region) => `<button class="chip ${data.regions.includes(region) ? 'selected' : ''}" data-action="toggle-region" data-region="${region}">${region}</button>`).join('')}</div></div>
      <div class="form-grid three" style="margin-top:17px">
        ${field('Fruehester Start', 'availableFrom', '2026-08-18', 'date')}
        ${selectField('Arbeitsrhythmus', 'schedule', [['5','Mo-Fr'],['6','Mo-Sa'],['rotation','Rotation 10/4'],['custom','Individuell']], '5')}
        ${field('Max. Uebernachtungen / Woche', 'nights', 4, 'number')}
      </div>
      <div class="notice info" style="margin-top:16px"><span class="notice-icon">${icon('map-pin')}</span><div><strong>Matching-Logik</strong><p>Der Marktplatz priorisiert Baustellen nach Entfernung, Teamfreigabe, Leistungsumfang, Startfenster und dokumentierter Qualitaet.</p></div></div>
      ${formNav(step)}
    `,
    5: `
      ${formHeader('05', 'Bülow & Dolz Academy', 'Jedes Team schliesst die relevanten Module ab. Ergebnisse sind personengebunden.')}
      <div class="training-grid">
        ${trainingCard('R290 sicher montieren', 'Aufstellbereich, Zundquellen, Foto-Gate 1.', 100, 'Bestanden')}
        ${trainingCard('Hydraulik Standard A', 'Puffer, Speicher, 3-Wegeventil und Abscheider.', 65, 'In Arbeit')}
        ${trainingCard('Foto-Gates & Dokumentation', 'Pflichtmotive, Abweichungen, Nachweise.', 40, 'In Arbeit')}
        ${trainingCard('Elektro-Schnittstellen', 'Rollen, Herstellerdaten, Messprotokoll.', 0, 'Gesperrt')}
      </div>
      <div class="notice warning" style="margin-top:15px"><span class="notice-icon">${icon('lock')}</span><div><strong>Freigabe nach Rolle</strong><p>Ein Kursnachweis macht aus einem Monteur keine Elektrofachkraft und ersetzt keine formale Berechtigung. Die Academy dient der Bülow & Dolz Systemqualifikation.</p></div></div>
      ${formNav(step)}
    `,
    6: `
      ${formHeader('06', 'Pilotanlagen & Freigabe', 'Drei begleitete Standardanlagen mit 100%iger Gate-Pruefung.')}
      <div class="grid three">
        ${pilotCard('Pilot 1', 'Potsdam', 'Abgeschlossen', 100, 'green')}
        ${pilotCard('Pilot 2', 'Berlin', 'Foto-Gate 3', 72, 'blue')}
        ${pilotCard('Pilot 3', 'Oranienburg', 'Geplant 16.08.', 18, 'amber')}
      </div>
      <div class="notice success" style="margin-top:16px"><span class="notice-icon">${icon('award')}</span><div><strong>Zielstatus: Bülow & Dolz Certified</strong><p>Nach drei bestandenen Pilotanlagen, abgeschlossener Academy und finaler Compliance-Freigabe wird das Team fuer Standardprojekte im Marktplatz freigeschaltet.</p></div></div>
      <div class="card pad" style="margin-top:14px;box-shadow:none;background:var(--surface-2)">
        <div class="section-header"><div><h3>Freigabekriterien</h3><p>Automatisch aus allen Modulen zusammengefuehrt.</p></div><span class="status-pill amber">2 Punkte offen</span></div>
        <div class="grid two">
          ${criteria('Compliance vollstaendig', true)}
          ${criteria('Mind. 1 Team geprueft', true)}
          ${criteria('Academy bestanden', false)}
          ${criteria('3 Pilotanlagen bestanden', false)}
          ${criteria('Erstabnahmequote >= 85%', true)}
          ${criteria('Keine A-Maengel offen', true)}
        </div>
      </div>
      ${formNav(step, true)}
    `
  };
  return steps[step] || steps[1];
}

function formNav(step, final = false) { return `<div class="form-actions"><button class="button outline" data-action="prev-step" ${step === 1 ? 'disabled style="opacity:.45"' : ''}>${icon('arrow-left',15)} Zurueck</button><div style="display:flex;gap:8px"><button class="button secondary" data-action="save-step">${icon('save',15)} Speichern</button>${final ? `<button class="button primary" data-action="request-approval">Freigabe beantragen ${icon('arrow-right',15)}</button>` : `<button class="button primary" data-action="next-step">Weiter ${icon('arrow-right',15)}</button>`}</div></div>`; }

function completeCurrentStep(goNext = false) {
  const step = state.onboarding.currentStep;
  if (!state.onboarding.completed.includes(step)) state.onboarding.completed.push(step);
  if (goNext && step < 6) state.onboarding.currentStep = step + 1;
  saveState();
  render();
  showToast('Gespeichert', goNext ? 'Naechste Onboarding-Stufe geoeffnet.' : 'Ihre Angaben wurden lokal gespeichert.', 'success');
}
