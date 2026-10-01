// Isolated UI preview, never an authenticated server session.
const AdminPreview = (() => {
  const preferenceKey = 'bd-admin-preview-enabled';
  const demoHost = ['127.0.0.1', 'localhost', '[::1]', 'nbuelow-lang.github.io'].includes(location.hostname);
  const option = new URLSearchParams(location.search).get('preview');
  const octets = location.hostname.split('.').map(Number);
  const privateIPv4 = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  const serverMode = Boolean(globalThis.BD_BACKEND?.enabled);
  const supported = !serverMode && (demoHost || privateIPv4 || location.protocol === 'file:');
  // LAN preview requires an explicit URL opt-in; never auto-enter on LAN.
  const enabled = supported && (option === 'admin' || (!privateIPv4 && option !== 'off' && localStorage.getItem(preferenceKey) !== 'false'));
  return {
    enabled,
    supported,
    storageKey: serverMode ? `bd-server-local-${BD_BACKEND.workspaceID}` : enabled ? 'bd-admin-preview-state-v1' : 'gep-flex-state-v1',
    start(state) {
      if (!enabled) return;
      state.role = 'admin';
      state.view = 'dashboard';
      state.offlineModeEnabled = false;
      state.initialSetup = { ...state.initialSetup, completed: true, stage: 0,
        role: 'GEP Administration', fullName: 'Nicolai Bülow', companyName: 'Bülow & Dolz',
        email: 'admin@example.invalid', phone: '', referenceCode: '', integrations: [], error: '' };
      state.session = { authenticated: true, email: 'admin@example.invalid', error: '' };
    },
    switchMode(active) {
      localStorage.setItem(preferenceKey, String(active));
      const url = new URL(location.href);
      url.searchParams.set('preview', active ? 'admin' : 'off');
      location.assign(url);
    }
  };
})();
