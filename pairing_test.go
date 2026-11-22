package main

import (
 "os"
 "path/filepath"
 "testing"
)

func TestPairingCodePersistsAcrossRestarts(t *testing.T){
 folder:=t.TempDir()
 t.Setenv("APPDATA",folder)
 t.Setenv("XDG_CONFIG_HOME",folder)
 first,err:=loadPairingKey()
 if err!=nil{t.Fatal(err)}
 if !pairingPattern.MatchString(first){t.Fatalf("invalid key: %q",first)}
 second,err:=loadPairingKey()
 if err!=nil{t.Fatal(err)}
 if first!=second{t.Fatalf("pairing code changed %q -> %q",first,second)}
 base,err:=os.UserConfigDir();if err!=nil{t.Fatal(err)}
 keyFile:=filepath.Join(base,"PinkBunny","pairing.key")
 if err:=os.WriteFile(keyFile,[]byte("INVALID"),0600);err!=nil{t.Fatal(err)}
 if _,err:=loadPairingKey();err==nil{t.Fatal("corrupt key should fail rather than silently break pairing")}
}
