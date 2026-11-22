package main

import (
 "bytes"
 "image"
 "image/color"
 "image/png"
 "image/gif"
 "encoding/binary"
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

func TestAnimatedGIFAccepted(t *testing.T){
 imageData:=image.NewPaletted(image.Rect(0,0,2,2),[]color.Color{color.White,color.Black})
 var b bytes.Buffer
 if err:=gif.Encode(&b,imageData,nil);err!=nil{t.Fatal(err)}
 if mime,err:=inspectAvatar(b.Bytes());err!=nil||mime!="image/gif"{t.Fatalf("GIF rejected: %v %q",err,mime)}
}
func TestWebPContainerValidation(t *testing.T){
 // RIFF/WEBP with VP8X canvas and an animation frame header.
 webp:=make([]byte,12+8+10+8+16)
 copy(webp[0:4],"RIFF");copy(webp[8:12],"WEBP")
 binary.LittleEndian.PutUint32(webp[4:8],uint32(len(webp)-8))
 copy(webp[12:16],"VP8X");binary.LittleEndian.PutUint32(webp[16:20],10)
 webp[20]=0x02 // animation flag
 webp[24]=63 // canvas width 64
 webp[27]=63 // canvas height 64
 copy(webp[30:34],"ANMF");binary.LittleEndian.PutUint32(webp[34:38],16)
 if mime,err:=inspectAvatar(webp);err!=nil||mime!="image/webp"{t.Fatalf("WebP rejected: %v %q",err,mime)}
 bad:=append([]byte(nil),webp...);binary.LittleEndian.PutUint32(bad[4:8],9999)
 if _,err:=inspectAvatar(bad);err==nil{t.Fatal("RIFF invalid size accepted")}
 oversized:=append([]byte(nil),webp...);oversized[24]=255;oversized[25]=8 // width 2304
 if _,err:=inspectAvatar(oversized);err==nil{t.Fatal("WebP too-wide canvas accepted")}
}
