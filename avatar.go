package main

import (
 "bytes"
 "errors"
 "image"
 _ "image/gif"
 "encoding/binary"
 _ "image/jpeg"
 _ "image/png"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "sync"
 "time"
)

const maxAvatarBytes=4*1024*1024
type avatarService struct {sync.RWMutex; file string}
func newAvatarService()*avatarService{
 dir,e:=os.UserConfigDir()
 if e!=nil{return &avatarService{}}
 return &avatarService{file:filepath.Join(dir,"PinkBunny","avatar.img")}
}
func inspectAvatar(data []byte)(string,error){
 if len(data)==0||len(data)>maxAvatarBytes{return "",errors.New("file must be 1 byte to 4MB")}
 mime:=http.DetectContentType(data)
 if len(data)>=12&&string(data[:4])=="RIFF"&&string(data[8:12])=="WEBP" {mime="image/webp"}
 if mime=="image/webp"{
  width,height,err:=webpDimensions(data)
  if err!=nil||width<1||height<1||width>2048||height>2048{return "",errors.New("invalid WebP or dimensions")}
  return mime,nil
 }
 if mime!="image/png"&&mime!="image/jpeg"&&mime!="image/gif"{return "",errors.New("only PNG, JPEG, GIF and WebP supported")}
 config,format,err:=image.DecodeConfig(bytes.NewReader(data))
 if err!=nil||config.Width<1||config.Height<1||config.Width>2048||config.Height>2048{return "",errors.New("invalid image or dimensions")}
 if (mime=="image/png"&&format!="png")||(mime=="image/jpeg"&&format!="jpeg")||(mime=="image/gif"&&format!="gif"){return "",errors.New("invalid image format")}
 return mime,nil
}
// Validate RIFF chunk sizes and the VP8, VP8L or VP8X dimension headers.
// Browser/OBS decodes and animates WebP; no external decoder dependency is needed.
func webpDimensions(data []byte)(int,int,error){
 invalid:=errors.New("invalid WebP container")
 if len(data)<20||string(data[:4])!="RIFF"||string(data[8:12])!="WEBP"{return 0,0,invalid}
 if uint64(binary.LittleEndian.Uint32(data[4:8]))+8!=uint64(len(data)){return 0,0,invalid}
 width,height:=0,0
 hasImage:=false
 for p:=12;p+8<=len(data);{
  tag:=string(data[p:p+4]);n:=uint64(binary.LittleEndian.Uint32(data[p+4:p+8]));start:=p+8
  if n>uint64(len(data)-start){return 0,0,invalid}
  chunk:=data[start:start+int(n)]
  switch tag{
  case "VP8X":
   if len(chunk)<10{return 0,0,invalid}
   width=1+int(chunk[4])+(int(chunk[5])<<8)+(int(chunk[6])<<16)
   height=1+int(chunk[7])+(int(chunk[8])<<8)+(int(chunk[9])<<16)
  case "VP8 ":
   if len(chunk)<10||chunk[3]!=0x9d||chunk[4]!=0x01||chunk[5]!=0x2a{return 0,0,invalid}
   if width==0{width=int(binary.LittleEndian.Uint16(chunk[6:8])&0x3fff);height=int(binary.LittleEndian.Uint16(chunk[8:10])&0x3fff)}
   hasImage=true
  case "VP8L":
   if len(chunk)<5||chunk[0]!=0x2f{return 0,0,invalid}
   packed:=binary.LittleEndian.Uint32(chunk[1:5])
   if width==0{width=int(packed&0x3fff)+1;height=int((packed>>14)&0x3fff)+1}
   hasImage=true
  case "ANMF":
   if len(chunk)<16{return 0,0,invalid}
   hasImage=true
  }
  if n>uint64(len(data)-start)||int(n)>len(data)-start{return 0,0,invalid}
  p=start+int(n)+int(n&1)
  if p>len(data){return 0,0,invalid}
  if p==len(data){break}
 }
 if !hasImage||width<1||height<1{return 0,0,invalid}
 return width,height,nil
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

