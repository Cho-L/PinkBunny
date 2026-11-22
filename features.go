package main

import (
 "encoding/json"
 "path/filepath"
 "net/http"
 "os"
 "os/exec"
 "runtime"
 "strings"
)

const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
const runValue = "PinkBunny"

func registerExtras(mux *http.ServeMux) {
 mux.HandleFunc("/api/open-extension-folder",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"{http.Error(w,"Method not allowed",405);return}
  if !isLocal(r)||r.Header.Get("Origin")!="http://127.0.0.1:38765"||r.Header.Get("X-PinkBunny-Action")!="1"{http.Error(w,"Forbidden",403);return}
  if runtime.GOOS!="windows"{reply(w,400,map[string]string{"error":"Windows only"});return}
  exe,err:=os.Executable();if err!=nil{reply(w,500,map[string]string{"error":"Cannot find executable"});return}
  folder:=filepath.Join(filepath.Dir(exe),"extension")
  if info,err:=os.Stat(filepath.Join(folder,"manifest.json"));err!=nil||info.IsDir(){
   reply(w,404,map[string]string{"error":"Extension folder missing from installation"});return
  }
  if err:=exec.Command("explorer.exe",folder).Start();err!=nil{reply(w,500,map[string]string{"error":"Cannot open Explorer"});return}
  reply(w,200,map[string]bool{"ok":true})
 })

 mux.HandleFunc("/api/autostart",func(w http.ResponseWriter,r *http.Request){
  if !isLocal(r){http.Error(w,"Local access only",http.StatusForbidden);return}
  if runtime.GOOS!="windows"{reply(w,400,map[string]any{"error":"Windows only"});return}
  switch r.Method {
  case http.MethodGet:
   result,err:=exec.Command("reg","query",runKey,"/v",runValue).CombinedOutput()
   reply(w,200,map[string]any{"enabled":err==nil&&strings.Contains(string(result),runValue)})
  case http.MethodPost:
   // Require same-origin JS JSON request, not a cross-origin form.
   if r.Header.Get("Origin")!="http://127.0.0.1:38765" || r.Header.Get("Content-Type")!="application/json" || r.Header.Get("X-PinkBunny-Action")!="1" {
    http.Error(w,"Forbidden",http.StatusForbidden);return
   }
   r.Body=http.MaxBytesReader(w,r.Body,1024)
   var p struct{Enabled bool `json:"enabled"`}
   if err:=json.NewDecoder(r.Body).Decode(&p);err!=nil {reply(w,400,map[string]string{"error":"Invalid input"});return}
   var cmd *exec.Cmd
   if p.Enabled {
    executable,err:=os.Executable()
    if err!=nil{reply(w,500,map[string]string{"error":"Cannot locate executable"});return}
    // HKCU only: no administrative privilege or system-wide setting.
    cmd=exec.Command("reg","add",runKey,"/v",runValue,"/t","REG_SZ","/d",`"`+executable+`" --silent`,"/f")
   } else {
    cmd=exec.Command("reg","delete",runKey,"/v",runValue,"/f")
   }
   if output,err:=cmd.CombinedOutput();err!=nil{
    reply(w,500,map[string]string{"error":"Windows startup setting failed","detail":clip(string(output),160)});return
   }
   reply(w,200,map[string]bool{"enabled":p.Enabled})
  default: http.Error(w,"Method not allowed",405)
  }
 })
}
