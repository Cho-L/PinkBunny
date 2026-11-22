const server=document.getElementById('server'),key=document.getElementById('key'),status=document.getElementById('status');
chrome.storage.local.get(['server','key']).then(s=>{server.value=s.server||'127.0.0.1';key.value=s.key||'';});
document.getElementById('save').addEventListener('click',async()=>{
 const h=server.value.trim(),k=key.value.trim().toUpperCase();
 if(!/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3})$/.test(h)||!/^[A-F0-9]{8}$/.test(k)){status.textContent='❌ IPv4 주소 또는 8자리 코드를 확인하세요.';return;}
 await chrome.storage.local.set({server:h,key:k});status.textContent='설정 저장됨 · 서버 연결 확인 중';
 try{const r=await fetch(`http://${h}:38765/api/status`);if(!r.ok)throw Error();const s=await r.json();status.textContent=s.connected?'✅ 서버 연결됨 · '+s.title:'✅ 서버 연결됨 · 유튜브 영상을 재생해 주세요';}
 catch{status.textContent='❌ 서버 연결 실패 · EXE/방화벽/IP 확인';}
});