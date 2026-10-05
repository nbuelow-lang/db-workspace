// Only a downward touch starting at the document top may own this gesture.
const PullRefresh = (() => {
  let indicator, gesture = null, refreshing = false, generation = 0;
  const resumeKey = 'bd-pull-refresh-view-v1';
  const visible = el => el && !el.hidden && el.getClientRects().length > 0;
  const mobile = () => matchMedia('(max-width: 940px)').matches;
  const busy = () => !BackendWorkspace.canReload() || !sharedRefreshSafe() || ServerOrders.busy();
  const blocked = () => !mobile() || busy() || MobileHomeSwipe.isActive() ||
    visible(document.getElementById('setupGate')) || visible(document.getElementById('modalBackdrop')) ||
    visible(document.getElementById('languageMenu')) ||
    document.querySelector('.sidebar.open, .workspace-home.is-arranging') ||
    document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || MobileHomeSwipe.hasDraft();

  function paint(distance = 0, label = '') {
    indicator.style.setProperty('--pull-distance', `${distance}px`);
    indicator.style.setProperty('--pull-turn', `${distance * 4}deg`);
    indicator.querySelector('.pull-refresh-label').textContent = label;
  }

  function cancel() {
    generation++;
    gesture = null;
    refreshing = false;
    if (!indicator) return;
    indicator.classList.remove('is-pulling', 'is-ready', 'is-refreshing');
    indicator.removeAttribute('aria-busy');
    paint();
  }

  async function reload() {
    if (blocked()) { cancel(); return; }
    gesture = null;
    refreshing = true;
    const attempt = ++generation;
    indicator.classList.remove('is-pulling', 'is-ready');
    indicator.classList.add('is-refreshing');
    indicator.setAttribute('aria-busy', 'true');
    paint(68, 'Wird aktualisiert …');
    try {
      if (!navigator.onLine || state.offlineModeEnabled) throw Error('offline');
      // Check reachability before replacing the page, retaining local work on failure.
      const response = await fetch(location.href, {cache:'no-store', signal:AbortSignal.timeout(8000)});
      response.body?.cancel().catch(() => {});
      if (!response.ok || response.redirected) throw Error('unavailable');
      if (attempt !== generation) return;
      if (blocked()) { cancel(); return; }
      sessionStorage.setItem(resumeKey, JSON.stringify({url:location.href, role:state.role, view:state.view}));
      location.reload();
    } catch {
      if (attempt !== generation) return;
      cancel();
      showToast('Nicht aktualisiert', 'Keine Verbindung. Dein aktueller Stand bleibt erhalten.', 'error');
    }
  }

  function start(event) {
    if (refreshing) return;
    if (event.touches.length !== 1) { cancel(); return; }
    const target = event.target;
    if (blocked() || window.scrollY > 1 || !target.closest('.main-area') ||
      target.closest('button,a,input,textarea,select,[contenteditable],.mobile-bottom-nav,[role="slider"],canvas,iframe')) return;
    // Nested scroll regions, maps and horizontal lists keep their own gestures.
    for (let el = target; el && el !== document.body; el = el.parentElement) {
      const css = getComputedStyle(el);
      if ((/(auto|scroll)/.test(css.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
          (/(auto|scroll)/.test(css.overflowX) && el.scrollWidth > el.clientWidth + 1)) return;
    }
    const touch = event.touches[0];
    gesture = {id:touch.identifier, x:touch.clientX, y:touch.clientY, locked:false, distance:0};
  }

  function move(event) {
    if (!gesture) return;
    if (event.touches.length !== 1 || blocked()) { cancel(); return; }
    const touch = event.touches[0];
    if (touch.identifier !== gesture.id) { cancel(); return; }
    const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
    if (!gesture.locked) {
      if (Math.hypot(dx, dy) < 8) return;
      if (dy <= 0 || dy < Math.abs(dx) * 1.15 || window.scrollY > 1) { cancel(); return; }
      gesture.locked = true;
    }
    if (!event.cancelable) { cancel(); return; }
    event.preventDefault();
    gesture.distance = Math.min(100, Math.max(0, dy) * .48);
    indicator.classList.add('is-pulling');
    indicator.classList.toggle('is-ready', gesture.distance >= 64);
    paint(gesture.distance, gesture.distance >= 64 ? 'Loslassen zum Aktualisieren' : 'Aktualisieren');
  }

  function init() {
    indicator = document.getElementById('pullRefresh');
    if (!indicator) return;
    // One-shot UI continuity, not an account or authorization override.
    try {
      const resume = JSON.parse(sessionStorage.getItem(resumeKey) || 'null');
      sessionStorage.removeItem(resumeKey);
      if (resume?.url === location.href &&
          [...document.querySelectorAll('#roleSelect option')].some(option => option.value === resume.role) &&
          [...document.querySelectorAll('[data-view]')].some(el => el.dataset.view === resume.view)) {
        state.role = resume.role;
        state.view = resume.view;
      }
    } catch { /* A disabled session store must not block application startup. */ }
    const availability = () => {
      document.documentElement.classList.toggle('has-pull-refresh', mobile() && !visible(document.getElementById('setupGate')));
    };
    document.addEventListener('touchstart', start, {passive:true});
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('touchend', event => {
      if (!gesture) return;
      if (event.touches.length || ![...event.changedTouches].some(t => t.identifier === gesture.id)) { cancel(); return; }
      if (gesture.locked && gesture.distance >= 64) void reload();
      else cancel();
    });
    document.addEventListener('touchcancel', cancel);
    document.addEventListener('visibilitychange', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', () => { cancel(); availability(); });
    document.addEventListener('input', cancel);
    document.addEventListener('change', cancel);
    const overlays = new MutationObserver(() => {
      availability();
      if ((gesture || refreshing) && blocked()) cancel();
    });
    document.querySelectorAll('#setupGate,#modalBackdrop,#languageMenu,.sidebar').forEach(el =>
      overlays.observe(el, {attributes:true, attributeFilter:['hidden','class']}));
    availability();
  }
  return {init, cancel, isActive:() => Boolean(gesture) || refreshing};
})();
