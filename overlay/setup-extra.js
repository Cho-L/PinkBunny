// Beginner helpers: startup preference, connection check and optional OBS WebSocket source creation.
(() => {
 const doc=document;
 const card=doc.createElement('section');
 card.className='card';
 card.innerHTML=`<strong>⑤ 편의 기능 (선택)</strong>
 <p>Windows 시작 시 Pink Bunny를 자동 실행하거나, OBS 소스를 클릭 한 번으로 추가할 수 있어요.</p>
 <div class="row"><button id="pb-start">Windows 자동 시작 상태 확인…</button><button id="pb-check" class="secondary">연결 진단</button></div>
 <p class="tiny" id="pb-result" role="status"></p>
 <hr style="border:0;border-top:1px solid #eac0d5;margin:17px 0">
 <p><strong>OBS 브라우저 소스 자동 추가 (선택)</strong></p>
 <p class="tiny">OBS Studio를 먼저 실행하고, 설정 → WebSocket 서버 설정에서 서버 활성화 여부와 포트를 확인하세요. 기본 포트는 4455입니다. 인증이 설정돼 있다면 암호를 입력하세요.</p>
 <div class="row">
  <label>OBS 포트 <input type="number" id="pb-obs-port" value="4455" min="1" max="65535" style="width:90px;padding:8px"></label>
  <label>OBS WebSocket 암호 <input type="password" id="pb-obs-pass" autocomplete="off" placeholder="설정돼 있다면 입력" style="padding:8px"></label>
  <button id="pb-obs-add">OBS 소스 자동 추가</button>
 </div>
 <p class="tiny" id="pb-obs-status" role="status"></p>`;
 const last=doc.querySelector('#message');
 last.parentElement.insertBefore(card,last);
 // Automatic diagnosis deliberately checks only measurable data. OBS and
 // audio require a manual check unless the user connects to OBS WebSocket.
 const diag=doc.createElement('section');
 diag.className='card';
 diag.id='pb-diagnostics';
 diag.innerHTML=`<strong>🩺 방송 준비 자동 진단</strong>
 <p class="tiny">Pink Bunny·Chrome 통신·유튜브 정보는 자동 확인합니다. OBS 소스와 오디오는 직접 확인해야 합니다.</p>
 <div class="row"><button id="pb-diag-refresh">🔄 지금 다시 확인</button><a href="/guide#feature-troubleshooting" target="_blank" rel="noopener">📘 문제 해결 그림</a></div>
 <p id="pb-diag-summary" role="status" class="tiny">방송 상태를 확인하는 중…</p>
 <div id="pb-diag-list" style="display:grid;gap:8px"></div>`;
 card.parentElement.insertBefore(diag,card);
 const diagSummary=doc.getElementById('pb-diag-summary');
 const diagList=doc.getElementById('pb-diag-list');
 const diagRefresh=doc.getElementById('pb-diag-refresh');
 async function loadDiagnostics(){
  diagRefresh.disabled=true;
  diagSummary.textContent='상태를 확인하는 중…';
  try{
   const r=await fetch('/api/diagnostics',{signal:AbortSignal.timeout(4000)});
   if(!r.ok)throw Error('서버 진단 요청에 실패했습니다.');
   const data=await r.json();
   diagList.replaceChildren();
   const checks=Array.isArray(data.checks)?data.checks:[];
   let ok=0,attention=0,manual=0;
   for(const check of checks){
    const state=check.state==='ok'?'ok':check.state==='manual'?'manual':'attention';
    if(state==='ok')ok++;else if(state==='manual')manual++;else attention++;
    const entry=doc.createElement('div');
    entry.style.cssText='padding:10px 12px;border:1px solid #eacbdd;border-radius:10px;background:#fff';
    const title=doc.createElement('strong');
    title.textContent=(state==='ok'?'✅ ':state==='manual'?'🔎 ':'⚠️ ')+check.label;
    const detail=doc.createElement('p');
    detail.className='tiny';
    detail.style.margin='4px 0';
    detail.textContent=check.detail;
    const help=doc.createElement('small');
    help.textContent=check.help||'';
    entry.append(title,detail,help);
    diagList.appendChild(entry);
   }
   diagSummary.textContent=`자동 확인 ${ok}개 정상 · ${attention}개 확인 필요 · ${manual}개 수동 점검 (OBS/오디오는 자동 검사 대상 아님)`;
  }catch(e){
   diagSummary.textContent='❌ 진단 데이터를 읽지 못했습니다: '+e.message;
  }finally{diagRefresh.disabled=false;}
 }
 diagRefresh.onclick=loadDiagnostics;
 loadDiagnostics();
 setInterval(()=>{if(!doc.hidden)loadDiagnostics();},12000);
 const result=doc.getElementById('pb-result');
 const start=doc.getElementById('pb-start');
 let enabled=false;
 async function load(){
   try{
    const r=await fetch('/api/autostart');const d=await r.json();
    if(!r.ok)throw Error(d.error||'Unknown');
    enabled=d.enabled;start.textContent=enabled?'✅ Windows 자동 시작: 켜짐 (클릭해 끄기)':'Windows 자동 시작 켜기';
   }catch{start.disabled=true;start.textContent='자동 시작 설정은 Windows에서만 지원';}
 }
 start.onclick=async()=>{
   start.disabled=true;result.textContent='설정을 변경하는 중…';
   try{
    const r=await fetch('/api/autostart',{method:'POST',headers:{'Content-Type':'application/json','X-PinkBunny-Action':'1'},body:JSON.stringify({enabled:!enabled})});
    const d=await r.json();if(!r.ok)throw Error(d.error||'실패');
    result.textContent=d.enabled?'✅ Windows 로그인 시 자동으로 실행됩니다.':'✅ 자동 시작을 해제했습니다.';
   }catch(e){result.textContent='❌ 설정 실패: '+e.message;}
   start.disabled=false;await load();
 };
 doc.getElementById('pb-check').onclick=async()=>{
  diag.scrollIntoView({behavior:'smooth',block:'start'});
  await loadDiagnostics();
 };
 const obsStatus=doc.getElementById('pb-obs-status');
 function b64(bytes){let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str);}
 async function sha256(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
 async function auth(password,salt,challenge){
  const secret=b64(await sha256(password+salt));
  return b64(await sha256(secret+challenge));
 }
 doc.getElementById('pb-obs-add').onclick=async()=>{
  const button=doc.getElementById('pb-obs-add');button.disabled=true;obsStatus.textContent='OBS에 연결하는 중…';
  const port=Number(doc.getElementById('pb-obs-port').value);
  if(!Number.isInteger(port)||port<1||port>65535){obsStatus.textContent='❌ 올바른 포트를 입력하세요.';button.disabled=false;return;}
  const password=doc.getElementById('pb-obs-pass').value;
  let ws;let timer;
  try{
   await new Promise((resolve,reject)=>{
    ws=new WebSocket('ws://127.0.0.1:'+port);
    timer=setTimeout(()=>reject(Error('OBS 응답 시간 초과')),5500);
    ws.onerror=()=>reject(Error('OBS WebSocket 서버에 연결할 수 없습니다.'));
    ws.onclose=()=>reject(Error('OBS 연결이 종료됐습니다.'));
    ws.onmessage=async event=>{
     try{
      const m=JSON.parse(event.data);
      if(m.op===0){
       let authentication;
       if(m.d.authentication){
        if(!password)throw Error('OBS WebSocket 비밀번호를 입력해 주세요.');
        authentication=await auth(password,m.d.authentication.salt,m.d.authentication.challenge);
       }
       ws.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:0,...(authentication?{authentication}:{})}}));
      }else if(m.op===2){clearTimeout(timer);resolve();}
     }catch(e){reject(e);}
    };
   });
   let serial=0;
   function request(type,data={}){
    return new Promise((resolve,reject)=>{
     const requestId='pink-'+(++serial);
     const onMessage=e=>{
      const m=JSON.parse(e.data);
      if(m.op!==7||m.d.requestId!==requestId)return;
      ws.removeEventListener('message',onMessage);
      if(m.d.requestStatus?.result)resolve(m.d.responseData||{});
      else reject(Error(m.d.requestStatus?.comment||'OBS 요청 실패'));
     };
     ws.addEventListener('message',onMessage);
     ws.send(JSON.stringify({op:6,d:{requestType:type,requestId,requestData:data}}));
     setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('OBS 응답 시간 초과'))},5000);
    });
   }
   const inputs=await request('GetInputList');
   if((inputs.inputs||[]).some(x=>x.inputName==='Pink Bunny Player')){
    obsStatus.textContent='✅ Pink Bunny Player 소스가 이미 OBS에 있습니다. 중복 추가하지 않았어요.';
   }else{
    const scene=await request('GetCurrentProgramScene');
    await request('CreateInput',{sceneName:scene.currentProgramSceneName,inputName:'Pink Bunny Player',inputKind:'browser_source',inputSettings:{url:'http://127.0.0.1:38765',width:420,height:130},sceneItemEnabled:true});
    obsStatus.textContent='✅ 현재 OBS 장면에 Pink Bunny Player 브라우저 소스를 추가했습니다!';
   }
  }catch(e){obsStatus.textContent='❌ '+e.message+' OBS 설정 → WebSocket 서버 설정을 확인하세요.';}
  finally{if(timer)clearTimeout(timer);if(ws)ws.close();button.disabled=false;}
 };
 load();
 const controls=doc.createElement('section');
 controls.className='card';
 controls.innerHTML=`<strong>⑥ 🎮 유튜브 원격 제어 (1컴·2컴)</strong>
 <p class="tiny">송출 PC에서 음악 PC의 유튜브를 조절할 수 있어요. 유튜브가 재생 중이고 크롬 확장 프로그램이 연결돼 있어야 합니다. 버튼을 누르면 음악 PC Chrome의 명령 처리 결과까지 확인해요. 유튜브 실제 재생 화면의 변화는 별도로 확인해야 할 수 있어요.</p>
 <div class="row">
 <button data-pb-remote="previous">⏮ 이전 곡</button>
 <button data-pb-remote="toggle">⏯ 재생 / 일시정지</button>
 <button data-pb-remote="next">다음 곡 ⏭</button>
 <button data-pb-remote="volumeDown">🔉 음량 -</button>
 <button data-pb-remote="volumeUp">🔊 음량 +</button>
 </div><p id="pb-remote-result" class="tiny" role="status"></p>
 <p class="tiny">팁: 송출 PC의 설정 페이지에서 제어하는 기능이에요. 영상 사이트에서 이전/다음 버튼을 제공하지 않으면 해당 명령은 작동하지 않을 수 있습니다.</p>`;
 last.parentElement.insertBefore(controls,last);
 const remoteButtons=[...controls.querySelectorAll('[data-pb-remote]')];
 remoteButtons.forEach(button=>button.onclick=async()=>{
  const result=doc.getElementById('pb-remote-result');
  remoteButtons.forEach(b=>b.disabled=true);
  result.textContent='⌛ 음악 PC에 제어 명령을 전달하고 있습니다…';
  try{
   const response=await fetch('/api/control',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-PinkBunny-Action':'1'},
    body:JSON.stringify({action:button.dataset.pbRemote})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'유튜브 연결 상태를 확인해 주세요.');
   if(!data.id){result.textContent='⚠️ 이전 버전 서버가 요청을 접수했습니다. 실행 결과는 확인할 수 없습니다.';return;}
   result.textContent='⌛ 명령 접수됨 · 유튜브 실행 응답을 확인하는 중…';
   for(let attempt=0;attempt<38;attempt++){
    await new Promise(resolve=>setTimeout(resolve,800));
    const r=await fetch('/api/control/result?id='+encodeURIComponent(data.id),{
     signal:AbortSignal.timeout(4000)
    });
    if(!r.ok)throw Error('명령 상태 조회에 실패했습니다.');
    const report=await r.json();
    if(report.state==='queued'){
     result.textContent='⌛ 명령이 대기열에 있어요. 음악 PC 연결을 확인하는 중…';
    }else if(report.state==='delivered'){
     result.textContent='⌛ 음악 PC가 명령을 받았어요. 유튜브 실행 응답을 기다리는 중…';
    }
    if(report.state==='success'){
     result.textContent='✅ 음악 PC Chrome에서 명령 처리를 확인했습니다. 실제 영상 화면도 확인해 주세요.';
     return;
    }
    if(report.state==='failed'){
     result.textContent='❌ 유튜브 명령 처리 실패: '+(report.error||'이유 불명');
     return;
    }
    if(report.state==='timeout'){
     result.textContent='⚠️ 시간 초과: '+(report.error||'음악 PC 응답이 없습니다.');
     return;
    }
   }
   result.textContent='⚠️ 명령 접수 후 응답이 지연되고 있습니다. 음악 PC 재생 상태를 확인해 주세요.';
  }catch(e){result.textContent='❌ '+e.message;}
  finally{remoteButtons.forEach(b=>b.disabled=false);}
 });

})();
