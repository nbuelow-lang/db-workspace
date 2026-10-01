// Device-local layout only. Project state and permissions never enter this store.
const WorkspaceArrange = (() => {
  let editing=false, draft=null, gesture=null, ghost=null, timer=0, frame=0, suppressUntil=0;
  const home=()=>document.querySelector('.workspace-home');
  const grid=()=>document.querySelector('.workspace-apps');
  const buttons=()=>[...(grid()?.querySelectorAll('.workspace-app') || [])];
  const key=()=> 'bd-workspace-order-v1:'+AdminPreview.storageKey;
  const defaults=()=>workspaceAreas.map(area=>area.view);
  function normalize(order) {
    const known=defaults();
    return [...new Set([...(Array.isArray(order)?order:[]),...known])].filter(id=>known.includes(id));
  }
  function saved() {
    try { return normalize(JSON.parse(localStorage.getItem(key()))); } catch { return defaults(); }
  }
  function areas(items) {
    return (draft || saved()).map(id=>items.find(area=>area.view===id)).filter(Boolean);
  }
  function announce(text) {
    const status=document.getElementById('workspaceArrangeStatus');
    if(status) status.textContent=text;
  }
  function arrangeDOM(order,animate=true) {
    const elements=buttons(), before=new Map(elements.map(el=>[el,el.getBoundingClientRect()]));
    elements.forEach(el=>el.getAnimations().forEach(animation=>animation.cancel()));
    const container=grid();
    if(!container)return;
    order.forEach(id=>{const el=elements.find(el=>el.dataset.target===id);if(el)container.append(el);});
    if(animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for(const el of elements) {
        const a=before.get(el),b=el.getBoundingClientRect();
        if(a.x!==b.x || a.y!==b.y) el.animate([{transform:`translate(${a.x-b.x}px,${a.y-b.y}px)`},{transform:'none'}],{duration:160,easing:'ease-out'});
      }
    }
  }
  function mount() {
    if(!home()) { cancelGesture(); editing=false;draft=null;return; }
    home().classList.toggle('is-arranging',editing);
    document.querySelectorAll('[data-workspace-arrange]').forEach(el=>{el.hidden=(el.dataset.workspaceArrange==='edit')===editing;});
    const search=document.getElementById('workspaceSearch');
    if(search)search.disabled=editing;
    buttons().forEach(el=>{
      if(editing) {
        el.setAttribute('aria-describedby','workspaceArrangeHelp');
        el.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown');
      } else {el.removeAttribute('aria-describedby');el.removeAttribute('aria-keyshortcuts');}
    });
  }
  function enter() {
    if(!home() || document.getElementById('workspaceSearch')?.value.trim())return false;
    if(!editing){draft=buttons().map(el=>el.dataset.target);editing=true;mount();announce('Anordnen aktiv. Arbeitsbereiche mit Ziehen oder Pfeiltasten verschieben.');}
    return true;
  }
  function finish(commit) {
    cancelGesture();
    if(!editing)return;
    let failed=false;
    if(commit) {
      try { localStorage.setItem(key(),JSON.stringify(draft)); }
      catch { failed=true; }
    }
    if(!commit) arrangeDOM(saved(),false);
    editing=false;draft=null;mount();
    announce(failed?'Reihenfolge konnte nicht dauerhaft gespeichert werden.':commit?'Reihenfolge gespeichert.':'Anordnung verworfen.');
    if(failed)showToast('Speichern nicht möglich','Der Browser erlaubt derzeit keine lokale Speicherung.','warning');
    document.querySelector('[data-workspace-arrange="edit"]')?.focus({preventScroll:true});
  }
  function clearTimer(){clearTimeout(timer);timer=0;}
  function startDrag(point) {
    if(!gesture || !gesture.button.isConnected || !enter()) {cancelGesture();return;}
    gesture.active=true;gesture.before=[...draft];
    const visual=gesture.button.querySelector('.workspace-app-visual'),rect=visual.getBoundingClientRect();
    gesture.offsetX=point.x-rect.x;gesture.offsetY=point.y-rect.y;
    ghost=visual.cloneNode(true);ghost.classList.add('workspace-drag-ghost');ghost.setAttribute('aria-hidden','true');
    ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';
    document.body.append(ghost);gesture.button.classList.add('is-drag-source');
    positionGhost(point);
    announce(gesture.button.querySelector('.workspace-app-label').textContent+' ausgewählt.');
  }
  function positionGhost(point) {
    if(!ghost || !gesture)return;
    ghost.style.transform=`translate3d(${point.x-gesture.offsetX}px,${point.y-gesture.offsetY}px,0) scale(1.08)`;
  }
  function moveTo(index) {
    const source=gesture?.button || document.activeElement;
    if(!source?.matches('.workspace-app') || !draft)return;
    const from=draft.indexOf(source.dataset.target),to=Math.max(0,Math.min(draft.length-1,index));
    if(from===to || from<0)return;
    const [id]=draft.splice(from,1);draft.splice(to,0,id);arrangeDOM(draft);
    announce(source.querySelector('.workspace-app-label').textContent+` · Position ${to+1} von ${draft.length}`);
  }
  function targetAt(point) {
    const bounds=grid()?.getBoundingClientRect();
    if(!bounds || point.x<bounds.left || point.x>bounds.right || point.y<bounds.top || point.y>bounds.bottom)return;
    const entries=buttons().map((el,index)=>{const r=el.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return {index,distance:Math.hypot(point.x-r.x+m.e-r.width/2,point.y-r.y+m.f-r.height/2)};});
    entries.sort((a,b)=>a.distance-b.distance);
    if(entries[0])moveTo(entries[0].index);
  }
  function scrollFrame() {
    if(!gesture?.active || !gesture.moved)return;
    const point=gesture.point;
    const top=Math.max(document.querySelector('.global-language-bar')?.getBoundingClientRect().bottom || 0,document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0)+24;
    const nav=document.querySelector('.mobile-bottom-nav');
    const bottom=innerHeight-(nav?.getClientRects().length?nav.getBoundingClientRect().height:0)-55;
    const bounds=grid()?.getBoundingClientRect();
    const speed=point.y<top && bounds?.top<top?-Math.min(12,(top-point.y)/4):point.y>bottom && bounds?.bottom>bottom?Math.min(12,(point.y-bottom)/4):0;
    if(speed){window.scrollBy({top:speed,behavior:'instant'});targetAt(point);}
    frame=requestAnimationFrame(scrollFrame);
  }
  function begin(button,point,type,id) {
    if(!button || gesture || document.getElementById('workspaceSearch')?.value.trim())return;
    if(!editing)suppressUntil=0;
    gesture={button,type,id,start:point,point,active:false,moved:false};
    if(editing)startDrag(point);
    else timer=setTimeout(()=>{timer=0;startDrag(gesture?.point || point);},500);
  }
  function move(point,event) {
    if(!gesture)return;
    gesture.point=point;
    const distance=Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y);
    if(!gesture.active){if(distance>10)cancelGesture();return;}
    if(event.cancelable)event.preventDefault();
    positionGhost(point);
    if(distance>6) {
      if(!gesture.moved){gesture.moved=true;frame=requestAnimationFrame(scrollFrame);}
      targetAt(point);
    }
  }
  function end(cancel=false) {
    clearTimer();cancelAnimationFrame(frame);frame=0;
    if(gesture?.active){
      suppressUntil=Date.now()+650;
      if(cancel && gesture.before){draft=[...gesture.before];arrangeDOM(draft,false);}
      gesture.button.classList.remove('is-drag-source');
    }
    ghost?.remove();ghost=null;gesture=null;
  }
  function cancelGesture(){end(true);}
  function point(event){return {x:event.clientX,y:event.clientY};}
  function init() {
    document.addEventListener('pointerdown',event=>{
      if(event.pointerType==='touch' || event.button!==0 || !event.isPrimary)return;
      begin(event.target.closest('.workspace-app'),point(event),'pointer',event.pointerId);
    });
    document.addEventListener('pointermove',event=>{if(gesture?.type==='pointer' && gesture.id===event.pointerId)move(point(event),event);});
    document.addEventListener('pointerup',event=>{if(gesture?.type==='pointer' && gesture.id===event.pointerId)end();});
    document.addEventListener('pointercancel',event=>{if(gesture?.type==='pointer' && gesture.id===event.pointerId)cancelGesture();});
    document.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){cancelGesture();return;}
      const touch=event.touches[0];
      begin(event.target.closest('.workspace-app'),point(touch),'touch',touch.identifier);
    },{passive:true});
    // Cancel native panning only after a deliberate long press; normal scrolling stays native.
    document.addEventListener('touchmove',event=>{
      if(gesture?.type!=='touch')return;
      const touch=[...event.touches].find(t=>t.identifier===gesture.id);
      if(touch)move(point(touch),event);
    },{passive:false});
    document.addEventListener('touchend',event=>{
      if(gesture?.type!=='touch')return;
      if(![...event.changedTouches].some(t=>t.identifier===gesture.id))return;
      if(gesture.active && event.cancelable)event.preventDefault();
      end();
    },{passive:false});
    document.addEventListener('touchcancel',()=>{if(gesture?.type==='touch')cancelGesture();},{passive:true});
    document.addEventListener('contextmenu',event=>{if(event.target.closest('.workspace-app'))event.preventDefault();});
    document.addEventListener('dragstart',event=>{if(event.target.closest('.workspace-app'))event.preventDefault();});
    document.addEventListener('click',event=>{
      const control=event.target.closest('[data-workspace-arrange]');
      if(control){
        event.preventDefault();event.stopImmediatePropagation();
        if(control.dataset.workspaceArrange==='edit')enter();
        if(control.dataset.workspaceArrange==='done')finish(true);
        if(control.dataset.workspaceArrange==='cancel')finish(false);
        if(control.dataset.workspaceArrange==='reset'){cancelGesture();draft=defaults();arrangeDOM(draft);announce('Standardanordnung wiederhergestellt.');}
        return;
      }
      if(event.target.closest('.workspace-app') && (editing || Date.now()<suppressUntil)){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('keydown',event=>{
      if(!editing || !home() || !document.getElementById('modalBackdrop').hidden)return;
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();
        if(gesture?.active)cancelGesture();else finish(false);
        return;
      }
      const button=event.target.closest('.workspace-app');
      if(!button || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopImmediatePropagation();
      const cols=getComputedStyle(grid()).gridTemplateColumns.split(' ').length;
      const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[event.key];
      moveTo(draft.indexOf(button.dataset.target)+step);button.focus({preventScroll:true});button.scrollIntoView({block:'nearest'});
    },true);
    window.addEventListener('blur',cancelGesture);
    window.addEventListener('resize',cancelGesture);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
  }
  return {areas,mount,init,beforeRender:cancelGesture,isEditing:()=>editing};
})();
