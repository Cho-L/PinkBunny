const player=document.getElementById('player'),title=document.getElementById('title'),channel=document.getElementById('channel'),icon=document.getElementById('stateIcon'),frame=title.parentElement,progress=document.getElementById('progress'),elapsed=document.getElementById('elapsed'),durationEl=document.getElementById('duration'),cover=document.getElementById('cover');
let previous='',current=null,lastUpdate=performance.now(),shownVideo='';
const fmt=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/3600)>0?Math.floor(s/3600)+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'):Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function updateClock(){
  const d=current||{},total=Number(d.duration)||0;
  const extrapolated=(Number(d.position)||0)+(d.playing?(performance.now()-lastUpdate)/1000:0);
  const pos=total>0?Math.min(total,extrapolated):extrapolated;
  progress.style.width=total>0?Math.max(0,Math.min(100,pos/total*100))+'%':'0%';
  elapsed.textContent=fmt(pos);durationEl.textContent=total>0?fmt(total):'LIVE';
}
function render(d){
  current=d;lastUpdate=performance.now();
  const connected=!!d?.connected,playing=!!d?.playing;
  player.classList.toggle('idle',!connected);player.classList.toggle('paused',connected&&!playing);
  icon.textContent=!connected?'♡':playing?'♫':'Ⅱ';
  const next=connected?(d.title||'제목 없음'):'유튜브 재생을 기다리는 중…';
  if(next!==previous){previous=next;title.textContent=next;title.classList.remove('scroll');
    requestAnimationFrame(()=>{const overflow=title.scrollWidth-frame.clientWidth;if(overflow>8){title.style.setProperty('--view',frame.clientWidth+'px');title.style.setProperty('--duration',Math.max(9,Math.ceil(overflow/24)+6)+'s');title.classList.add('scroll')}})}
  channel.textContent=connected?(d.channel||'YouTube'):'Pink Bunny Player';
  const vid=/^[A-Za-z0-9_-]{11}$/.test(d?.videoId||'')?d.videoId:'';
  if(vid!==shownVideo){shownVideo=vid;cover.removeAttribute('src');cover.style.display=vid?'block':'none';
    if(vid)cover.src='https://i.ytimg.com/vi/'+vid+'/mqdefault.jpg';
  }
  updateClock();
}
render({connected:false});
const demo=new URLSearchParams(location.search).has('demo');
if(demo){render({connected:true,playing:true,title:'Pink Bunny · 유튜브 Now Playing 미리보기',channel:'YouTube',position:48,duration:205,videoId:''})}
else{const es=new EventSource('/events');es.onmessage=e=>{try{render(JSON.parse(e.data))}catch{}}}
setInterval(updateClock,200);


const pbThemes={
 pink:['#fff0f8','#ffc6e2','#d36b9f'],
 purple:['#f3eaff','#d7bbf7','#9b78c6'],
 mint:['#e6fff7','#a8e9d7','#4caa94'],
 peach:['#fff1e5','#ffd0b7','#df8b68']
};
let themeConfig=null;
function applyTheme(config){
 if(!config||!pbThemes[config.color])return;
 if(!Number.isFinite(config.opacity)||config.opacity<20||config.opacity>100)return;
 if(!Number.isFinite(config.scale)||config.scale<75||config.scale>100)return;
 themeConfig=config;
 const [a,b,accent]=pbThemes[config.color];
 const rgba=(hex,opacity)=>{const raw=hex.slice(1),parts=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16));return 'rgba('+parts.join(',')+','+(opacity/100)+')'};
 player.style.setProperty('--pb-bg1',rgba(a,config.opacity));
 player.style.setProperty('--pb-bg2',rgba(b,config.opacity));
 player.style.setProperty('--pb-accent',accent);
 player.style.setProperty('--pb-scale',String(config.scale/100));
 const imageScale=Number(config.avatarScale)||100,imageX=Number(config.avatarX)||0,imageY=Number(config.avatarY)||0;
 if(imageScale>=50&&imageScale<=200&&Math.abs(imageX)<=40&&Math.abs(imageY)<=40){
  player.style.setProperty('--pb-avatar-scale',String(imageScale/100));
  player.style.setProperty('--pb-avatar-x',imageX+'px');
  player.style.setProperty('--pb-avatar-y',imageY+'px');
 }
 player.classList.toggle('no-animation',!config.animate);
 player.classList.toggle('no-cover',!config.showCover);
 player.classList.remove('layout-classic','layout-compact','layout-cover');
 player.classList.add('layout-'+(['classic','compact','cover'].includes(config.layout)?config.layout:'classic'));
}
async function refreshTheme(){
 try{
  const r=await fetch('/api/theme',{cache:'no-store'});
  if(r.ok)applyTheme(await r.json());
 }catch{}
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='pink-bunny-theme-preview')return;
 applyTheme(event.data.value);
});
refreshTheme();
if(!demo)setInterval(refreshTheme,2000);

const customAvatar=document.getElementById('customAvatar');
let avatarVersion=null;
async function refreshAvatar(){
 try{
  const r=await fetch('/api/avatar/info',{cache:'no-store'});
  if(!r.ok)return;
  const data=await r.json();
  const next=data.present?String(data.version):'none';
  if(avatarVersion===next)return;
  avatarVersion=next;
  if(data.present){
   customAvatar.hidden=false;
   customAvatar.src='/api/avatar?v='+encodeURIComponent(data.version);
   player.classList.add('has-avatar');
  }else{
   customAvatar.hidden=true;
   customAvatar.removeAttribute('src');
   player.classList.remove('has-avatar');
  }
 }catch{}
}
customAvatar.addEventListener('error',()=>{customAvatar.hidden=true;player.classList.remove('has-avatar')});
refreshAvatar();
setInterval(refreshAvatar,2000);
window.addEventListener('message',event=>{
 if(event.origin===location.origin&&event.data?.type==='pink-bunny-avatar-refresh')refreshAvatar();
});
