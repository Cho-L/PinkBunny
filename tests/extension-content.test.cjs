const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const content=fs.readFileSync('extension/content.js','utf8');

function mockItem(title,byline,selected=false){
 return {hasAttribute:name=>name==='selected'&&selected,getAttribute:name=>name==='aria-selected'&&selected?'true':null,classList:{contains:()=>false},
 querySelector:selector=>selector.startsWith('#byline')?{textContent:byline}:{textContent:title,getAttribute:()=>''}};
}
function setup(){
 const messages=[],intervals=[],listeners={};
 const video={duration:120,currentTime:12,paused:false,ended:false,readyState:4,volume:0.5,play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true}};
 const nodes=[mockItem('Playing','Artist',true),mockItem('  Next   Song  ','Next Artist')];
 let ad=false;
 let musicControl=null;
 let regularNextControl=null;
 let regularPrevControl=null;
 const playlist={querySelectorAll:()=>nodes};
 const doc={title:'Current Song - YouTube',
 querySelector(selector){
  if(selector==='video.html5-main-video'||selector==='video')return video;
  if(selector==='ytd-playlist-panel-renderer')return playlist;
  if(selector.includes('ad-showing'))return ad?{}:null;
  if(selector==='ytmusic-player-bar .next-button'||selector==='ytmusic-player-bar .previous-button')return musicControl;
  if(selector==='#movie_player .ytp-next-button'||selector==='.ytp-next-button')return regularNextControl;
  if(selector==='#movie_player .ytp-prev-button'||selector==='.ytp-prev-button')return regularPrevControl;
  if(selector.includes('h1.ytd-watch-metadata'))return {textContent:'Current Song'};
  return null; },
 addEventListener(){} };
 const page={href:'https://www.youtube.com/watch?v=abc12345678',hostname:'www.youtube.com'};
 const chrome={storage:{local:{get:async()=>({hideAds:true,hideShorts:true})},onChanged:{addListener(fn){listeners.storage=fn}}},
 runtime:{sendMessage(data){messages.push(data);return Promise.resolve()},onMessage:{addListener(fn){listeners.message=fn}}}};
 const ctx={document:doc,location:page,chrome,URL,setInterval(fn){intervals.push(fn)},setTimeout(fn){return 1},window:{addEventListener(){}}};
 vm.runInNewContext(content,ctx,{timeout:2000,filename:'extension/content.js'});
 return {messages,intervals,listeners,video,nodes,page,setAd(v){ad=v},setMusicControl(v){musicControl=v},setRegularNextControl(v){regularNextControl=v},setRegularPrevControl(v){regularPrevControl=v}};
}
test('playlist next title and byline come from the item immediately after selected',async()=>{
 const m=setup();await Promise.resolve();m.intervals[0]();
 const latest=m.messages.at(-1).data;
 assert.equal(latest.title,'Current Song');
 assert.equal(latest.nextTitle,'Next Song');
 assert.equal(latest.nextChannel,'Next Artist');
 assert.equal(latest.suppressed,false);
});
test('ads and Shorts never broadcast while matching filters are on',async()=>{
 const m=setup();await Promise.resolve();
 m.setAd(true);m.intervals[0]();assert.equal(m.messages.at(-1).data.suppressed,true);
 m.listeners.storage({hideAds:{newValue:false}},'local');assert.equal(m.messages.at(-1).data.suppressed,false);
 m.page.href='https://www.youtube.com/shorts/abc12345678';m.intervals[0]();
 assert.equal(m.messages.at(-1).data.suppressed,true);
 m.listeners.storage({hideShorts:{newValue:false}},'local');
 assert.equal(m.messages.at(-1).data.suppressed,false);
});
test('remote player control toggles playback and adjusts volume without leaving page',()=>{
 const m=setup();let result;
 m.listeners.message({type:'pinkbunny-player-command',action:'toggle'},null,x=>{result=x});
 assert.equal(result.ok,true);assert.equal(m.video.paused,true);
 m.listeners.message({type:'pinkbunny-player-command',action:'volumeUp'},null,x=>{result=x});
 assert.equal(result.ok,true);assert.equal(m.video.volume,0.6);
 m.listeners.message({type:'pinkbunny-player-command',action:'navigate'},null,x=>{result=x});
 assert.equal(result.ok,false);
});
test('no playlist selection means no guessed next track',()=>{
 const m=setup();m.nodes[0]=mockItem('Playing','Artist',false);m.intervals[0]();
 assert.equal(m.messages.at(-1).data.nextTitle,'');
});

test('play acknowledgement waits for the play promise and confirms playback',async()=>{
 const m=setup();
 m.video.paused=true;
 let result;
 const keepOpen=m.listeners.message({type:'pinkbunny-player-command',action:'toggle'},null,x=>{result=x});
 assert.equal(keepOpen,true,'async Chrome message port must remain open');
 assert.equal(result,undefined,'must not acknowledge until play resolves');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(result?.ok,true);
 assert.equal(m.video.paused,false);
});
test('autoplay rejection is reported to the streaming PC as a failed command',async()=>{
 const m=setup();
 m.video.paused=true;
 m.video.play=()=>Promise.reject(Error('NotAllowedError: gesture required'));
 let result;
 const keepOpen=m.listeners.message({type:'pinkbunny-player-command',action:'toggle'},null,x=>{result=x});
 assert.equal(keepOpen,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(result?.ok,false);
 assert.match(result?.error||'',/NotAllowedError/);
});

test('volume down returns the actual volume percentage and volume up unmutes',()=>{
 const m=setup();
 let response;
 m.listeners.message({type:'pinkbunny-player-command',action:'volumeDown'},null,r=>response=r);
 assert.equal(response.ok,true);
 assert.equal(response.volumePercent,40);
 assert.equal(m.video.volume,0.4);
 m.video.muted=true;
 m.listeners.message({type:'pinkbunny-player-command',action:'volumeUp'},null,r=>response=r);
 assert.equal(response.ok,true);
 assert.equal(response.volumePercent,50);
 assert.equal(response.muted,false);
 assert.equal(m.video.muted,false);
});
test('at maximum or minimum volume the player does not falsely report successful adjustment',()=>{
 const m=setup();
 let response;
 m.video.volume=1;
 m.video.muted=false;
 m.listeners.message({type:'pinkbunny-player-command',action:'volumeUp'},null,r=>response=r);
 assert.equal(response.ok,false);
 assert.match(response.error,/최대 음량/);
 m.video.volume=0;
 m.listeners.message({type:'pinkbunny-player-command',action:'volumeDown'},null,r=>response=r);
 assert.equal(response.ok,false);
 assert.match(response.error,/최소 음량/);
});
test('standard YouTube next uses the native anchor-based transport button',()=>{
 const m=setup();
 let clicks=0;
 // Real YouTube's control often renders as <a class="ytp-next-button">.
 const anchor={tagName:'A',disabled:false,getAttribute:()=>null,getClientRects:()=>[{}],click(){clicks++}};
 m.setRegularNextControl(anchor);
 let result;
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>result=r);
 assert.equal(result.ok,true);
 assert.equal(clicks,1);
});
test('standard YouTube previous supports anchor control too',()=>{
 const m=setup();
 let clicks=0;
 m.setRegularPrevControl({tagName:'A',disabled:false,getAttribute:()=>null,getClientRects:()=>[{}],click(){clicks++}});
 let result;
 m.listeners.message({type:'pinkbunny-player-command',action:'previous'},null,r=>result=r);
 assert.equal(result.ok,true);
 assert.equal(clicks,1);
});
test('hidden or disabled native next control reports unavailable instead of clicking',()=>{
 const m=setup();
 let clicks=0;
 const control={tagName:'A',disabled:false,getAttribute:name=>name==='aria-disabled'?'true':null,getClientRects:()=>[{}],click(){clicks++}};
 m.setRegularNextControl(control);
 let result;
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>result=r);
 assert.equal(result.ok,false);
 assert.match(result.error,/비활성화/);
 assert.equal(clicks,0);
 control.getAttribute=()=>null;
 control.getClientRects=()=>[];
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>result=r);
 assert.equal(result.ok,false);
 assert.equal(clicks,0);
});
test('YouTube Music next uses player-bar native control instead of recommendations',()=>{
 const m=setup();
 m.page.hostname='music.youtube.com';
 m.page.href='https://music.youtube.com/watch?v=abc12345678';
 let clicks=0;
 m.setMusicControl({tagName:'TP-YT-PAPER-ICON-BUTTON',disabled:false,getAttribute:()=>null,getClientRects:()=>[{}],click(){clicks++}});
 let result;
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>result=r);
 assert.equal(result.ok,true);
 assert.equal(clicks,1);
});
test('next video only claims button press when an enabled YouTube Music transport exists',()=>{
 const m=setup();
 let response;
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>response=r);
 assert.equal(response.ok,false);
 assert.match(response.error,/다음 버튼을 찾지 못했습니다/);
 let clicked=0;
 m.setMusicControl({disabled:false,getAttribute:()=>null,getClientRects:()=>[{}],click(){clicked++}});
 m.listeners.message({type:'pinkbunny-player-command',action:'next'},null,r=>response=r);
 assert.equal(response.ok,true);
 assert.equal(clicked,1);
});
