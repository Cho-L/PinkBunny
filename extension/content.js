(() => {
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
  function read(){
    const url=new URL(location.href);
    if(!(url.pathname==='/watch'||url.pathname.startsWith('/shorts/')||location.hostname==='music.youtube.com'))return;
    const video=document.querySelector('video.html5-main-video')||document.querySelector('video');
    if(!video||!title())return;
    const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:0;
    const position=Number.isFinite(video.currentTime)?Math.max(0,video.currentTime):0;
    const data={title:title(),channel:channel(),url:url.href,
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
    if(!video){sendResponse({ok:false,error:'No YouTube video'});return;}
    try{
      switch(message.action){
        case 'toggle':
          if(video.paused)video.play().catch(()=>{});else video.pause();break;
        case 'previous':
        case 'next':{
          const selectors=message.action==='next'
            ? ['ytmusic-player-bar .next-button','button.ytp-next-button']
            : ['ytmusic-player-bar .previous-button','button.ytp-prev-button'];
          const button=selectors.map(sel=>document.querySelector(sel)).find(x=>x&&!x.disabled);
          if(!button){sendResponse({ok:false,error:'Playlist transport button not available'});return;}
          button.click();break;
        }
        case 'volumeUp':video.volume=Math.min(1,Math.round((video.volume+0.1)*100)/100);break;
        case 'volumeDown':video.volume=Math.max(0,Math.round((video.volume-0.1)*100)/100);break;
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