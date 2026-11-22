const fullPage=new URLSearchParams(location.search).get('mode')==='full';
if(fullPage){
 document.body.classList.add('full-page');
 document.getElementById('openDashboard').hidden=true;
 document.getElementById('uiHint').textContent='큰 화면 모드에서는 드롭다운을 선택해도 창이 사라지지 않습니다.';
}else{
 document.getElementById('openDashboard').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html?mode=full')}));
}
// Help opens the Pink Bunny server's bundled offline-friendly guide.
document.getElementById('openFeatureGuide').addEventListener('click',async()=>{
 const cfg=await chrome.storage.local.get(['server']);
 const host=(cfg.server||'127.0.0.1').trim();
 if(!validHost(host)){
  const message=document.getElementById('status');
  message.textContent='❌ 연결 주소를 확인한 후 기능 가이드를 열어 주세요.';
  return;
 }
 // On a separate music PC the OBS setup/guide is intentionally LAN-private.
 const url=(host==='127.0.0.1'||host==='localhost')
  ?'http://'+host+':38765/guide#features'
  :'https://github.com/Cho-L/PinkBunny/blob/main/GUIDE.md#features';
 chrome.tabs.create({url});
});
function validHost(host){
 if(host==='localhost')return true;
 const parts=host.split('.');
 if(parts.length!==4||!parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255))return false;
 const [a,b]=parts.map(Number);
 return (a===127&&b===0&&Number(parts[2])===0&&Number(parts[3])===1)||
        a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
const server=document.getElementById('server'),key=document.getElementById('key'),status=document.getElementById('status'),pair=document.getElementById('pair');
chrome.storage.local.get(['server','key']).then(async s=>{
 server.value=s.server||'127.0.0.1';key.value=s.key||'';
 if(!s.key){
  try{
   const r=await fetch('http://127.0.0.1:38765/api/pair',{signal:AbortSignal.timeout(2000)});
   if(r.ok){const d=await r.json();await connect('127.0.0.1',d.code);await refreshTabs();}
  }catch{status.textContent='1컴은 자동 연결 버튼, 2컴은 연결 주소를 사용해 주세요.';}
 }
});
async function connect(host,code){
 if(!validHost(host)||!(/^[A-F0-9]{8}$/.test(code)||/^[A-F0-9]{32}$/.test(code))){status.textContent='❌ 주소 또는 연결 코드가 올바르지 않습니다.';return false;}
 // A separate music PC requests permission only for the selected streaming
 // PC address, never unrestricted web access during extension installation.
 if(host!=='127.0.0.1'&&host!=='localhost'){
  try{
   const permitted=await chrome.permissions.request({origins:['http://'+host+'/*']});
   if(!permitted){status.textContent='❌ 송출 PC 접근 권한이 필요합니다. 연결 주소 적용을 눌러 권한을 허용해 주세요.';return false;}
  }catch{status.textContent='❌ 2컴 연결 주소 적용 버튼에서 송출 PC 접근 권한을 허용해 주세요.';return false;}
 }
 status.textContent='서버 연결 중…';
 try{
  const result=await fetch('http://'+host+':38765/api/tabs',{headers:{'X-Bunny-Key':code,'X-Bunny-Extension':'1'},signal:AbortSignal.timeout(4000)});
  if(!result.ok)throw Error('Server error');
  await chrome.storage.local.set({server:host,key:code});
  server.value=host;key.value=code;status.textContent='✅ 연결됐어요! 유튜브 탭을 새로고침하고 음악을 틀어 주세요.';
  await refreshTabs();await refreshCurrentTab();
  return true;
 }catch{status.textContent='❌ 연결되지 않았어요. PinkBunny.exe가 켜져 있는지, 주소·방화벽이 맞는지 확인하세요.';return false;}
}
document.getElementById('auto').onclick=async()=>{
 status.textContent='내 PC에서 Pink Bunny 찾는 중…';
 try{
  const r=await fetch('http://127.0.0.1:38765/api/pair',{signal:AbortSignal.timeout(4000)});
  if(!r.ok)throw Error();
  const d=await r.json();
  await connect('127.0.0.1',d.code);
 }catch{status.textContent='❌ 이 PC에서 실행 중인 PinkBunny.exe가 없어요. 먼저 실행해 주세요.';}
};
document.getElementById('apply').onclick=async()=>{
 try{
  const u=new URL(pair.value.trim());
  if(u.protocol!=='pinkbunny:'||u.hostname!=='pair')throw Error();
  const host=u.searchParams.get('host')||'',code=(u.searchParams.get('key')||'').toUpperCase();
  if(u.searchParams.get('port')!=='38765')throw Error();
  if(await connect(host,code))pair.value='';
 }catch{status.textContent='❌ 올바른 연결 주소가 아니에요. 송출 PC 설치 도우미에서 복사해 주세요.';}
};
document.getElementById('save').onclick=()=>connect(server.value.trim(),key.value.trim().toUpperCase());


const tabsSelect=document.getElementById('tabs');
async function refreshTabs(){
 const cfg=await chrome.storage.local.get(['server','key']);
 const host=cfg.server||'127.0.0.1', code=cfg.key||'';
 if(!code){tabsSelect.replaceChildren(new Option('먼저 연결해 주세요','0'));return;}
 try{
   const r=await fetch('http://'+host+':38765/api/tabs',{headers:{'X-Bunny-Key':code,'X-Bunny-Extension':'1'},signal:AbortSignal.timeout(4000)});
   if(!r.ok)throw Error('서버 인증 실패');
   const data=await r.json();
   tabsSelect.replaceChildren(new Option('자동 선택 (재생 중인 탭)','0'));
   for(const t of data.tabs||[])tabsSelect.add(new Option((t.hidden?'🙈 ':t.playing?'▶ ':'Ⅱ ')+t.title.slice(0,58)+' [탭 '+t.tabId+']',String(t.tabId)));
   tabsSelect.value=String(data.pinnedId||0);
   document.getElementById('connection').textContent='🟢 Pink Bunny 연결됨 · '+(data.tabs||[]).length+'개 유튜브 탭 감지';
 }catch(e){tabsSelect.replaceChildren(new Option('연결 실패 · 새로고침','0'));status.textContent='❌ 서버 연결 실패 · Pink Bunny 실행 여부와 연결 주소를 확인해 주세요.';document.getElementById('connection').textContent='🔴 연결되지 않음 · 연결 설정을 열어 주세요.';}
}
document.getElementById('refresh').onclick=async()=>{await refreshTabs();await refreshCurrentTab();};
tabsSelect.addEventListener('change',()=>{if(fullPage)refreshCurrentTab();});
document.getElementById('selectTab').onclick=async()=>{
 const cfg=await chrome.storage.local.get(['server','key']);
 if(!cfg.key){status.textContent='먼저 서버와 연결해 주세요.';return;}
 try{
   const r=await fetch('http://'+(cfg.server||'127.0.0.1')+':38765/api/select',{
     method:'POST',headers:{'Content-Type':'application/json','X-Bunny-Key':cfg.key,'X-Bunny-Extension':'1'},
     body:JSON.stringify({tabId:Number(tabsSelect.value)})
   });
   if(!r.ok)throw Error('탭이 없거나 서버 인증이 실패했습니다.');
   status.textContent='✅ OBS에 표시할 탭 설정을 적용했어요.';await refreshTabs();
 }catch(e){status.textContent='❌ '+e.message;}
};
refreshTabs();

const connection=document.getElementById('connection');
const activeVideo=document.getElementById('activeVideo');
const pinCurrent=document.getElementById('pinCurrent');
const toggleCurrent=document.getElementById('toggleCurrent');
let currentId=0,currentHidden=false;
function isYouTubeTab(t){
 try{const u=new URL(t.url||'');return u.protocol==='https:'&&['www.youtube.com','music.youtube.com'].includes(u.hostname);}
 catch{return false;}
}
async function authenticated(path,method='GET',body){
 const cfg=await chrome.storage.local.get(['server','key']);
 if(!cfg.key)throw Error('먼저 Pink Bunny 서버에 연결해 주세요.');
 const response=await fetch('http://'+(cfg.server||'127.0.0.1')+':38765/api/'+path,{
  method,headers:{'X-Bunny-Key':cfg.key,'X-Bunny-Extension':'1',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(4000)
 });
 if(!response.ok)throw Error(response.status===404?'이 탭의 유튜브 정보를 아직 받지 못했어요. 영상을 재생하거나 새로고침해 주세요.':'서버 연결 또는 인증 실패');
 return response.json();
}
async function refreshCurrentTab(){
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  let target=isYouTubeTab(tab)?tab:null;
  if(!target&&fullPage){
   const all=await chrome.tabs.query({currentWindow:true});
   const options=all.filter(isYouTubeTab).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0));
   const selected=Number(tabsSelect.value);
   target=options.find(t=>t.id===selected)||options[0]||null;
  }
  currentId=target?.id||0;
  if(!currentId){
   activeVideo.textContent='유튜브 또는 YouTube Music 탭에서 확장 프로그램을 열어 주세요.';
   pinCurrent.disabled=true;toggleCurrent.disabled=true;return;
  }
  activeVideo.textContent=(fullPage?'제어 대상 탭: ':'현재 탭: ')+(target?.title||'YouTube').slice(0,75);
  const data=await authenticated('tabs');
  const found=(data.tabs||[]).find(x=>x.tabId===currentId);
  if(!found){
   activeVideo.textContent+=' · 영상 재생 후 새로고침해 주세요.';
   pinCurrent.disabled=true;toggleCurrent.disabled=true;return;
  }
  currentHidden=!!found.hidden;
  pinCurrent.disabled=false;toggleCurrent.disabled=false;
  pinCurrent.textContent=data.pinnedId===currentId?'📌 고정 중':'📌 이 탭 고정';
  toggleCurrent.textContent=currentHidden?'👁️ 다시 표시':'🙈 이 탭 숨기기';
 }catch(e){
  pinCurrent.disabled=true;toggleCurrent.disabled=true;
  activeVideo.textContent='서버 연결을 먼저 확인해 주세요.';
 }
}
pinCurrent.onclick=async()=>{
 try{
  await authenticated('visibility','POST',{tabId:currentId,hidden:false});
  await authenticated('select','POST',{tabId:currentId});
  status.textContent='✅ 이 탭을 OBS 표시 대상으로 고정했어요.';
  await refreshTabs();await refreshCurrentTab();
 }catch(e){status.textContent='❌ '+e.message;}
};
toggleCurrent.onclick=async()=>{
 try{
  await authenticated('visibility','POST',{tabId:currentId,hidden:!currentHidden});
  status.textContent=currentHidden?'✅ 이 탭을 다시 표시해요.':'✅ 이 탭을 OBS에서 숨겼어요. 음악은 계속 재생돼요.';
  await refreshTabs();await refreshCurrentTab();
 }catch(e){status.textContent='❌ '+e.message;}
};
document.getElementById('unpin').onclick=async()=>{
 try{
  await authenticated('select','POST',{tabId:0});
  status.textContent='✅ 자동 선택으로 전환했어요.';
  await refreshTabs();await refreshCurrentTab();
 }catch(e){status.textContent='❌ '+e.message;}
};
refreshCurrentTab();

const controlStatus=document.getElementById('controlStatus');
async function executeLocalControl(action){
 controlStatus.textContent='⌛ 유튜브 탭과 연결하는 중…';
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 let target=isYouTubeTab(tab)?tab:null;
 if(!target&&fullPage){
  const all=await chrome.tabs.query({currentWindow:true});
  const selected=Number(tabsSelect.value);
  target=all.find(t=>isYouTubeTab(t)&&t.id===selected)||
   all.filter(isYouTubeTab).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
 }
 if(!target){
  controlStatus.textContent='❌ 유튜브 영상이 열려 있는 탭에서 확장 프로그램을 사용해 주세요. 큰 화면 설정에서는 표시할 탭을 선택할 수 있어요.';
  return;
 }
 controlStatus.textContent='⌛ '+(target.title||'YouTube').slice(0,36)+' 탭에 명령 전송 중…';
 try{
  const r=await chrome.tabs.sendMessage(target.id,{type:'pinkbunny-player-command',action});
  if(!r?.ok){
   controlStatus.textContent='❌ '+(r?.error||'유튜브에서 제어 응답이 없습니다. 영상 탭을 새로고침해 주세요.');
   return;
  }
  if(action==='volumeUp'||action==='volumeDown'){
   controlStatus.textContent=typeof r.volumePercent==='number'
    ?'✅ 유튜브 영상 음량: '+r.volumePercent+'%'+(r.muted?' (음소거 중)':'')
    :'✅ 유튜브 영상 음량 조절 요청 완료';
  }else if(action==='next'||action==='previous'){
   controlStatus.textContent='✅ 유튜브의 '+(action==='next'?'다음':'이전')+' 버튼을 눌렀어요. 실제 영상 전환 여부를 확인해 주세요.';
  }else{
   controlStatus.textContent='✅ 유튜브 재생/일시정지 명령을 처리했어요.';
  }
 }catch(e){
  controlStatus.textContent='❌ 확장 프로그램이 이 유튜브 탭과 통신하지 못했습니다. chrome://extensions에서 확장 프로그램을 새로고침한 뒤 유튜브 페이지도 새로고침해 주세요.';
 }
}
for(const button of document.querySelectorAll('[data-control]')){
 button.addEventListener('click',()=>executeLocalControl(button.dataset.control));
}
chrome.storage.local.get(['hideAds','hideShorts']).then(v=>{
 document.getElementById('filterAds').checked=v.hideAds!==false;
 document.getElementById('filterShorts').checked=v.hideShorts!==false;
});
for(const [id,key] of [['filterAds','hideAds'],['filterShorts','hideShorts']]){
 document.getElementById(id).addEventListener('change',async e=>{
  await chrome.storage.local.set({[key]:e.target.checked});
  status.textContent='✅ 스마트 방송 필터 설정을 저장했어요.';
 });
}
