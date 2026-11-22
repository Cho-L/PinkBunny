package main

import (
 "encoding/json"
 "net/http"
 "time"
)

// The streaming-PC setup page submits commands, but a 202 Accepted response
// means queued only. The music-PC extension explicitly reports its content
// script's outcome through /api/command-result.
func registerPlayerControlEndpoints(mux *http.ServeMux, s *Store, key string) {
 mux.HandleFunc("/api/control",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||!isLocal(r)||r.Header.Get("Origin")!="http://127.0.0.1:38765"||r.Header.Get("X-PinkBunny-Action")!="1" {
   http.Error(w,"Forbidden",403);return
  }
  r.Body=http.MaxBytesReader(w,r.Body,1024);defer r.Body.Close()
  var request struct{Action string `json:"action"`;TabID int `json:"tabId"`}
  if json.NewDecoder(r.Body).Decode(&request)!=nil||!validPlayerAction(request.Action)||request.TabID<0 {
   http.Error(w,"Invalid action",400);return
  }
  s.Lock();defer s.Unlock()
  tabID:=request.TabID
  if tabID==0 {selected:=s.snapshot();if selected.Connected{tabID=s.lastID}}
  tab,found:=s.tabs[tabID]
  if !found||s.hidden[tabID]||tab.Suppressed {
   reply(w,409,map[string]string{"error":"No controllable video; play YouTube and choose a visible tab"});return
  }
  cmd,err:=s.enqueueCommand(tabID,request.Action,time.Now())
  if err!=nil{reply(w,429,map[string]string{"error":"Too many pending commands or cannot create command ID"});return}
  reply(w,202,map[string]any{"queued":true,"id":cmd.ID,"tabId":tabID})
 })
 mux.HandleFunc("/api/control/result",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"||!isLocal(r){http.Error(w,"Forbidden",403);return}
  id:=r.URL.Query().Get("id")
  if len(id)!=24{http.Error(w,"Invalid command ID",400);return}
  s.Lock();defer s.Unlock()
  s.sweepCommands(time.Now())
  result,ok:=s.commandResults[id]
  if !ok{http.Error(w,"Command not found",404);return}
  reply(w,200,result)
 })
 mux.HandleFunc("/api/commands",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key {
   http.Error(w,"Forbidden",403);return
  }
  s.Lock();defer s.Unlock()
  s.extensionLastSeen=time.Now()
  command:=s.nextCommand(time.Now())
  reply(w,200,map[string]any{"command":command})
 })
 mux.HandleFunc("/api/command-result",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||!extensionOrigin(r)||r.Header.Get("X-Bunny-Key")!=key {
   http.Error(w,"Forbidden",403);return
  }
  r.Body=http.MaxBytesReader(w,r.Body,1024);defer r.Body.Close()
  var report struct{
   ID string `json:"id"`
   TabID int `json:"tabId"`
   OK *bool `json:"ok"`
   Error string `json:"error"`
  }
  if json.NewDecoder(r.Body).Decode(&report)!=nil||len(report.ID)!=24||report.TabID<=0||report.OK==nil {
   http.Error(w,"Invalid acknowledgement",400);return
  }
  s.Lock();defer s.Unlock()
  _,err:=s.finishCommand(report.ID,report.TabID,*report.OK,report.Error,time.Now())
  if err!=nil{http.Error(w,"Command expired, repeated or not found",409);return}
  s.extensionLastSeen=time.Now()
  reply(w,200,map[string]bool{"ok":true})
 })
}
