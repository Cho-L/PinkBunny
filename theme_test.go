package main

import "testing"

func TestThemeValidation(t *testing.T){
 cases:=[]struct{name string;theme Theme;valid bool}{
 {"defaults",defaultTheme(),true},
 {"minimums",Theme{"mint",20,75,false,false,"compact"},true},
 {"maximums",Theme{"purple",100,100,true,true,"cover"},true},
 {"invalid color",Theme{"url(javascript:)",80,100,true,true,"classic"},false},
 {"invalid opacity",Theme{"pink",101,100,true,true,"classic"},false},
 {"invalid size",Theme{"peach",80,60,true,true,"classic"},false},
 {"old settings accepted",Theme{"pink",78,100,true,true,""},true},
 {"invalid layout",Theme{"pink",78,100,true,true,"<script>"},false},
 }
 for _,c:=range cases{
  t.Run(c.name,func(t *testing.T){
   err:=validateTheme(c.theme)
   if (err==nil)!=c.valid{t.Fatalf("valid=%v error=%v",c.valid,err)}
  })
 }
}
