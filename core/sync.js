// Extracted without behavior changes; see Docs/Modules for ownership.
function setSyncStatus(mode, text) {
  if (AdminPreview.enabled) { mode = 'preview'; text = 'Lokal · Testmodus'; }
  const status = document.getElementById('syncStatus');
  const label = document.getElementById('syncStatusText');
  if (!status || !label) return;
  status.classList.toggle('online', mode === 'online');
  status.classList.toggle('error', mode === 'error');
  label.textContent = text;
  status.title = mode === 'online' ? 'App und Web verwenden denselben Datenstand.' : text;
}

function mapSharedProject(project) {
  const readiness = {
    'Baustelle bereit': 100,
    'Material disponiert': 94,
    'Kunde bestätigt': 90,
    'In Feinplanung': 82
  }[project.readiness] || 85;
  return {
    id: project.id,
    city: project.city,
    region: project.region,
    postal: project.postalCode,
    start: project.schedule,
    price: project.compensation,
    material: Math.round(project.compensation * 0.31 / 10) * 10,
    travel: Math.max(80, project.distanceKilometers * 2),
    distance: project.distanceKilometers,
    readiness,
    complexity: project.compensation === 7500 ? 'Standard' : 'Individuell',
    scope: 'Turnkey',
    title: project.title,
    duration: `${project.durationDays} Tage`,
    bids: 0,
    color: project.readiness === 'Baustelle bereit' ? 'green' : project.readiness === 'In Feinplanung' ? 'amber' : 'blue',
    tags: [project.readiness, project.heatPump, project.propertyType],
    aiScore: project.aiScore,
    aiSummary: project.aiScoreSummary,
    aiFactors: project.aiScoreFactors || [],
    tasks: project.scope || [],
    docs: ['Projektsteckbrief', 'Montagecheckliste', 'Fotodokumentation'],
    risks: project.requirements || [],
    coordinator: project.coordinator || 'Bülow & Dolz Projektkoordination',
    coordinatorPhone: project.coordinatorPhone || '',
    standard: project.compensation === 7500
  };
}

function completedOnboardingSteps(shared) {
  const completed = [];
  if (shared.companyDataConfirmed) completed.push(1);
  if ((shared.documents || []).every(document => ['Geprüft', 'In Prüfung'].includes(document.status))) completed.push(2);
  if ((shared.teams || []).length && shared.teams.every(team => (team.members || []).length)) completed.push(3);
  if ((shared.selectedRegions || []).length) completed.push(4);
  if ((shared.academyCompletedLessonIDs || []).length >= 6) completed.push(5);
  if ((shared.assignments || []).some(assignment => assignment.phase === 'Abgeschlossen')) completed.push(6);
  return completed;
}

function applySharedState(shared) {
  if (!shared || !Array.isArray(shared.projects)) return;

  const access = shared.accessProfile;
  if (access?.setupCompleted) {
    state.initialSetup = {
      ...state.initialSetup,
      completed: true,
      stage: 5,
      email: access.email || '',
      role: access.role || '',
      fullName: access.fullName || '',
      phone: access.phone || '',
      companyName: access.companyName || '',
      referenceCode: access.referenceCode || '',
      integrations: [...(access.requestedIntegrations || [])],
      error: ''
    };
    state.session = state.session || structuredClone(defaultState.session);
    if (!state.session.authenticated) state.session.email = access.email || '';
    state.role = webRoleForAccessRole(access.role);
  }

  projects.splice(0, projects.length, ...shared.projects.map(mapSharedProject));
  const projectById = new Map(shared.projects.map(project => [project.id, project]));
  const teamById = new Map((shared.teams || []).map(team => [team.id, team]));

  activeProjects.splice(0, activeProjects.length, ...(shared.assignments || []).map(assignment => {
    const project = projectById.get(assignment.projectID);
    const completedChecks = (assignment.checklist || []).filter(item => item.isComplete).length;
    const progress = assignment.checklist?.length ? completedChecks / assignment.checklist.length : 0;
    return {
      id: assignment.projectID,
      city: project?.city || assignment.projectID,
      title: project?.title || 'Montageauftrag',
      stage: assignment.phase,
      date: project?.schedule || '',
      price: project?.compensation || 0,
      gates: Math.round(progress * 4),
      status: assignment.phase === 'Abgeschlossen' ? 'done' : assignment.phase === 'Abnahme' ? 'review' : 'active'
    };
  }));

  state.bids = (shared.applications || []).map(application => {
    const project = projectById.get(application.projectID);
    return {
      projectId: application.projectID,
      price: project?.compensation || 0,
      start: project?.schedule || '',
      team: application.teamID,
      scope: 'Turnkey',
      note: application.note || '',
      status: application.status,
      sentAt: new Date((Number(application.submittedAt || 0) + swiftReferenceDateOffset) * 1000).toISOString()
    };
  });

  const profile = shared.partner || {};
  state.onboarding.data.company = profile.companyName || state.onboarding.data.company;
  state.onboarding.data.legalForm = profile.legalForm || state.onboarding.data.legalForm;
  state.onboarding.data.taxId = profile.taxNumber || state.onboarding.data.taxId;
  state.onboarding.data.contact = profile.contactName || state.onboarding.data.contact;
  state.onboarding.data.email = profile.email || state.onboarding.data.email;
  state.onboarding.data.phone = profile.phone || state.onboarding.data.phone;
  state.onboarding.data.maxDistance = shared.travelRadius || state.onboarding.data.maxDistance;
  state.onboarding.data.regions = [...(shared.selectedRegions || [])];
  state.onboarding.completed = completedOnboardingSteps(shared);
  state.onboarding.currentStep = [1,2,3,4,5,6].find(step => !state.onboarding.completed.includes(step)) || 6;

  state.notifications = (shared.notifications || []).map(notification => ({
    id: notification.id,
    kind: notification.kind || 'general',
    title: notification.title,
    text: notification.message,
    time: notification.timestamp,
    isRead: Boolean(notification.isRead),
    messageID: notification.messageID || null,
    area: notification.area || null,
    notificationArchivedFingerprint: notification.notificationArchivedFingerprint,
    priority: notification.priority || 'Normal',
    projectID: notification.projectID || null,
    recipientTeamID: notification.recipientTeamID || null,
    recipientName: notification.recipientName || '',
    recipientRole: notification.recipientRole || '',
    deliveryStatus: notification.deliveryStatus || (notification.isRead ? 'Gelesen' : 'Zugestellt'),
    sentAt: notification.sentAt || null,
    senderName: notification.senderName || ''
  }));

  state.operations = state.operations || structuredClone(defaultState.operations);
  state.werkraumLeads = shared.werkraumLeads ?? state.werkraumLeads ?? [];
  state.operations.projectManagers = shared.projectManagers || state.operations.projectManagers;
  state.operations.importCandidates = shared.importCandidates || state.operations.importCandidates;
  state.operations.projectMessages = shared.projectMessages || state.operations.projectMessages;
  state.operations.lastImportAt = shared.lastImportAt || state.operations.lastImportAt || null;
  for (const field of ['copilotTasks','photoGateAssessments','autopilotProposals','teamMatchSuggestions','deploymentPlans','deviationCases','automatedInvoices','academyRecommendations']) {
    if (Array.isArray(shared[field])) state[field] = shared[field];
  }
  state.offlineModeEnabled = Boolean(shared.offlineModeEnabled ?? state.offlineModeEnabled);
  state.pendingOfflineChanges = Number(shared.pendingOfflineChanges ?? state.pendingOfflineChanges ?? 0);

  const displayCompany = access?.companyName || profile.companyName || 'Bülow & Dolz Partner';
  document.querySelector('.profile-copy strong').textContent = displayCompany;
  document.querySelector('.profile-copy span').textContent = access?.role || [...(shared.selectedRegions || [])].slice(0, 2).join(' / ') || 'Partnerprofil';
  document.querySelector('.avatar').textContent = initials(access?.fullName || displayCompany);
  localStorage.setItem(AdminPreview.storageKey, JSON.stringify(state));
}

function mergeWebStateIntoShared() {
  if (!sharedEnvelope?.state) return null;
  const shared = structuredClone(sharedEnvelope.state);
  shared.werkraumLeads = structuredClone(state.werkraumLeads || []);
  const data = state.onboarding.data;
  shared.partner = {
    ...shared.partner,
    companyName: data.company || shared.partner.companyName,
    legalForm: data.legalForm || shared.partner.legalForm,
    contactName: data.contact || shared.partner.contactName,
    email: data.email || shared.partner.email,
    phone: data.phone || shared.partner.phone,
    taxNumber: data.taxId || shared.partner.taxNumber
  };
  shared.selectedRegions = [...(data.regions || [])];
  shared.travelRadius = Number(data.maxDistance || shared.travelRadius);
  shared.companyDataConfirmed = state.onboarding.completed.includes(1);
  const operations = state.operations || structuredClone(defaultState.operations);
  shared.projectManagers = operations.projectManagers || [];
  shared.importCandidates = operations.importCandidates || [];
  shared.projectMessages = operations.projectMessages || [];
  shared.lastImportAt = operations.lastImportAt || null;
  for (const field of ['copilotTasks','photoGateAssessments','autopilotProposals','teamMatchSuggestions','deploymentPlans','deviationCases','automatedInvoices','academyRecommendations']) {
    shared[field] = structuredClone(state[field] || []);
  }
  shared.offlineModeEnabled = Boolean(state.offlineModeEnabled);
  shared.pendingOfflineChanges = Number(state.pendingOfflineChanges || 0);
  shared.notifications = (state.notifications || []).map((notification, index) => ({
    id: notification.id || `notification-web-${Date.now()}-${index}`,
    kind: notification.kind || 'general',
    title: notification.title || 'Mitteilung',
    message: notification.text || '',
    timestamp: notification.time || 'Gerade eben',
    isRead: Boolean(notification.isRead),
    messageID: notification.messageID || null,
    area: notification.area || null,
    notificationArchivedFingerprint: notification.notificationArchivedFingerprint,
    priority: notification.priority || 'Normal',
    projectID: notification.projectID || null,
    recipientTeamID: notification.recipientTeamID || null,
    recipientName: notification.recipientName || null,
    recipientRole: notification.recipientRole || null,
    deliveryStatus: notification.deliveryStatus || (notification.isRead ? 'Gelesen' : 'Zugestellt'),
    sentAt: notification.sentAt || null,
    senderName: notification.senderName || null
  }));

  const projectEdits = operations.projectEdits || {};
  shared.projects = (shared.projects || []).map(project => {
    const edit = projectEdits[project.id];
    if (!edit) return project;
    const manager = (operations.projectManagers || []).find(item => item.id === edit.coordinatorID);
    return {
      ...project,
      title: edit.title || project.title,
      schedule: edit.schedule || project.schedule,
      compensation: Number(edit.compensation || project.compensation),
      readiness: edit.readiness || project.readiness,
      coordinator: manager?.name || project.coordinator,
      coordinatorPhone: manager?.phone || project.coordinatorPhone
    };
  });

  for (const candidate of (operations.importCandidates || []).filter(item => item.status === 'Importiert')) {
    if (shared.projects.some(project => project.id === candidate.proposedProjectID)) continue;
    const manager = (operations.projectManagers || []).find(item => item.id === candidate.coordinatorID);
    shared.projects.unshift({
      id: candidate.proposedProjectID,
      title: candidate.title,
      city: candidate.city,
      postalCode: candidate.postalCode,
      region: candidate.region,
      schedule: candidate.schedule,
      distanceKilometers: 0,
      compensation: Number(candidate.compensation || 0),
      readiness: 'In Feinplanung',
      heatPump: candidate.heatPump,
      propertyType: candidate.propertyType,
      durationDays: 3,
      scope: [`Projektumfang aus ${candidate.source} pruefen`, 'Montagepaket vervollstaendigen', 'Kundenfreigabe dokumentieren'],
      requirements: [`Importquelle ${escapeAttr(candidate.externalID)}`, 'Technische Pruefung vor Veroeffentlichung'],
      teamSize: 2,
      slots: 1,
      coordinator: manager?.name || 'Bülow & Dolz Projektkoordination',
      coordinatorPhone: manager?.phone || '',
      latitude: candidate.source === 'MyHammer' ? 0 : 52.375,
      longitude: candidate.source === 'MyHammer' ? 0 : 9.732
    });
  }

  if (state.initialSetup?.completed) {
    shared.accessProfile = {
      fullName: state.initialSetup.fullName || data.contact || '',
      email: state.initialSetup.email || data.email || '',
      phone: state.initialSetup.phone || data.phone || '',
      companyName: isInternalSetupRole(state.initialSetup.role) ? 'Bülow & Dolz' : state.initialSetup.companyName || data.company || '',
      referenceCode: state.initialSetup.referenceCode || '',
      role: state.initialSetup.role,
      requestedIntegrations: [...(state.initialSetup.integrations || [])],
      setupCompleted: true
    };
  }

  if (state.onboarding.completed.includes(2)) {
    shared.documents = (shared.documents || []).map(document => document.status === 'Fehlt' ? {
      ...document,
      status: 'In Prüfung',
      fileName: document.fileName || 'Web-Nachweis.pdf'
    } : document);
  }

  if (state.onboarding.completed.includes(5)) {
    shared.academyCompletedLessonIDs = [...new Set([
      ...(shared.academyCompletedLessonIDs || []),
      'standard-arrival', 'standard-workflow', 'photo-required', 'acceptance', 'hydraulic-layout', 'insulation'
    ])];
  }

  const applicationsByProject = new Map((shared.applications || []).map(application => [application.projectID, application]));
  const teamIDs = (shared.teams || []).map(team => team.id);
  shared.applications = state.bids.map((bid, index) => {
    const existing = applicationsByProject.get(bid.projectId);
    const selectedTeamID = teamIDs.includes(bid.team) ? bid.team : teamIDs[Math.min(index, Math.max(teamIDs.length - 1, 0))] || '';
    return {
      id: existing?.id || `application-${bid.projectId}`,
      projectID: bid.projectId,
      teamID: selectedTeamID,
      submittedAt: existing?.submittedAt || (Date.now() / 1000 - swiftReferenceDateOffset),
      status: existing?.status || 'In Prüfung',
      note: bid.note || ''
    };
  });
  return shared;
}

function scheduleSharedSync() {
  if (state.offlineModeEnabled) return;
  if (!syncApiUrl) return;
  if (!sharedEnvelope) return;
  clearTimeout(sharedSyncTimer);
  sharedSyncTimer = setTimeout(pushSharedState, 450);
}

async function pushSharedState() {
  if (state.offlineModeEnabled) return;
  if (!syncApiUrl) {
    setSyncStatus('online', 'GitHub Pages Demo');
    return;
  }
  const shared = mergeWebStateIntoShared();
  if (!shared) return;
  setSyncStatus('syncing', 'Synchronisiert ...');
  try {
    const response = await fetch(syncApiUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'web', state: shared })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    sharedEnvelope = await response.json();
    setSyncStatus('online', 'App & Web verbunden');
  } catch (error) {
    setSyncStatus('error', 'Server nicht erreichbar');
  }
}

async function fetchSharedState() {
  if (state.offlineModeEnabled) {
    setSyncStatus('error', `Offline · ${state.pendingOfflineChanges || 0} lokal`);
    return;
  }
  if (!syncApiUrl) {
    setSyncStatus('online', 'GitHub Pages Demo');
    return;
  }
  try {
    const response = await fetch(syncApiUrl, { cache: 'no-store' });
    if (response.status === 404) {
      setSyncStatus('syncing', 'Warte auf App-Daten');
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const envelope = await response.json();
    if (!sharedEnvelope || envelope.revision > sharedEnvelope.revision) {
      const shouldUploadLocalSetup = state.initialSetup?.completed && !envelope.state?.accessProfile?.setupCompleted;
      sharedEnvelope = envelope;
      isApplyingSharedState = true;
      applySharedState(envelope.state);
      isApplyingSharedState = false;
      render();
      if (shouldUploadLocalSetup) scheduleSharedSync();
    }
    setSyncStatus('online', 'App & Web verbunden');
  } catch (error) {
    setSyncStatus('error', 'Server nicht erreichbar');
  }
}

function initializeSharedSync() {
  fetchSharedState();
  if (!syncApiUrl) return;
  clearInterval(sharedPollTimer);
  sharedPollTimer = setInterval(fetchSharedState, 5000);
}
