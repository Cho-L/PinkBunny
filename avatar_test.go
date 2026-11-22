package main

import (
 "bytes"
 "image"
 "image/color"
 "image/png"
 "testing"
)

func TestAvatarValidation(t *testing.T){
 im:=image.NewRGBA(image.Rect(0,0,2,2))
 im.Set(0,0,color.RGBA{255,0,128,255})
 var buf bytes.Buffer
 if err:=png.Encode(&buf,im);err!=nil{t.Fatal(err)}
 mime,err:=inspectAvatar(buf.Bytes())
 if err!=nil||mime!="image/png"{t.Fatalf("valid PNG rejected: %v %s",err,mime)}
 for _,data:=range [][]byte{
  []byte("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
  []byte("<html>not an image</html>"),
  bytes.Repeat([]byte("x"),maxAvatarBytes+1),
  nil,
 }{
  if _,err:=inspectAvatar(data);err==nil{t.Fatalf("invalid bytes accepted: %q",data[:min(len(data),20)])}
 }
}
