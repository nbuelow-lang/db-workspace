// A read-only destination render, never a second mounted application.
const HomeReveal = (() => {
  let layer, frame, animation, committing=false, startY=0, geometry;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const destination=()=>state.role==='finance' ? 'finance' : 'dashboard';

  function cancel() {
    animation?.cancel();animation=null;committing=false;
    layer?.remove();layer=null;frame=null;geometry=null;
  }

  function start(y) {
    cancel();
    if(reduced())return;
    startY=y;
    layer=document.createElement('div');
    layer.className='home-reveal';layer.inert=true;layer.setAttribute('aria-hidden','true');
    frame=document.createElement('div');frame.className='home-reveal-frame';
    const language=document.querySelector('.global-language-bar').cloneNode(true);
    const header=document.querySelector('.topbar').cloneNode(true);
    const meta={admin:['BÜLOW & DOLZ','Arbeitsplatz'],pm:['BÜLOW & DOLZ PM','Projektmanagement Cockpit'],
      quality:['BÜLOW & DOLZ QUALITY','Bauleitung / QM'],finance:['BÜLOW & DOLZ','Finanzen']};
    const [eyebrow,title]=meta[state.role] || ['BÜLOW & DOLZ','Partner Cockpit'];
    header.querySelector('#pageEyebrow').textContent=eyebrow;
    header.querySelector('#pageTitle').textContent=title;
    header.querySelector('#roleSelect').value=state.role;
    for(const selector of ['#syncStatus','#syncStatusText']) {
      header.querySelector(selector).style.display=getComputedStyle(document.querySelector(selector)).display;
    }
    header.querySelector('.topbar-actions').style.gridTemplateColumns=getComputedStyle(document.querySelector('.topbar-actions')).gridTemplateColumns;
    header.querySelector('.notification-dot')?.classList.add('workspace-notification-badge');
    const content=document.createElement('div');content.className='content';
    content.innerHTML=state.role==='finance' ? renderFinance(state.role,{preview:true}) : renderDashboard(state.role,{preview:true});
    const nav=document.querySelector('.mobile-bottom-nav').cloneNode(true);
    nav.querySelector('.home-grip-liquid')?.remove();
    nav.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===destination()));
    frame.append(language,header,document.getElementById('adminPreviewBar').cloneNode(true));
    const backendBar=document.getElementById('backendBar');
    if(backendBar)frame.append(backendBar.cloneNode(true));
    frame.append(content,nav);
    hydrateIcons(frame);updateNotificationBadges(frame);
    // No duplicate IDs, focus targets, live regions or delegated actions in the preview.
    frame.querySelectorAll('*').forEach(element=>{
      if(element.id)element.id='home-preview-'+element.id;
      for(const attribute of ['autofocus','aria-live','aria-controls','aria-labelledby','data-action','data-view'])element.removeAttribute(attribute);
      if(element.matches('button,input,select,textarea,a,[tabindex]'))element.setAttribute('tabindex','-1');
    });
    layer.append(frame);document.body.append(layer);
  }

  function update(up,x,y,baseRadius) {
    if(!layer)return baseRadius;
    const progress=Math.max(0,Math.min(1,(up-110)/Math.max(160,startY*.68-110)));
    const cover=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+2;
    const radius=baseRadius+cover*progress*progress;
    const reveal=Math.min(1,progress/0.82);
    const opacity=reveal*reveal*(3-2*reveal);
    geometry={x,y,radius,cover,opacity};
    layer.style.clipPath=`circle(${radius}px at ${x}px ${y}px)`;
    layer.style.visibility=up>64 ? 'visible' : 'hidden';
    frame.style.opacity=opacity;
    frame.style.filter=`blur(${(1-opacity)*7}px)`;
    layer.dataset.progress=String(progress);
    return radius;
  }

  function retract() {
    if(!layer)return;
    animation?.cancel();committing=false;
    const element=layer;
    animation=element.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out'});
    animation.finished.then(()=>{if(layer===element)cancel();}).catch(()=>{});
  }

  function commit(navigate) {
    if(!layer || !geometry || reduced()){cancel();navigate(false);return;}
    committing=true;
    const element=layer,role=state.role,view=state.view;
    const {x,y,cover,radius}=geometry;
    element.style.visibility='visible';
    frame.style.transition='opacity 180ms ease,filter 180ms ease';
    frame.style.opacity='1';frame.style.filter='blur(0px)';
    animation=element.animate([
      {clipPath:`circle(${radius}px at ${x}px ${y}px)`},
      {clipPath:`circle(${Math.max(radius,cover)}px at ${x}px ${y}px)`}
    ],{duration:200,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});
    animation.finished.then(()=>{
      if(layer!==element || role!==state.role || view!==state.view)return;
      try { navigate(true); } finally { cancel(); }
    }).catch(()=>{});
  }
  return {start,update,cancel,retract,commit,isCommitting:()=>committing};
})();
