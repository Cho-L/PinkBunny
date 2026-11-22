async function send(type,payload){
 const settings=await chrome.storage.local.get(['server','key']);
 const host=(settings.server||'127.0.0.1').trim(), key=(settings.key||'').trim().toUpperCase();
 if(!key){chrome.action.setBadgeText({text:'SET'});return;}
 if(!/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3})$/.test(host))return;
 try{
  const response=await fetch(`http://${host}:38765/api/${type}`,{
   method:'POST',headers:{'Content-Type':'application/json','X-Bunny-Key':key,'X-Bunny-Extension':'1'},body:JSON.stringify(payload)
  });
  chrome.action.setBadgeText({text:response.ok?'ON':'!'});
  chrome.action.setBadgeBackgroundColor({color:response.ok?'#E681AF':'#D14F55'});
 }catch{chrome.action.setBadgeText({text:'OFF'});chrome.action.setBadgeBackgroundColor({color:'#999999'});}
}
chrome.runtime.onMessage.addListener((message,sender)=>{
 if(message?.type!=='bunny-update'||sender.tab?.id==null)return;
 if(!/^https:\/\/(www\.youtube\.com|music\.youtube\.com)\//.test(sender.tab.url||''))return;
 send('update',{...message.data,tabId:sender.tab.id});
});
chrome.tabs.onRemoved.addListener(tabId=>send('remove',{tabId}));
chrome.tabs.onUpdated.addListener((tabId,changeInfo)=>{if(changeInfo.url&&!/^https:\/\/(www\.youtube\.com|music\.youtube\.com)\//.test(changeInfo.url))send('remove',{tabId});});