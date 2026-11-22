(() => {
  // Declarative + recovery injection must not register duplicate listeners
  // or multiple media polling loops in the same document.
  if(globalThis.__pinkBunnyContentAttached)return;
  globalThis.__pinkBunnyContentAttached=true;
  let last='',sent=0;
  let filters={hideAds:true,hideShorts:true};
  chrome.storage.local.get(['hideAds','hideShorts']).then(v=>{filters.hideAds=v.hideAds!==false;filters.hideShorts=v.hideShorts!==false;last='';});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.hideAds)filters.hideAds=changes.hideAds.newValue!==false;if(changes.hideShorts)filters.hideShorts=changes.hideShorts.newValue!==false;last='';read();});
  const title=()=> (document.querySelector('ytmusic-player-bar .title')?.textContent||
    document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent||
    document.querySelector('h1.title yt-formatted-string')?.textContent||
    document.title.replace(/\s*-\s*YouTube(?: Music)?\s*$/,'')||'').trim();
  const channel=()=> (document.querySelector('ytmusic-player-bar .byline')?.textContent||
    document.querySelector('ytd-watch-metadata #owner #channel-name a')?.textContent||'').trim();

  // Only use the actual visible playlist/queue. Never claim that YouTube's
  // "recommended" videos are a guaranteed next track.
  function queueInfo(){
    let nodes=[],active=-1;
    if(location.hostname==='music.youtube.com'){
      nodes=[...document.querySelectorAll('ytmusic-player-queue ytmusic-player-queue-item')];
      active=nodes.findIndex(n=>n.hasAttribute('selected')||n.getAttribute('aria-selected')==='true'||n.classList.contains('selected'));
    }else{
      const panel=document.querySelector('ytd-playlist-panel-renderer');
      if(panel){
        nodes=[...panel.querySelectorAll('ytd-playlist-panel-video-renderer')];
        active=nodes.findIndex(n=>n.hasAttribute('selected')||n.getAttribute('aria-selected')==='true'||n.classList.contains('selected'));
      }
    }
    const label=n=>(
      n?.querySelector('#video-title, .song-title, yt-formatted-string.title, .title')?.getAttribute('title')||
      n?.querySelector('#video-title, .song-title, yt-formatted-string.title, .title')?.textContent||''
    ).replace(/\s+/g,' ').trim().slice(0,180);
    const byline=n=>(
      n?.querySelector('#byline, .byline, .subtitle, #metadata')?.textContent||''
    ).replace(/\s+/g,' ').trim().slice(0,90);
    if(active<0||active+1>=nodes.length)return {nextTitle:'',nextChannel:''};
    const next=nodes[active+1];
    return {nextTitle:label(next),nextChannel:byline(next)};
  }
  function read(){
    const url=new URL(location.href);
    if(!(url.pathname==='/watch'||url.pathname.startsWith('/shorts/')||location.hostname==='music.youtube.com'))return;
    const video=document.querySelector('video.html5-main-video')||document.querySelector('video');
    if(!video||!title())return;
    const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:0;
    const position=Number.isFinite(video.currentTime)?Math.max(0,video.currentTime):0;
    const upcoming=queueInfo();
    const data={title:title(),channel:channel(),url:url.href,...upcoming,
      videoId:url.searchParams.get('v')||(url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]:''),
      playing:!video.paused&&!video.ended&&video.readyState>=2,
      suppressed:(filters.hideShorts&&url.pathname.startsWith('/shorts/'))||(filters.hideAds&&!!document.querySelector('.html5-video-player.ad-showing, #movie_player.ad-showing')),
      position:Math.round(position*10)/10,duration:Math.round(duration*10)/10};
    const serialized=JSON.stringify({...data,position:Math.floor(data.position)});
    if(serialized!==last||Date.now()-sent>3500){last=serialized;sent=Date.now();
      try{chrome.runtime.sendMessage({type:'bunny-update',data}).catch(()=>{});}catch{}
    }
  }
  // These controls are deliberately limited to the YouTube video element
  // or YouTube's own native transport buttons. They never change OBS settings.
  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.type!=='pinkbunny-player-command')return;
    const video=document.querySelector('video.html5-main-video')||document.querySelector('video');
    if(!video){sendResponse({ok:false,error:'유튜브 영상 플레이어를 찾지 못했습니다. 유튜브 탭을 새로고침해 주세요.'});return;}
    try{
      switch(message.action){
        case 'toggle':
          if(video.paused){
            // Wait for the browser to accept play(): autoplay restrictions can
            // reject the promise even when a click command was delivered.
            Promise.resolve().then(()=>video.play()).then(()=>{
              sendResponse(video.paused
                ?{ok:false,error:'브라우저가 영상 재생을 시작하지 않았습니다.'}
                :{ok:true});
              setTimeout(read,100);
            }).catch(e=>sendResponse({ok:false,error:String(e?.message||e||'재생이 차단됐습니다.')}));
            return true; // Keep Chrome's message channel open for async reply.
          }
          video.pause();
          if(!video.paused){sendResponse({ok:false,error:'일시정지가 적용되지 않았습니다.'});return;}
          break;
        case 'previous':
        case 'next':{
          const isNext=message.action==='next';
          // YouTube Music has shipped several player-bar layouts. Prefer
          // native controls rather than guessing the next recommended video.
          const selectors=isNext
            ? ['ytmusic-player-bar .next-button','ytmusic-app-layout .next-button',
               'ytmusic-player-page .next-button','button.ytp-next-button']
            : ['ytmusic-player-bar .previous-button','ytmusic-app-layout .previous-button',
               'ytmusic-player-page .previous-button','button.ytp-prev-button'];
          const button=selectors.map(sel=>document.querySelector(sel))
            .find(el=>el&&!el.disabled&&el.getAttribute?.('aria-disabled')!=='true'
              &&(!el.getClientRects||el.getClientRects().length>0));
          if(!button){
            sendResponse({ok:false,error:'이 유튜브 화면에서 '+(isNext?'다음':'이전')+
              ' 버튼을 찾을 수 없습니다. 재생목록을 재생하거나 유튜브의 해당 버튼이 보이는지 확인해 주세요.'});
            return;
          }
          button.click();
          sendResponse({ok:true,action:message.action});
          setTimeout(read,150);
          return;
        }
        case 'volumeUp':
        case 'volumeDown':{
          const before=Number(video.volume);
          const mutedBefore=!!video.muted;
          if(!Number.isFinite(before)){
            sendResponse({ok:false,error:'이 유튜브 플레이어의 볼륨을 읽지 못했습니다.'});
            return;
          }
          if(message.action==='volumeUp'){
            if(video.muted)video.muted=false;
            video.volume=Math.min(1,Math.round((before+0.1)*100)/100);
          }else{
            video.volume=Math.max(0,Math.round((before-0.1)*100)/100);
          }
          const actual=Number(video.volume);
          const muted=!!video.muted;
          if(actual===before&&muted===mutedBefore){
            sendResponse({ok:false,error:message.action==='volumeUp'
              ?'이미 최대 음량이거나 플레이어가 음량 변경을 허용하지 않습니다.'
              :'이미 최소 음량이거나 플레이어가 음량 변경을 허용하지 않습니다.'});
            return;
          }
          sendResponse({ok:true,volumePercent:Math.round(actual*100),muted});
          setTimeout(read,100);
          return;
        }
        default:sendResponse({ok:false,error:'Invalid command'});return;
      }
      sendResponse({ok:true});setTimeout(read,100);
    }catch(e){sendResponse({ok:false,error:String(e)});}
  });
  setInterval(read,850);
  document.addEventListener('play',read,true);
  document.addEventListener('pause',read,true);
  document.addEventListener('seeked',read,true);
  window.addEventListener('yt-navigate-finish',()=>{last='';setTimeout(read,500);});
  read();
})();