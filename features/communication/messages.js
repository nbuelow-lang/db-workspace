// Extracted without behavior changes; see Docs/Modules for ownership.
function formatOperationsDate(value) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date((numeric + swiftReferenceDateOffset) * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unbekannt' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function operationProject(projectID) {
  return projects.find(project => project.id === projectID) || { id: projectID, city: projectID, title: 'Bauvorhaben', coordinator: 'Bülow & Dolz Projektkoordination', coordinatorPhone: '' };
}

function renderChats() {
  setPageMeta('BÜLOW & DOLZ COMMS', 'Projektchats');
  const operations = state.operations || structuredClone(defaultState.operations);
  const messages = operations.projectMessages || [];
  const projectIDs = [...new Set(messages.map(message => message.projectID))];
  const activeProjectID = projectIDs.includes(operations.activeChatProjectID) ? operations.activeChatProjectID : projectIDs[0];
  operations.activeChatProjectID = activeProjectID;
  const activeProject = operationProject(activeProjectID);
  const activeMessages = messages.filter(message => message.projectID === activeProjectID).sort((a,b) => Number(a.sentAt) - Number(b.sentAt));
  const currentName = state.initialSetup?.fullName || 'Nicolai Bülow';
  return `
    <section class="section" style="margin-top:0">
      <div class="section-header"><div><h2>Projektkommunikation</h2><p>Rueckfragen und Entscheidungen bleiben dem Bauvorhaben zugeordnet.</p></div><span class="status-pill blue">${messages.filter(message => !message.isRead && message.senderName !== currentName).length} ungelesen</span></div>
      <div class="chat-workspace">
        <aside class="chat-conversations">
          <header><h3>Bauvorhaben</h3><p>${projectIDs.length} aktive Unterhaltungen</p></header>
          ${projectIDs.map(projectID => {
            const project = operationProject(projectID);
            const projectMessages = messages.filter(message => message.projectID === projectID);
            const last = projectMessages[projectMessages.length - 1];
            const unread = projectMessages.filter(message => !message.isRead && message.senderName !== currentName).length;
            return `<button class="chat-conversation ${projectID === activeProjectID ? 'active' : ''}" data-action="select-chat" data-project="${escapeAttr(projectID)}"><span class="chat-conversation-avatar">${escapeAttr(initials(project.coordinator || project.city))}</span><span class="chat-conversation-copy"><strong>${escapeAttr(project.city)} · ${escapeAttr(projectID)}</strong><span>${escapeAttr(last?.body || 'Noch keine Nachricht')}</span></span>${unread ? `<span class="chat-unread">${unread}</span>` : '<span></span>'}</button>`;
          }).join('')}
        </aside>
        <section class="chat-panel">
          <header><h3>${escapeAttr(activeProject.city || 'Projektchat')} · ${escapeAttr(activeProjectID || '')}</h3><p>${escapeAttr(activeProject.coordinator || 'Bülow & Dolz Projektkoordination')} · Projektkanal</p></header>
          <div class="chat-thread">
            ${activeMessages.length ? activeMessages.map(message => `<article class="chat-message ${message.senderName === currentName ? 'mine' : ''}"><div class="chat-message-meta"><strong>${escapeAttr(message.senderName)}</strong><span>${escapeAttr(message.senderRole)} · ${formatOperationsDate(message.sentAt)}</span></div><p>${escapeAttr(message.body)}</p>${message.translatedBody ? `<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><strong>${escapeAttr(availableLanguages.find(item=>item.code===message.targetLanguageCode)?.title || 'Übersetzung')}</strong><p>${escapeAttr(message.translatedBody)}</p></div>` : ''}</article>`).join('') : emptyState('mail','Noch keine Nachricht','Starten Sie die projektbezogene Abstimmung.')}
          </div>
          <div class="chat-composer"><input id="chatMessageInput" placeholder="Nachricht an die Projektkoordination"><button class="button primary" data-action="send-chat" data-project="${escapeAttr(activeProjectID || '')}" aria-label="Nachricht senden" ${activeProjectID?'':'disabled'}>${icon('arrow-right',16)} Senden</button></div>
        </section>
      </div>
    </section>
  `;
}

function renderTranslationConsole() {
  const projectIDs = [...new Set([...(state.operations?.projectMessages || []).map(item => item.projectID),...projects.map(item => item.id)])].slice(0,12);
  return `<div class="translation-console">
    <article class="card pad"><span class="eyebrow">PROJEKTCHAT</span><h3>Übersetzt senden</h3>
      <div class="form-grid" style="margin-top:12px"><div class="field full"><label>Bauvorhaben</label><select id="translationProject">${projectIDs.map(id=>`<option>${id}</option>`).join('')}</select></div><div class="field full"><label>Zielsprache</label><select id="translationLanguage">${availableLanguages.map(language=>`<option value="${language.code}">${language.flag} ${language.title}</option>`).join('')}</select></div><div class="field full"><label>Nachricht</label><textarea id="translationMessage">Bitte die fehlenden Fotos hochladen.</textarea></div></div>
      <button class="button primary full" style="margin-top:10px" data-action="translation-send">${icon('mail',15)} Übersetzt senden</button>
    </article>
    <article class="card pad"><span class="eyebrow">INTERNER PROJEKTRAUM</span><h3>LiveTranslation Call</h3><div class="translation-call-state" id="translationCallState"><div><span class="smart-module-icon" style="margin:auto">${icon('phone',20)}</span><p>Serverstatus wird beim Start geprüft.<br>Live-Audio: Deutsch, Englisch, Russisch.</p></div></div><audio id="translationAudio" class="live-audio" autoplay controls hidden></audio><button class="button secondary full" style="margin-top:10px" data-action="realtime-start">${icon('phone',15)} Sicheren Audiokanal starten</button></article>
  </div>`;
}

function localWebTranslation(text, language) {
  const phrase = /foto|bild/i.test(text) ? 'photos' : /material/i.test(text) ? 'material' : /fertig|abgeschlossen/i.test(text) ? 'done' : 'received';
  const translations = {
    de:{photos:'Bitte die fehlenden Fotos hochladen.',material:'Das Material ist auf der Baustelle angekommen.',done:'Die Arbeiten sind abgeschlossen.',received:'Nachricht erhalten. Die Projektkoordination meldet sich.'},
    en:{photos:'Please upload the missing photos.',material:'The material has arrived at the site.',done:'The work has been completed.',received:'Message received. Project coordination will respond.'},
    pl:{photos:'Proszę przesłać brakujące zdjęcia.',material:'Materiał dotarł na budowę.',done:'Prace zostały zakończone.',received:'Wiadomość odebrana. Koordynator projektu odpowie.'},
    cs:{photos:'Nahrajte prosím chybějící fotografie.',material:'Materiál dorazil na stavbu.',done:'Práce byly dokončeny.',received:'Zpráva přijata. Koordinace projektu odpoví.'},
    sk:{photos:'Nahrajte prosím chýbajúce fotografie.',material:'Materiál dorazil na stavbu.',done:'Práce boli dokončené.',received:'Správa prijatá. Koordinácia projektu odpovie.'},
    sl:{photos:'Prosimo, naložite manjkajoče fotografije.',material:'Material je prispel na gradbišče.',done:'Dela so zaključena.',received:'Sporočilo je prejeto. Koordinacija projekta bo odgovorila.'},
    hu:{photos:'Kérjük, töltse fel a hiányzó fényképeket.',material:'Az anyag megérkezett az építkezésre.',done:'A munka befejeződött.',received:'Az üzenet megérkezett. A projektkoordináció válaszol.'},
    uk:{photos:'Будь ласка, завантажте відсутні фотографії.',material:'Матеріал прибув на будівельний майданчик.',done:'Роботи завершено.',received:'Повідомлення отримано. Координатор проєкту відповість.'},
    ru:{photos:'Пожалуйста, загрузите недостающие фотографии.',material:'Материал доставлен на объект.',done:'Работы завершены.',received:'Сообщение получено. Координатор проекта ответит.'}
  };
  return translations[language]?.[phrase] || text;
}

let realtimePeer = null;

let realtimeStream = null;

async function startRealtimeTranslation() {
  if (AdminPreview.enabled || BackendWorkspace.enabled) { showToast('Testmodus', 'Live-Verbindungen sind im Testmodus deaktiviert.'); return; }
  const targetLanguage = document.getElementById('translationLanguage')?.value || 'en';
  const projectID = document.getElementById('translationProject')?.value || '';
  const panel = document.getElementById('translationCallState');
  if (!panel) return;
  panel.innerHTML = '<div><strong>Server und Mikrofon werden vorbereitet …</strong></div>';
  try {
    const response = await fetch('/api/realtime/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetLanguage,projectID})});
    const session = await response.json();
    if (!response.ok) throw new Error(session.message || (response.status === 503 ? 'OPENAI_API_KEY fehlt am Mac-Server.' : 'Realtime-Sitzung nicht verfügbar.'));
    const clientSecret = session.client_secret?.value || session.client_secret;
    if (!clientSecret) throw new Error('Kein kurzlebiger Sitzungsschlüssel erhalten.');
    realtimeStream = await navigator.mediaDevices.getUserMedia({audio:true});
    realtimePeer = new RTCPeerConnection();
    const audio = document.getElementById('translationAudio');
    realtimePeer.ontrack = event => { audio.srcObject = event.streams[0]; audio.hidden = false; };
    realtimeStream.getTracks().forEach(track => realtimePeer.addTrack(track,realtimeStream));
    realtimePeer.createDataChannel('oai-events');
    const offer = await realtimePeer.createOffer();
    await realtimePeer.setLocalDescription(offer);
    const sdpResponse = await fetch('https://api.openai.com/v1/realtime/translations/calls',{method:'POST',headers:{Authorization:`Bearer ${clientSecret}`,'Content-Type':'application/sdp'},body:offer.sdp});
    if (!sdpResponse.ok) throw new Error(`Audiokanal HTTP ${sdpResponse.status}`);
    await realtimePeer.setRemoteDescription({type:'answer',sdp:await sdpResponse.text()});
    panel.innerHTML = `<div><strong>LiveTranslation aktiv</strong><p>Projektraum ${escapeAttr(projectID)} · ${escapeAttr(availableLanguages.find(item=>item.code===targetLanguage)?.title || targetLanguage)}<br>Das Mikrofon überträgt jetzt Audio.</p><button class="button danger small" data-action="realtime-stop">Call beenden</button></div>`;
  } catch (error) {
    stopRealtimeTranslation();
    panel.innerHTML = `<div><strong>Callservice noch nicht bereit</strong><p>${escapeAttr(error.message)}</p></div>`;
  }
}

function stopRealtimeTranslation() {
  realtimeStream?.getTracks().forEach(track => track.stop());
  realtimePeer?.close();
  realtimeStream = null;
  realtimePeer = null;
}

function markProjectChatRead(projectID) {
  if (!projectID) return;
  for (const notification of state.notifications || []) {
    if (notification.kind === 'chat' && notification.projectID === projectID) {
      notification.isRead = true;
      notification.deliveryStatus = 'Gelesen';
    }
  }
  for (const message of state.operations.projectMessages || []) {
    if (message.projectID === projectID) message.isRead = true;
  }
}

function selectOperationsChat(projectID) {
  state.operations.activeChatProjectID = projectID;
  markProjectChatRead(projectID);
  saveState();
  render();
}

function sendOperationsChat(projectID) {
  const input = document.getElementById('chatMessageInput');
  const body = input?.value.trim() || '';
  if (!body) return;
  const roleTitle = state.role === 'admin' ? 'Administrator / Organisation' : state.role === 'pm' ? 'Projektmanagement' : state.role === 'quality' ? 'Bauleitung / QM' : 'Montagepartner';
  state.operations.projectMessages.push({
    id: `message-${Date.now()}`,
    projectID,
    senderName: state.initialSetup?.fullName || 'Nicolai Bülow',
    senderRole: roleTitle,
    body,
    sentAt: Date.now() / 1000 - swiftReferenceDateOffset,
    isRead: true
  });
  saveState();
  render();
}

function sendSmartTranslation() {
  const projectID = document.getElementById('translationProject')?.value || '';
  const targetLanguageCode = document.getElementById('translationLanguage')?.value || 'en';
  const body = document.getElementById('translationMessage')?.value.trim() || '';
  if (!projectID || !body) { showToast('Nachricht fehlt','Bitte Projekt und Nachricht prüfen.','warning'); return; }
  const senderName = state.initialSetup?.fullName || state.onboarding?.data?.contact || 'Bülow & Dolz';
  state.operations.projectMessages.push({id:`message-translation-${Date.now()}`,projectID,senderName,senderRole:state.initialSetup?.role || 'Projektkoordination',body,sentAt:Date.now()/1000-swiftReferenceDateOffset,isRead:true,sourceLanguageCode:state.language || 'de',targetLanguageCode,translatedBody:localWebTranslation(body,targetLanguageCode)});
  saveState();
  showSmartModule('translation');
  showToast('Übersetzt gesendet',`Die Nachricht liegt in der Projektakte ${projectID}.`,'success');
}
