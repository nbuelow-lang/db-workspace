// Extracted without behavior changes; see Docs/Modules for ownership.
let state = loadState();

AdminPreview.start(state);
BackendWorkspace.prepare(state);

let appearance = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

let currentModalProject = null;

let sharedEnvelope = null;

let sharedSyncTimer = null;

let sharedPollTimer = null;

let isApplyingSharedState = false;

let setupPassword = '';

let setupTermsAccepted = false;

let sessionPassword = '';

const isGitHubPagesHost = /\.github\.io$/i.test(window.location.hostname);

if (isGitHubPagesHost) {
  document.querySelector('.setup-security').textContent = 'Öffentliche Demo · keine echten Kundendaten eingeben';
  document.querySelector('.demo-note').textContent = 'Öffentliche Demo · Beispieldaten';
}

const syncApiUrl = (BackendWorkspace.enabled || AdminPreview.enabled || isGitHubPagesHost) ? null : (window.location.protocol === 'file:' ? 'http://127.0.0.1:8787/api/state' : '/api/state');

WorkspaceArrange.init();
MobileHomeSwipe.init();
MobileBack.init();
Assistant.init();
ProjectRing.start();
Customers.start();
NotificationGestures.init();
MobileSidebar.init();
PullRefresh.init();
document.addEventListener('error', handleWorkspaceImageError, true);

document.addEventListener('click', (event) => {
  if (event.target.closest('#workspaceSearchClear')) {
    const search = document.getElementById('workspaceSearch');
    search.value = ''; filterWorkspace(''); search.focus(); return;
  }
  if (event.target.closest('#appearanceToggle')) { toggleAppearance(); return; }
  const languageOption = event.target.closest('[data-language]');
  if (languageOption) { selectLanguage(languageOption.dataset.language); return; }
  if (event.target.closest('#languageMenuButton')) { toggleLanguageMenu(); return; }
  if (!event.target.closest('.language-menu-shell')) toggleLanguageMenu(false);
  const setupTarget = event.target.closest('[data-setup-action]');
  if (setupTarget) { handleSetupAction(setupTarget.dataset.setupAction, setupTarget); return; }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { setView(viewButton.dataset.view); return; }
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'workspaceSearch') { filterWorkspace(event.target.value); return; }
  const sessionModel = event.target.dataset.sessionModel;
  if (sessionModel) {
    if (sessionModel === 'password') sessionPassword = event.target.value;
    if (sessionModel === 'email') state.session.email = event.target.value;
    state.session.error = '';
    return;
  }
  const setupModel = event.target.dataset.setupModel;
  if (setupModel) {
    if (setupModel === 'password') setupPassword = event.target.value;
    else if (setupModel !== 'terms') {
      state.initialSetup[setupModel] = event.target.value;
      state.initialSetup.error = '';
      localStorage.setItem(AdminPreview.storageKey, JSON.stringify(state));
    }
    return;
  }
  const model = event.target.dataset.model;
  if (model && !model.startsWith('bid') && !model.startsWith('notification')) {
    state.onboarding.data[model] = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    saveState();
  }
  if (event.target.id === 'marketSearch') {
    state.filters.search = event.target.value;
    saveState();
    clearTimeout(window.__marketTimer);
    window.__marketTimer = setTimeout(render, 220);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.dataset.setupModel === 'terms') {
    setupTermsAccepted = event.target.checked;
    state.initialSetup.error = '';
    return;
  }
  if (event.target.id === 'roleSelect') {
    state.role = event.target.value;
    state.view = 'dashboard';
    saveState();
    render();
    showToast('Ansicht gewechselt', event.target.options[event.target.selectedIndex].text, 'success');
  }
  if (event.target.id === 'regionFilter') { state.filters.region = event.target.value; saveState(); render(); }
  if (event.target.id === 'scopeFilter') { state.filters.scope = event.target.value; saveState(); render(); }
});

document.getElementById('modalClose').addEventListener('click', closeModal);

document.getElementById('modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (event.target.id === 'workspaceSearch') { event.target.value = ''; filterWorkspace(''); }
  toggleLanguageMenu(false);
  if (!document.getElementById('modalBackdrop').hidden) closeModal();
});

document.getElementById('notificationButton').addEventListener('click', () => showNotifications());

document.getElementById('profileButton').addEventListener('click', showAccountManagement);

document.getElementById('endAdminPreview').addEventListener('click', () => AdminPreview.switchMode(false));

document.getElementById('roleSelect').value = state.role;

hydrateIcons();

applyAppearance();

renderLanguageControl();

render();

setInterval(updateTimeGreeting, 60 * 1000);

if (BackendWorkspace.enabled) { BackendWorkspace.start(); ServerAcceptance.start(); ServerOrders.start(); ServerInstruments.start(); ServerTime.start(); }
else initializeSharedSync();
