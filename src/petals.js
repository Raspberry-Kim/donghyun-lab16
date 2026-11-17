/* 꽃비: 승리 화면 위로 꽃잎을 약 10초 동안 내린다. 그림 파일 없이 작은 픽셀 무늬를 캔버스에 찍는다.
   캔버스는 클릭·터치를 받지 않아(pointer-events:none) 결과 카드의 버튼을 가리지 않는다.
   동현전·동현워·동현삼·동현항의 이 파일은 같다.
   결과 카드 자리(hole)는 비워 두어 글자를 가리지 않는다. 꽃잎이 카드 뒤로 지나가는 것처럼 보인다.
   DHPETALS.start(자리, {dur:초, delay:초, still:참이면 멈춘 꽃잎, hole:비울 네모 [x,y,w,h]를 돌려주는 함수, alive:거짓을 돌려주면 걷는다, cut:걷힐 때 부를 함수}) · DHPETALS.stop() */
var DHPETALS=(function(){
  'use strict';
  /* 꽃잎 네 모습(앞 · 기운 모습 · 옆 · 반대로 기운 모습)을 돌려 가며 찍어 팔랑거리게 한다. 1 밝은 색 · 2 그늘 · 3 꽃술 */
  var PETAL=[['.1.1.','11111','11112','.112.','..2..'],['..11.','.1112','11122','.122.','.....'],['.....','...1.','..12.','.12..','.2...'],['.11..','2111.','22111','.221.','.....']];
  var BLOOM=[['11.11','11311','.333.','11311','22.22'],['..1..','.111.','11311','.122.','..2..']];
  var HUES=[['#ffc4d8','#ee8fb2'],['#ffc4d8','#ee8fb2'],['#ff9fbe','#dc648e'],['#ff9fbe','#dc648e'],['#fff3f6','#f0c0d0'],['#fff3f6','#f0c0d0'],['#ffd2bd','#f0a089'],['#ff8496','#d64c66'],['#ffe48a','#e2b53c']];
  var cv=null, g=null, raf=0, t0=0, list=[], opt=null, host=null, W=0, H=0, unit=3, ended=0;
  function rnd(a,b){ return a+Math.random()*(b-a); }
  function size(){ var w=host.clientWidth, h=host.clientHeight, d=Math.min(2,window.devicePixelRatio||1);
    if(w===W&&h===H&&cv.width===Math.round(w*d)) return; W=w; H=h; cv.width=Math.round(w*d); cv.height=Math.round(h*d); g.setTransform(d,0,0,d,0,0); g.imageSmoothingEnabled=false;
    unit=Math.max(2,Math.min(4,Math.round(w/210))); }
  function seed(){ var n=Math.max(70,Math.min(260,Math.round(W*H/2600))), span=Math.max(1,opt.dur-4.4); list=[];
    for(var i=0;i<n;i++){ var first=i<n*0.22, bloom=Math.random()<0.14, s=Math.max(2,unit+(Math.random()<0.25?-1:Math.random()<0.2?1:0));
      list.push({ born:first?rnd(0,0.5):rnd(0.3,span), x:rnd(-0.08,1.04), y0:first?rnd(-0.05,0.55):rnd(-0.12,-0.03), fall:rnd(3.3,5.4)*(unit+1)/(s+1), sway:rnd(8,26), rate:rnd(0.9,1.9), ph:rnd(0,6.28),
        wind:rnd(4,22), spin:rnd(3,6.5), f0:Math.floor(rnd(0,4)), s:s, bloom:bloom, hue:HUES[Math.floor(Math.random()*HUES.length)] }); } }
  function stamp(rows,x,y,s,hue){ for(var r=0;r<rows.length;r++){ var row=rows[r]; for(var c=0;c<row.length;c++){ var ch=row.charCodeAt(c); if(ch===46) continue;
    g.fillStyle=ch===49?hue[0]:ch===50?hue[1]:'#ffd23f'; g.fillRect(x+c*s,y+r*s,s,s); } } }
  function draw(t){ size(); g.clearRect(0,0,W,H); var shown=0, hole=opt.hole?opt.hole():null;
    g.save(); if(hole){ g.beginPath(); g.rect(0,0,W,H); g.rect(hole[0],hole[1],hole[2],hole[3]); g.clip('evenodd'); }
    for(var i=0;i<list.length;i++){ var p=list[i], a=opt.still?p.fall*(0.08+0.8*((i*0.618)%1)):t-p.born; if(a<0) continue;
      var y=p.y0*H+a/p.fall*H*1.12; if(y>H+8) continue;
      var x=p.x*W+Math.sin(p.ph+a*p.rate)*p.sway+p.wind*a, set=p.bloom?BLOOM:PETAL, f=(p.f0+Math.floor(a*p.spin))%set.length;
      stamp(set[f],Math.round(x),Math.round(y),p.s,p.hue); shown++; }
    g.restore(); return shown; }
  function frame(now){ raf=0; if(!cv) return;
    if(opt.alive&&!opt.alive()){ var cut=opt.cut; stop(); if(cut) cut(); return; }
    var t=(now-t0)/1000-opt.delay;
    if(t>=0){ var left=opt.dur-t; cv.style.opacity=left<0.9?String(Math.max(0,left/0.9)):'1'; var n=draw(t); if(t>opt.dur||(!opt.still&&t>1&&n===0)){ ended++; stop(); return; } }
    raf=requestAnimationFrame(frame); }
  function stop(){ if(raf) cancelAnimationFrame(raf); raf=0; if(cv&&cv.parentNode) cv.parentNode.removeChild(cv); cv=null; g=null; list=[]; host=null; opt=null; W=H=0; }
  return {
    start:function(el,o){ stop(); if(!el||!document.createElement('canvas').getContext) return false; o=o||{};
      opt={dur:o.dur>0?o.dur:10.4, delay:o.delay>0?o.delay:0, still:!!o.still, hole:o.hole||null, alive:o.alive||null, cut:o.cut||null}; host=el;
      cv=document.createElement('canvas'); cv.className='dh-petals'; cv.setAttribute('aria-hidden','true');
      cv.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:6;image-rendering:pixelated';
      g=cv.getContext('2d'); el.appendChild(cv); size(); seed(); t0=performance.now(); raf=requestAnimationFrame(frame); return true; },
    stop:stop,
    get on(){ return !!cv; },
    /* 시험용: 지금 그리고 있는 꽃잎 수, 끝까지 내리고 걷힌 횟수 */
    get count(){ return cv&&opt?list.filter(function(p){ var a=opt.still?1:(performance.now()-t0)/1000-opt.delay-p.born; return a>=0&&p.y0*H+a/p.fall*H*1.12<=H+8; }).length:0; },
    get ended(){ return ended; }
  };
})();
