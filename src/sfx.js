/* 합성 효과음: 소리 파일 없이 Web Audio로 그 자리에서 만든다.
   발소리·말발굽·바퀴·궤도·배·비행·점령 환호·상대 점령 알림·승리 팡파르·딩동댕·패배 땡, 공격·반격·격파, 동현텐의 짧은 소리.
   브라우저 규칙에 따라 첫 클릭·터치·키 입력 뒤에 소리 장치를 연다.
   동현삼·동현항은 동현큐의 이 파일을 그대로 쓰고 끝에 동전 소리(coin)·북소리(drum)와 승리 팡파르(pomp)를 더했다. 두 저장소의 파일은 같다. */
var DHSFX=function(storeKey){ /* 동현워의 합성 효과음에 동현크용 소리를 더했다 */
  'use strict';
  var AC=window.AudioContext||window.webkitAudioContext, ctx=null, master=null, noiseBuf=null;
  var on=true; try{ on=localStorage.getItem(storeKey)!=='off'; }catch(e){}
  function unlock(){
    if(!AC) return;
    if(!ctx){ try{ ctx=new AC(); }catch(e){ return; }
      master=ctx.createGain(); master.gain.value=0.32;
      var comp=ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      var n=ctx.sampleRate, b=ctx.createBuffer(1,n,n), d=b.getChannelData(0);
      for(var i=0;i<n;i++) d[i]=Math.random()*2-1; noiseBuf=b; }
    if(ctx.state!=='running'){
      try{ var r=ctx.resume(); if(r&&r.catch) r.catch(function(){}); }catch(e){}
      /* 옛 iOS Safari: 손짓 안에서 빈 소리를 한 번 틀어야 소리 장치가 열린다 */
      try{ var sb=ctx.createBufferSource(); sb.buffer=ctx.createBuffer(1,1,22050); sb.connect(ctx.destination); sb.start(0); }catch(e){}
    }
  }
  /* 휴대폰은 손가락을 뗄 때(touchend·click)만 소리를 허락하므로 그 이벤트도 함께 듣는다 */
  ['touchend','click','pointerup','mousedown','keydown','touchstart','pointerdown'].forEach(function(ev){ document.addEventListener(ev,unlock,{capture:true,passive:true}); });
  function ready(){ return on&&ctx&&ctx.state!=='closed'; }
  function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); }
  function noise(t,dur,type,freq,q,peak,a,out){
    var s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
    var f=ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t); if(q) f.Q.value=q;
    var g=ctx.createGain(); env(g,t,a||0.005,peak,dur);
    s.connect(f); f.connect(g); g.connect(out||master); s.start(t,Math.random()*0.5); s.stop(t+(a||0.005)+dur+0.05); return f;
  }
  function tone(t,type,freq,dur,peak,a,out){
    var o=ctx.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t);
    var g=ctx.createGain(); env(g,t,a||0.01,peak,dur);
    o.connect(g); g.connect(out||master); o.start(t); o.stop(t+(a||0.01)+dur+0.05); return o;
  }
  function bus(peak){ var g=ctx.createGain(); g.gain.value=peak; g.connect(master); return g; }
  /* 팡파르만 따로 묶어, 소리를 끄거나 결과 화면을 떠날 때 바로 줄인다 */
  var fan=null, fanEnd=0, played=[];
  function hush(){ if(!fan||!ctx) return; var g=fan, u=ctx.currentTime; fan=null;
    try{ g.gain.cancelScheduledValues(u); g.gain.setValueAtTime(g.gain.value,u); g.gain.linearRampToValueAtTime(0,u+0.12); }catch(e){}
    setTimeout(function(){ try{ g.disconnect(); }catch(e){} },400); }
  var S={
    foot:function(t,dur,heavy){ var n=Math.max(2,Math.min(6,Math.round(dur/0.16))); for(var i=0;i<n;i++){ var u=t+i*0.16+(i%2)*0.012;
      noise(u,0.06,'lowpass',heavy?600:900,0,0.5); var o=tone(u,'sine',heavy?95:120,0.08,0.45,0.004); o.frequency.exponentialRampToValueAtTime(55,u+0.08); } },
    horse:function(t,dur){ var n=Math.max(2,Math.min(5,Math.round(dur/0.3))); for(var i=0;i<n;i++){ var u=t+i*0.3;
      [0,0.06,0.115].forEach(function(o,k){ noise(u+o,0.035,'bandpass',1500+k*300,4,0.7); tone(u+o,'sine',180,0.04,0.25,0.003); }); } },
    tire:function(t,dur){ var d=Math.max(0.45,dur+0.15), b=bus(0.5);
      var o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(70,t); o.frequency.linearRampToValueAtTime(105,t+d*0.6); o.frequency.linearRampToValueAtTime(80,t+d);
      var f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; var g=ctx.createGain(); env(g,t,0.06,0.6,d);
      o.connect(f); f.connect(g); g.connect(b); o.start(t); o.stop(t+d+0.1); noise(t,d,'lowpass',300,0,0.15,0.06,b); },
    tread:function(t,dur){ var d=Math.max(0.6,dur+0.2), b=bus(0.55);
      var o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(42,t); o.frequency.linearRampToValueAtTime(52,t+d);
      var f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=260; var g=ctx.createGain(); env(g,t,0.08,0.8,d);
      var am=ctx.createGain(); am.gain.value=0.6; var lfo=ctx.createOscillator(); lfo.frequency.value=11; var lg=ctx.createGain(); lg.gain.value=0.4; lfo.connect(lg); lg.connect(am.gain);
      o.connect(f); f.connect(am); am.connect(g); g.connect(b); o.start(t); o.stop(t+d+0.1); lfo.start(t); lfo.stop(t+d+0.1);
      for(var u=t+0.05;u<t+d;u+=0.12) noise(u,0.03,'bandpass',2200,6,0.12,0.003,b); noise(t,d,'lowpass',180,0,0.35,0.08,b); },
    siege:function(t,dur){ var d=Math.max(0.6,dur+0.2), b=bus(0.5); noise(t,d,'lowpass',220,0,0.3,0.06,b);
      for(var u=t+0.05;u<t+d;u+=0.34){ var o=tone(u,'triangle',300+Math.random()*80,0.16,0.22,0.02,b); o.frequency.linearRampToValueAtTime(470+Math.random()*90,u+0.16); } },
    ship:function(t,dur){ var d=Math.max(0.8,dur+0.3), b=bus(0.6);
      var f=noise(t,d,'lowpass',300,0,0.45,0.15,b); f.frequency.linearRampToValueAtTime(800,t+d*0.5); f.frequency.linearRampToValueAtTime(300,t+d);
      [110,111.6].forEach(function(fr){ var o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=fr; var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=650;
        var g=ctx.createGain(); env(g,t,0.06,0.22,0.5); o.connect(lp); lp.connect(g); g.connect(b); o.start(t); o.stop(t+0.65); }); },
    air:function(t,dur){ var d=Math.max(0.6,dur+0.2), b=bus(0.5);
      var f=noise(t,d,'bandpass',700,1.2,0.5,0.2,b); f.frequency.linearRampToValueAtTime(2000,t+d*0.5); f.frequency.linearRampToValueAtTime(600,t+d);
      var o=tone(t,'sawtooth',170,d,0.06,0.2,b); o.frequency.linearRampToValueAtTime(120,t+d); },
    copter:function(t,dur){ var d=Math.max(0.6,dur+0.2), b=bus(0.55); for(var u=t;u<t+d;u+=0.07) noise(u,0.045,'bandpass',320,1.5,0.55,0.004,b); },
    cheer:function(t){ var b=bus(0.55);
      for(var i=0;i<7;i++){ var u=t+Math.random()*0.08, f=noise(u,0.75+Math.random()*0.2,'bandpass',650+Math.random()*700,3,0.35,0.06,b); f.frequency.linearRampToValueAtTime(900+Math.random()*900,u+0.5); }
      for(var k=0;k<4;k++){ var u2=t+Math.random()*0.1, o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(280+Math.random()*180,u2); o.frequency.linearRampToValueAtTime(380+Math.random()*220,u2+0.4);
        var lfo=ctx.createOscillator(); lfo.frequency.value=5+Math.random()*3; var lg=ctx.createGain(); lg.gain.value=12; lfo.connect(lg); lg.connect(o.frequency);
        var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; var g=ctx.createGain(); env(g,u2,0.08,0.07,0.7);
        o.connect(lp); lp.connect(g); g.connect(b); o.start(u2); o.stop(u2+0.9); lfo.start(u2); lfo.stop(u2+0.9); } },
    alert:function(t){ tone(t,'triangle',330,0.18,0.35); tone(t+0.2,'triangle',247,0.3,0.35); },
    bell:function(t,f,dur,peak){ tone(t,'sine',f,dur,peak,0.005); tone(t,'sine',f*2,dur*0.5,peak*0.3,0.005); tone(t,'sine',f*3.01,dur*0.25,peak*0.12,0.005); },
    win:function(t){ S.bell(t,523.25,0.5,0.5); S.bell(t+0.28,659.25,0.5,0.5); S.bell(t+0.56,783.99,1.2,0.55); },
    lose:function(t){ S.bell(t,196,1.3,0.55); tone(t,'sine',196*2.76,0.5,0.08,0.005); },
    /* 공격·반격·격파 */
    gun:function(t){ for(var i=0;i<2;i++){ noise(t+i*0.11,0.07,'bandpass',1800,0.8,0.8,0.002); var o=tone(t+i*0.11,'square',220,0.04,0.12,0.002); o.frequency.exponentialRampToValueAtTime(70,t+i*0.11+0.04); } },
    mg:function(t){ for(var i=0;i<6;i++){ noise(t+i*0.065,0.04,'bandpass',2000,0.9,0.6,0.002); } },
    cannon:function(t){ noise(t,0.45,'lowpass',700,0,1,0.003); var o=tone(t,'sine',120,0.35,0.8,0.003); o.frequency.exponentialRampToValueAtTime(38,t+0.35); },
    shell:function(t){ var o=tone(t,'sine',1400,0.42,0.12,0.02); o.frequency.exponentialRampToValueAtTime(500,t+0.42); S.cannon(t+0.42); },
    rocket:function(t){ var f=noise(t,0.35,'bandpass',900,1.2,0.5,0.01); f.frequency.exponentialRampToValueAtTime(3000,t+0.3); noise(t+0.32,0.4,'lowpass',900,0,0.8,0.003); var o=tone(t+0.32,'sine',90,0.3,0.6,0.003); o.frequency.exponentialRampToValueAtTime(40,t+0.62); },
    bomb:function(t){ var o=tone(t,'sine',1800,0.5,0.1,0.02); o.frequency.exponentialRampToValueAtTime(350,t+0.5); S.explode(t+0.5); },
    torpedo:function(t){ var f=noise(t,0.5,'bandpass',400,2,0.35,0.05); f.frequency.linearRampToValueAtTime(250,t+0.5); var o=tone(t+0.5,'sine',70,0.5,0.8,0.01); o.frequency.exponentialRampToValueAtTime(30,t+1); noise(t+0.5,0.5,'lowpass',300,0,0.6,0.01); },
    flak:function(t){ for(var i=0;i<4;i++){ noise(t+i*0.09,0.08,'lowpass',1200,0,0.7,0.002); tone(t+i*0.09,'sine',150,0.06,0.35,0.002); } },
    clash:function(t){ for(var i=0;i<2;i++){ var u=t+i*0.17; [1250,1870,2630].forEach(function(f){ tone(u,'square',f*(1+Math.random()*0.02),0.12,0.05,0.001); }); noise(u,0.05,'highpass',3000,0,0.4,0.001); tone(u,'sine',160,0.06,0.3,0.002); } },
    arrow:function(t){ var o=tone(t,'triangle',190,0.08,0.3,0.002); o.frequency.exponentialRampToValueAtTime(110,t+0.08); var f=noise(t+0.03,0.25,'bandpass',2600,3,0.4,0.03); f.frequency.exponentialRampToValueAtTime(1200,t+0.28); noise(t+0.3,0.04,'lowpass',900,0,0.5,0.002); },
    bang:function(t){ noise(t,0.25,'lowpass',1500,0,0.9,0.002); var o=tone(t,'sine',160,0.18,0.5,0.002); o.frequency.exponentialRampToValueAtTime(50,t+0.18); },
    thud:function(t){ for(var i=0;i<2;i++){ var u=t+i*0.22, o=tone(u,'sine',85,0.2,0.9,0.003); o.frequency.exponentialRampToValueAtTime(40,u+0.2); noise(u,0.1,'lowpass',400,0,0.6,0.002); } },
    catapult:function(t){ var o=tone(t,'triangle',260,0.15,0.2,0.01); o.frequency.linearRampToValueAtTime(420,t+0.15); var f=noise(t+0.12,0.35,'bandpass',600,1.5,0.35,0.05); f.frequency.linearRampToValueAtTime(1500,t+0.45); S.thud(t+0.5); },
    explode:function(t){ noise(t,0.7,'lowpass',900,0,1,0.003); var o=tone(t,'sine',100,0.6,0.9,0.003); o.frequency.exponentialRampToValueAtTime(30,t+0.6); },
    fall:function(t){ noise(t,0.18,'lowpass',500,0,0.6,0.004); var o=tone(t,'sine',140,0.25,0.5,0.004); o.frequency.exponentialRampToValueAtTime(55,t+0.25); },
    /* 동현텐: 고르기·짝·틀림·줄·판 비우기·Add·Hint·끝 */
    tick:function(t){ tone(t,'triangle',880,0.05,0.25,0.003); },
    pop:function(t){ var o=tone(t,'sine',520,0.12,0.45,0.004); o.frequency.exponentialRampToValueAtTime(1040,t+0.08); },
    buzz:function(t){ var o=tone(t,'square',140,0.16,0.12,0.005); o.frequency.linearRampToValueAtTime(110,t+0.16); },
    rows:function(t){ S.bell(t,659.25,0.3,0.4); S.bell(t+0.1,987.77,0.45,0.4); },
    swish:function(t){ var f=noise(t,0.32,'bandpass',500,1.5,0.45,0.04); f.frequency.linearRampToValueAtTime(2400,t+0.3); },
    sparkle:function(t){ [1318.5,1568,2093].forEach(function(f,i){ S.bell(t+i*0.06,f,0.25,0.18); }); },
    /* 동현크 */
    jump:function(t){ var o=tone(t,'square',330,0.12,0.18,0.004); o.frequency.exponentialRampToValueAtTime(660,t+0.1); },
    jump2:function(t){ var o=tone(t,'square',440,0.1,0.16,0.004); o.frequency.exponentialRampToValueAtTime(990,t+0.09); },
    stomp:function(t){ noise(t,0.08,'lowpass',900,0,0.6,0.002); var o=tone(t,'square',260,0.09,0.2,0.002); o.frequency.exponentialRampToValueAtTime(120,t+0.09); },
    paw:function(t){ var f=noise(t,0.09,'bandpass',1200,1.2,0.5,0.004); f.frequency.exponentialRampToValueAtTime(400,t+0.09); tone(t,'triangle',520,0.05,0.15,0.003); },
    bark:function(t){ var o=tone(t,'sawtooth',300,0.07,0.16,0.004); o.frequency.exponentialRampToValueAtTime(180,t+0.07); noise(t,0.05,'bandpass',900,1,0.3,0.003); },
    bone:function(t){ tone(t,'square',988,0.06,0.16,0.003); tone(t+0.07,'square',1319,0.14,0.16,0.003); },
    heartup:function(t){ [659.25,830.6,987.77,1318.5].forEach(function(f,i){ tone(t+i*0.07,'triangle',f,0.14,0.2,0.004); }); },
    hurt:function(t){ var o=tone(t,'sawtooth',220,0.22,0.25,0.003); o.frequency.exponentialRampToValueAtTime(70,t+0.22); noise(t,0.1,'lowpass',600,0,0.4,0.002); },
    die:function(t){ [392,330,262,196].forEach(function(f,i){ tone(t+i*0.13,'square',f,0.14,0.18,0.004); }); },
    swap:function(t){ [523.25,659.25,783.99,1046.5].forEach(function(f,i){ tone(t+i*0.05,'square',f,0.08,0.14,0.003); }); },
    ping:function(t){ tone(t,'sine',1760,0.08,0.12,0.003); },
    zone:function(t){ S.bell(t,783.99,0.3,0.35); S.bell(t+0.15,1046.5,0.5,0.35); },
    shot:function(t){ noise(t,0.06,'bandpass',1500,0.8,0.5,0.002); var o=tone(t,'square',200,0.05,0.12,0.002); o.frequency.exponentialRampToValueAtTime(90,t+0.05); },
    shotgun:function(t){ noise(t,0.2,'lowpass',1200,0,0.9,0.002); var o=tone(t,'sine',140,0.15,0.5,0.002); o.frequency.exponentialRampToValueAtTime(45,t+0.15); },
    charge:function(t){ var f=noise(t,0.22,'bandpass',600,1.5,0.5,0.01); f.frequency.linearRampToValueAtTime(2000,t+0.2); tone(t,'triangle',330,0.1,0.15,0.005); },
    over:function(t){ S.bell(t,523.25,0.4,0.4); S.bell(t+0.22,392,0.4,0.4); S.bell(t+0.44,261.63,0.9,0.45); },
    /* 동현램 v0.15: 붕괴 예고 우르릉, 트램 종, 기물마다 다른 격파 폭발, 안 죽은 기물을 칠 때의 쇳소리, 초파리 날갯짓 */
    rumble:function(t){ var d=1.6, b=bus(0.7); var f=noise(t,d,'lowpass',140,0,0.9,0.12,b); f.frequency.linearRampToValueAtTime(260,t+d);
      var o=tone(t,'sine',38,d,0.5,0.1,b); o.frequency.linearRampToValueAtTime(52,t+d); for(var u=t+0.2;u<t+d;u+=0.23) noise(u,0.05,'bandpass',900+Math.random()*600,4,0.25,0.003,b); },
    tramBell:function(t){ S.bell(t,1318.5,0.35,0.3); S.bell(t+0.18,1318.5,0.45,0.3); },
    clank:function(t){ [1450,2210].forEach(function(f){ tone(t,'square',f*(1+Math.random()*0.03),0.09,0.05,0.001); }); noise(t,0.06,'highpass',2500,0,0.45,0.001); tone(t,'sine',170,0.07,0.35,0.002); },
    boomCar:function(t){ noise(t,0.3,'lowpass',1400,0,0.9,0.002); var o=tone(t,'sine',150,0.22,0.6,0.002); o.frequency.exponentialRampToValueAtTime(45,t+0.22); S.clank(t+0.05); noise(t+0.12,0.25,'highpass',3200,0,0.3,0.01); /* 유리 흩어지는 쉭 */ },
    boomTaxi:function(t){ noise(t,0.26,'lowpass',1600,0,0.8,0.002); var o=tone(t,'sine',190,0.2,0.55,0.002); o.frequency.exponentialRampToValueAtTime(60,t+0.2); var h=tone(t+0.03,'square',440,0.25,0.08,0.004); h.frequency.linearRampToValueAtTime(380,t+0.28); /* 경적이 늘어지며 꺼진다 */ },
    boomTank:function(t){ noise(t,0.8,'lowpass',700,0,1,0.003); var o=tone(t,'sine',80,0.7,1,0.003); o.frequency.exponentialRampToValueAtTime(24,t+0.7); for(var i=0;i<3;i++) noise(t+0.15+i*0.13,0.08,'lowpass',1100,0,0.5,0.002); /* 연쇄 폭발 */ },
    boomHeli:function(t){ noise(t,0.55,'lowpass',1000,0,0.9,0.003); var o=tone(t,'sine',120,0.5,0.8,0.003); o.frequency.exponentialRampToValueAtTime(34,t+0.5); var r=tone(t+0.05,'sawtooth',240,0.6,0.08,0.01); r.frequency.exponentialRampToValueAtTime(60,t+0.65); for(var u=t+0.1;u<t+0.6;u+=0.08) noise(u,0.03,'bandpass',320,1.5,0.3,0.003); /* 날개가 느려지며 떨어진다 */ },
    boomTram:function(t){ noise(t,0.5,'lowpass',900,0,0.9,0.003); var o=tone(t,'sine',110,0.45,0.8,0.003); o.frequency.exponentialRampToValueAtTime(32,t+0.45); S.clank(t+0.08); S.clank(t+0.2); var z=tone(t+0.05,'sawtooth',90,0.4,0.1,0.01); z.frequency.linearRampToValueAtTime(60,t+0.45); S.bell(t+0.3,1318.5,0.4,0.15); /* 쇠 부딪힘 두 번과 마지막 종 */ },
    /* 동현삼·동현항: 사고팔 때 동전, 침공할 때 북 */
    coin:function(t){ tone(t,'square',1319,0.05,0.12,0.002); tone(t+0.06,'square',1760,0.16,0.12,0.002); },
    drum:function(t){ for(var i=0;i<3;i++){ var u=t+i*0.18, o=tone(u,'sine',i===2?70:90,0.22,0.85,0.003); o.frequency.exponentialRampToValueAtTime(42,u+0.22); noise(u,0.08,'lowpass',500,0,0.45,0.002); } },
    flap:function(t){ for(var i=0;i<3;i++){ noise(t+i*0.045,0.035,'bandpass',320,1.2,0.9,0.004); var o=tone(t+i*0.045,'triangle',190,0.04,0.2,0.003); o.frequency.exponentialRampToValueAtTime(120,t+i*0.045+0.04); } },
    /* 승리 팡파르(약 10초): 엘가 〈위풍당당 행진곡〉 1번(1901) 트리오 가락의 첫 줄을 라장조로 옮겨 금관·저음·팀파니 소리로 합성한다. 녹음은 쓰지 않는다.
       가락·화음·저음은 악보를 따른다(마디마다 두 번 짚는 화음, 차례로 오르는 저음). 넷째 마디는 조금 늦추고, 다음 줄의 첫 으뜸화음에서 맺는다.
       음은 MIDI 번호(69 = 가온 라 440Hz), 길이는 박으로 적는다 */
    pomp:function(t){ hush(); var out=fan=ctx.createGain(); out.gain.value=0.85; out.connect(master);
      var pre=ctx.createGain(), dl=ctx.createDelay(0.5), fb=ctx.createGain(), wet=ctx.createGain(); dl.delayTime.value=0.115; fb.gain.value=0.28; wet.gain.value=0.22;
      pre.connect(out); pre.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out);
      var B=0.53, at=function(b){ return t+(b<=12?b*B:12*B+(b-12)*B*(1+0.05*(b-12))); }, hz=function(m){ return 440*Math.pow(2,(m-69)/12); };
      function horn(b,len,m,peak,cut){ var u=at(b), d=at(b+len)-u-0.035, lp=ctx.createBiquadFilter(), g=ctx.createGain(); lp.type='lowpass'; lp.Q.value=0.7;
        lp.frequency.setValueAtTime(cut*0.4,u); lp.frequency.linearRampToValueAtTime(cut,u+0.07); lp.frequency.setTargetAtTime(cut*0.62,u+0.07,0.3);
        g.gain.setValueAtTime(0.0001,u); g.gain.linearRampToValueAtTime(peak,u+0.04); g.gain.setTargetAtTime(peak*0.8,u+0.04,0.25); g.gain.setTargetAtTime(0.0001,u+d,0.05);
        [-5,5].forEach(function(c){ var o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=hz(m); o.detune.value=c; o.connect(lp); o.start(u); o.stop(u+d+0.4); });
        lp.connect(g); g.connect(pre); }
      function timp(b,m,peak){ var u=at(b), o=tone(u,'sine',hz(m)*1.1,0.5,peak,0.004,pre); o.frequency.exponentialRampToValueAtTime(hz(m),u+0.06); noise(u,0.07,'lowpass',700,0,peak*0.5,0.002,pre); }
      function crash(b,peak,dur){ var u=at(b); noise(u,dur,'highpass',4800,0,peak,0.004,pre); noise(u,dur*0.6,'bandpass',2600,0.6,peak*0.5,0.004,pre);
        var o=tone(u,'sine',58,0.45,peak*1.5,0.004,pre); o.frequency.exponentialRampToValueAtTime(34,u+0.45); }
      /* 가락: 한 옥타브 위를 겹쳐 트럼펫처럼 밝게 한다 */
      [[74,0,2],[73,2,0.5],[74,2.5,0.5],[76,3,1],[71,4,2],[69,6,2],[67,8,2],[66,10,0.5],[67,10.5,0.5],[69,11,1],[64,12,4],[66,16,1.4]].forEach(function(n){
        horn(n[1],n[2],n[0],0.2,2500); horn(n[1],n[2],n[0]+12,0.1,3300); });
      /* 화음(박마다 다시 짚는다)과 저음 */
      var CH=[[57,62,66],[57,62,66],[57,61,64],[57,61,64],[59,62,66],[59,62,66],[57,62,66],[57,62,66],[59,62,67],[59,62,67],[57,62,66],[57,62,66],[56,62,64],[56,62,64],[55,61,64],[55,61,64]],
          BS=[38,38,40,40,42,42,42,45,43,43,45,45,47,47,45,45];
      CH.forEach(function(c,b){ c.forEach(function(m){ horn(b,0.94,m,0.065,1300); }); horn(b,0.94,BS[b],0.2,520); horn(b,0.94,BS[b]+12,0.085,760); });
      [57,62,66,69,74].forEach(function(m){ horn(16,1.4,m,0.085,1700); }); horn(16,1.4,38,0.22,520); horn(16,1.4,50,0.1,760);
      /* 팀파니·심벌즈·작은북: 첫 박과 마디 머리를 짚고, 끝 두 박에서 굴려 마지막 화음으로 몰아간다 */
      crash(0,0.16,0.9); timp(0,50,0.5); timp(4,50,0.3); timp(8,50,0.36); timp(12,52,0.3);
      for(var i=0;i<12;i++){ var b=14+i/6, k=i/11; timp(b,45,0.1+0.3*k); noise(at(b),0.05,'bandpass',1900,0.7,0.05+0.2*k,0.002,pre); }
      crash(16,0.28,1.1); timp(16,50,0.5); fanEnd=performance.now()+(at(17.4)+0.5-ctx.currentTime)*1000;
    }
  };
  // play(k)로 부를 때 길이·음높이가 필요한 소리의 기본값(동현삼·동현항: 이동 · 출항 · 배 구입)
  var ARGS={foot:[0.5],horse:[0.6],tire:[0.5],tread:[0.6],siege:[0.6],ship:[0.6],air:[0.6],copter:[0.6],bell:[880,0.45,0.35]};
  var MT={foot:'foot',mech:'mech',horse:'horse',tire:'tire',tread:'tread',siege:'siege',ship:'ship',lander:'ship',air:'air'};
  return {
    get on(){ return on; },
    set:function(v){ on=!!v; try{ localStorage.setItem(storeKey,on?'on':'off'); }catch(e){} if(on) unlock(); else hush(); },
    /* 유닛 이동: mt는 이동 방식, dur는 화면 이동 시간(초), copter는 헬기 여부 */
    move:function(mt,dur,copter){ if(!ready()) return; var t=ctx.currentTime+0.01, k=copter?'copter':MT[mt];
      if(k==='mech') S.foot(t,dur,true); else if(S[k]) S[k](t,dur); },
    play:function(k,delay){ if(!ready()||!S[k]) return; played.push(k); if(played.length>40) played.shift(); S[k].apply(null,[ctx.currentTime+0.01+(delay||0)].concat(ARGS[k]||[])); },
    /* 팡파르를 멈춘다(짧은 효과음은 그대로 둔다) */
    stop:function(){ hush(); },
    /* 실제로 낸 소리의 이름(최근 40개). 시험이 읽는다 */
    get played(){ return played.slice(); },
    /* 팡파르가 울리는 중인가 */
    get ringing(){ return !!fan&&performance.now()<fanEnd; }
  };
};
