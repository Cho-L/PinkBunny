const server=document.getElementById('server'),key=document.getElementById('key'),status=document.getElementById('status'),pair=document.getElementById('pair');
chrome.storage.local.get(['server','key']).then(s=>{server.value=s.server||'127.0.0.1';key.value=s.key||'';});
async function connect(host,code){
 if(!/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3})$/.test(host)||!/^[A-F0-9]{8}$/.test(code)){status.textContent='❌ 주소 또는 연결 코드가 올바르지 않습니다.';return;}
 status.textContent='서버 연결 중…';
 try{
  const result=await fetch('http://'+host+':38765/api/status',{signal:AbortSignal.timeout(4000)});
  if(!result.ok)throw Error('Server error');
  await chrome.storage.local.set({server:host,key:code});
  server.value=host;key.value=code;status.textContent='✅ 연결됐어요! 유튜브 탭을 새로고침하고 음악을 틀어 주세요.';
 }catch{status.textContent='❌ 연결되지 않았어요. PinkBunny.exe가 켜져 있는지, 주소·방화벽이 맞는지 확인하세요.';}
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
  await connect(host,code);
  pair.value='';
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
   for(const t of data.tabs||[])tabsSelect.add(new Option((t.playing?'▶ ':'Ⅱ ')+t.title.slice(0,58)+' [탭 '+t.tabId+']',String(t.tabId)));
   tabsSelect.value=String(data.pinnedId||0);
 }catch(e){tabsSelect.replaceChildren(new Option('연결 실패 · 새로고침','0'));status.textContent='❌ 탭 목록 확인 실패: '+e.message;}
}
document.getElementById('refresh').onclick=refreshTabs;
document.getElementById('selectTab').onclick=async()=>{
 const cfg=await chrome.storage.local.get(['server','key']);
 if(!cfg.key){status.textContent='먼저 서버와 연결해 주세요.';return;}
 try{
   const r=await fetch('http://'+(cfg.server||'127.0.0.1')+':38765/api/select',{
     method:'POST',headers:{'Content-Type':'application/json','X-Bunny-Key':cfg.key,'X-Bunny-Extension':'1'},
     body:JSON.stringify({tabId:Number(tabsSelect.value)})
   });
   if(!r.ok)throw Error('탭이 없거나 서버 인증이 실패했습니다.');
   status.textContent='✅ OBS에 표시할 탭 설정을 적용했어요.';
 }catch(e){status.textContent='❌ '+e.message;}
};
refreshTabs();
