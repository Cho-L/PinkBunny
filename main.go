package main

import (
 "embed"
 "encoding/json"
 "math"
 "fmt"
 "io"
 "log"
 "net"
 "net/http"
 "net/url"
 "os"
 "os/exec"
 "runtime"
 "sort"
 "strings"
 "sync"
 "time"
)

//go:embed overlay/*
var assets embed.FS

type Update struct {
 TabID int `json:"tabId"`
 URL string `json:"url"`
 Title string `json:"title"`
 Channel string `json:"channel"`
 VideoID string `json:"videoId"`
 Playing bool `json:"playing"`
 Position float64 `json:"position"`
 Duration float64 `json:"duration"`
 Suppressed bool `json:"suppressed"`
 NextTitle string `json:"nextTitle,omitempty"`
 NextChannel string `json:"nextChannel,omitempty"`
}
type Tab struct {
 Update
 Seen time.Time
 Activated time.Time
}
type Status struct {
 Connected bool `json:"connected"`
 Playing bool `json:"playing"`
 Title string `json:"title"`
 Channel string `json:"channel"`
 VideoID string `json:"videoId"`
 URL string `json:"url"`
 Position float64 `json:"position"`
 Duration float64 `json:"duration"`
 NextTitle string `json:"nextTitle,omitempty"`
 NextChannel string `json:"nextChannel,omitempty"`
}
type Store struct {
 sync.Mutex
 tabs map[int]Tab
 lastID int
 pinnedID int
 hidden map[int]bool
 commands []PlayerCommand
 listeners map[chan Status]struct{}
 lastJSON string
}
func (s *Store) snapshot() Status {
 now:=time.Now()
 all:=make([]Tab,0,len(s.tabs))
 for id,t:=range s.tabs {if now.Sub(t.Seen)>12*time.Second{delete(s.tabs,id);delete(s.hidden,id)}else if !s.hidden[id]&&!t.Suppressed{all=append(all,t)}}
 sort.Slice(all,func(i,j int)bool{return all[i].Seen.After(all[j].Seen)})
 var selected *Tab
 for i:=range all {t:=&all[i];if t.Playing&&(selected==nil||!selected.Playing||t.Activated.After(selected.Activated)){selected=t}}
 if s.pinnedID>0 {for i:=range all{if all[i].TabID==s.pinnedID{selected=&all[i];break}}}
 if selected==nil {for i:=range all{if all[i].TabID==s.lastID{selected=&all[i];break}}}
 if selected==nil&&len(all)>0{selected=&all[0]}
 if selected==nil{return Status{}}
 s.lastID=selected.TabID
 return Status{Connected:true,Playing:selected.Playing,Title:selected.Title,Channel:selected.Channel,VideoID:selected.VideoID,URL:selected.URL,Position:selected.Position,Duration:selected.Duration,NextTitle:selected.NextTitle,NextChannel:selected.NextChannel}
}
func (s *Store) publish(){
 st:=s.snapshot();b,_:=json.Marshal(st)
 if string(b)==s.lastJSON{return}
 s.lastJSON=string(b)
 for ch:=range s.listeners{select{case ch<-st:default:}}
}
func reply(w http.ResponseWriter,code int,v any){w.Header().Set("Content-Type","application/json; charset=utf-8");w.Header().Set("Cache-Control","no-store");w.WriteHeader(code);_ = json.NewEncoder(w).Encode(v)}
func clip(v string,max int)string{r:=[]rune(strings.TrimSpace(v));if len(r)>max{return string(r[:max])};return string(r)}
func extensionOrigin(r *http.Request)bool{
 origin:=r.Header.Get("Origin")
 if strings.HasPrefix(origin,"chrome-extension://"){
  id:=strings.TrimPrefix(origin,"chrome-extension://");if len(id)!=32{return false}
  for _,c:=range id{if c<'a'||c>'p'{return false}};return true
 }
 return origin==""&&r.Header.Get("X-Bunny-Extension")=="1"
}
func update(w http.ResponseWriter,r *http.Request,s *Store,remove bool,key string){
 if r.Method!="POST"{reply(w,405,map[string]string{"error":"Method not allowed"});return}
 if !extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key{reply(w,403,map[string]string{"error":"Not authorized"});return}
 r.Body=http.MaxBytesReader(w,r.Body,8192);defer r.Body.Close()
 var p Update
 if json.NewDecoder(r.Body).Decode(&p)!=nil||p.TabID<0{reply(w,400,map[string]string{"error":"Bad payload"});return}
 s.Lock();defer s.Unlock()
 if remove{delete(s.tabs,p.TabID);delete(s.hidden,p.TabID);if s.pinnedID==p.TabID{s.pinnedID=0}}else{
  u,e:=url.Parse(p.URL)
  if e!=nil||u.Scheme!="https"||!(u.Hostname()=="www.youtube.com"||u.Hostname()=="music.youtube.com"||u.Hostname()=="youtube.com"){reply(w,400,map[string]string{"error":"Not YouTube"});return}
  p.Title=clip(p.Title,220);if p.Title==""{reply(w,400,map[string]string{"error":"Empty title"});return}
  p.Channel=clip(p.Channel,100);p.VideoID=clip(p.VideoID,25);p.URL=clip(p.URL,350)
  p.NextTitle=clip(p.NextTitle,180);p.NextChannel=clip(p.NextChannel,90)
  if math.IsNaN(p.Position)||math.IsInf(p.Position,0)||p.Position<0 {p.Position=0}
  if math.IsNaN(p.Duration)||math.IsInf(p.Duration,0)||p.Duration<0 {p.Duration=0}
  if p.Duration>0&&p.Position>p.Duration {p.Position=p.Duration}
  now:=time.Now();old,ok:=s.tabs[p.TabID];active:=old.Activated
  if p.Playing&&(!ok||!old.Playing||old.URL!=p.URL){active=now}
  s.tabs[p.TabID]=Tab{p,now,active}
 }
 s.publish();reply(w,200,map[string]bool{"ok":true})
}
func isLocal(r *http.Request) bool {
 host,_,err:=net.SplitHostPort(r.RemoteAddr)
 if err!=nil{return false}
 ip:=net.ParseIP(host)
 return ip!=nil&&ip.IsLoopback()
}
func localIPs() []string {
 ips:=[]string{}
 for _,a:=range mustInterfaceAddrs(){if ipnet,ok:=a.(*net.IPNet);ok{
  ip:=ipnet.IP.To4()
  if ip!=nil&&!ip.IsLoopback()&&ip.IsPrivate(){ips=append(ips,ip.String())}
 }}
 return ips
}
func openBrowser(address string) {
 var command *exec.Cmd
 switch runtime.GOOS {
 case "windows": command=exec.Command("rundll32","url.dll,FileProtocolHandler",address)
 case "darwin": command=exec.Command("open",address)
 default: command=exec.Command("xdg-open",address)
 }
 _=command.Start()
}
func main(){
 key,err:=loadPairingKey();if err!=nil{log.Fatal("Pairing configuration: ",err)}
 s:=&Store{tabs:map[int]Tab{},hidden:map[int]bool{},listeners:map[chan Status]struct{}{}}
 mux:=http.NewServeMux()
 registerExtras(mux)
 mux.HandleFunc("/api/theme",makeThemeService().handler)
 avatar:=newAvatarService()
 mux.HandleFunc("/api/avatar",avatar.handler)
 mux.HandleFunc("/api/avatar/info",avatar.handler)
 mux.HandleFunc("/api/pair",func(w http.ResponseWriter,r *http.Request){
  if !isLocal(r){http.Error(w,"Local access only",403);return}
  if r.Method!="GET"{http.Error(w,"Method not allowed",405);return}
  reply(w,200,map[string]any{"code":key,"ips":localIPs(),"port":38765})
 })
 mux.HandleFunc("/setup",func(w http.ResponseWriter,r *http.Request){
  if !isLocal(r){http.Error(w,"Local access only",403);return}
  w.Header().Set("Content-Type","text/html; charset=utf-8"); b,e:=assets.ReadFile("overlay/setup.html");if e!=nil{http.Error(w,"Missing setup",500);return};_,_=w.Write(b)
 })
 mux.HandleFunc("/api/status",func(w http.ResponseWriter,r *http.Request){if r.Method!="GET"{http.Error(w,"Method not allowed",405);return};s.Lock();st:=s.snapshot();s.Unlock();reply(w,200,st)})
 mux.HandleFunc("/api/update",func(w http.ResponseWriter,r *http.Request){update(w,r,s,false,key)})
 mux.HandleFunc("/api/remove",func(w http.ResponseWriter,r *http.Request){update(w,r,s,true,key)})

 mux.HandleFunc("/api/tabs",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key{http.Error(w,"Forbidden",403);return}
  s.Lock();defer s.Unlock()
  s.snapshot()
  tabs:=make([]map[string]any,0,len(s.tabs))
  for _,t:=range s.tabs{tabs=append(tabs,map[string]any{"tabId":t.TabID,"title":t.Title,"playing":t.Playing,"hidden":s.hidden[t.TabID],"suppressed":t.Suppressed})}
  sort.Slice(tabs,func(i,j int)bool{return tabs[i]["tabId"].(int)<tabs[j]["tabId"].(int)})
  reply(w,200,map[string]any{"tabs":tabs,"pinnedId":s.pinnedID})
 })
 mux.HandleFunc("/api/select",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key{http.Error(w,"Forbidden",403);return}
  r.Body=http.MaxBytesReader(w,r.Body,1024)
  var p struct{TabID int `json:"tabId"`}
  if json.NewDecoder(r.Body).Decode(&p)!=nil||p.TabID<0 {http.Error(w,"Invalid tab",400);return}
  s.Lock();defer s.Unlock()
  if p.TabID>0 {if _,ok:=s.tabs[p.TabID];!ok||s.hidden[p.TabID]{http.Error(w,"Tab not found or hidden",404);return}}
  s.pinnedID=p.TabID;s.publish();reply(w,200,map[string]bool{"ok":true})
 })
 mux.HandleFunc("/api/visibility",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key{http.Error(w,"Forbidden",403);return}
  r.Body=http.MaxBytesReader(w,r.Body,1024)
  var p struct{TabID int `json:"tabId"`; Hidden bool `json:"hidden"`}
  if json.NewDecoder(r.Body).Decode(&p)!=nil||p.TabID<=0{http.Error(w,"Invalid tab",400);return}
  s.Lock();defer s.Unlock()
  if _,ok:=s.tabs[p.TabID];!ok{http.Error(w,"Tab not found",404);return}
  if p.Hidden{s.hidden[p.TabID]=true;if s.pinnedID==p.TabID{s.pinnedID=0}}else{delete(s.hidden,p.TabID)}
  s.publish();reply(w,200,map[string]bool{"ok":true,"hidden":p.Hidden})
 })
 mux.HandleFunc("/api/control",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||!isLocal(r)||r.Header.Get("Origin")!="http://127.0.0.1:38765"||r.Header.Get("X-PinkBunny-Action")!="1"{http.Error(w,"Forbidden",403);return}
  r.Body=http.MaxBytesReader(w,r.Body,1024);defer r.Body.Close()
  var request struct{Action string `json:"action"`;TabID int `json:"tabId"`}
  if json.NewDecoder(r.Body).Decode(&request)!=nil||!validPlayerAction(request.Action){http.Error(w,"Invalid action",400);return}
  s.Lock();defer s.Unlock()
  tabID:=request.TabID
  if tabID==0 {selected:=s.snapshot();if selected.Connected{tabID=s.lastID}}
  tab,ok:=s.tabs[tabID]
  if !ok||s.hidden[tabID]||tab.Suppressed {reply(w,409,map[string]string{"error":"No controllable video; play YouTube and choose a visible tab"});return}
  if len(s.commands)>=10{reply(w,429,map[string]string{"error":"Too many pending commands"});return}
  s.commands=append(s.commands,PlayerCommand{TabID:tabID,Action:request.Action,Created:time.Now()})
  reply(w,202,map[string]any{"queued":true,"tabId":tabID})
 })
 mux.HandleFunc("/api/commands",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key{http.Error(w,"Forbidden",403);return}
  s.Lock();defer s.Unlock()
  now:=time.Now()
  for len(s.commands)>0&&now.Sub(s.commands[0].Created)>15*time.Second{s.commands=s.commands[1:]}
  if len(s.commands)==0{reply(w,200,map[string]any{"command":nil});return}
  command:=s.commands[0];s.commands=s.commands[1:]
  reply(w,200,map[string]any{"command":command})
 })
 mux.HandleFunc("/events",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"{http.Error(w,"Method not allowed",405);return}
  f,ok:=w.(http.Flusher);if !ok{http.Error(w,"Streaming unavailable",500);return}
  w.Header().Set("Content-Type","text/event-stream; charset=utf-8");w.Header().Set("Cache-Control","no-cache, no-transform")
  ch:=make(chan Status,2)
  s.Lock();s.listeners[ch]=struct{}{};initial:=s.snapshot();s.Unlock()
  defer func(){s.Lock();delete(s.listeners,ch);s.Unlock()}()
  send:=func(st Status)bool{b,_:=json.Marshal(st);_,err:=fmt.Fprintf(w,"data: %s\n\n",b);if err!=nil{return false};f.Flush();return true}
  if !send(initial){return}
  heartbeat:=time.NewTicker(4*time.Second);defer heartbeat.Stop()
  for{select{
   case <-r.Context().Done():return
   case st:=<-ch:if !send(st){return}
   case <-heartbeat.C:if _,err:=io.WriteString(w,": ping\n\n");err!=nil{return};f.Flush()
  }}
 })
 mux.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"{http.Error(w,"Method not allowed",405);return}
  names:=map[string]string{"/":"index.html","/index.html":"index.html","/app.js":"app.js","/style.css":"style.css","/setup-extra.js":"setup-extra.js","/theme-settings.js":"theme-settings.js","/guide":"guide.html","/guide.html":"guide.html","/guide-quickstart-1pc.svg":"guide-quickstart-1pc.svg","/guide-quickstart-2pc.svg":"guide-quickstart-2pc.svg","/guide-chrome-extension.svg":"guide-chrome-extension.svg","/guide-obs-source.svg":"guide-obs-source.svg","/guide-feature-extension.svg":"guide-feature-extension.svg","/guide-feature-tabs.svg":"guide-feature-tabs.svg","/guide-feature-controls.svg":"guide-feature-controls.svg","/guide-feature-design.svg":"guide-feature-design.svg","/guide-feature-remote.svg":"guide-feature-remote.svg","/guide-feature-filters.svg":"guide-feature-filters.svg","/guide-feature-troubleshoot.svg":"guide-feature-troubleshoot.svg"}
  name,ok:=names[r.URL.Path];if !ok{http.NotFound(w,r);return}
  bytes,err:=assets.ReadFile("overlay/"+name);if err!=nil{http.Error(w,"Asset missing",500);return}
  switch{case strings.HasSuffix(name,".html"):w.Header().Set("Content-Type","text/html; charset=utf-8");case strings.HasSuffix(name,".js"):w.Header().Set("Content-Type","application/javascript");case strings.HasSuffix(name,".css"):w.Header().Set("Content-Type","text/css");case strings.HasSuffix(name,".svg"):w.Header().Set("Content-Type","image/svg+xml")}
  w.Header().Set("Cache-Control","no-store");w.Header().Set("X-Content-Type-Options","nosniff");_,_=w.Write(bytes)
 })
 handler:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  // Reject DNS-rebound hosts and never expose player status/artwork/OBS UI
  // beyond the streaming PC. The 2-PC extension uses paired API endpoints.
  if !permittedClient(r){http.Error(w,"Local access or paired extension required",403);return}
  if origin:=r.Header.Get("Origin");extensionOrigin(r)&&strings.HasPrefix(origin,"chrome-extension://")&&
   (remoteExtensionEndpoint(r.URL.Path)||r.URL.Path=="/api/pair"){
   w.Header().Set("Access-Control-Allow-Origin",origin);w.Header().Set("Vary","Origin")
   w.Header().Set("Access-Control-Allow-Headers","Content-Type, X-Bunny-Key, X-Bunny-Extension")
   w.Header().Set("Access-Control-Allow-Methods","GET, POST, OPTIONS")
  }
  if r.Method=="OPTIONS"{w.WriteHeader(204);return};mux.ServeHTTP(w,r)
 })
 ln,err:=net.Listen("tcp","0.0.0.0:38765")
 if err!=nil{fmt.Fprintln(os.Stderr,"Port 38765 is in use:",err);openBrowser("http://127.0.0.1:38765/setup");return}
 fmt.Println("🐰 Pink Bunny | OBS: http://127.0.0.1:38765")
 fmt.Println("Connection code:",key)
 for _,ip:=range localIPs(){fmt.Println("Streaming PC IPv4:",ip)}
 fmt.Println("Setup guide: http://127.0.0.1:38765/setup")
 fmt.Println("Pink Bunny is running. Use the Windows tray menu to exit.")
 runTray()
 go func(){tick:=time.NewTicker(4*time.Second);defer tick.Stop();for range tick.C{s.Lock();s.publish();s.Unlock()}}()
 if len(os.Args)<2||os.Args[1]!="--silent"{go func(){time.Sleep(350*time.Millisecond);openBrowser("http://127.0.0.1:38765/setup")}()}
 log.Fatal(http.Serve(ln,handler))
}
func mustInterfaceAddrs()[]net.Addr{a,_:=net.InterfaceAddrs();return a}
