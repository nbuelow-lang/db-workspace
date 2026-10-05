// iOS-like gestures for the notification center (notifications.js):
// swipe a card left to reveal "Gelesen"/"Archiv" (a long swipe archives), pull down from the
// top bar on touch devices to open, push the sheet header up to close. Buttons stay the
// keyboard and screen-reader path for every gesture.
const NotificationGestures = (() => {
  let swipe = null, pull = null, suppressClick = false;
  const suppress = () => { suppressClick = true; setTimeout(() => { suppressClick = false; }, 450); };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sheetOpen = () => document.getElementById('modalBackdrop').classList.contains('is-nc') && !document.getElementById('modalBackdrop').hidden;

  function closeRows(except = null) {
    document.querySelectorAll('.nc-row.is-open').forEach(row => { if (row !== except) { row.classList.remove('is-open'); row.querySelector('.nc-card').style.transform = ''; } });
  }

  function start(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const card = event.target.closest?.('.nc-row .nc-card');
    if (card && sheetOpen()) {
      const row = card.closest('.nc-row'), actions = row.querySelector('.nc-swipe-actions');
      swipe = {row, card, id:event.pointerId, x:event.clientX, y:event.clientY, dx:0, locked:null, width:actions.getBoundingClientRect().width || 152, base:row.classList.contains('is-open') ? -(actions.getBoundingClientRect().width || 152) : 0};
      return;
    }
    if (event.pointerType === 'touch' && !sheetOpen() && document.getElementById('modalBackdrop').hidden && event.target.closest?.('.global-language-bar')) {
      pull = {id:event.pointerId, y:event.clientY, done:false};
      return;
    }
    if (sheetOpen() && event.target.closest?.('.modal-backdrop.is-nc .modal-header') && !event.target.closest('button')) pull = {id:event.pointerId, y:event.clientY, close:true, done:false};
  }

  function move(event) {
    if (swipe && event.pointerId === swipe.id) {
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
      if (swipe.locked === null && Math.hypot(dx, dy) > 8) swipe.locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (swipe.locked !== 'x') return;
      event.preventDefault();
      closeRows(swipe.row);
      const raw = Math.min(0, swipe.base + dx), max = swipe.row.getBoundingClientRect().width;
      // Rubber band beyond the action buttons, like iOS.
      const offset = raw < -swipe.width ? -swipe.width + (raw + swipe.width) * .55 : raw;
      swipe.dx = raw;
      swipe.row.classList.add('is-swiping');
      swipe.row.style.setProperty('--nc-actions', `${swipe.width}px`);
      swipe.card.style.transition = 'none';
      swipe.card.style.transform = `translateX(${Math.max(offset, -max)}px)`;
      return;
    }
    if (pull && event.pointerId === pull.id && !pull.done) {
      const dy = event.clientY - pull.y;
      if (!pull.close && dy > 56) { pull.done = true; suppress(); showNotifications(); }
      if (pull.close && dy < -56) { pull.done = true; closeModal(); }
    }
  }

  function end(event) {
    if (pull && event.pointerId === pull.id) pull = null;
    if (!swipe || event.pointerId !== swipe.id) return;
    const {row, card, dx, locked, width} = swipe;
    swipe = null;
    card.style.transition = reduced() ? 'none' : '';
    row.classList.remove('is-swiping');
    if (locked !== 'x') return;
    suppress();
    const full = row.getBoundingClientRect().width * .55;
    const archive = row.querySelector('.nc-swipe-archive');
    if (-dx > full && archive && !archive.disabled) {
      card.style.transform = 'translateX(-110%)';
      setTimeout(() => { suppressClick = false; archive.click(); }, reduced() ? 0 : 180);
      return;
    }
    if (-dx > width * .45) { row.classList.add('is-open'); card.style.transform = ''; row.style.setProperty('--nc-actions', `${width}px`); }
    else { row.classList.remove('is-open'); card.style.transform = ''; }
  }

  function init() {
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('pointermove', move, {capture:true, passive:false});
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    // A swipe or pull must not also count as a tap on the card or the top bar.
    document.addEventListener('click', event => {
      if (suppressClick) { suppressClick = false; if (event.target.closest('.nc-row, .global-language-bar')) { event.preventDefault(); event.stopPropagation(); } return; }
      if (!event.target.closest('.nc-row.is-open')) closeRows();
    }, true);
  }

  return {init, closeRows};
})();
