// The in-app grip leaves Safari edge navigation and the iOS home gesture alone.
const MobileHomeSwipe = (() => {
  let grip, gesture = null, entrance = null, suppressClick = false;
  let liquid, neck, drop, anchor, detached = false;
  const root = () => document.getElementById('viewRoot');
  const destination = () => state.role === 'finance' ? 'finance' : 'dashboard';
  const visible = element => element && !element.hidden && element.getClientRects().length > 0;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawLiquid(up, dx, ready) {
    if (reducedMotion()) return;
    const distance=Math.max(0,up), beyondSnap=Math.max(0,distance-64);
    const p=Math.min(1,distance/64);
    const x=80+Math.max(-18,Math.min(18,dx*.25));
    // After detaching, follow the finger 1:1 and keep growing without a height cap.
    const y=94-distance*.7-beyondSnap*.3;
    const baseRadius=ready ? 22+beyondSnap*.12 : 26-4*p, a=36-22*p;
    const bounds=grip.getBoundingClientRect();
    HomeReveal.update(distance,bounds.x+bounds.width/2+x-80,bounds.y-98+y,baseRadius);
    const r=baseRadius;
    const join=y+baseRadius*.66;
    const mx=(80+x)/2, my=Math.max(join+3,y+(120-y)*.62), waist=10-8.7*p;
    const upper=(my-join)*.5, lower=(120-my)*.5;
    drop.setAttribute('cx',x);drop.setAttribute('cy',y);drop.setAttribute('r',r);
    // Concave sides form a narrowing neck between the fixed base and the drop.
    neck.setAttribute('d',`M ${x-r*.75} ${join}
      C ${x-r*.75} ${join+upper} ${mx-waist} ${my-upper} ${mx-waist} ${my}
      C ${mx-waist} ${my+lower} ${80-a} ${120-lower} ${80-a} 120
      Q 80 125 ${80+a} 120
      C ${80+a} ${120-lower} ${mx+waist} ${my+lower} ${mx+waist} ${my}
      C ${mx+waist} ${my-upper} ${x+r*.75} ${join+upper} ${x+r*.75} ${join} Z`);
    neck.style.opacity=ready ? '0' : '1';
    anchor.setAttribute('rx',ready ? 52 : 52-12*p);
    anchor.setAttribute('ry',ready ? 3 : 4+2*p);
    if(ready!==detached) {
      drop.getAnimations().forEach(animation=>animation.cancel());
      anchor.getAnimations().forEach(animation=>animation.cancel());
      if(ready) {
        drop.animate([
          {transform:'translateY(3px) scale(.8,1.22)'},
          {transform:'translateY(-5px) scale(1.15,.85)',offset:.45},
          {transform:'translateY(0) scale(1)'}
        ],{duration:340,easing:'cubic-bezier(.2,.8,.3,1)'});
        anchor.animate([{transform:'scaleX(.65)'},{transform:'scaleX(1.1)',offset:.65},{transform:'scaleX(1)'}],
          {duration:300,easing:'ease-out'});
      }
    }
    detached=ready;
  }

  function hasDraft() {
    return [...root().querySelectorAll('input,textarea,select,[contenteditable="true"]')].some(field => {
      if (field.disabled || field.type === 'search' || field.type === 'hidden') return false;
      if (field.isContentEditable) return Boolean(field.textContent.trim());
      if (field.tagName === 'SELECT') {
        const defaults = [...field.options].filter(option => option.defaultSelected);
        return field.value !== (defaults[0] || field.options[0])?.value;
      }
      if (['checkbox','radio'].includes(field.type)) return field.checked !== field.defaultChecked;
      if (field.type === 'file') return field.files.length > 0;
      return field.value !== field.defaultValue;
    });
  }

  function blocked() {
    return !matchMedia('(max-width: 940px)').matches ||
      visible(document.getElementById('setupGate')) || visible(document.getElementById('modalBackdrop')) ||
      visible(document.getElementById('languageMenu')) ||
      document.querySelector('.sidebar.open, .workspace-home.is-arranging') ||
      document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || hasDraft();
  }

  function refresh() {
    if (!grip) return;
    grip.disabled = Boolean(blocked());
    grip.setAttribute('aria-label', state.role === 'finance' ? 'Zum Finanzarbeitsplatz' : 'Zum Arbeitsplatz');
    grip.title = grip.getAttribute('aria-label');
  }

  function cancel({preservePreview=false,retract=false} = {}) {
    if(!preservePreview) { if(retract)HomeReveal.retract();else HomeReveal.cancel(); }
    entrance?.cancel();
    entrance = null;
    if (gesture) {
      suppressClick = true;
      const id = gesture.id;
      gesture = null;
      if (grip.hasPointerCapture(id)) grip.releasePointerCapture(id);
    }
    root()?.classList.remove('home-swipe-dragging');
    root()?.classList.remove('home-swipe-animating');
    root()?.style.removeProperty('--home-swipe-lift');
    grip?.classList.remove('is-swiping','is-ready');
    [drop,anchor].forEach(element=>element?.getAnimations().forEach(animation=>animation.cancel()));
    detached=false;
  }

  function animateContent(frames,options) {
    const content=root();
    content.classList.add('home-swipe-animating');
    entrance=content.animate(frames,options);
    entrance.onfinish=()=>{
      content.classList.remove('home-swipe-animating');
      entrance=null;
    };
  }

  function settle() {
    const content=root(), wasDragging=content?.classList.contains('home-swipe-dragging');
    const transform=wasDragging ? getComputedStyle(content).transform : 'none';
    cancel({retract:true});
    if(wasDragging && !reducedMotion()) {
      animateContent([{transform},{transform:'translateY(2px)',offset:.75},{transform:'translateY(0)'}],
        {duration:300,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }

  function goHome(fromPreview=false) {
    if (blocked()) return;
    if (state.view === destination()) {
      if(fromPreview)window.scrollTo({top:0,behavior:'instant'});
      return;
    }
    setView(destination());
    if(fromPreview)window.scrollTo({top:0,behavior:'instant'});
    if (!reducedMotion() && !fromPreview) {
      // Navigation already scrolls to the top; fade without a second position animation.
      animateContent([{opacity:.65},{opacity:1}],
        {duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    refresh();
  }

  function init() {
    grip = document.getElementById('mobileHomeGrip');
    if (!grip) return;
    liquid=grip.querySelector('.home-grip-liquid');
    neck=liquid.querySelector('.home-grip-neck');
    drop=liquid.querySelector('.home-grip-drop');
    anchor=liquid.querySelector('.home-grip-anchor');
    grip.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (HomeReveal.isCommitting()) return;
      if (!event.isPrimary || gesture) { cancel(); return; }
      if (blocked()) return;
      gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,view:state.view,distance:0,upward:false};
      entrance?.cancel();entrance=null;
      root().classList.remove('home-swipe-animating');
      grip.setPointerCapture(event.pointerId);
      HomeReveal.start(event.clientY);
      [drop,anchor].forEach(element=>element.getAnimations().forEach(animation=>animation.cancel()));
      drawLiquid(0,0,false);
      grip.classList.add('is-swiping');
    });
    grip.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx=event.clientX-gesture.x, up=gesture.y-event.clientY;
      gesture.distance = Math.max(gesture.distance,Math.hypot(dx,up));
      if (!gesture.upward) {
        if(up>=8 && up>=Math.abs(dx)*.85)gesture.upward=true;
        else if (Math.abs(dx)>24 && Math.abs(dx)>Math.abs(up) || up < -16) { settle(); return; }
      }
      const ready=gesture.upward && up>=64;
      grip.classList.toggle('is-ready',ready);
      drawLiquid(up,dx,ready);
      root().classList.add('home-swipe-dragging');
      root().style.setProperty('--home-swipe-lift',`${-Math.min(18,Math.max(0,up)*.15)}px`);
    });
    grip.addEventListener('pointerup', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const last = gesture, up=last.y-event.clientY, dx=Math.abs(event.clientX-last.x);
      const ready = last.upward && up>=64 && state.view===last.view;
      const tap = last.distance<8 && Math.hypot(dx,up)<8;
      if (ready) { cancel({preservePreview:true});HomeReveal.commit(goHome); }
      else { settle();if(tap)suppressClick=false; }
    });
    grip.addEventListener('pointercancel',settle);
    grip.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});
    grip.addEventListener('click',event=>{
      event.stopPropagation();
      if (event.detail && suppressClick) return;
      goHome();
    });
    // A second contact anywhere cancels instead of competing with pinch zoom.
    document.addEventListener('pointerdown',event=>{
      if(gesture && event.pointerId!==gesture.id)cancel();
      else if(event.isPrimary && !gesture)suppressClick=false;
    },true);
    document.addEventListener('input',refresh);
    document.addEventListener('change',refresh);
    document.addEventListener('focusin',refresh);
    document.addEventListener('focusout',()=>queueMicrotask(refresh));
    document.addEventListener('visibilitychange',cancel);
    window.addEventListener('blur',cancel);
    window.addEventListener('resize',()=>{cancel();refresh();});
    window.visualViewport?.addEventListener('resize',()=>{cancel();refresh();});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',cancel);
    const overlays = new MutationObserver(()=>{
      if ((gesture || HomeReveal.isCommitting()) && blocked()) cancel();
      refresh();
    });
    document.querySelectorAll('#modalBackdrop,#setupGate,#languageMenu,.sidebar').forEach(element=>
      overlays.observe(element,{attributes:true,attributeFilter:['hidden','class']}));
    refresh();
  }
  return {init,refresh,cancel,hasDraft,isActive:()=>Boolean(gesture) || HomeReveal.isCommitting()};
})();
