// Only communicate with loopback or RFC1918 private streaming-PC addresses.
function validServerHost(host){
 if(host==='localhost'||host==='127.0.0.1')return true;
 const parts=host.split('.');
 if(parts.length!==4||!parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255))return false;
 const [a,b]=parts.map(Number);
 return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
// Reconnect command receivers in YouTube tabs that predate an extension update.
async function sendYouTubeCommand(tabId,action){
 const message={type:'pinkbunny-player-command',action};
 try{
  return await chrome.tabs.sendMessage(tabId,message);
 }catch(error){
  if(!/Receiving end does not exist|Could not establish connection/i.test(String(error?.message||error||'')))throw error;
  await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
  return await chrome.tabs.sendMessage(tabId,message);
 }
}
let polling=false,lastPoll=0;
async function reportCommand(host,key,command,outcome){
 if(!command.id)return; // Older streaming-PC builds did not issue IDs.
 try{
  await fetch(`http://${host}:38765/api/command-result`,{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Bunny-Key':key,'X-Bunny-Extension':'1'},
   body:JSON.stringify({id:command.id,tabId:command.tabId,ok:outcome.ok===true,
    error:outcome.ok?'':String(outcome.error||'유튜브 제어 실패').slice(0,160)}),
   signal:AbortSignal.timeout(3500)
  });
 }catch{
  // The streaming PC will time out and show "no acknowledgement".
 }
}
async function pollControls(host,key){
 if(polling||Date.now()-lastPoll<900)return;
 polling=true;lastPoll=Date.now();
 try{
  const r=await fetch(`http://${host}:38765/api/commands`,{
   headers:{'X-Bunny-Key':key,'X-Bunny-Extension':'1'},signal:AbortSignal.timeout(3500)
  });
  if(!r.ok)return;
  const data=await r.json();
  if(!data.command)return;
  const command=data.command;
  let outcome={ok:false,error:'대상 YouTube 탭이 없습니다.'};
  try{
   const tab=await chrome.tabs.get(command.tabId).catch(()=>null);
   if(tab){
    let valid=false;
    try{
     const page=new URL(tab.url||'');
     valid=page.protocol==='https:'&&['www.youtube.com','music.youtube.com'].includes(page.hostname);
    }catch{}
    if(!valid)outcome={ok:false,error:'대상 탭이 더 이상 YouTube 페이지가 아닙니다.'};
    else{
     const answer=await sendYouTubeCommand(command.tabId,command.action);
     outcome=answer?.ok===true?{ok:true}:{ok:false,error:answer?.error||'유튜브 탭에서 실행 응답을 받지 못했습니다.'};
    }
   }
  }catch(e){outcome={ok:false,error:e?.message||'Chrome 탭으로 명령을 전달할 수 없습니다.'};}
  await reportCommand(host,key,command,outcome);
 }catch{}finally{polling=false;}
}
async function send(type,payload){
 const settings=await chrome.storage.local.get(['server','key']);
 const host=(settings.server||'127.0.0.1').trim(), key=(settings.key||'').trim().toUpperCase();
 if(!key){chrome.action.setBadgeText({text:'SET'});return;}
 if(!validServerHost(host))return;
 try{
  const response=await fetch(`http://${host}:38765/api/${type}`,{
   method:'POST',headers:{'Content-Type':'application/json','X-Bunny-Key':key,'X-Bunny-Extension':'1'},body:JSON.stringify(payload)
  });
  chrome.action.setBadgeText({text:response.ok?'ON':'!'});
  chrome.action.setBadgeBackgroundColor({color:response.ok?'#E681AF':'#D14F55'});
  if(response.ok)pollControls(host,key);
 }catch{chrome.action.setBadgeText({text:'OFF'});chrome.action.setBadgeBackgroundColor({color:'#999999'});}
}
chrome.runtime.onMessage.addListener((message,sender)=>{
 if(message?.type!=='bunny-update'||sender.tab?.id==null)return;
 if(!/^https:\/\/(www\.youtube\.com|music\.youtube\.com)\//.test(sender.tab.url||''))return;
 send('update',{...message.data,tabId:sender.tab.id});
});
chrome.tabs.onRemoved.addListener(tabId=>send('remove',{tabId}));
chrome.tabs.onUpdated.addListener((tabId,changeInfo)=>{if(changeInfo.url&&!/^https:\/\/(www\.youtube\.com|music\.youtube\.com)\//.test(changeInfo.url))send('remove',{tabId});});
// The content script already reports media activity every ~850ms, keeping
// remote commands responsive without an always-running extension worker.
