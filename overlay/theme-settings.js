(() => {
 const card=document.createElement('section');
 card.className='card';
 card.innerHTML=`<h2>🎨 Pink Bunny 디자인 설정</h2>
 <p class="tiny">여기서 변경한 디자인은 OBS 위젯에 자동 반영돼요. 설정은 이 컴퓨터에 저장됩니다.</p>
 <div style="margin-bottom:12px"><iframe id="theme-preview" title="플레이어 미리보기" src="/?demo" style="width:420px;max-width:100%;height:135px;border:0;border-radius:12px;background:linear-gradient(120deg,#f1e5ee,#d5d4dd)"></iframe></div>
 <div class="row">
 <label>색상 <select id="theme-color"><option value="pink">🌸 핑크</option><option value="purple">💜 라벤더</option><option value="mint">🍃 민트</option><option value="peach">🍑 피치</option></select></label>
 <label>배경 불투명도 <input id="theme-opacity" type="range" min="20" max="100" step="5" value="80"><span id="theme-opacity-val">80%</span></label>
 <label>플레이어 크기 <input id="theme-scale" type="range" min="75" max="100" step="5" value="100"><span id="theme-scale-val">100%</span></label>
 </div>
 <div class="row" style="margin-top:10px">
 <label><input id="theme-animate" type="checkbox" checked> 🐰 토끼 귀 애니메이션</label>
 <label><input id="theme-cover" type="checkbox" checked> 🖼️ 유튜브 썸네일</label>
 </div>
 <div class="row" style="margin-top:12px"><button id="theme-save">설정 저장</button><button id="theme-reset" class="secondary">기본 디자인 복원</button></div>
 <p id="theme-result" class="tiny" role="status"></p>`;
 const anchor=document.querySelector('#message');
 anchor.parentElement.insertBefore(card,anchor);
 const $=id=>document.getElementById(id);
 const defaults={color:'pink',opacity:78,scale:100,animate:true,showCover:true};
 const fields=['theme-color','theme-opacity','theme-scale','theme-animate','theme-cover'];
 function getForm(){return {color:$('theme-color').value,opacity:Number($('theme-opacity').value),scale:Number($('theme-scale').value),animate:$('theme-animate').checked,showCover:$('theme-cover').checked}}
 function fill(v){
  $('theme-color').value=v.color;$('theme-opacity').value=v.opacity;$('theme-scale').value=v.scale;
  $('theme-animate').checked=v.animate;$('theme-cover').checked=v.showCover;
  $('theme-opacity-val').textContent=v.opacity+'%';$('theme-scale-val').textContent=v.scale+'%';
  $('theme-preview').contentWindow?.postMessage({type:'pink-bunny-theme-preview',value:v},location.origin);
 }
 for(const id of fields)$(id).addEventListener('input',()=>fill(getForm()));
 $('theme-preview').addEventListener('load',()=>fill(getForm()));
 $('theme-save').onclick=async()=>{
   $('theme-result').textContent='설정 저장 중…';
   try{
    const r=await fetch('/api/theme',{method:'POST',headers:{'Content-Type':'application/json','X-PinkBunny-Action':'1'},body:JSON.stringify(getForm())});
    if(!r.ok)throw Error('저장 요청이 실패했어요.');
    fill(await r.json());$('theme-result').textContent='✅ 저장 완료 · OBS에도 곧 반영됩니다.';
   }catch(e){$('theme-result').textContent='❌ '+e.message;}
 };
 $('theme-reset').onclick=()=>{fill(defaults);$('theme-save').click()};
 fetch('/api/theme').then(r=>r.json()).then(v=>fill(v)).catch(()=>{$('theme-result').textContent='디자인 정보를 불러오지 못했어요.';});
})();
