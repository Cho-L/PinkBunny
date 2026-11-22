const player=document.getElementById('player'),title=document.getElementById('title'),channel=document.getElementById('channel'),icon=document.getElementById('stateIcon'),frame=title.parentElement;let previous='';
function render(d){const connected=!!d?.connected,playing=!!d?.playing;player.classList.toggle('idle',!connected);player.classList.toggle('paused',connected&&!playing);icon.textContent=!connected?'♡':playing?'♫':'Ⅱ';const next=connected?(d.title||'제목 없음'):'유튜브 재생을 기다리는 중…';
 if(next!==previous){previous=next;title.textContent=next;title.classList.remove('scroll');requestAnimationFrame(()=>{const overflow=title.scrollWidth-frame.clientWidth;if(overflow>8){title.style.setProperty('--view',frame.clientWidth+'px');title.style.setProperty('--duration',Math.max(9,Math.ceil(overflow/24)+6)+'s');title.classList.add('scroll');}})}
 channel.textContent=connected?(d.channel||'YouTube'):'Pink Bunny Player';
}
render({connected:false});
const es=new EventSource('/events');es.onmessage=e=>{try{render(JSON.parse(e.data))}catch{}};
if(new URLSearchParams(location.search).has('demo')){es.close();render({connected:true,playing:true,title:'밤양갱 - 비비 (BIBI) | Official Music Video',channel:'BIBI'});}
