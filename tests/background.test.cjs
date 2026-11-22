const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
 const hooks={},requested=[],badge=[];
 const chrome={
  storage:{local:{get:async()=>({server:'127.0.0.1',key:'A'.repeat(32)})}},
  action:{setBadgeText:arg=>badge.push(arg.text),setBadgeBackgroundColor:()=>{}},
  runtime:{onMessage:{addListener:fn=>{hooks.message=fn}}},
  tabs:{onRemoved:{addListener:fn=>hooks.removed=fn},
        onUpdated:{addListener:fn=>hooks.updated=fn},
        get:async id=>({id,url:'https://www.youtube.com/watch?v=abc12345678'}),
        sendMessage:async()=>({ok:true})}
 };
 const ctx={chrome,URL,AbortSignal,Date,fetch:async (url,options)=>{requested.push({url,options});return {ok:true,json:async()=>({command:null})}}};
 vm.runInNewContext(fs.readFileSync('extension/background.js','utf8'),ctx,{timeout:1000});
 return {ctx,hooks,requested,badge};
}

test('background rejects public IPs and malformed hosts',()=>{
 const m=boot();
 for(const host of ['localhost','127.0.0.1','192.168.0.9','10.23.1.4','172.16.0.1','172.31.255.2']){
  assert.equal(m.ctx.validServerHost(host),true,host);
 }
 for(const host of ['8.8.8.8','172.32.0.1','169.254.0.10','999.1.2.3','bad.example','0.0.0.0']){
  assert.equal(m.ctx.validServerHost(host),false,host);
 }
});
test('background only accepts YouTube sender updates',async()=>{
 const m=boot();
 m.hooks.message({type:'bunny-update',data:{title:'Song'}},{tab:{id:17,url:'https://evil.example/watch'}});
 await Promise.resolve();await Promise.resolve();
 assert.equal(m.requested.length,0);
 m.hooks.message({type:'bunny-update',data:{title:'Song'}},{tab:{id:17,url:'https://www.youtube.com/watch?v=123'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(m.requested.some(v=>v.url==='http://127.0.0.1:38765/api/update'));
});
