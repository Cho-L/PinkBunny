(() => {
  let lastPayload = '', lastSent = 0;
  const getTitle = () => (document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent
    || document.querySelector('h1.title yt-formatted-string')?.textContent
    || document.querySelector('ytmusic-player-bar .title')?.textContent
    || document.title.replace(/\s*-\s*YouTube(?: Music)?\s*$/, '') || '').trim();
  const getChannel = () => (document.querySelector('ytd-watch-metadata #owner #channel-name a')?.textContent
    || document.querySelector('ytmusic-player-bar .byline')?.textContent || '').trim();
  function sendIfChanged() {
    const video=document.querySelector('video.html5-main-video')||document.querySelector('video');
    if(!video)return;
    const url=new URL(location.href);
    if(!(url.pathname==='/watch'||url.pathname.startsWith('/shorts/')||location.hostname==='music.youtube.com'))return;
    const title=getTitle();if(!title)return;
    const data={title,channel:getChannel(),url:url.href,videoId:url.searchParams.get('v')||(url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]:''),playing:!video.paused&&!video.ended&&video.readyState>=2};
    const serialized=JSON.stringify(data),now=Date.now();
    if(serialized!==lastPayload||now-lastSent>3000){
      lastPayload=serialized;lastSent=now;
      try{chrome.runtime.sendMessage({type:'bunny-update',data}).catch(()=>{});}catch{}
    }
  }
  setInterval(sendIfChanged,1000);
  document.addEventListener('play',sendIfChanged,true);
  document.addEventListener('pause',sendIfChanged,true);
  window.addEventListener('yt-navigate-finish',()=>{lastPayload='';setTimeout(sendIfChanged,600);});
  sendIfChanged();
})();