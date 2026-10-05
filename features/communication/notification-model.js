// Shared projection for the center and badges. Reading never completes a task.
const NotificationCenterModel = (() => {
  const areas = {
    werkraum: {name:'Anfragen',icon:'briefcase'}, control:{name:'Projekte',icon:'layers'},
    acceptance:{name:'Abnahmen',icon:'clipboard-check'}, chats:{name:'Nachrichten',icon:'mail'},
    finance:{name:'Finanzen',icon:'euro'}, partners:{name:'Partner',icon:'users'},
    smartops:{name:'Morning Control',icon:'bar-chart'}, instruments:{name:'Prüfmittel',icon:'gauge'}, time:{name:'Arbeitszeit',icon:'clock'}, imports:{name:'Import',icon:'upload'},
    orders:{name:'Aufträge',icon:'hard-hat'}
  };
  const priority = value => ({Kritisch:3,Dringend:2,Wichtig:1,Hoch:1}[value] || 0);
  const label = rank => ['Normal','Wichtig','Dringend','Kritisch'][rank];
  function timestamp(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value > 1e12 ? value : (value + (value < 1e9 ? 978307200 : 0))*1000;
    return Date.parse(value) || 0;
  }
  // tasks: prepared rows (server job steps assigned to the signed-in person).
  function entries(state, queue=[], tasks=[]) {
    const result=[], seen=new Set(), linked=new Set();
    const currentName=state.initialSetup?.fullName;
    const messages=state.operations?.projectMessages || [];
    const role=state.role || 'admin';
    const visibleAreas=role==='finance' ? ['finance'] : role==='admin' ? Object.keys(areas) : role==='pm' ? ['werkraum','control','acceptance','chats','smartops'] : role==='quality' ? ['werkraum','acceptance','chats','smartops'] : ['control','acceptance','chats','smartops'];
    function add(source, record, area, title, text, rank=0, target={}, related=[]) {
      if (!record.id || !visibleAreas.includes(area)) return;
      const key=source+':'+record.id;
      if (seen.has(key)) return;
      seen.add(key);
      const projectID=record.projectID || (source==='acceptance' ? record.id : source==='import' ? record.proposedProjectID : '') || '';
      const signature=JSON.stringify([title,text,rank,projectID,record.status,record.updatedAt,record.sentAt,record.checks]);
      const direct=source==='notification' || source==='message';
      const isRead=direct ? Boolean(record.isRead) : record.notificationReadFingerprint===signature;
      result.push({key,record,related,source,area,title,text,rank,priority:label(rank),projectID,signature,isRead,
        archived:record.notificationArchivedFingerprint===signature && rank<3,
        time:record.time || record.deadline || record.slot || '',
        timestamp:timestamp(record.updatedAt || record.sentAt || record.generatedAt),target});
    }
    for (const n of state.notifications || []) {
      const related=messages.filter(m => n.messageID===m.id || (n.sentAt != null && m.sentAt===n.sentAt && n.projectID===m.projectID && n.senderName===m.senderName && n.text===m.body));
      related.forEach(m=>linked.add(m.id));
      if (currentName && n.senderName===currentName) continue;
      const area=areas[n.area] ? n.area : ({chat:'chats',project:'control',document:'acceptance',quality:'acceptance',finance:'finance',partner:'partners',lead:'werkraum',import:'imports'}[n.kind] || 'smartops');
      add('notification',n,area,n.title || 'Mitteilung',n.text || '',priority(n.priority),{view:area},related);
    }
    for (const m of messages) {
      if (linked.has(m.id) || (currentName && m.senderName===currentName)) continue;
      add('message',m,'chats',m.senderName || 'Projektchat',m.body || '',priority(m.priority),{chat:m.projectID});
    }
    for (const d of state.deviationCases || []) {
      if (['Erledigt','Geschlossen','Abgeschlossen'].includes(d.status)) continue;
      add('deviation',d,'smartops',d.title,d.detail,priority(d.priority),{module:'deviations'});
    }
    for (const c of state.operations?.importCandidates || []) {
      if (!['Importbereit','Prüfung nötig','Mögliches Duplikat'].includes(c.status)) continue;
      add('import',c,'imports',c.title || 'Projektimport',`${c.source || 'Import'} · ${c.status}`,c.status==='Importbereit'?0:1,{import:c.id});
    }
    for (const g of state.photoGateAssessments || []) {
      if (['Bestanden','Freigegeben','Abgeschlossen'].includes(g.status)) continue;
      add('gate',g,'acceptance',g.gateName || 'Foto-Prüfung',[g.status,...(g.findings || [])].join(' · '),1,{module:'photo'});
    }
    for (const a of queue) {
      if (['Freigegeben','Abgeschlossen','Bestanden'].includes(a.status)) continue;
      add('acceptance',a,'acceptance',`Abnahme ${a.city || a.id}`,`${a.status || 'Offen'} · ${(a.checks || []).filter(([,ok])=>!ok).length} Prüfpunkte offen`,1,{acceptance:a.id});
    }
    for (const t of tasks) add('task',t,t.area || 'orders',t.title,t.text,t.rank || 1,t.target || {order:t.orderID});
    for (const invoice of state.automatedInvoices || []) {
      if (invoice.status!=='Abrechnungsbereit') continue;
      add('invoice',invoice,'finance','Abrechnung prüfen',`${invoice.projectID} · ${invoice.status}`,1,{module:'billing'});
    }
    return result.sort((a,b)=>b.rank-a.rank || Number(a.isRead)-Number(b.isRead) || b.timestamp-a.timestamp || a.key.localeCompare(b.key));
  }
  function filter(items, mode='all') {
    return items.filter(item=>mode==='archive' ? item.archived : !item.archived && (mode!=='unread' || !item.isRead) && (mode!=='urgent' || item.rank>=2));
  }
  function groups(items, mode='area') {
    const grouped=new Map();
    for (const item of items) {
      const key=mode==='project' ? item.projectID || 'general' : item.area;
      if (!grouped.has(key)) grouped.set(key,{key,title:mode==='project' ? item.projectID || 'Ohne Projektbezug' : areas[item.area].name,icon:mode==='project'?'building':areas[item.area].icon,items:[]});
      grouped.get(key).items.push(item);
    }
    return [...grouped.values()].sort((a,b)=>b.items[0].rank-a.items[0].rank || b.items.filter(i=>!i.isRead).length-a.items.filter(i=>!i.isRead).length || b.items[0].timestamp-a.items[0].timestamp);
  }
  function badges(items) {
    const counts=Object.fromEntries(Object.keys(areas).map(key=>[key,0]));
    items.filter(item=>!item.isRead && !item.archived).forEach(item=>counts[item.area]++);
    return counts;
  }
  function read(item, value=true) {
    if (['notification','message'].includes(item.source)) item.record.isRead=value;
    else if (value) item.record.notificationReadFingerprint=item.signature;
    else delete item.record.notificationReadFingerprint;
    if (item.source==='notification') item.record.deliveryStatus=value?'Gelesen':'Ungelesen';
    for (const related of item.related) related.isRead=value;
  }
  function archive(item, value=true) {
    if (value && item.rank===3) return false;
    if (value) {item.record.notificationArchivedFingerprint=item.signature;read(item,true);}
    else delete item.record.notificationArchivedFingerprint;
    return true;
  }
  return {areas,entries,filter,groups,badges,read,archive};
})();
