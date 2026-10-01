// Extracted without behavior changes; see Docs/Modules for ownership.
function loadState() {
  if (BackendWorkspace.enabled) return structuredClone(defaultState);
  try {
    const raw = localStorage.getItem(AdminPreview.storageKey);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    // Browser-only project snapshot; the server modes retain their own contracts.
    if (Array.isArray(parsed._browserProjects) && parsed._browserProjects.every(project =>
      project && typeof project.id === 'string' && typeof project.city === 'string' && typeof project.title === 'string')) {
      projects.splice(0, projects.length, ...parsed._browserProjects);
    }
    delete parsed._browserProjects;
    const merged = { ...structuredClone(defaultState), ...parsed };
    merged.operations = { ...structuredClone(defaultState.operations), ...(parsed.operations || {}) };
    restoreLocalNotificationReceipts(merged);
    return merged;
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  if (BackendWorkspace.enabled) { BackendWorkspace.schedule(); return; }
  captureLocalNotificationReceipts();
  if (state.offlineModeEnabled && !isApplyingSharedState) {
    state.pendingOfflineChanges = Number(state.pendingOfflineChanges || 0) + 1;
  }
  localStorage.setItem(AdminPreview.storageKey, JSON.stringify({...state, _browserProjects:projects}));
  if (!isApplyingSharedState && !state.offlineModeEnabled && syncApiUrl) scheduleSharedSync();
  if (!syncApiUrl && !state.offlineModeEnabled) setSyncStatus('online', 'GitHub Pages Demo');
  if (state.offlineModeEnabled) setSyncStatus('error', `Offline · ${state.pendingOfflineChanges} lokal`);
}
