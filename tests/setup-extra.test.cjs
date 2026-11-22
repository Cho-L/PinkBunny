const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('overlay/setup-extra.js', 'utf8');

function mount(remoteState = 'success') {
  const elements = new Map();
  const network = [];
  const periods = [];
  const remoteButtons = ['toggle','previous','next','volumeUp','volumeDown'].map(action => ({
    dataset: {pbRemote: action}, disabled: false, onclick: null,
  }));
  const root = {insertBefore(element) {element.parentElement = root;}};

  function element() {
    return {
      disabled:false,textContent:'',className:'',hidden:false,innerHTML:'',style:{},
      children:[], parentElement:null,
      append(...kids){this.children.push(...kids);},
      appendChild(kid){this.children.push(kid);},
      replaceChildren(...kids){this.children = kids;},
      querySelectorAll(selector){return selector==='[data-pb-remote]'?remoteButtons:[];},
      scrollIntoView(){},
    };
  }
  function get(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
  get('message').parentElement = root;
  get('pb-obs-port').value = '4455';
  get('pb-obs-pass').value = '';

  const checks = [
    {id:'server',label:'Pink Bunny 서버',state:'ok',detail:'서버 정상',help:'없음'},
    {id:'extension',label:'Chrome 확장',state:'attention',detail:'연결 안 됨',help:'확장 확인'},
    {id:'youtube',label:'YouTube 수신',state:'ok',detail:'Song',help:'없음'},
    {id:'obs',label:'OBS 브라우저 소스',state:'manual',detail:'자동 점검 불가',help:'OBS 확인'},
    {id:'audio',label:'방송 오디오',state:'manual',detail:'자동 점검 불가',help:'오디오 확인'},
  ];
  const fetch = async (url,opts) => {
    network.push({url,opts});
    if (url==='/api/autostart') return {ok:true,json:async()=>({enabled:false})};
    if (url==='/api/diagnostics') return {ok:true,json:async()=>({checks})};
    if (url==='/api/control') return {ok:true,json:async()=>({id:'a'.repeat(24)})};
    if (url.startsWith('/api/control/result?id=')) return {ok:true,json:async()=>({
      state:remoteState,error:remoteState==='failed'?'Playlist transport button not available':
        remoteState==='timeout'?'음악 PC 응답 없음':'',
    })};
    throw Error('Unexpected UI network call: '+url);
  };
  const document = {
    hidden:false,
    createElement:element,
    getElementById:get,
    querySelector(selector){return selector==='#message'?get('message'):null},
  };
  const ctx = {
    document,fetch,AbortSignal,
    setInterval:(fn,delay)=>periods.push({fn,delay}),
    setTimeout:fn=>{fn();return 1},
  };
  vm.runInNewContext(source,ctx,{timeout:2000,filename:'setup-extra.js'});
  return {get,network,periods,remoteButtons};
}
async function settle(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}

test('broadcast readiness UI reports only real automatic checks; OBS and audio remain manual',async()=>{
 const m=mount();await settle();
 const cards=m.get('pb-diag-list').children;
 assert.equal(cards.length,5);
 assert.match(m.get('pb-diag-summary').textContent,/2개 정상/);
 assert.match(m.get('pb-diag-summary').textContent,/1개 확인 필요/);
 assert.match(m.get('pb-diag-summary').textContent,/2개 수동 점검/);
 assert.match(cards[3].children[0].textContent,/🔎/);
 assert.match(cards[4].children[0].textContent,/🔎/);
 assert.ok(m.periods.some(p=>p.delay===12000));
});

for (const state of ['success','failed','timeout']) {
 test('remote-control UI displays '+state+' from music-PC acknowledgement',async()=>{
  const m=mount(state);await settle();
  await m.remoteButtons[0].onclick();
  const message=m.get('pb-remote-result').textContent;
  if(state==='success') assert.match(message,/✅ 음악 PC Chrome에서 명령 처리를 확인/);
  else if(state==='failed') assert.match(message,/❌ 유튜브 명령 처리 실패/);
  else assert.match(message,/⚠️ 시간 초과/);
  assert.ok(m.remoteButtons.every(b=>b.disabled===false));
  assert.ok(m.network.some(x=>x.url==='/api/control'&&x.opts.method==='POST'));
  assert.ok(m.network.some(x=>x.url.startsWith('/api/control/result?id=')));
 });
}
