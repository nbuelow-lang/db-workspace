// Back arrow in the mobile bottom bar: returns to the previous page inside the app.
// Records every view change (setView) and order list/detail switches; hidden on the home screen.
const MobileBack = (() => {
  const stack = [];
  let button = null, navigating = false;
  const home = () => state.role === 'finance' ? 'finance' : 'dashboard';
  const here = () => ({view:state.view, order:state.view === 'orders' && ServerOrders.enabled ? ServerOrders.currentOrder() : null});
  const same = (a, b) => a && b && a.view === b.view && a.order === b.order;
  const visible = element => element && !element.hidden && element.getClientRects().length > 0;

  // Called before a navigation changes the page.
  function record() {
    if (navigating) return;
    const entry = here();
    if (entry.view === home()) { stack.length = 0; }
    if (!same(stack[stack.length - 1], entry)) stack.push(entry);
    if (stack.length > 40) stack.shift();
  }

  function back() {
    if (!button || button.hidden || visible(document.getElementById('modalBackdrop'))) return;
    const current = here();
    let target = stack.pop();
    while (target && same(target, current)) target = stack.pop();
    target = target || {view:home(), order:null};
    navigating = true;
    try {
      if (target.view === 'orders' && ServerOrders.enabled) ServerOrders.show(target.order);
      if (state.view !== target.view) setView(target.view);
      else { render(); window.scrollTo({top:0}); }
    } finally { navigating = false; }
    refresh();
  }

  function refresh() {
    if (!button) return;
    button.hidden = state.view === home();
    const label = I18n.t('Zurück');
    button.setAttribute('aria-label', label); button.title = label;
  }

  function init() {
    button = document.getElementById('mobileBackButton');
    if (!button) return;
    button.addEventListener('click', back);
    refresh();
  }

  return {init, record, back, refresh, depth:() => stack.length};
})();
