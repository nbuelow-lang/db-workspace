// The in-app grip leaves Safari edge navigation and the iOS home gesture alone.
const MobileHomeSwipe = (() => {
  let grip, gesture = null, entrance = null, suppressClick = false;
  let liquid, neck, drop, anchor, detached = false;
  const root = () => document.getElementById('viewRoot');
  const destination = () => state.role === 'finance' ? 'finance' : 'dashboard';
  const visible = element => element && !element.hidden && element.getClientRects().length > 0;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Liquid geometry in SVG units (1 unit = 1 CSS px; base center 80/120, resting drop 80/94).
  // The drop follows the finger sideways almost 1:1 up to the screen edge (soft limit), so it can be played with.
  let shine, house, wobble = 0, wobbleAngle = 0, spring = null;
  function sideways(dx) {
    const bounds = grip.getBoundingClientRect(), center = bounds.x + bounds.width / 2;
    const limit = Math.max(20, (dx < 0 ? center : innerWidth - center) - 34);
    return limit * Math.tanh(dx / limit);
  }

  // The neck tears at 52px stretch in any direction (reconnects below 44px); going home still needs 64px up.
  const TEAR=52, MEND=44;
  function drawLiquid(up, dx, ready, {reveal = true, speed = 0, angle = 0, snap = true} = {}) {
    if (reducedMotion()) return;
    const distance=Math.max(0,up), beyondSnap=Math.max(0,distance-64);
    const ox=sideways(dx), x=80+ox;
    // After detaching, follow the finger 1:1 and keep growing without a height cap.
    const y=94-distance*.7-beyondSnap*.3;
    const stretch=Math.hypot(ox,distance*.7);
    const free=ready || stretch>=(detached ? MEND : TEAR);
    const p=Math.min(1,stretch/TEAR);
    const r=free ? 22+beyondSnap*.12 : 26-4*p, a=36-22*p;
    if (reveal) {
      const bounds=grip.getBoundingClientRect();
      HomeReveal.update(distance,bounds.x+bounds.width/2+x-80,bounds.y-98+y,r);
    }
    // The puddle slides a little towards the drop.
    const bx=80+ox*.22, by=120;
    let ux=x-bx, uy=y-by;
    const length=Math.hypot(ux,uy)||1; ux/=length; uy/=length;
    const nx=-uy, ny=ux, h=r*.75;
    const jx=x-ux*r*.66, jy=y-uy*r*.66;
    const mx=bx+(x-bx)*.38, my=by+(y-by)*.38, waist=Math.max(1.3,10-8.7*p);
    const upper=Math.hypot(jx-mx,jy-my)*.5, lower=Math.hypot(mx-bx,my-by)*.5;
    const P=(px,py)=>`${px.toFixed(2)} ${py.toFixed(2)}`;
    drop.setAttribute('cx',x);drop.setAttribute('cy',y);drop.setAttribute('r',r);
    // Concave sides along the pull direction form a narrowing neck between base and drop.
    neck.setAttribute('d',`M ${P(jx-nx*h,jy-ny*h)}
      C ${P(jx-nx*h-ux*upper,jy-ny*h-uy*upper)} ${P(mx-nx*waist+ux*upper,my-ny*waist+uy*upper)} ${P(mx-nx*waist,my-ny*waist)}
      C ${P(mx-nx*waist-ux*lower,my-ny*waist-uy*lower)} ${P(bx-a,by-lower)} ${P(bx-a,by)}
      Q ${P(bx,by+5)} ${P(bx+a,by)}
      C ${P(bx+a,by-lower)} ${P(mx+nx*waist-ux*lower,my+ny*waist-uy*lower)} ${P(mx+nx*waist,my+ny*waist)}
      C ${P(mx+nx*waist+ux*upper,my+ny*waist+uy*upper)} ${P(jx+nx*h-ux*upper,jy+ny*h-uy*upper)} ${P(jx+nx*h,jy+ny*h)} Z`);
    neck.style.opacity=free ? '0' : '1';
    anchor.setAttribute('cx',free ? 80 : bx);
    anchor.setAttribute('rx',free ? 52 : 52-12*p);
    anchor.setAttribute('ry',free ? 3 : 4+2*p);
    // Squash and stretch along the movement, smoothed so the drop wobbles instead of jittering.
    wobble=wobble*.6+Math.min(.16,speed*.07)*.4;
    if (speed>.05) wobbleAngle=angle;
    const deg=wobbleAngle*180/Math.PI;
    drop.style.transform=wobble>.005 ? `rotate(${deg}deg) scale(${1+wobble},${1-wobble*.8}) rotate(${-deg}deg)` : '';
    if (house) {
      // Sized to the drop; gone after about 40px of upward pull or once the drop tears off.
      const scale=r*.95/18;
      house.setAttribute('transform',`translate(${(x-12*scale).toFixed(2)} ${(y-12*scale).toFixed(2)}) scale(${scale.toFixed(3)})`);
      house.style.opacity=free ? '0' : String(Math.max(0,1-distance/40));
    }
    if (shine) {
      shine.setAttribute('cx',x-r*.36);shine.setAttribute('cy',y-r*.4);
      shine.setAttribute('rx',r*.3);shine.setAttribute('ry',r*.18);
    }
    if(free!==detached) {
      drop.getAnimations().forEach(animation=>animation.cancel());
      anchor.getAnimations().forEach(animation=>animation.cancel());
      if(free && snap) {
        drop.animate([
          {transform:'translateY(3px) scale(.8,1.22)'},
          {transform:'translateY(-5px) scale(1.15,.85)',offset:.45},
          {transform:'translateY(0) scale(1)'}
        ],{duration:340,easing:'cubic-bezier(.2,.8,.3,1)'});
        anchor.animate([{transform:'scaleX(.65)'},{transform:'scaleX(1.1)',offset:.65},{transform:'scaleX(1)'}],
          {duration:300,easing:'ease-out'});
      }
    }
    detached=free;
  }

  // Released without going home: the drop springs back into the base while the liquid fades out.
  function springBack(up, dx) {
    stopSpring();
    if (reducedMotion() || (Math.abs(up)<4 && Math.abs(dx)<4)) return;
    const begin=performance.now(), duration=260;
    const step=now=>{
      const t=Math.min(1,(now-begin)/duration);
      // Damped oscillation: overshoots slightly below the rest position, like a settling liquid.
      const k=Math.exp(-5*t)*Math.cos(t*Math.PI*1.6);
      drawLiquid(Math.min(63,up)*k,dx*k,false,{reveal:false,snap:false});
      spring=t<1 ? requestAnimationFrame(step) : null;
    };
    spring=requestAnimationFrame(step);
  }
  function stopSpring() { if (spring) cancelAnimationFrame(spring); spring=null; }

  // While the finger rests, the squash relaxes back into a round drop.
  let relaxing=null;
  function relax() {
    if (relaxing) return;
    const step=()=>{
      relaxing=null;
      if (!gesture || wobble<=.005) { if(!gesture && drop)drop.style.transform=''; return; }
      drawLiquid(gesture.up,gesture.dx,gesture.up>=64,{reveal:false});
      relaxing=requestAnimationFrame(step);
    };
    relaxing=requestAnimationFrame(step);
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
    detached=false;wobble=0;
    if(drop)drop.style.transform='';
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
    const last=gesture ? {up:gesture.up||0,dx:gesture.dx||0} : null;
    cancel({retract:true});
    if(last)springBack(last.up,last.dx);
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
    shine=liquid.querySelector('.home-grip-shine');
    house=liquid.querySelector('.home-grip-house');
    grip.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (HomeReveal.isCommitting()) return;
      if (!event.isPrimary || gesture) { cancel(); return; }
      if (blocked()) return;
      stopSpring();
      gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,view:state.view,distance:0,up:0,dx:0,
        last:{x:event.clientX,y:event.clientY,t:event.timeStamp}};
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
      // Sideways play is allowed; only a clear downward pull gives up.
      if (up < -16) { settle(); return; }
      const last=gesture.last, dt=Math.max(8,event.timeStamp-last.t);
      const speed=Math.hypot(event.clientX-last.x,event.clientY-last.y)/dt, angle=Math.atan2(event.clientY-last.y,event.clientX-last.x);
      gesture.last={x:event.clientX,y:event.clientY,t:event.timeStamp};gesture.up=up;gesture.dx=dx;
      const ready=up>=64;
      grip.classList.toggle('is-ready',ready);
      drawLiquid(up,dx,ready,{speed,angle});
      relax();
      root().classList.add('home-swipe-dragging');
      root().style.setProperty('--home-swipe-lift',`${-Math.min(18,Math.max(0,up)*.15)}px`);
    });
    grip.addEventListener('pointerup', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const last = gesture, up=last.y-event.clientY, dx=Math.abs(event.clientX-last.x);
      const ready = up>=64 && state.view===last.view;
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
