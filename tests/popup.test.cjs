const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('extension/popup.js','utf8');

function makeElement(){
 return {value:'0',textContent:'',checked:false,hidden:false,disabled:false,items:[],handlers:{},classList:{add(){}},
 addEventListener(name,fn){this.handlers[name]=fn},replaceChildren(...items){this.items=items},add(item){this.items.push(item)}};
}
function initialize(fullPage=false,offline=false,playerReply={ok:true}){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,makeElement());return elements.get(id)};
 const controls=['next','volumeDown'].map(control=>({dataset:{control},handlers:{},addEventListener(name,fn){this.handlers[name]=fn}}));
 const opened=[],sent=[],events=[],requests=[],storage={server:'127.0.0.1',key:'AABBCCDD',hideAds:true,hideShorts:true};
 const yt={id:22,url:'https://www.youtube.com/watch?v=abc12345678',title:'Playlist Song',lastAccessed:200};
 const ext={id:33,url:'chrome-extension://abc/popup.html?mode=full',title:'Pink Bunny Settings',lastAccessed:250};
 const chrome={permissions:{request:async args=>{requests.push(args);return true}},storage:{local:{get:async()=>({...storage}),set:async v=>Object.assign(storage,v)}},
 tabs:{query:async q=>q.active?[fullPage?ext:yt]:[ext,yt],create:async opts=>opened.push(opts),sendMessage:async(id,msg)=>{sent.push({id,msg});return playerReply}},
 runtime:{getURL:path=>'chrome-extension://abc/'+path}};
 const document={body:{classList:{add(name){events.push(name)}}},getElementById:get,
 querySelectorAll(selector){return selector==='[data-control]'?controls:[]}};
 const ctx={URL,URLSearchParams,AbortSignal,document,location:{search:fullPage?'?mode=full':''},chrome,Option:class {constructor(text,value){this.text=text;this.value=value}},
 fetch:async()=>{if(offline)throw Error('Offline');return {ok:true,json:async()=>({tabs:[{tabId:22,title:'Playlist Song',playing:true,hidden:false}],pinnedId:0})}}};
 vm.runInNewContext(script,ctx,{timeout:2000});
 return {get,opened,sent,storage,ctx,events,requests,controls};
}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))}

test('extension popup offers a persistent browser-tab dashboard',async()=>{
 const x=initialize(false);await flush();
 assert.equal(typeof x.get('openDashboard').handlers.click,'function');
 x.get('openDashboard').handlers.click();
 assert.equal(x.opened[0].url,'chrome-extension://abc/popup.html?mode=full');
});
test('full-page mode selects the last YouTube tab even though dashboard has focus',async()=>{
 const x=initialize(true);await flush();
 assert.equal(x.get('openDashboard').hidden,true);
 assert.match(x.get('activeVideo').textContent,/Playlist Song/);
 assert.equal(x.get('pinCurrent').disabled,false);
 await x.get('pinCurrent').onclick();
 assert.match(x.get('status').textContent,/고정/);
});
test('invalid server IPs are rejected and failed pairing link remains editable',async()=>{
 const x=initialize(false,true);await flush();
 assert.equal(x.ctx.validHost('999.10.10.10'),false);
 assert.equal(x.ctx.validHost('192.168.0.12'),true);
 assert.equal(x.ctx.validHost('localhost'),true);
 assert.equal(x.ctx.validHost('10.1.2.3'),true);
 assert.equal(x.ctx.validHost('172.25.0.8'),true);
 assert.equal(x.ctx.validHost('8.8.8.8'),false);
 x.get('pair').value='pinkbunny://pair?host=192.168.0.1&port=38765&key=AABBCCDD';
 await x.get('apply').onclick();
 assert.match(x.get('pair').value,/pinkbunny:\/\/pair/);
});

test('new 128-bit pairing code asks permission only for the chosen private streaming PC',async()=>{
 const x=initialize(false);await flush();
 const token='A'.repeat(32);
 x.get('pair').value='pinkbunny://pair?host=192.168.1.42&port=38765&key='+token;
 await x.get('apply').onclick();await flush();
 assert.equal(x.requests.length,1);
 assert.equal(x.requests[0].origins[0],'http://192.168.1.42/*');
 assert.equal(x.storage.server,'192.168.1.42');
 assert.equal(x.storage.key,token);
 assert.equal(x.get('pair').value,'');
});
test('same-PC connection requests no optional remote host access',async()=>{
 const x=initialize(false);await flush();
 await x.get('auto').onclick();await flush();
 assert.equal(x.requests.length,0);
});
test('remote picture guide uses public illustrated GitHub page when LAN UI is disabled',async()=>{
 const x=initialize(false);await flush();
 x.storage.server='192.168.1.42';
 x.get('openFeatureGuide').handlers.click();await flush();
 assert.match(x.opened.at(-1).url,/github\.com\/Cho-L\/PinkBunny\/blob\/main\/GUIDE\.md#features/);
});

test('popup shows volume percentage immediately next to playback controls',async()=>{
 const x=initialize(false,false,{ok:true,volumePercent:40,muted:false});
 await flush();
 await x.controls.find(b=>b.dataset.control==='volumeDown').handlers.click();
 await flush();
 assert.match(x.get('controlStatus').textContent,/유튜브 영상 음량: 40%/);
 assert.equal(x.sent.at(-1).id,22);
 assert.equal(x.sent.at(-1).msg.action,'volumeDown');
});
test('popup reports unavailable next button in the visible controls area',async()=>{
 const x=initialize(false,false,{ok:false,error:'이 유튜브 화면에서 다음 버튼을 찾을 수 없습니다.'});
 await flush();
 await x.controls.find(b=>b.dataset.control==='next').handlers.click();
 await flush();
 assert.match(x.get('controlStatus').textContent,/❌ .*다음 버튼/);
});
test('full-page settings uses the selected YouTube tab, not the settings page',async()=>{
 const x=initialize(true,false,{ok:true});
 await flush();
 await x.controls.find(b=>b.dataset.control==='next').handlers.click();
 await flush();
 assert.equal(x.sent.at(-1).id,22);
 assert.match(x.get('controlStatus').textContent,/버튼을 눌렀어요/);
});
