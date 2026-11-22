(() => {
  let last='',sent=0;
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
      position:Math.round(position*10)/10,duration:Math.round(duration*10)/10};
    const serialized=JSON.stringify({...data,position:Math.floor(data.position)});
    if(serialized!==last||Date.now()-sent>3500){last=serialized;sent=Date.now();
      try{chrome.runtime.sendMessage({type:'bunny-update',data}).catch(()=>{});}catch{}
    }
  }
  setInterval(read,850);
  document.addEventListener('play',read,true);
  document.addEventListener('pause',read,true);
  document.addEventListener('seeked',read,true);
  window.addEventListener('yt-navigate-finish',()=>{last='';setTimeout(read,500);});
  read();
})();