// A separate background surface keeps drawer text and native scrolling undeformed.
const SidebarLiquid = (() => {
  let panel, surface, glass, outline, path, raf=0, amplitude=0, center=0;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

  function draw(amount,y) {
    amplitude=amount;center=y;
    const rect=panel.getBoundingClientRect(),width=panel.offsetWidth,height=rect.height;
    const cy=Math.max(0,Math.min(height,y-rect.top));
    const reach=Math.min(160,height*.3);
    const top=Math.max(0,cy-reach),bottom=Math.min(height,cy+reach);
    const bulge=Math.max(0,Math.min(amount,innerWidth-width-8));
    outline.setAttribute('viewBox',`0 0 ${innerWidth} ${height}`);
    const shape=`M 0 0 H ${width} V ${top}
      C ${width} ${top+(cy-top)*.65} ${width+bulge} ${cy-(cy-top)*.35} ${width+bulge} ${cy}
      C ${width+bulge} ${cy+(bottom-cy)*.35} ${width} ${bottom-(bottom-cy)*.65} ${width} ${bottom}
      V ${height} H 0 Z`;
    path.setAttribute('d',shape);
    // Use the same contour for real backdrop blur and its light-catching rim.
    glass.style.clipPath=`path("${shape.replace(/\s+/g,' ')}")`;
    surface.dataset.bulge=String(bulge);
  }

  function init(sidebar) {
    panel=sidebar;
    surface=document.createElement('div');
    surface.classList.add('sidebar-liquid-surface');
    surface.setAttribute('aria-hidden','true');
    glass=document.createElement('div');glass.className='sidebar-liquid-glass';
    outline=document.createElementNS('http://www.w3.org/2000/svg','svg');
    outline.setAttribute('focusable','false');
    path=document.createElementNS('http://www.w3.org/2000/svg','path');
    outline.append(path);surface.append(glass,outline);document.body.append(surface);
    panel.classList.add('has-liquid-surface');
  }

  function move(shift,y,amount=0) {
    cancelAnimationFrame(raf);
    surface.classList.add('is-dragging');
    surface.style.setProperty('--liquid-shift',`${shift}px`);
    draw(reduced()?0:amount,y);
  }

  function settle(opened,y=center,pulse=false) {
    if(!surface)return;
    cancelAnimationFrame(raf);
    surface.classList.remove('is-dragging');
    surface.style.setProperty('--liquid-shift',opened?'0px':`${-panel.offsetWidth}px`);
    const start=reduced()?0:Math.max(amplitude,pulse?24:0);
    draw(start,y);
    if(!start)return;
    const began=performance.now();
    const step=now=>{
      const t=Math.min(1,(now-began)/340);
      draw(start*Math.pow(1-t,2)*(1+.25*Math.sin(t*Math.PI*3)),y);
      if(t<1)raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
  }

  function reset(opened) {
    if(!surface)return;
    cancelAnimationFrame(raf);
    surface.classList.add('is-dragging');
    surface.style.setProperty('--liquid-shift',opened?'0px':`${-panel.offsetWidth}px`);
    draw(0,panel.getBoundingClientRect().top+100);
  }
  return {init,move,settle,reset};
})();
