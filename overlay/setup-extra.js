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
  result.textContent='확인하는 중…';
  try{
   const r=await fetch('/api/status');if(!r.ok)throw Error();const d=await r.json();
   result.textContent=d.connected?('✅ 서버 정상 / 유튜브 연결 확인 / '+(d.playing?'재생 중':'일시정지')+' / '+d.title)
    :'✅ 서버 정상 · 유튜브 정보는 아직 받지 못했어요. 확장 프로그램 연결과 영상 재생을 확인하세요.';
  }catch{result.textContent='❌ Pink Bunny 서버 연결에 실패했습니다.';}
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
})();
