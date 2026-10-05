// Extracted without behavior changes; see Docs/Modules for ownership.
const setupRoles = [
  { id: 'Kalkulation und Finanzen', title: 'Kalkulation / Finanzen', icon: 'euro', detail: 'Für Kalkulation, wirtschaftliche Projektbewertung und Lexware Office.' },
  {
    id: 'GEP Administration', title: 'Administrator / Organisation', icon: 'layers',
    detail: 'Fuer Administration, Disposition, Rollensteuerung und die zentrale Pflege von Bauvorhaben.'
  },
  {
    id: 'GEP Projektmanagement', title: 'Projektmanager / Projektkoordination', icon: 'clipboard-check',
    detail: 'Fuer Projektmanager und Projektkoordinatoren mit eigenem operativem Portfolio.'
  },
  {
    id: 'Bauleitung / QM', title: 'Bauleiter / Qualitätsmanagement', icon: 'shield',
    detail: 'Fuer Bauleitung, Foto-Gates, Qualitätsprüfungen, Abnahmen und Eskalationen.'
  },
  {
    id: 'GEP Intern', title: 'Bülow & Dolz · Intern', icon: 'building',
    detail: 'Fuer Mitarbeitende aus Projektsteuerung, Betrieb und Partner Management.'
  },
  {
    id: 'Externer Vertrieb', title: 'Externer Vertriebspartner', icon: 'user-check',
    detail: 'Fuer selbststaendige Vertriebspartner, die Kunden und Bauvorhaben für Bülow & Dolz betreuen.'
  },
  {
    id: 'Subunternehmen', title: 'Subunternehmen', icon: 'wrench',
    detail: 'Fuer Unternehmen, die sich fuer Waermepumpenmontagen bewerben moechten.'
  }
];

function isInternalSetupRole(role) {
  if (role === 'Kalkulation und Finanzen') return true;
  return ['GEP Administration', 'GEP Projektmanagement', 'Bauleitung / QM', 'GEP Intern'].includes(role);
}

function webRoleForAccessRole(role) {
  if (role === 'Kalkulation und Finanzen') return 'finance';
  if (role === 'GEP Administration' || role === 'GEP Intern') return 'admin';
  if (role === 'GEP Projektmanagement') return 'pm';
  if (role === 'Bauleitung / QM') return 'quality';
  if (role === 'Externer Vertrieb') return 'sales';
  return 'partner';
}

const setupSystems = [
  { id: 'Lexware Office', icon: 'euro', detail: 'Kalkulation und Finanzen · verantwortlich: Lukas Langer' },
  { id: 'MyHammer', icon: 'hammer', detail: 'Anfragen und Kundengespräche im Bülow & Dolz Werkraum' },
  { id: 'Pipedrive', icon: 'users', detail: 'Kontakte, Organisationen und Vertriebschancen' },
  { id: 'Locatick', icon: 'map-pin', detail: 'Einsatzorte, Auftraege und operative Status' },
  { id: 'Foxtag', icon: 'clipboard-check', detail: 'Anlagen, Pruefungen und technische Berichte' }
];

function recommendedSetupSystems(role) {
  if (role === 'Kalkulation und Finanzen') return ['Lexware Office'];
  if (isInternalSetupRole(role)) return ['MyHammer', 'Pipedrive', 'Locatick', 'Foxtag'];
  if (role === 'Externer Vertrieb') return ['Pipedrive'];
  return ['Locatick', 'Foxtag'];
}

function setupProgress(stage) {
  if (!stage) return '';
  return `<div class="setup-progress">${[1,2,3,4,5].map((number) => `<span class="${number <= stage ? 'active' : ''}"></span>`).join('')}</div>`;
}

function setupHeading(eyebrow, title, detail) {
  return `<div class="setup-heading"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${detail}</p></div>`;
}

function setupActions({ back = true, next = 'Weiter', action = 'setup-next' } = {}) {
  return `<div class="setup-actions">
    ${back ? `<button class="button outline" data-setup-action="setup-back">${icon('arrow-left',14)} Zurueck</button>` : ''}
    <button class="button primary" data-setup-action="${action}">${next} ${icon('arrow-right',14)}</button>
  </div>`;
}

function renderInitialSetupGate() {
  const gate = document.getElementById('setupGate');
  const appShell = document.getElementById('appShell');
  const root = document.getElementById('setupContent');
  if (!gate || !appShell || !root) return;
  const setup = state.initialSetup || structuredClone(defaultState.initialSetup);
  state.initialSetup = setup;
  state.session = state.session || structuredClone(defaultState.session);
  if (!state.session.email) state.session.email = setup.email || '';

  const hasActiveSession = BackendWorkspace.enabled || AdminPreview.enabled || (setup.completed && state.session.authenticated);
  gate.hidden = hasActiveSession;
  appShell.hidden = !hasActiveSession;
  if (hasActiveSession) return;

  const stage = Number(setup.stage || 0);
  let content = '';
  if (setup.completed) {
    const roleTitle = setupRoles.find((role) => role.id === setup.role)?.title || setup.role;
    content = `${setupHeading('WILLKOMMEN ZURUECK', 'Bei Bülow & Dolz anmelden', `${escapeAttr(setup.fullName)} · ${escapeAttr(roleTitle)}`)}
      <div class="setup-fields">
        <div class="setup-field"><label>Geschaeftliche E-Mail</label><input type="email" autocomplete="email" data-session-model="email" value="${escapeAttr(state.session.email)}"></div>
        <div class="setup-field"><label>Passwort</label><input type="password" autocomplete="current-password" data-session-model="password" placeholder="Mindestens 8 Zeichen"></div>
      </div>
      ${state.session.error ? `<div class="setup-error">${state.session.error}</div>` : ''}
      <div class="setup-role-list"><button class="button primary full" data-setup-action="session-signin">Anmelden ${icon('arrow-right',14)}</button></div>
      <div class="setup-note">${icon('lock',15)} Das Passwort wird im Prototyp nicht gespeichert. Das Konto und synchronisierte Daten bleiben nach der Abmeldung erhalten.</div>`;
  } else if (stage === 0) {
    content = `${setupHeading('WILLKOMMEN', 'Bülow & Dolz einrichten', 'Erstelle deinen Zugang und wir konfigurieren den passenden Arbeitsbereich fuer deine Rolle.')}
      <div class="setup-role-list">
        <button class="button primary full" data-setup-action="setup-start" data-mode="create">Konto einrichten ${icon('arrow-right',14)}</button>
        <button class="button outline full" data-setup-action="setup-start" data-mode="signin">Mit bestehendem Konto anmelden</button>
      </div>
      <div class="setup-note">${icon('lock',15)} Das Kennwort wird in diesem Prototyp weder gespeichert noch synchronisiert.</div>`;
  } else if (stage === 1) {
    content = `${setupProgress(stage)}${setupHeading('SICHERER ZUGANG', setup.mode === 'signin' ? 'Bei Bülow & Dolz anmelden' : 'Dein Konto einrichten', 'Nutze deine geschaeftliche E-Mail-Adresse. Deine Rolle legst du im naechsten Schritt fest.')}
      <div class="setup-switch">
        <button class="${setup.mode === 'create' ? 'active' : ''}" data-setup-action="setup-mode" data-mode="create">Konto anlegen</button>
        <button class="${setup.mode === 'signin' ? 'active' : ''}" data-setup-action="setup-mode" data-mode="signin">Anmelden</button>
      </div>
      <div class="setup-fields">
        <div class="setup-field"><label>Geschaeftliche E-Mail</label><input type="email" autocomplete="email" data-setup-model="email" value="${escapeAttr(setup.email)}" placeholder="name@unternehmen.de"></div>
        <div class="setup-field"><label>Passwort</label><input type="password" autocomplete="${setup.mode === 'create' ? 'new-password' : 'current-password'}" data-setup-model="password" placeholder="Mindestens 8 Zeichen"></div>
        ${setup.mode === 'create' ? `<label class="checkbox-row"><input type="checkbox" data-setup-model="terms" ${setupTermsAccepted ? 'checked' : ''}><span>Ich akzeptiere die Nutzungsbedingungen und Datenschutzhinweise.</span></label>` : ''}
      </div>
      ${setup.error ? `<div class="setup-error">${setup.error}</div>` : ''}
      <div class="setup-note">${icon('lock',15)} Das Passwort bleibt ausschliesslich in dieser Eingabesitzung.</div>
      ${setupActions()}`;
  } else if (stage === 2) {
    content = `${setupProgress(stage)}${setupHeading('DEIN ARBEITSBEREICH', 'Wie arbeitest du mit Bülow & Dolz?', 'Die Auswahl steuert deinen Einstieg, deine Freigaben und die vorgeschlagenen Systeme.')}
      <div class="setup-role-list">${setupRoles.map((role) => `<button class="setup-choice ${setup.role === role.id ? 'selected' : ''}" data-setup-action="setup-role" data-role="${role.id}"><span class="setup-choice-icon">${icon(role.icon,18)}</span><span><strong>${role.title}</strong><small>${role.detail}</small></span><span class="setup-choice-state">${setup.role === role.id ? 'GEWAEHLT' : 'AUSWAEHLEN'}</span></button>`).join('')}</div>
      ${setup.error ? `<div class="setup-error">${setup.error}</div>` : ''}
      ${setupActions()}`;
  } else if (stage === 3) {
    const isInternal = isInternalSetupRole(setup.role);
    const title = isInternal ? 'Bülow & Dolz Zugang bestaetigen' : setup.role === 'Externer Vertrieb' ? 'Vertriebsprofil anlegen' : 'Unternehmen vorstellen';
    const detail = isInternal ? 'Damit wir deinen Zugang dem richtigen Team und Berechtigungsbereich zuordnen koennen.' : setup.role === 'Externer Vertrieb' ? 'Damit Leads, Regionen und Ansprechpartner eindeutig zugeordnet werden koennen.' : 'Diese Basisdaten bilden den Start deiner Bewerbung als Montagepartner.';
    content = `${setupProgress(stage)}${setupHeading('PROFIL', title, detail)}
      <div class="setup-fields">
        <div class="setup-field"><label>Vor- und Nachname</label><input data-setup-model="fullName" value="${escapeAttr(setup.fullName)}" placeholder="Max Mustermann"></div>
        <div class="setup-field"><label>Telefon</label><input type="tel" data-setup-model="phone" value="${escapeAttr(setup.phone)}" placeholder="+49 170 1234567"></div>
        ${isInternal ? '' : `<div class="setup-field"><label>Unternehmen</label><input data-setup-model="companyName" value="${escapeAttr(setup.companyName)}" placeholder="Unternehmensname"></div>`}
        <div class="setup-field"><label>${isInternal ? 'Personal- oder Einladungscode' : 'Einladungscode (optional)'}</label><input data-setup-model="referenceCode" value="${escapeAttr(setup.referenceCode)}" placeholder="${isInternal ? 'BF-1234' : 'Code eingeben'}"></div>
      </div>
      ${setup.error ? `<div class="setup-error">${setup.error}</div>` : ''}
      ${setupActions()}`;
  } else if (stage === 4) {
    const recommended = recommendedSetupSystems(setup.role);
    content = `${setupProgress(stage)}${setupHeading('SCHNITTSTELLEN', 'Bestehende Systeme verknuepfen', 'Waehle aus, welche Unternehmenssysteme fuer deinen Zugang zentral eingerichtet werden sollen.')}
      <div class="setup-system-list">${setupSystems.map((system) => {
        const selected = setup.integrations.includes(system.id);
        return `<button class="setup-choice ${selected ? 'selected' : ''}" data-setup-action="setup-system" data-system="${system.id}"><span class="setup-choice-icon">${icon(system.icon,18)}</span><span><strong>${system.id}${recommended.includes(system.id) ? '<span class="setup-recommended">EMPFOHLEN</span>' : ''}</strong><small>${system.detail}</small></span><span class="setup-choice-state">${selected ? 'VORGEMERKT' : 'VERKNUEPFEN'}</span></button>`;
      }).join('')}</div>
      <div class="setup-note">${icon('lock',15)} API-Schluessel werden spaeter verschluesselt im Bülow & Dolz Backend hinterlegt, nicht im Browser.</div>
      ${setupActions()}`;
  } else {
    const systems = setup.integrations.length ? setup.integrations.join(', ') : 'Spaeter einrichten';
    content = `${setupProgress(stage)}<div class="setup-success">${icon('check',30)}</div>${setupHeading('BEREIT', 'Dein Bülow & Dolz Zugang ist vorbereitet', 'Rolle, Arbeitsbereich und gewuenschte Systemzugriffe sind fuer die Freigabe vorgemerkt.')}
      <div class="setup-summary">
        <div class="setup-summary-row"><span>Konto</span><strong>${escapeAttr(setup.email)}</strong></div>
        <div class="setup-summary-row"><span>Rolle</span><strong>${escapeAttr(setupRoles.find((role) => role.id === setup.role)?.title || setup.role)}</strong></div>
        <div class="setup-summary-row"><span>Systeme</span><strong>${escapeAttr(systems)}</strong></div>
      </div>
      ${setupActions({ next: 'Arbeitsbereich oeffnen', action: 'setup-finish' })}`;
  }

  root.innerHTML = `<section class="setup-card">${content}</section>`;
  if (AdminPreview.supported) {
    const previewButton = document.createElement('button');
    previewButton.className = 'button outline full';
    previewButton.textContent = 'Admin-Test starten';
    previewButton.addEventListener('click', () => AdminPreview.switchMode(true));
    root.append(previewButton);
  }
  hydrateIcons(gate);
}

function updateSetupProfileChrome() {
  const setup = state.initialSetup;
  if (!setup?.completed) return;
  const displayCompany = isInternalSetupRole(setup.role) ? 'Bülow & Dolz' : setup.companyName || 'Bülow & Dolz';
  document.querySelector('.profile-copy strong').textContent = displayCompany;
  document.querySelector('.profile-copy span').textContent = setupRoles.find((role) => role.id === setup.role)?.title || setup.role;
  document.querySelector('.avatar').textContent = initials(setup.fullName || displayCompany);
}

function finishInitialSetup() {
  const setup = state.initialSetup;
  setup.completed = true;
  setup.stage = 5;
  setup.error = '';
  state.role = webRoleForAccessRole(setup.role);
  state.onboarding.data.contact = setup.fullName || state.onboarding.data.contact;
  state.onboarding.data.email = setup.email || state.onboarding.data.email;
  state.onboarding.data.phone = setup.phone || state.onboarding.data.phone;
  if (setup.companyName) state.onboarding.data.company = setup.companyName;
  state.session = { authenticated: true, email: setup.email, error: '' };
  saveState();
  updateSetupProfileChrome();
  document.getElementById('roleSelect').value = state.role;
  render();
  showToast('Willkommen bei Bülow & Dolz', 'Dein Arbeitsbereich wurde eingerichtet.', 'success');
}

function handleSetupAction(action, target) {
  const setup = state.initialSetup;
  setup.error = '';
  if (action === 'session-signin') {
    const emailMatches = state.session.email.trim().toLowerCase() === setup.email.trim().toLowerCase();
    if (!emailMatches || sessionPassword.length < 8) {
      state.session.error = 'E-Mail oder Passwort ist nicht korrekt.';
    } else {
      state.session.authenticated = true;
      state.session.error = '';
      sessionPassword = '';
      saveState();
      render();
      showToast('Willkommen zurueck', 'Deine Sitzung ist wieder aktiv.', 'success');
      return;
    }
  } else if (action === 'setup-start') {
    setup.mode = target.dataset.mode || 'create';
    setup.stage = 1;
  } else if (action === 'setup-mode') {
    setup.mode = target.dataset.mode;
    setupPassword = '';
    setupTermsAccepted = false;
  } else if (action === 'setup-role') {
    setup.role = target.dataset.role;
    setup.integrations = [...new Set([...setup.integrations, ...recommendedSetupSystems(setup.role)])];
  } else if (action === 'setup-system') {
    const system = target.dataset.system;
    setup.integrations = setup.integrations.includes(system) ? setup.integrations.filter((item) => item !== system) : [...setup.integrations, system];
  } else if (action === 'setup-back') {
    setup.stage = Math.max(0, Number(setup.stage) - 1);
  } else if (action === 'setup-next') {
    if (setup.stage === 1 && (!setup.email.includes('@') || setupPassword.length < 8 || (setup.mode === 'create' && !setupTermsAccepted))) {
      setup.error = 'Bitte E-Mail, ein Passwort mit mindestens 8 Zeichen und gegebenenfalls die Zustimmung vervollstaendigen.';
    } else if (setup.stage === 2 && !setup.role) {
      setup.error = 'Bitte einen Arbeitsbereich auswaehlen.';
    } else if (setup.stage === 3 && (!setup.fullName.trim() || (!isInternalSetupRole(setup.role) && !setup.companyName.trim()))) {
      setup.error = 'Bitte Name und Unternehmen vervollstaendigen.';
    } else {
      setup.stage = Math.min(5, Number(setup.stage) + 1);
    }
  } else if (action === 'setup-finish') {
    finishInitialSetup();
    return;
  }
  saveState();
  renderInitialSetupGate();
}

function showAccountManagement() {
  if (BackendWorkspace.enabled) {
    const user=BD_BACKEND.user || {name:BD_BACKEND.displayName,roleLabel:'Gemeinsames Testkonto'}, t=I18n.t;
    openModal({eyebrow:t('SERVERKONTO'),title:user.name,body:`<div class="detail-grid"><div class="detail-block"><span>${t('Rolle auf dem Server')}</span><strong>${escapeAttr(t(user.roleLabel))}</strong></div><div class="detail-block"><span>${t('Technische Freigabe')}</span><strong>${t(BD_BACKEND.permissions?.decideAcceptance ? 'Erlaubt' : 'Nicht erlaubt')}</strong></div></div><p>${t('Der Server prüft Rollen bei Elektro-Abnahmen und Aufträgen. Alle übrigen Bereiche teilen alle Konten weiterhin als gemeinsamen Arbeitsstand; die Rollen-Auswahl ist dort nur eine Ansichtsvorschau.')}</p><p>${t('Konten und Passwörter werden am Mac mit backend.command verwaltet.')}</p>`,footer:`<button class="button danger" data-action="web-signout">${t('Abmelden')}</button>`});
    return;
  }
  const setup = state.initialSetup;
  if (!setup?.completed) return;
  document.getElementById('toastRegion').innerHTML = '';
  const roleTitle = setupRoles.find((role) => role.id === setup.role)?.title || setup.role;
  openModal({
    eyebrow: 'KONTO & ZUGANG',
    title: 'Kontomanagement',
    body: `
      <div class="form-grid">
        <div class="field"><label>Vor- und Nachname</label><input id="accountFullName" value="${escapeAttr(setup.fullName)}"></div>
        <div class="field"><label>Geschaeftliche E-Mail</label><input id="accountEmail" type="email" value="${escapeAttr(setup.email)}"></div>
        <div class="field"><label>Telefon</label><input id="accountPhone" type="tel" value="${escapeAttr(setup.phone)}"></div>
        <div class="field"><label>Organisation</label><input id="accountCompany" value="${escapeAttr(isInternalSetupRole(setup.role) ? 'Bülow & Dolz' : setup.companyName)}" ${isInternalSetupRole(setup.role) ? 'disabled' : ''}></div>
      </div>
      <div class="detail-grid section">
        <div class="detail-block"><span>Rolle</span><strong>${escapeAttr(roleTitle)}</strong></div>
        <div class="detail-block"><span>Sitzung</span><strong>Auf diesem Browser aktiv</strong></div>
      </div>
      <div class="section">
        <div class="section-header"><div><h3>Schnittstellen</h3><p>Zugriffsanforderungen fuer den zentralen Bülow & Dolz Backend-Zugang.</p></div></div>
        <div class="form-grid">${setupSystems.map((system) => `<label class="checkbox-row"><input type="checkbox" data-account-system="${system.id}" ${setup.integrations.includes(system.id) ? 'checked' : ''}><span><strong>${system.id}</strong><br><small>${system.detail}</small></span></label>`).join('')}</div>
      </div>
      <div class="notice info section"><span class="notice-icon">${icon('lock')}</span><div><strong>Sicheres Kontomodell</strong><p>Passwoerter und API-Schluessel werden nicht im Browserzustand gespeichert.</p></div></div>
    `,
    footer: `<button class="button danger" data-action="web-signout">Abmelden</button><button class="button outline" data-action="account-password">Passwort & Sicherheit</button><button class="button primary" data-action="account-save">Aenderungen speichern</button>`
  });
}

function saveAccountManagement() {
  const setup = state.initialSetup;
  const fullName = document.getElementById('accountFullName')?.value.trim() || '';
  const email = document.getElementById('accountEmail')?.value.trim().toLowerCase() || '';
  const phone = document.getElementById('accountPhone')?.value.trim() || '';
  const companyName = isInternalSetupRole(setup.role) ? 'Bülow & Dolz' : document.getElementById('accountCompany')?.value.trim() || '';
  if (!fullName || !email.includes('@') || !companyName) {
    showToast('Angaben unvollstaendig', 'Bitte Name, E-Mail und Organisation pruefen.', 'warning');
    return;
  }
  setup.fullName = fullName;
  setup.email = email;
  setup.phone = phone;
  setup.companyName = companyName;
  setup.integrations = [...document.querySelectorAll('[data-account-system]:checked')].map((input) => input.dataset.accountSystem);
  state.session.email = email;
  state.onboarding.data.contact = fullName;
  state.onboarding.data.email = email;
  state.onboarding.data.phone = phone;
  if (!isInternalSetupRole(setup.role)) state.onboarding.data.company = companyName;
  saveState();
  closeModal();
  updateSetupProfileChrome();
  showToast('Kontodaten gespeichert', 'Profil und Schnittstellenauswahl wurden synchronisiert.', 'success');
}

function showPasswordManagement() {
  openModal({
    eyebrow: 'KONTOSICHERHEIT',
    title: 'Passwort aendern',
    body: `<div class="setup-fields" style="margin-top:0">
      <div class="setup-field"><label>Aktuelles Passwort</label><input id="currentAccountPassword" type="password" autocomplete="current-password"></div>
      <div class="setup-field"><label>Neues Passwort</label><input id="newAccountPassword" type="password" autocomplete="new-password"></div>
      <div class="setup-field"><label>Neues Passwort wiederholen</label><input id="confirmAccountPassword" type="password" autocomplete="new-password"></div>
    </div><div class="setup-note">${icon('lock',15)} Der Passwortwechsel wird im Prototyp simuliert. Es wird kein Passwort gespeichert.</div>`,
    footer: `<button class="button outline" data-action="account-manage">Zurueck</button><button class="button primary" data-action="account-password-save">Passwort aktualisieren</button>`
  });
}

function saveAccountPassword() {
  const current = document.getElementById('currentAccountPassword')?.value || '';
  const next = document.getElementById('newAccountPassword')?.value || '';
  const confirmation = document.getElementById('confirmAccountPassword')?.value || '';
  if (current.length < 8 || next.length < 8 || next !== confirmation) {
    showToast('Passwort nicht aktualisiert', 'Bitte alle Felder pruefen. Das neue Passwort muss mindestens 8 Zeichen haben.', 'warning');
    return;
  }
  closeModal();
  showToast('Passwort aktualisiert', 'Der Passwortwechsel wurde fuer den Prototyp simuliert.', 'success');
}

function signOutWebSession() {
  if (BackendWorkspace.enabled) { BackendWorkspace.logout().catch(() => showToast('Abmelden', 'Keine Verbindung zum Server.')); return; }
  if (AdminPreview.enabled) { AdminPreview.switchMode(false); return; }
  closeModal();
  document.getElementById('toastRegion').innerHTML = '';
  state.session.authenticated = false;
  state.session.email = state.initialSetup.email;
  state.session.error = '';
  sessionPassword = '';
  saveState();
  renderInitialSetupGate();
}
