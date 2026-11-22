package main

import "testing"

func TestThemeValidation(t *testing.T){
 cases:=[]struct{name string;theme Theme;valid bool}{
 {"defaults",defaultTheme(),true},
 {"minimums",Theme{"mint",20,75,false,false,"compact",100,0,0},true},
 {"maximums",Theme{"purple",100,100,true,true,"cover",100,0,0},true},
 {"invalid color",Theme{"url(javascript:)",80,100,true,true,"classic",100,0,0},false},
 {"invalid opacity",Theme{"pink",101,100,true,true,"classic",100,0,0},false},
 {"invalid size",Theme{"peach",80,60,true,true,"classic",100,0,0},false},
 {"old settings accepted",Theme{"pink",78,100,true,true,"",0,0,0},true},
 {"invalid layout",Theme{"pink",78,100,true,true,"<script>",100,0,0},false},
 {"custom avatar transform",Theme{Color:"pink",Opacity:78,Scale:100,Animate:true,ShowCover:true,Layout:"classic",AvatarScale:180,AvatarX:-40,AvatarY:40},true},
 {"avatar size over limit",Theme{Color:"pink",Opacity:78,Scale:100,Layout:"classic",AvatarScale:210},false},
 {"avatar X over limit",Theme{Color:"pink",Opacity:78,Scale:100,Layout:"classic",AvatarScale:100,AvatarX:41},false},
 }
 for _,c:=range cases{
  t.Run(c.name,func(t *testing.T){
   err:=validateTheme(c.theme)
   if (err==nil)!=c.valid{t.Fatalf("valid=%v error=%v",c.valid,err)}
  })
 }
}
