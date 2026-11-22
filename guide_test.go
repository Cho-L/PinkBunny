package main

import (
 "bytes"
 "encoding/xml"
 "strings"
 "testing"
)

func TestIllustratedInstallationGuidesAreEmbedded(t *testing.T){
 names:=[]string{
  "guide-quickstart-1pc.svg",
  "guide-quickstart-2pc.svg",
  "guide-chrome-extension.svg",
  "guide-obs-source.svg",
  "guide-feature-extension.svg",
  "guide-feature-tabs.svg",
  "guide-feature-controls.svg",
  "guide-feature-design.svg",
  "guide-feature-remote.svg",
  "guide-feature-filters.svg",
  "guide-feature-troubleshoot.svg",
 }
 guide,err:=assets.ReadFile("overlay/guide.html")
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(guide),"id=\"features\"")||!strings.Contains(string(guide),"기능 사용"){t.Fatal("feature guide must be discoverable from offline manual")}
 if !strings.Contains(string(guide),"송출 PC")||!strings.Contains(string(guide),"127.0.0.1:38765"){
  t.Fatal("offline guide must identify correct streaming PC and OBS address")
 }
 for _,name:=range names{
  t.Run(name,func(t *testing.T){
   picture,err:=assets.ReadFile("overlay/"+name)
   if err!=nil{t.Fatal(err)}
   if !bytes.Contains(guide,[]byte(name)){t.Fatalf("offline guide does not link %s",name)}
   var svg struct{XMLName xml.Name}
   if err:=xml.Unmarshal(picture,&svg);err!=nil{t.Fatalf("not valid SVG XML: %v",err)}
   if svg.XMLName.Local!="svg"{t.Fatalf("unexpected root %s",svg.XMLName.Local)}
   if bytes.Contains(bytes.ToLower(picture),[]byte("<script")){t.Fatal("guide must be a static illustration")}
  })
 }
}
