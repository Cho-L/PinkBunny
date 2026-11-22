const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(command=null,playerOutcome={ok:true}){
 const hooks={},requested=[],badge=[];
 const chrome={
  storage:{local:{get:async()=>({server:'127.0.0.1',key:'A'.repeat(32)})}},
  action:{setBadgeText:arg=>badge.push(arg.text),setBadgeBackgroundColor:()=>{}},
  runtime:{onMessage:{addListener:fn=>{hooks.message=fn}}},
  tabs:{onRemoved:{addListener:fn=>hooks.removed=fn},
        onUpdated:{addListener:fn=>hooks.updated=fn},
        get:async id=>({id,url:'https://www.youtube.com/watch?v=abc12345678'}),
        sendMessage:async()=>playerOutcome}
 };
 const ctx={chrome,URL,AbortSignal,Date,fetch:async (url,options)=>{requested.push({url,options});return {ok:true,json:async()=>({command:url.endsWith('/api/commands')?command:null})}}};
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

test('remote command reports successful Chrome execution acknowledgement',async()=>{
 const command={id:'a'.repeat(24),tabId:22,action:'toggle'};
 const m=boot(command,{ok:true});
 await m.ctx.pollControls('127.0.0.1','A'.repeat(32));
 const report=m.requested.find(x=>x.url.endsWith('/api/command-result'));
 assert.ok(report,'missing execution report to streaming PC');
 assert.equal(report.options.method,'POST');
 const body=JSON.parse(report.options.body);
 assert.equal(body.id,command.id);
 assert.equal(body.tabId,22);
 assert.equal(body.ok,true);
});
test('remote command reports YouTube content-script failure instead of silently succeeding',async()=>{
 const command={id:'b'.repeat(24),tabId:22,action:'previous'};
 const m=boot(command,{ok:false,error:'Playlist transport button not available'});
 await m.ctx.pollControls('127.0.0.1','A'.repeat(32));
 const report=m.requested.find(x=>x.url.endsWith('/api/command-result'));
 assert.ok(report);
 const body=JSON.parse(report.options.body);
 assert.equal(body.ok,false);
 assert.match(body.error,/Playlist transport/);
});
