package main

import (
 "bytes"
 "encoding/json"
 "errors"
 "image"
 _ "image/jpeg"
 _ "image/png"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "sync"
 "time"
)

const maxAvatarBytes=2*1024*1024
type avatarService struct {sync.RWMutex; file string}
func newAvatarService()*avatarService{
 dir,e:=os.UserConfigDir()
 if e!=nil{return &avatarService{}}
 return &avatarService{file:filepath.Join(dir,"PinkBunny","avatar.img")}
}
func inspectAvatar(data []byte)(string,error){
 if len(data)==0||len(data)>maxAvatarBytes{return "",errors.New("file must be 1 byte to 2MB")}
 mime:=http.DetectContentType(data)
 if mime!="image/png"&&mime!="image/jpeg"{return "",errors.New("only PNG and JPEG supported")}
 config,format,err:=image.DecodeConfig(bytes.NewReader(data))
 if err!=nil||config.Width<1||config.Height<1||config.Width>2048||config.Height>2048{return "",errors.New("invalid image or dimensions")}
 if (mime=="image/png"&&format!="png")||(mime=="image/jpeg"&&format!="jpeg"){return "",errors.New("invalid image format")}
 return mime,nil
}
func (a *avatarService) info()(bool,int64){
 a.RLock();defer a.RUnlock()
 if a.file==""{return false,0}
 fi,err:=os.Stat(a.file)
 if err!=nil{return false,0}
 return true,fi.ModTime().UnixNano()
}
func (a *avatarService) handler(w http.ResponseWriter,r *http.Request){
 switch r.Method{
 case http.MethodGet:
  if r.URL.Path=="/api/avatar/info" {
   present,version:=a.info()
   reply(w,200,map[string]any{"present":present,"version":version});return
  }
  if r.URL.Path!="/api/avatar"{http.NotFound(w,r);return}
  a.RLock();defer a.RUnlock()
  if a.file==""{http.NotFound(w,r);return}
  b,err:=os.ReadFile(a.file)
  if err!=nil{http.NotFound(w,r);return}
  mime,err:=inspectAvatar(b)
  if err!=nil{http.NotFound(w,r);return}
  w.Header().Set("Content-Type",mime)
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  _,_=w.Write(b)
 case http.MethodPost,http.MethodDelete:
  if !isLocal(r)||r.Header.Get("Origin")!="http://127.0.0.1:38765"||
   r.Header.Get("X-PinkBunny-Action")!="1" {http.Error(w,"Forbidden",403);return}
  if a.file==""{reply(w,500,map[string]string{"error":"User configuration folder unavailable"});return}
  a.Lock();defer a.Unlock()
  if r.Method==http.MethodDelete {
   if err:=os.Remove(a.file);err!=nil&&!os.IsNotExist(err){reply(w,500,map[string]string{"error":"Cannot remove image"});return}
   reply(w,200,map[string]bool{"ok":true});return
  }
  if r.Header.Get("Content-Type")!="application/octet-stream"{http.Error(w,"Unsupported format",415);return}
  r.Body=http.MaxBytesReader(w,r.Body,maxAvatarBytes+1);defer r.Body.Close()
  b,err:=io.ReadAll(r.Body)
  if err!=nil{reply(w,413,map[string]string{"error":"Image exceeds 2MB"});return}
  if _,err:=inspectAvatar(b);err!=nil{reply(w,400,map[string]string{"error":err.Error()});return}
  dir:=filepath.Dir(a.file)
  if err:=os.MkdirAll(dir,0700);err!=nil{reply(w,500,map[string]string{"error":"Cannot create image folder"});return}
  tmp,err:=os.CreateTemp(dir,"avatar-*.tmp")
  if err!=nil{reply(w,500,map[string]string{"error":"Cannot prepare image"});return}
  tmpName:=tmp.Name();defer os.Remove(tmpName)
  _=tmp.Chmod(0600)
  if _,err=tmp.Write(b);err!=nil{tmp.Close();reply(w,500,map[string]string{"error":"Cannot write image"});return}
  if err=tmp.Close();err!=nil{reply(w,500,map[string]string{"error":"Cannot close image"});return}
  // Windows replace-existing-file behavior: keep previous image if replacement fails.
  if err=os.Rename(tmpName,a.file);err!=nil {
   backup:=a.file+".backup"
   _=os.Remove(backup)
   previous:=os.Rename(a.file,backup)
   if previous!=nil&&!os.IsNotExist(previous){reply(w,500,map[string]string{"error":"Cannot replace image"});return}
   if err=os.Rename(tmpName,a.file);err!=nil{
    _=os.Rename(backup,a.file)
    reply(w,500,map[string]string{"error":"Cannot save image"});return
   }
   _=os.Remove(backup)
  }
  // Timestamp is used to refresh the image by the browser without a full OBS reload.
  _=os.Chtimes(a.file,time.Now(),time.Now())
  reply(w,200,map[string]bool{"ok":true})
 default: http.Error(w,"Method not allowed",405)
 }
}

// JSON is intentionally kept in the theme endpoint, while avatar bytes use
// application/octet-stream to avoid user-supplied paths, SVG or HTML content.
var _ = json.Valid
