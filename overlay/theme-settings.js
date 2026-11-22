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
 <label>레이아웃 <select id="theme-layout">
  <option value="classic">🐰 기본형</option>
  <option value="compact">📏 컴팩트</option>
  <option value="cover">🖼️ 이미지 강조</option>
 </select></label>
 </div>
 <div class="row" style="margin-top:10px">
 <label><input id="theme-animate" type="checkbox" checked> 🐰 토끼 귀 애니메이션</label>
 <label><input id="theme-cover" type="checkbox" checked> 🖼️ 유튜브 썸네일</label>
 </div>
 <div class="row" style="margin-top:12px"><button id="theme-save">설정 저장</button><button id="theme-reset" class="secondary">기본 디자인 복원</button></div>
 <p id="theme-result" class="tiny" role="status"></p>
 <hr style="border:0;border-top:1px solid #eac0d5;margin:16px 0">
 <strong>🐰 내 캐릭터 이미지 등록</strong>
 <p class="tiny">PNG 또는 JPEG 이미지만 지원합니다. 최대 2MB, 가로·세로 각각 2048px 이하. 배경이 투명한 PNG를 추천해요. 이미지는 송출 PC에만 보관됩니다.</p>
 <input id="pb-avatar-file" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" style="max-width:100%;margin:8px 0">
 <div class="row"><button id="pb-avatar-upload">이미지 적용</button><button id="pb-avatar-remove" class="secondary">기본 토끼로 복원</button></div>
 <p class="tiny" id="pb-avatar-result" role="status"></p>`;
 const anchor=document.querySelector('#message');
 anchor.parentElement.insertBefore(card,anchor);
 const $=id=>document.getElementById(id);
 const defaults={color:'pink',opacity:78,scale:100,animate:true,showCover:true,layout:'classic'};
 const fields=['theme-color','theme-opacity','theme-scale','theme-animate','theme-cover','theme-layout'];
 function getForm(){return {color:$('theme-color').value,opacity:Number($('theme-opacity').value),scale:Number($('theme-scale').value),animate:$('theme-animate').checked,showCover:$('theme-cover').checked,layout:$('theme-layout').value}}
 function fill(v){
  $('theme-color').value=v.color;$('theme-opacity').value=v.opacity;$('theme-scale').value=v.scale;
  $('theme-animate').checked=v.animate;$('theme-cover').checked=v.showCover;$('theme-layout').value=v.layout||'classic';
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
 const avatarInput=$('pb-avatar-file'), avatarStatus=$('pb-avatar-result');
 async function avatarRefresh(){
  try{
   const r=await fetch('/api/avatar/info',{cache:'no-store'}),d=await r.json();
   avatarStatus.textContent=d.present?'✅ 사용자 이미지가 적용되어 있어요.':'현재 기본 토끼 캐릭터를 사용 중이에요.';
   $('theme-preview').contentWindow?.postMessage({type:'pink-bunny-avatar-refresh'},location.origin);
  }catch{avatarStatus.textContent='이미지 상태를 확인하지 못했어요.';}
 }
 $('pb-avatar-upload').onclick=async()=>{
  const file=avatarInput.files?.[0];
  if(!file){avatarStatus.textContent='❌ 먼저 PNG/JPEG 이미지를 선택하세요.';return;}
  if(file.size>2*1024*1024){avatarStatus.textContent='❌ 이미지 크기는 최대 2MB입니다.';return;}
  avatarStatus.textContent='이미지를 저장하는 중…';
  try{
   const r=await fetch('/api/avatar',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-PinkBunny-Action':'1'},body:file});
   if(!r.ok){const e=await r.json().catch(()=>({error:'업로드 실패'}));throw Error(e.error||'업로드 실패');}
   await avatarRefresh();
  }catch(e){avatarStatus.textContent='❌ '+e.message;}
 };
 $('pb-avatar-remove').onclick=async()=>{
  try{
   const r=await fetch('/api/avatar',{method:'DELETE',headers:{'X-PinkBunny-Action':'1'}});
   if(!r.ok)throw Error('이미지 삭제 실패');
   avatarInput.value='';await avatarRefresh();
  }catch(e){avatarStatus.textContent='❌ '+e.message;}
 };
 avatarRefresh();
 fetch('/api/theme').then(r=>r.json()).then(v=>fill(v)).catch(()=>{$('theme-result').textContent='디자인 정보를 불러오지 못했어요.';});
})();
