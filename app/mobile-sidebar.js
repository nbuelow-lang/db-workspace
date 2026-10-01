const MobileSidebar = (() => {
  let sidebar, toggle, backdrop, main, grip, gripAnimation, gesture = null, lastOpen, lastMobile, suppressClick = false;
  const mobile = () => matchMedia('(max-width: 940px)').matches;
  const isOpen = () => mobile() && sidebar.classList.contains('open');

  function positionGrip(edge=isOpen()?sidebar.offsetWidth:4) {
    const center=Math.max(isOpen()?22:12,edge);
    const panel=sidebar.getBoundingClientRect(),menu=toggle.getBoundingClientRect();
    const closedY=Math.max(panel.top+32,menu.y+menu.height/2);
    grip.style.setProperty('--grip-x',`${center}px`);
    grip.style.setProperty('--bar-offset',`${edge-center}px`);
    grip.style.setProperty('--grip-y',`${isOpen()?panel.top+panel.height/2:closedY}px`);
    grip.style.setProperty('--grip-height',isOpen()?'112px':'64px');
    grip.style.setProperty('--grip-width',isOpen()?'44px':'24px');
    grip.style.setProperty('--bar-height',isOpen()?'72px':'48px');
  }

  function animateGrip(opening) {
    gripAnimation?.cancel();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const box=grip.getBoundingClientRect(),panel=sidebar.getBoundingClientRect(),menu=toggle.getBoundingClientRect();
    const top=document.querySelector('.global-language-bar').getBoundingClientRect().bottom+12;
    const center=box.y+box.height/2,openY=panel.top+panel.height/2;
    const closedY=Math.max(panel.top+32,menu.y+menu.height/2);
    const reach=Math.max(36,openY-top);
    const resting={height:opening?'72px':'48px',transform:'translateY(0px)',opacity:1};
    const extended={height:`${reach+36}px`,transform:`translateY(${openY-center+(36-reach)/2}px)`,opacity:1};
    const frames=opening ? [
      {height:'48px',transform:`translateY(${closedY-center}px)`,opacity:1,offset:0},{...extended,offset:.45},{...resting,offset:1}
    ] : [
      {height:'72px',transform:`translateY(${openY-center}px)`,opacity:1,offset:0},{...extended,offset:.28},
      {height:'6px',transform:`translateY(${top-center+3}px)`,opacity:1,offset:.7},
      {height:'6px',transform:`translateY(${top-center+3}px)`,opacity:0,offset:.8},
      {...resting,opacity:0,offset:.81},{...resting,offset:1}
    ];
    gripAnimation=grip.firstElementChild.animate(frames,{duration:opening?560:640,easing:'cubic-bezier(.2,.7,.3,1)'});
  }

  function cancel() {
    gripAnimation?.cancel();
    if (gesture?.moved) suppressClick = true;
    const id = gesture?.id,target=gesture?.target,y=gesture?.lastY;
    gesture = null;
    if (id !== undefined && target?.hasPointerCapture(id)) target.releasePointerCapture(id);
    sidebar.classList.remove('is-dragging');
    sidebar.style.removeProperty('--sidebar-drag');
    grip.classList.remove('is-pressed','is-dragging');
    positionGrip();
    backdrop.hidden=!isOpen();backdrop.style.removeProperty('opacity');
    SidebarLiquid.settle(isOpen(),y);
  }

  function sync() {
    const narrow=mobile(), opened=isOpen();
    if (narrow===lastMobile && opened===lastOpen) return;
    lastMobile=narrow;lastOpen=opened;
    cancel();
    backdrop.hidden=!opened;
    grip.hidden=!narrow;
    grip.setAttribute('aria-expanded',String(opened));
    grip.setAttribute('aria-label',opened?'Seitenmenü schließen':'Seitenmenü öffnen');
    grip.title=opened?'Nach links ziehen oder antippen':'Nach rechts ziehen oder antippen';
    main.inert=opened;
    sidebar.inert=narrow && !opened;
    sidebar.setAttribute('aria-hidden',String(narrow && !opened));
    toggle.setAttribute('aria-expanded',String(opened));
    toggle.setAttribute('aria-label',opened?'Navigation schließen':'Navigation öffnen');
    if (opened) sidebar.querySelector('.nav-item:not([hidden])')?.focus();
  }

  function close(restoreFocus=true,animate=false) {
    if (!sidebar) return;
    const wasOpen=isOpen();
    cancel();
    sidebar.classList.remove('open');
    sync();
    if (wasOpen && restoreFocus) toggle.focus({preventScroll:true});
    if(wasOpen && animate)animateGrip(false);
  }

  function direction(x,y) {
    if(gesture.mode!=='pending')return gesture.mode;
    const distance=gesture.opening ? x-gesture.x : gesture.x-x,dy=Math.abs(y-gesture.y);
    if(distance>=8 && distance>=dy*.8) { gesture.mode='horizontal';gesture.moved=true; }
    else if(dy>=10 || distance<=-8) { gesture.mode='native';gesture.moved=true; }
    return gesture.mode;
  }

  function drag(x,y) {
    const width=sidebar.offsetWidth;
    const distance=Math.max(0,gesture.opening ? x-gesture.x : gesture.x-x);
    const shift=gesture.opening ? -width+Math.min(width,distance) : -Math.min(width,distance);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    gesture.lastY=y;
    sidebar.classList.add('is-dragging');
    sidebar.style.setProperty('--sidebar-drag',`${shift}px`);
    grip.classList.add('is-dragging');
    positionGrip(reduced?(isOpen()?width:4):Math.max(4,width+shift));
    backdrop.hidden=false;backdrop.style.opacity=String(1+shift/width);
    SidebarLiquid.move(reduced ? (isOpen()?0:-width) : shift,y,gesture.target===grip?0:Math.min(42,distance*.28));
  }

  function finish(x) {
    if(gesture.viewportWidth!==innerWidth || gesture.viewportHeight!==innerHeight){gesture.moved=true;cancel();return;}
    const opening=gesture.opening,y=gesture.lastY,fromGrip=gesture.target===grip;
    const distance=opening ? x-gesture.x : gesture.x-x;
    const shouldChange=gesture.mode==='horizontal' && distance>=64;
    cancel();
    if(shouldChange) {
      if(opening){sidebar.classList.add('open');sync();SidebarLiquid.settle(true,y);}
      else close(true,fromGrip);
    }
  }

  function init() {
    sidebar=document.querySelector('.sidebar');toggle=document.getElementById('mobileMenu');
    main=document.querySelector('.main-area');backdrop=document.getElementById('sidebarBackdrop');
    grip=document.createElement('button');
    grip.type='button';grip.className='sidebar-grip';grip.hidden=true;
    grip.setAttribute('aria-label','Seitenmenü schließen');
    grip.setAttribute('aria-controls',sidebar.id);
    grip.title='Nach links ziehen oder antippen';
    const bar=document.createElement('span');bar.setAttribute('aria-hidden','true');grip.append(bar);
    document.getElementById('appShell').append(grip);
    grip.addEventListener('click',()=>{
      if(isOpen())close(true,true);
      else if(!MobileHomeSwipe.isActive()) {
        sidebar.classList.add('open');sync();animateGrip(true);
      }
    });
    SidebarLiquid.init(sidebar);
    toggle.addEventListener('click',()=>{
      if(isOpen())close();else {
        sidebar.classList.add('open');sync();
        const rect=toggle.getBoundingClientRect();SidebarLiquid.settle(true,rect.y+rect.height/2,true);
      }
    });
    backdrop.addEventListener('click',event=>{event.stopPropagation();close();});
    // Non-passive touchmove lets us claim a sideways gesture before native scroll
    // starts. Once vertical scrolling wins, never switch axes during that touch.
    for(const target of [sidebar,toggle,grip]) {
    target.addEventListener('touchstart',event=>{
      const opening=target===toggle || target===grip && !isOpen();
      if(!mobile() || opening===isOpen() || event.touches.length!==1){cancel();return;}
      if(opening && MobileHomeSwipe.isActive())return;
      gripAnimation?.cancel();
      const touch=event.touches[0];
      if(target===grip)grip.classList.add('is-pressed');
      gesture={kind:'touch',target,opening,touchID:touch.identifier,x:touch.clientX,y:touch.clientY,lastY:touch.clientY,viewportWidth:innerWidth,viewportHeight:innerHeight,mode:'pending',moved:false};
    },{passive:true});
    target.addEventListener('touchmove',event=>{
      if(gesture?.kind!=='touch')return;
      if(event.touches.length!==1){cancel();return;}
      const touch=[...event.touches].find(touch=>touch.identifier===gesture.touchID);
      if(!touch)return;
      if(direction(touch.clientX,touch.clientY)!=='horizontal')return;
      if(!event.cancelable){cancel();return;}
      event.preventDefault();
      drag(touch.clientX,touch.clientY);
    },{passive:false});
    target.addEventListener('touchend',event=>{
      if(gesture?.kind!=='touch')return;
      const touch=[...event.changedTouches].find(touch=>touch.identifier===gesture.touchID);
      if(touch)finish(touch.clientX);
    },{passive:true});
    target.addEventListener('touchcancel',()=>{if(gesture?.kind==='touch')cancel();},{passive:true});
    target.addEventListener('pointerdown',event=>{
      const opening=target===toggle || target===grip && !isOpen();
      if(!mobile() || opening===isOpen() || event.pointerType==='touch' || !event.isPrimary || event.button!==0)return;
      if(opening && MobileHomeSwipe.isActive())return;
      gripAnimation?.cancel();
      const capture=target===grip ? grip : opening ? toggle : event.target.closest('.nav-item') || sidebar;
      if(target===grip)grip.classList.add('is-pressed');
      gesture={kind:'pointer',target:capture,opening,id:event.pointerId,x:event.clientX,y:event.clientY,lastY:event.clientY,viewportWidth:innerWidth,viewportHeight:innerHeight,mode:'pending',moved:false};
      capture.setPointerCapture(event.pointerId);
    });
    target.addEventListener('pointermove',event=>{
      if(gesture?.kind!=='pointer' || event.pointerId!==gesture.id)return;
      if(direction(event.clientX,event.clientY)!=='horizontal')return;
      drag(event.clientX,event.clientY);
    });
    target.addEventListener('pointerup',event=>{
      if(gesture?.kind==='pointer' && event.pointerId===gesture.id)finish(event.clientX);
    });
    target.addEventListener('pointercancel',()=>{if(gesture?.kind==='pointer')cancel();});
    target.addEventListener('lostpointercapture',event=>{
      if(event.target===gesture?.target && event.pointerId===gesture?.id)cancel();
    });
    }
    document.addEventListener('touchstart',event=>{if(event.touches.length>1)cancel();},{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{
      if(gesture && (!event.isPrimary || event.pointerType!=='touch' && event.pointerId!==gesture.id))cancel();
      else if(event.isPrimary && !gesture)suppressClick=false;
    },true);
    // Suppress the synthetic click after a drag before delegated route handlers run.
    document.addEventListener('click',event=>{
      if(event.detail && suppressClick){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('keydown',event=>{
      if(!isOpen())return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const buttons=[...sidebar.querySelectorAll('button:not([disabled])')].filter(button=>button.getClientRects().length);
      buttons.push(grip);
      const first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    });
    new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>{cancel();if(!mobile())sidebar.classList.remove('open');sync();SidebarLiquid.reset(isOpen());});
    window.visualViewport?.addEventListener('resize',()=>{cancel();SidebarLiquid.reset(isOpen());});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{cancel();SidebarLiquid.reset(isOpen());});
    window.addEventListener('blur',cancel);
    document.addEventListener('visibilitychange',cancel);
    sync();
  }
  return {init,close};
})();
