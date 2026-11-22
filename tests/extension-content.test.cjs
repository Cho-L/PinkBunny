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
 const playlist={querySelectorAll:()=>nodes};
 const doc={title:'Current Song - YouTube',
 querySelector(selector){
  if(selector==='video.html5-main-video'||selector==='video')return video;
  if(selector==='ytd-playlist-panel-renderer')return playlist;
  if(selector.includes('ad-showing'))return ad?{}:null;
  if(selector.includes('h1.ytd-watch-metadata'))return {textContent:'Current Song'};
  return null; },
 addEventListener(){} };
 const page={href:'https://www.youtube.com/watch?v=abc12345678',hostname:'www.youtube.com'};
 const chrome={storage:{local:{get:async()=>({hideAds:true,hideShorts:true})},onChanged:{addListener(fn){listeners.storage=fn}}},
 runtime:{sendMessage(data){messages.push(data);return Promise.resolve()},onMessage:{addListener(fn){listeners.message=fn}}}};
 const ctx={document:doc,location:page,chrome,URL,setInterval(fn){intervals.push(fn)},setTimeout(fn){return 1},window:{addEventListener(){}}};
 vm.runInNewContext(content,ctx,{timeout:2000,filename:'extension/content.js'});
 return {messages,intervals,listeners,video,nodes,page,setAd(v){ad=v}};
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
