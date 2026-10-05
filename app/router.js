// Extracted without behavior changes; see Docs/Modules for ownership.
function setView(view) {
  if (view !== state.view) MobileBack.record();
  MobileSidebar.close(false);
  state.view = view;
  if (view === 'chats' && state.role !== 'finance') {
    const ids = (state.operations?.projectMessages || []).map(message => message.projectID);
    markProjectChatRead(ids.includes(state.operations?.activeChatProjectID) ? state.operations.activeChatProjectID : ids[0]);
  }
  saveState();
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.querySelector('.sidebar')?.classList.remove('open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setPageMeta(eyebrow, title) {
  document.getElementById('pageEyebrow').textContent = eyebrow;
  document.getElementById('pageTitle').textContent = title;
}

function render() {
  PullRefresh.cancel();
  MobileHomeSwipe.cancel();
  WorkspaceArrange.beforeRender();
  const root = document.getElementById('viewRoot');
  const role = state.role;
  updateRoleNavigation();
  const views = {
    finance: renderFinance,
    werkraum: renderWerkraum,
    dashboard: renderDashboard,
    smartops: () => Assistant.renderBriefing(),
    academy: renderAcademy,
    schedule: () => Schedule.render(),
    customers: () => Customers.render(),
    instruments: () => ServerInstruments.render(),
    time: () => ServerTime.render(),
    control: role => ServerOrders.enabled ? ProjectRing.render() : renderProjectControl(role),
    imports: renderImports,
    chats: renderChats,
    onboarding: renderOnboarding,
    marketplace: renderMarketplace,
    projects: renderProjects,
    acceptance: renderAcceptance,
    orders: () => ServerOrders.renderView(),
    partners: renderPartners
  };
  root.innerHTML = (views[state.view] || renderDashboard)(role);
  hydrateIcons(root);
  WorkspaceArrange.mount();
  updateBadges();
  renderInitialSetupGate();
  Assistant.refresh();
  updateSetupProfileChrome();
  renderLanguageControl();
  MobileHomeSwipe.refresh();
  MobileBack.refresh();
  I18n.apply();
  document.getElementById('adminPreviewBar').hidden = !AdminPreview.enabled;
  document.getElementById('adminPreviewLabel').textContent = state.role === 'admin'
    ? 'Testmodus · Geschäftsführung' : 'Testmodus · ' + document.getElementById('roleSelect').selectedOptions[0].textContent;
  root.focus({ preventScroll: true });
}

function updateRoleNavigation() {
  const role = state.role;
  const allowed = {
    finance: role === 'admin' || role === 'finance',
    werkraum: ['admin', 'pm', 'quality'].includes(role),
    dashboard: true,
    smartops: true,
    academy: true,
    schedule: ServerOrders.enabled,
    customers: ServerOrders.enabled,
    instruments: ServerOrders.enabled,
    time: ServerOrders.enabled,
    control: role === 'admin' || role === 'pm',
    imports: role === 'admin',
    chats: true,
    onboarding: role === 'partner',
    marketplace: role === 'partner' || role === 'sales' || role === 'admin',
    projects: role !== 'admin' && role !== 'pm',
    acceptance: role === 'partner' || role === 'admin' || role === 'quality' || role === 'pm',
    partners: role === 'admin',
    orders: ServerOrders.enabled
  };
  if (role === 'finance') Object.keys(allowed).forEach(view => { allowed[view] = view === 'finance'; });
  document.querySelectorAll('.nav-list [data-view], .mobile-bottom-nav [data-view]').forEach(button => {
    button.hidden = allowed[button.dataset.view] === false;
  });
  if (allowed[state.view] === false) state.view = role === 'finance' ? 'finance' : 'dashboard';
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
}

function updateBadges() {
  const progress = onboardingProgress();
  const onboardingBadge = document.getElementById('onboardingBadge');
  if (onboardingBadge) onboardingBadge.textContent = `${progress}%`;
  const marketBadge = document.getElementById('marketBadge');
  if (marketBadge) marketBadge.textContent = String(availableProjects().length);
  const acceptanceBadge = document.getElementById('acceptanceBadge');
  if (acceptanceBadge) acceptanceBadge.textContent = String(ServerAcceptance.enabled ? ServerAcceptance.openCount() : acceptanceQueue.length);
  const importBadge = document.getElementById('importBadge');
  if (importBadge) importBadge.textContent = String((state.operations?.importCandidates || []).filter(item => ['Importbereit', 'Prüfung nötig'].includes(item.status)).length);
  const chatBadge = document.getElementById('chatBadge');
  if (chatBadge) chatBadge.textContent = String((state.operations?.projectMessages || []).filter(message => !message.isRead && message.senderName !== state.initialSetup?.fullName).length);
  const smartBadge = document.getElementById('smartBadge');
  if (smartBadge) smartBadge.textContent = String(Assistant.badgeCount());
  Assistant.refresh();
  updateNotificationBadges();
}

function handleAction(action, target) {
  if (action.startsWith('focus-')) { WorkspaceFocus.action(action, target); return; }
  if (action.startsWith('nc-')) { notificationCenterAction(action, target); return; }
  if (action.startsWith('sa-')) { ServerAcceptance.action(action, target); return; }
  if (action.startsWith('so-')) { ServerOrders.action(action, target); return; }
  if (action.startsWith('as-')) { Assistant.action(action, target); return; }
  if (action.startsWith('pr-')) { ProjectRing.action(action, target); return; }
  if (action.startsWith('sc-')) { Schedule.action(action, target); return; }
  if (action.startsWith('cu-')) { Customers.action(action, target); return; }
  if (action.startsWith('pm-')) { ServerInstruments.action(action, target); return; }
  if (action.startsWith('tm-')) { ServerTime.action(action, target); return; }
  if (action === 'lexware-verify') { checkLexware(); return; }
  if (action.startsWith('werkraum-')) { werkraumAction(action, target); return; }
  const dataset = target.dataset;
  switch (action) {
    case 'goto': if (!document.getElementById('modalBackdrop').hidden) closeModal(); setView(dataset.target); break;
    case 'workspace-folder': showWorkspaceFolder(dataset.target); break;
    case 'smart-module': showSmartModule(dataset.module); break;
    case 'smart-update': updateSmartItem(dataset.collection,dataset.item,dataset.status,dataset.module); break;
    case 'offline-toggle': {
      if (BackendWorkspace.enabled) { showToast('Server-Testbetrieb', 'Bei Verbindungsabbruch bleiben Änderungen als lokaler Entwurf erhalten. Vollständiger Offline-Betrieb folgt separat.'); return; }
      const wasOffline = state.offlineModeEnabled;
      state.offlineModeEnabled = !wasOffline;
      if (wasOffline) state.pendingOfflineChanges = 0;
      saveState();
      if (wasOffline) { scheduleSharedSync(); pushSharedState(); }
      showSmartModule('offline');
      break;
    }
    case 'translation-send': sendSmartTranslation(); break;
    case 'realtime-start': startRealtimeTranslation(); break;
    case 'realtime-stop': stopRealtimeTranslation(); showSmartModule('translation'); break;
    case 'notifications': showNotifications(); break;
    case 'filter-notifications': showNotifications(dataset.filter); break;
    case 'open-notification': showNotificationDetail(dataset.notification); break;
    case 'compose-notification': showNotificationComposer(); break;
    case 'send-notification': sendInstallerNotification(); break;
    case 'mark-all-notifications':
      notificationCenterAction('nc-mark-all', target);
      break;
    case 'notification-chat':
      closeModal();
      state.view = 'chats';
      selectOperationsChat(dataset.project);
      break;
    case 'onboarding-step': state.onboarding.currentStep = Number(dataset.step); saveState(); render(); break;
    case 'next-step': completeCurrentStep(true); break;
    case 'prev-step': state.onboarding.currentStep = Math.max(1, state.onboarding.currentStep - 1); saveState(); render(); break;
    case 'save-step': completeCurrentStep(false); break;
    case 'request-approval': completeCurrentStep(false); showToast('Freigabe beantragt', 'Bülow & Dolz Compliance sowie Bauleitung / QM wurden informiert.', 'success'); break;
    case 'mock-upload': showToast('Demo-Upload', 'In der Produktivversion wird das Dokument verschluesselt hochgeladen.', 'success'); break;
    case 'add-team': showToast('Team-Assistent', 'Der Team-Dialog ist im MVP als naechstes Modul vorgesehen.', 'success'); break;
    case 'toggle-chip': target.classList.toggle('selected'); break;
    case 'toggle-region': {
      const region = dataset.region;
      const list = state.onboarding.data.regions;
      const index = list.indexOf(region);
      if (index >= 0) list.splice(index, 1); else list.push(region);
      saveState(); render(); break;
    }
    case 'training': showToast('Academy Demo', 'Video, Wissenscheck und personenbezogenes Zertifikat sind als Modul vorgesehen.', 'success'); break;
    case 'project-details': showProjectDetails(dataset.project); break;
    case 'edit-project': showOperationsProjectEditor(dataset.project); break;
    case 'save-project': saveOperationsProject(dataset.project); break;
    case 'open-project-chat': state.view = 'chats'; selectOperationsChat(dataset.project); break;
    case 'select-chat': selectOperationsChat(dataset.project); break;
    case 'send-chat': sendOperationsChat(dataset.project); break;
    case 'select-import-source': state.operations.importSource = dataset.source; saveState(); render(); break;
    case 'refresh-imports': state.operations.lastImportAt = Date.now() / 1000 - swiftReferenceDateOffset; saveState(); render(); showToast('Abruf abgeschlossen', `${dataset.source}: Importvorschau wurde aktualisiert.`, 'success'); break;
    case 'review-import': showImportReview(dataset.import); break;
    case 'save-import-review': saveImportReview(dataset.import); break;
    case 'import-project': {
      const imported = importOperationsCandidate(dataset.import);
      showToast(imported ? 'Bauvorhaben importiert' : 'Import nicht moeglich', imported ? 'Der Datensatz liegt jetzt in der Projektpflege.' : 'Bitte Duplikat oder Pflichtangaben pruefen.', imported ? 'success' : 'warning');
      break;
    }
    case 'import-all': {
      const ids = (state.operations.importCandidates || []).filter(item => item.source === dataset.source && item.status === 'Importbereit').map(item => item.id);
      const importedCount = ids.filter(id => importOperationsCandidate(id, false)).length;
      render();
      showToast('Sammelimport abgeschlossen', `${importedCount} Bauvorhaben wurden uebernommen.`, 'success');
      break;
    }
    case 'bid': showBidForm(dataset.project); break;
    case 'submit-bid': submitBid(dataset.project); break;
    case 'reset-filters': state.filters = { search: '', region: 'all', scope: 'all', date: 'all' }; saveState(); render(); break;
    case 'active-project': showToast('Projekt geoeffnet', `${dataset.project}: Foto-Gates und Dokumente wuerden hier erscheinen.`, 'success'); break;
    case 'deviation': showToast('Abweichungsworkflow', 'Fotoaufnahme, Kategorie, STOP-Status und technische Freigabe werden gestartet.', 'warning'); break;
    case 'acceptance-details': showAcceptanceDetails(dataset.acceptance); break;
    case 'approve-acceptance': {
      const acceptanceID = dataset.acceptance;
      const invoice = (state.automatedInvoices || []).find(item => item.projectID === acceptanceID || item.status === 'Wartet auf Abnahme');
      if (invoice) invoice.status = 'Abrechnungsbereit';
      saveState(); closeModal(); showToast('QM-Abnahme bestanden', invoice ? `${invoice.projectID} ist jetzt automatisch abrechnungsbereit.` : 'Entscheidung wurde mit Zeitstempel dokumentiert.', 'success'); break;
    }
    case 'raise-defect': closeModal(); showToast('Mangel angelegt', 'Pflichtangaben: Schweregrad, Foto, Sollquelle, Frist und Verantwortlicher.', 'warning'); break;
    case 'partner-details': showPartnerDetails(dataset.partner); break;
    case 'partner-next': closeModal(); showToast('Prozessschritt gestartet', 'Aufgabe wurde der verantwortlichen Person zugeordnet.', 'success'); break;
    case 'invite-partner': showToast('Einladungslink erstellt', 'Mehrsprachiger Onboarding-Link wurde in die Zwischenablage kopiert (Demo).', 'success'); break;
    case 'account-manage': showAccountManagement(); break;
    case 'account-save': saveAccountManagement(); break;
    case 'account-password': showPasswordManagement(); break;
    case 'account-password-save': saveAccountPassword(); break;
    case 'web-signout': signOutWebSession(); break;
    case 'close-modal': closeModal(); break;
    default: break;
  }
}
