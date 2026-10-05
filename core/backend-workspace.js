// Optional web-only transport, activated exclusively by the authenticated backend.
const BackendWorkspace = (() => {
  const enabled = Boolean(window.BD_BACKEND?.enabled);
  const fields = ['bids','notifications','werkraumLeads','onboarding','operations','copilotTasks','photoGateAssessments','autopilotProposals','teamMatchSuggestions','deploymentPlans','deviationCases','automatedInvoices','academyRecommendations'];
  const operationsFields = ['projectEdits','projectManagers','importCandidates','projectMessages','lastImportAt'];
  const draftKey = enabled ? `bd-server-draft-${BD_BACKEND.workspaceID}` : '';
  let revision = null, baseline = '', dirty = false, sending = false, conflict = false, timer, pollTimer, starting = false, changeVersion = 0, polling = false;

  function snapshot() {
    const saved = {};
    for (const field of fields) saved[field] = structuredClone(state[field] ?? (field === 'onboarding' || field === 'operations' ? {} : []));
    saved.operations = Object.fromEntries(operationsFields.map(key => [key, structuredClone(state.operations?.[key] ?? (key === 'projectEdits' ? {} : key === 'lastImportAt' ? null : []))]));
    return structuredClone({schemaVersion:1,state:saved,projects,activeProjects,acceptanceQueue,partnerPipeline});
  }

  function apply(data) {
    if (!data || data.schemaVersion !== 1) throw Error(I18n.t('Unbekanntes Datenformat'));
    const operationsUI = {importSource:state.operations?.importSource,activeChatProjectID:state.operations?.activeChatProjectID};
    for (const field of fields) state[field] = structuredClone(data.state[field]);
    state.operations = {...state.operations,...operationsUI};
    for (const [target,source] of [[projects,data.projects],[activeProjects,data.activeProjects],[acceptanceQueue,data.acceptanceQueue],[partnerPipeline,data.partnerPipeline]]) target.splice(0,target.length,...structuredClone(source));
  }

  function status(message, failed=false) {
    document.getElementById('backendStatus').textContent = message;
    document.getElementById('backendBar').classList.toggle('has-error',failed);
    document.getElementById('backendReload').hidden = !conflict;
    document.getElementById('backendExport').hidden = !dirty;
    document.getElementById('backendRetry').hidden = !failed || conflict;
  }

  async function request(method='GET', body) {
    const response = await fetch('/api/workspace', {method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','X-BD-CSRF':BD_BACKEND.csrf},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(12000)});
    if (response.status === 409) {conflict=true;throw Error(I18n.t('Anderer Serverstand. Dein Entwurf bleibt lokal erhalten.'));}
    if (response.status === 401) throw Error(I18n.t('Sitzung abgelaufen. Bitte erneut anmelden; dein Entwurf bleibt erhalten.'));
    if (!response.ok) throw Error(I18n.t('Serverfehler {status}. Änderungen bleiben lokal.', {status:response.status}));
    return response.json();
  }

  function rememberDraft(data=snapshot()) {
    localStorage.setItem(draftKey,JSON.stringify({baseRevision:revision,data}));
  }

  function schedule() {
    if (!enabled || revision === null) return;
    changeVersion++;
    const data=snapshot();
    dirty=JSON.stringify(data)!==baseline;
    if (!dirty) {
      if (!sending && !conflict) {localStorage.removeItem(draftKey);clearTimeout(timer);status(I18n.t('Server · gespeichert · Stand {n}', {n:revision}));}
      return;
    }
    try {rememberDraft(data);} catch {status(I18n.t('Lokaler Speicher voll. Bitte Entwurf sichern und Seite offen lassen.'),true);return;}
    if (conflict) {status(I18n.t('Speicherkonflikt. Dein Entwurf bleibt lokal erhalten.'),true);return;}
    status(I18n.t('Änderungen werden gespeichert …'));
    clearTimeout(timer);timer=setTimeout(push,350);
  }

  async function push() {
    if (!dirty || sending || conflict || revision === null) return;
    sending=true;
    const data=snapshot(), encoded=JSON.stringify(data);
    try {
      const result=await request('PUT',{baseRevision:revision,data});
      revision=result.revision;baseline=encoded;dirty=JSON.stringify(snapshot())!==encoded;
      if (!dirty) localStorage.removeItem(draftKey);else rememberDraft();
      status(I18n.t('Server · gespeichert · Stand {n}', {n:revision}));
    } catch (error) {status(error.message,true);}
    finally {sending=false;}
    if (dirty && !conflict) {clearTimeout(timer);timer=setTimeout(push,4000);}
  }

  async function poll() {
    if (!enabled || revision === null || sending || conflict || polling) return;
    if (dirty) {await push();return;}
    if (PullRefresh.isActive() || MobileHomeSwipe.isActive() || document.querySelector('.workspace-home.is-arranging') || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || !document.getElementById('modalBackdrop').hidden) return;
    const observedVersion = changeVersion, observedRevision = revision;
    polling = true;
    try {
      const result=await request();
      // A read started before a local edit must never replace that edit.
      if (dirty || sending || changeVersion !== observedVersion || revision !== observedRevision) return;
      if (PullRefresh.isActive() || MobileHomeSwipe.isActive() || document.querySelector('.workspace-home.is-arranging') || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || !document.getElementById('modalBackdrop').hidden) return;
      if (result.revision !== revision) {
        if (!result.data) throw Error(I18n.t('Serverdaten fehlen. Kein automatisches Überschreiben.'));
        apply(result.data);revision=result.revision;baseline=JSON.stringify(snapshot());render();
      }
      status(I18n.t('Server · gespeichert · Stand {n}', {n:revision}));
    } catch (error) {status(error.message,true);}
    finally {polling=false;}
  }

  function exportDraft() {
    const url=URL.createObjectURL(new Blob([JSON.stringify({baseRevision:revision,data:snapshot()},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='Buelow-Dolz-Entwurf.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function reloadServer() {
    if (!confirm(I18n.t('Lokale Änderungen verwerfen und Serverstand laden? Den Entwurf bei Bedarf vorher sichern.'))) return;
    try {
      const result=await request();
      if (!result.data) throw Error(I18n.t('Kein Serverstand vorhanden.'));
      apply(result.data);revision=result.revision;baseline=JSON.stringify(snapshot());dirty=false;conflict=false;localStorage.removeItem(draftKey);render();status(I18n.t('Server · gespeichert · Stand {n}', {n:revision}));
    } catch (error) {status(error.message,true);}
  }

  async function logout() {
    if (dirty && !confirm(I18n.t('Ungespeicherte Änderungen bleiben als lokaler Entwurf erhalten. Trotzdem abmelden?'))) return;
    const response=await fetch('/api/logout',{method:'POST',headers:{'X-BD-CSRF':BD_BACKEND.csrf},credentials:'same-origin'});
    if (response.ok || response.status===401) {dirty=false;location.assign('/login');}
    else status(I18n.t('Abmelden fehlgeschlagen. Bitte erneut versuchen.'),true);
  }

  const languageKey = enabled ? `bd-language-${BD_BACKEND.user?.username || 'shared'}` : '';
  function rememberLanguage(code) { try { localStorage.setItem(languageKey, code); } catch {} }

  function prepare(userState) {
    if (!enabled) return;
    // A language picked on the login page wins once and is then remembered for this person.
    let stored = null, picked = null;
    try { stored = localStorage.getItem(languageKey); picked = sessionStorage.getItem('bd-login-language-pick'); sessionStorage.removeItem('bd-login-language-pick'); } catch {}
    if (picked) rememberLanguage(picked);
    userState.language = picked || stored || BD_BACKEND.user?.language || 'de';
    userState.role='admin';userState.view='dashboard';
    userState.initialSetup={...userState.initialSetup,completed:true,role:'GEP Administration',fullName:BD_BACKEND.user?.name || BD_BACKEND.displayName,companyName:'Bülow & Dolz',email:'server-test@example.invalid'};
    userState.session={authenticated:true,email:'server-test@example.invalid',error:''};
  }

  async function start() {
    if (!enabled || starting) return;
    starting=true;
    if (!document.getElementById('backendBar')) {
      const bar=document.createElement('aside');bar.id='backendBar';bar.className='backend-bar';bar.setAttribute('aria-label','Serverstatus');
      bar.innerHTML='<div><strong><span data-i18n="Server-Testbetrieb">'+I18n.t('Server-Testbetrieb')+'</span> · '+escapeAttr(BD_BACKEND.user?.name || BD_BACKEND.displayName)+'</strong><span id="backendStatus" role="status">'+I18n.t('Verbindung wird hergestellt …')+'</span></div><div class="backend-actions"><button id="backendExport" data-i18n="Entwurf sichern" hidden>'+I18n.t('Entwurf sichern')+'</button><button id="backendReload" data-i18n="Serverstand laden" hidden>'+I18n.t('Serverstand laden')+'</button><button id="backendRetry" data-i18n="Erneut verbinden" hidden>'+I18n.t('Erneut verbinden')+'</button><button id="backendLogout" data-i18n="Abmelden">'+I18n.t('Abmelden')+'</button></div>';
      document.getElementById('viewRoot').before(bar);
      document.getElementById('backendExport').onclick=exportDraft;
      document.getElementById('backendReload').onclick=reloadServer;
      document.getElementById('backendRetry').onclick=()=>revision===null ? start() : poll();
      document.getElementById('backendLogout').onclick=()=>logout().catch(()=>status(I18n.t('Keine Verbindung zum Server.'),true));
      const loading=document.createElement('div');loading.id='backendLoading';loading.className='backend-loading';loading.innerHTML='<div><strong>'+I18n.t('Server-Arbeitsplatz wird geladen')+'</strong><p id="backendLoadingStatus">'+I18n.t('Bitte warten …')+'</p><button id="backendLoadRetry" hidden>'+I18n.t('Erneut versuchen')+'</button></div>';document.body.append(loading);
      document.getElementById('backendLoadRetry').onclick=start;
      window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
    }
    try {
      const result=await request();revision=result.revision;
      if (result.data) {apply(result.data);baseline=JSON.stringify(snapshot());}
      else baseline='';
      const raw=localStorage.getItem(draftKey);
      if (raw) {
        const draft=JSON.parse(raw);
        if (JSON.stringify(draft.data)!==baseline) {apply(draft.data);revision=draft.baseRevision;dirty=true;}
        else localStorage.removeItem(draftKey);
      }
      dirty=JSON.stringify(snapshot())!==baseline;
      if (dirty) {rememberDraft();await push();}
      else status(I18n.t('Server · gespeichert · Stand {n}', {n:revision}));
      render();document.getElementById('backendLoading').hidden=true;
      clearInterval(pollTimer);pollTimer=setInterval(poll,4000);
    } catch (error) {
      revision=null;status(I18n.t('Server nicht verfügbar. Es wurden keine lokalen Daten hochgeladen.'),true);
      document.getElementById('backendLoadingStatus').textContent=error.message;
      document.getElementById('backendLoadRetry').hidden=false;
    } finally {starting=false;}
  }
  return {enabled,prepare,start,schedule,poll,logout,rememberLanguage,canReload:()=>!enabled || (revision !== null && !dirty && !sending && !conflict && !starting)};
})();
