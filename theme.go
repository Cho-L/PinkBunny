package main

import (
 "encoding/json"
 "errors"
 "net/http"
 "os"
 "path/filepath"
 "sync"
)

type Theme struct {
 Color string `json:"color"`
 Opacity int `json:"opacity"`
 Scale int `json:"scale"`
 Animate bool `json:"animate"`
 ShowCover bool `json:"showCover"`
 Layout string `json:"layout"`
}
type themeService struct {sync.RWMutex; value Theme; file string}
func defaultTheme()Theme{return Theme{Color:"pink",Opacity:78,Scale:100,Animate:true,ShowCover:true,Layout:"classic"}}
func validateTheme(t Theme)error{
 switch t.Color {case "pink","purple","mint","peach":default:return errors.New("invalid color")}
 if t.Opacity<20||t.Opacity>100 {return errors.New("opacity must be 20-100")}
 if t.Scale<75||t.Scale>100 {return errors.New("scale must be 75-100")}
 switch t.Layout {case "", "classic","compact","cover":default:return errors.New("invalid layout")}
 return nil
}
func makeThemeService()*themeService{
 dir,e:=os.UserConfigDir()
 t:=&themeService{value:defaultTheme()}
 if e!=nil {return t}
 t.file=filepath.Join(dir,"PinkBunny","theme.json")
 b,e:=os.ReadFile(t.file)
 if e==nil{
  var settings Theme
  if json.Unmarshal(b,&settings)==nil && validateTheme(settings)==nil {if settings.Layout==""{settings.Layout="classic"};t.value=settings}
 }
 return t
}
func (t *themeService) handler(w http.ResponseWriter,r *http.Request){
 if r.Method==http.MethodGet {
  t.RLock();v:=t.value;t.RUnlock()
  reply(w,200,v);return
 }
 if r.Method!=http.MethodPost {http.Error(w,"Method not allowed",405);return}
 if !isLocal(r)||r.Header.Get("Origin")!="http://127.0.0.1:38765"||
 r.Header.Get("Content-Type")!="application/json"||r.Header.Get("X-PinkBunny-Action")!="1" {
  http.Error(w,"Forbidden",403);return
 }
 r.Body=http.MaxBytesReader(w,r.Body,1024);defer r.Body.Close()
 dec:=json.NewDecoder(r.Body);dec.DisallowUnknownFields()
 var v Theme
 if dec.Decode(&v)!=nil||validateTheme(v)!=nil{reply(w,400,map[string]string{"error":"Invalid theme settings"});return}
 if v.Layout==""{v.Layout="classic"}
 t.Lock();defer t.Unlock()
 if t.file!="" {
  dir:=filepath.Dir(t.file)
  if err:=os.MkdirAll(dir,0700);err!=nil {reply(w,500,map[string]string{"error":"Cannot create settings directory"});return}
  b,_:=json.MarshalIndent(v,"","  ")
  temp:=t.file+".tmp"
  if err:=os.WriteFile(temp,b,0600);err!=nil {reply(w,500,map[string]string{"error":"Cannot save settings"});return}
  if err:=os.Rename(temp,t.file);err!=nil {
   _=os.Remove(temp)
   // Windows may reject replacing an existing file: remove and retry.
   if err:=os.Remove(t.file);err!=nil&&!os.IsNotExist(err){reply(w,500,map[string]string{"error":"Cannot replace settings"});return}
   if err:=os.WriteFile(t.file,b,0600);err!=nil{reply(w,500,map[string]string{"error":"Cannot write settings"});return}
  }
 }
 t.value=v;reply(w,200,v)
}
