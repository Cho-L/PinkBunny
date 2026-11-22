package main

import (
 "crypto/rand"
 "encoding/hex"
 "errors"
 "os"
 "path/filepath"
 "regexp"
 "strings"
)

var pairingPattern=regexp.MustCompile(`^[A-F0-9]{8}$`)

// The short pairing code is preserved across restarts so existing Chrome settings work.
// It is a LAN convenience token, not a substitute for trusted local network isolation.
func loadPairingKey()(string,error){
 dir,err:=os.UserConfigDir();if err!=nil{return "",err}
 folder:=filepath.Join(dir,"PinkBunny")
 if err=os.MkdirAll(folder,0700);err!=nil{return "",err}
 path:=filepath.Join(folder,"pairing.key")
 if bytes,readErr:=os.ReadFile(path);readErr==nil{
  key:=strings.TrimSpace(string(bytes))
  if pairingPattern.MatchString(key){return key,nil}
  return "",errors.New("invalid pairing.key; move or delete the file to reset the connection")
 }else if !os.IsNotExist(readErr){return "",readErr}
 random:=make([]byte,4)
 if _,err=rand.Read(random);err!=nil{return "",err}
 key:=strings.ToUpper(hex.EncodeToString(random))
 file,err:=os.OpenFile(path,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0600)
 if errors.Is(err,os.ErrExist){
  bytes,readErr:=os.ReadFile(path);if readErr!=nil{return "",readErr}
  k:=strings.TrimSpace(string(bytes));if pairingPattern.MatchString(k){return k,nil}
  return "",errors.New("invalid existing pairing.key")
 }
 if err!=nil{return "",err}
 if _,err=file.WriteString(key+"\n");err!=nil{file.Close();return "",err}
 if err=file.Close();err!=nil{return "",err}
 return key,nil
}
