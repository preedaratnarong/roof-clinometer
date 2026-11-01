(function(){const $=id=>document.getElementById(id),R=Math.PI/180,LS=localStorage;
const st=Object.assign({lat:13.75,lon:100.5,tz:7,fov:60,off:0,obs:[],pick:''},JSON.parse(LS.getItem('ar_cfg')||'{}'));
const save=()=>LS.setItem('ar_cfg',JSON.stringify(st));
let M=null,Ms=null,stream=null,mode='2d',raf=0,absOK=false;
const now=new Date();let selDay=dayOfYear(now),selMin=now.getHours()*60+now.getMinutes();
function dayOfYear(d){return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(d.getFullYear(),0,1))/864e5)+1}
const YR=now.getFullYear();function ymd(doy){const d=new Date(Date.UTC(YR,0,doy));return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}
const TH=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function curves(){const c=[{n:'ครีษมายัน 21 มิ.ย.',d:[6,21],col:'#ffb020'},{n:'วิษุวัต 20 มี.ค./22 ก.ย.',d:[3,20],col:'#A6FF00'},{n:'เหมายัน 21 ธ.ค.',d:[12,21],col:'#4db8ff'}];
 const t=ymd(selDay);c.push({n:'วันที่เลือก '+t[2]+' '+TH[t[1]-1],d:[t[1],t[2]],col:'#ff5cf0',w:3});
 if(st.pick){const p=st.pick.split('-').map(Number);c.push({n:'กำหนดเอง '+p[2]+' '+TH[p[1]-1],d:[p[1],p[2]],col:'#ffffff'})}return c}
function sp(m,d,h){return SUN.pos(SUN.lt(YR,m,d,h,st.tz),st.lat,st.lon)}
function path(m,d){const a=[];for(let h=0;h<=24.001;h+=1/6){const p=sp(m,d,h);a.push({h,az:p.az,alt:p.alt})}return a}
// obstacle horizon
function hor(az){const o=st.obs.slice().sort((a,b)=>a.az-b.az);if(!o.length)return 0;if(o.length===1)return Math.abs(((az-o[0].az+540)%360)-180)<3?o[0].alt:0;
 for(let i=0;i<o.length;i++){const a=o[i],b=o[(i+1)%o.length];let span=(b.az-a.az+360)%360,x=(az-a.az+360)%360;if(span>0&&span<=60&&x<=span)return a.alt+(b.alt-a.alt)*x/span}return 0}
const blocked=p=>p.alt>0&&p.alt<hor(p.az);
function shadeStats(m,d){let tot=0,lost=0,rg=[],cur=null;const st5=1/12;for(let h=4;h<=20.001;h+=st5){const p=sp(m,d,h);const up=p.alt>0;if(up)tot+=Math.sin(p.alt*R);const b=up&&blocked(p);if(b){lost+=Math.sin(p.alt*R);if(!cur)cur=[h,h];cur[1]=h+st5}else if(cur){rg.push(cur);cur=null}}if(cur)rg.push(cur);return{pct:tot?lost/tot*100:0,rg,hrs:rg}}
const rgTxt=rg=>rg.map(r=>hm(r[0])+'–'+hm(r[1])).join(', ');
// orientation -> rotation matrix (device->ENU)
function rot(al,be,ga){const a=al*R,b=be*R,g=ga*R,cA=Math.cos(a),sA=Math.sin(a),cB=Math.cos(b),sB=Math.sin(b),cG=Math.cos(g),sG=Math.sin(g);
 return[cA*cG-sA*sB*sG,-cB*sA,cA*sG+cG*sA*sB, cG*sA+cA*sB*sG,cA*cB,sA*sG-cA*cG*sB, -cB*sG,sB,cB*cG]}
function onOri(e,abs){let al;if(e.webkitCompassHeading!=null)al=360-e.webkitCompassHeading;else if(abs||e.absolute)al=e.alpha;else if(absOK)return;else al=e.alpha;
 if(al==null||e.beta==null)return;if(abs)absOK=true;const m=rot(al+st.off,e.beta,e.gamma);// off rotates world heading
 if(!Ms)Ms=m.slice();else for(let i=0;i<9;i++)Ms[i]+=0.2*(m[i]-Ms[i]);M=Ms;$('arSens').textContent='เซนเซอร์: '+(e.webkitCompassHeading!=null?'iOS compass':(abs||e.absolute)?'absolute':'relative (อาจไม่ตรงทิศ)')}
// heading offset: positive off => scene heading shifts. Heading = compass - off
function proj(az,alt,W,H){if(!M)return null;const ce=Math.cos(alt*R),v=[Math.sin(az*R)*ce,Math.cos(az*R)*ce,Math.sin(alt*R)];
 const x=M[0]*v[0]+M[3]*v[1]+M[6]*v[2],y=M[1]*v[0]+M[4]*v[1]+M[7]*v[2],z=M[2]*v[0]+M[5]*v[1]+M[8]*v[2];if(z>=-0.05)return null;
 const f=W/2/Math.tan(st.fov*R/2);return{x:W/2+f*x/-z,y:H/2-f*y/-z}}
function center(){if(!M)return null;const x=-M[2],y=-M[5],z=-M[8];return{az:(Math.atan2(x,y)/R+360)%360,alt:Math.asin(Math.max(-1,Math.min(1,z)))/R}}
// 2D polar projection
function polar(az,alt,W,H){if(alt<-2)return null;const r=Math.min(W,H)/2-26,rr=r*(90-Math.max(alt,0))/90;return{x:W/2+rr*Math.sin(az*R),y:H/2-rr*Math.cos(az*R)}}
function draw(){const cv=$('arCv'),W=cv.clientWidth,H=cv.clientHeight,dpr=devicePixelRatio||1;if(cv.width!==W*dpr){cv.width=W*dpr;cv.height=H*dpr}
 const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);const P=mode==='ar'?proj:polar;c.font='12px sans-serif';c.lineCap='round';
 const line=(pts,col,w,dash)=>{c.strokeStyle=col;c.lineWidth=w;c.setLineDash(dash||[]);c.beginPath();let pen=false;for(const p of pts){const q=p&&P(p.az,p.alt,W,H);if(!q){pen=false;continue}pen?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);pen=true}c.stroke();c.setLineDash([])};
 const txt=(s,x,y,col,al)=>{c.textAlign=al||'center';c.fillStyle='#000a';const w=c.measureText(s).width;c.fillRect((al==='left'?x:x-w/2)-3,y-11,w+6,15);c.fillStyle=col;c.fillText(s,x,y)};
 if(mode==='2d'){c.fillStyle='#07090a';c.fillRect(0,0,W,H)}
 // grid
 for(let a=0;a<=60;a+=15){const pts=[];for(let z=0;z<=360;z+=3)pts.push({az:z,alt:a});line(pts,a?'#ffffff22':'#A6FF00',a?1:2)}
 if(mode==='ar')for(let a=15;a<=60;a+=15){const q=P(center()?center().az:0,a,W,H);if(q)txt(a+'°',q.x+18,q.y,'#ffffff88')}
 const NM={0:'เหนือ',90:'ตะวันออก',180:'ใต้',270:'ตะวันตก'};for(let z=0;z<360;z+=15){const q=P(z,0,W,H),q2=P(z,NM[z]!=null?4:2,W,H);if(q&&q2){c.strokeStyle='#A6FF00';c.lineWidth=1.5;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q2.x,q2.y);c.stroke()}
  if(q){if(NM[z]!=null)txt(NM[z],q.x+(mode==='ar'?0:z===90?-34:z===270?30:0),mode==='ar'?q.y+18:q.y+(z===0?-6:z===180?16:4),'#A6FF00');else if(z%45===0)txt(z+'°',q.x,q.y+16,'#ccc')}}
 // obstacles
 if(st.obs.length){const o=st.obs.slice().sort((a,b)=>a.az-b.az);const pts=[];for(let z=0;z<=360;z+=1){const h=hor(z);pts.push(h>0?{az:z,alt:h}:null)}line(pts,'#ff4d4d',2.5);
  for(const p of o){const q=P(p.az,p.alt,W,H);if(q){c.fillStyle='#ff4d4d';c.beginPath();c.arc(q.x,q.y,4,0,7);c.fill()}}}
 // analemma hour lines
 for(let h=6;h<=18;h++){const pts=[];for(let dy=1;dy<=366;dy+=7){const t=ymd(dy),p=sp(t[1],t[2],h);pts.push(p.alt>0?p:null)}line(pts,'#ffffff30',1,[3,4])}
 // season curves
 for(const cu of curves()){const pa=path(cu.d[0],cu.d[1]);let seg=[],segB=[];for(const p of pa){const b=blocked(p);seg.push(p.alt>0&&!b?p:null);segB.push(p.alt>0&&b?p:null)}
  line(seg,cu.col,cu.w||2.5);line(segB,'#ff4d4d',cu.w||2.5,[6,5]);
  for(const p of pa){if(Math.abs(p.h-Math.round(p.h))>1e-6||p.alt<=0)continue;const q=P(p.az,p.alt,W,H);if(!q)continue;c.fillStyle=blocked(p)?'#ff4d4d':cu.col;c.beginPath();c.arc(q.x,q.y,3.5,0,7);c.fill();
   if(cu.w||cu.d[0]===6)txt(Math.round(p.h)+'',q.x,q.y-7,'#fff')}
  const rs=SUN.riseSet(YR,cu.d[0],cu.d[1],st.lat,st.lon,st.tz);for(const h of[rs.rise,rs.set])if(h!=null){const p=sp(cu.d[0],cu.d[1],h),q=P(p.az,0,W,H);if(q){c.strokeStyle=cu.col;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,6,0,7);c.stroke()}}}
 // sun
 const t=ymd(selDay),s=sp(t[1],t[2],selMin/60),q=P(s.az,s.alt,W,H);if(q){const gr=c.createRadialGradient(q.x,q.y,2,q.x,q.y,22);gr.addColorStop(0,'#fff');gr.addColorStop(.35,'#ffd84d');gr.addColorStop(1,'#ffd84d00');c.fillStyle=gr;c.beginPath();c.arc(q.x,q.y,22,0,7);c.fill();txt('☀',q.x,q.y+5,'#ffde00')}
 if(mode==='ar'){c.strokeStyle='#A6FF00';c.lineWidth=1.5;c.beginPath();c.moveTo(W/2-16,H/2);c.lineTo(W/2+16,H/2);c.moveTo(W/2,H/2-16);c.lineTo(W/2,H/2+16);c.stroke();const ce=center();$('arCtr').textContent=ce?'เป้า: Az '+ce.az.toFixed(1)+'° · Alt '+ce.alt.toFixed(1)+'°':'รอเซนเซอร์…'}else $('arCtr').textContent='มุมมอง 2D (โดมท้องฟ้า) · จุดกลาง = เหนือศีรษะ'
 readout(s,t)}
var hm=h=>{if(h==null)return'--';const t=Math.round(h*60);return String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
function readout(s,t){$('arRead').innerHTML=`<b>${t[2]} ${TH[t[1]-1]} ${hm(selMin/60)}</b> · Az <b>${s.az.toFixed(1)}°</b> · Alt <b>${s.alt.toFixed(1)}°</b>`+(blocked(s)?' · <span style="color:#ff4d4d">โดนบัง</span>':'');
 const rs=SUN.riseSet(t[0],t[1],t[2],st.lat,st.lon,st.tz);$('arRS').textContent='ขึ้น '+hm(rs.rise)+' · ตก '+hm(rs.set)+' (เวลาท้องถิ่น UTC+'+st.tz+')';
 // shadow calc
 const Hh=parseFloat($('shH').value)||0,Rf=parseFloat($('shR').value)||0,Dd=parseFloat($('shD').value)||0,eh=Hh-Rf;let o;
 if(s.alt<=0)o='ดวงอาทิตย์อยู่ใต้ขอบฟ้า';else if(eh<=0)o='สิ่งกีดขวางไม่สูงกว่าหลังคา → ไม่บัง';else{const L=eh/Math.tan(s.alt*R);o=`เงายาว (เหนือระดับหลังคา) <b>${L.toFixed(1)} ม.</b> ทอดไปทิศ ${((s.az+180)%360).toFixed(0)}° → `+(L>=Dd?'<span style="color:#ff4d4d">ถึงหลังคา (ถ้าอยู่ในแนวทิศนั้น)</span>':'<span style="color:#A6FF00">ไม่ถึงหลังคา</span>')}
 $('shOut').innerHTML=o}
const SN=['มิ.ย.','มี.ค./ก.ย.','ธ.ค.'];
function summary(){try{let h='',sh='';curves().forEach((cu,i)=>{const r=shadeStats(cu.d[0],cu.d[1]),t=r.rg.length?rgTxt(r.rg):'ไม่โดนบัง';
 h+=`<div><span style="color:${cu.col}">● ${cu.n}</span><small>${r.rg.length?'บังช่วง '+t:'ไม่โดนบัง'}</small><b>${r.pct.toFixed(1)}%</b></div>`;
 sh+=`<div class="sr"><span style="color:${cu.col}">● ${SN[i]||(i===3?'วันที่เลือก':'กำหนดเอง')}</span><small>${t}</small><b class="${r.pct>=5?'bad':''}">-${r.pct.toFixed(1)}%</b></div>`});
 $('arSum').innerHTML=(st.obs.length?h:'<div><small>ยังไม่มีจุดสิ่งกีดขวาง — เล็งที่ขอบบนต้นไม้/ตึก แล้วกด “➕ มาร์กจุด”</small></div>');
 const sp_=$('arStrip');if(sp_)sp_.innerHTML=`<div class="sh"><span>🌳 สรุปเงาบัง · ${st.obs.length} จุด</span><span>${sp_.classList.contains('min')?'▲':'▼'}</span></div>`+(st.obs.length?sh:'<div class="sr"><small>ยังไม่มีจุด — เล็ง + ที่ขอบบนสิ่งกีดขวาง แล้วกด ➕</small></div>')}catch(e){console.error(e);$('arSum').textContent='คำนวณสรุปไม่ได้: '+e.message}}
function loop(){draw();raf=requestAnimationFrame(loop)}
async function startAR(){try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw new Error('ไม่ได้รับสิทธิ์เซนเซอร์')}
  
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});$('arVid').srcObject=stream;await $('arVid').play().catch(()=>{});
  setMode('ar')}catch(err){$('arMsg').textContent='เปิดกล้อง/เซนเซอร์ไม่ได้: '+(err.message||err)+' → ใช้มุมมอง 2D แทน (ต้องเปิดผ่าน HTTPS)';setMode('2d')}}
function setMode(m){mode=m;document.body.classList.toggle('arfull',m==='ar');$('arVid').style.display=m==='ar'?'block':'none';$('arStart').textContent=m==='ar'?'■ ปิดกล้อง':'📷 เปิดกล้อง AR';if(m!=='ar'&&stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function geo(){if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(p=>{st.lat=+p.coords.latitude.toFixed(4);st.lon=+p.coords.longitude.toFixed(4);st.tz=-new Date().getTimezoneOffset()/60;syncIn();save();summary()},()=>{$('arMsg').textContent='ไม่ได้ตำแหน่ง GPS — ใช้ค่าที่กรอกเอง'})}
function syncIn(){$('arLat').value=st.lat;$('arLon').value=st.lon;$('arTz').value=st.tz;$('arFov').value=st.fov;$('arFovV').textContent=st.fov+'°';$('arOff').value=st.off;$('arOffV').textContent=st.off+'°';$('arDay').value=selDay;$('arMin').value=selMin;$('arPick').value=st.pick}
function init(){syncIn();summary();addEventListener('deviceorientationabsolute',e=>onOri(e,true));addEventListener('deviceorientation',e=>onOri(e,false));
 $('arStart').onclick=()=>mode==='ar'?setMode('2d'):startAR();$('arExit').onclick=()=>setMode('2d');$('arGeo').onclick=geo;
 for(const[k,id]of[['lat','arLat'],['lon','arLon'],['tz','arTz']])$(id).onchange=e=>{st[k]=parseFloat(e.target.value)||0;save();summary()};
 $('arFov').oninput=e=>{st.fov=+e.target.value;$('arFovV').textContent=st.fov+'°';save()};$('arOff').oninput=e=>{st.off=+e.target.value;$('arOffV').textContent=st.off+'°';save()};
 $('arDay').oninput=e=>{selDay=+e.target.value;summary()};$('arMin').oninput=e=>{selMin=+e.target.value};$('arNow').onclick=()=>{const d=new Date();selDay=dayOfYear(d);selMin=d.getHours()*60+d.getMinutes();syncIn();summary()};
 $('arPick').onchange=e=>{st.pick=e.target.value;save();summary()};
 $('arMark').onclick=()=>{const ce=center();if(!ce){$('arMsg').textContent='ต้องเปิดโหมดกล้อง AR ก่อนจึงจะมาร์กจุดได้ (หรือกรอก Az/Alt เอง)';return}st.obs.push({az:+ce.az.toFixed(1),alt:+Math.max(0,ce.alt).toFixed(1)});save();summary()};
 $('arAdd').onclick=()=>{const a=parseFloat($('obAz').value),b=parseFloat($('obAlt').value);if(isFinite(a)&&isFinite(b)){st.obs.push({az:(a+360)%360,alt:b});save();summary()}};
 const clrAll=()=>{if(!st.obs.length||confirm('ลบจุดสิ่งกีดขวางทั้งหมด?')){st.obs=[];save();summary()}};$('arClr2').onclick=clrAll;$('arSumT').onclick=()=>{const e=$('arStrip');e.classList.toggle('min');summary()};$('arStrip').onclick=$('arSumT').onclick;
 $('arUndo').onclick=()=>{st.obs.pop();save();summary()};$('arClr').onclick=()=>{if(confirm('ลบจุดสิ่งกีดขวางทั้งหมด?')){st.obs=[];save();summary()}};
 $('arSunCal').onclick=()=>{const ce=center();if(!ce){$('arMsg').textContent='เปิดกล้อง AR แล้วเล็งกากบาทตรงดวงอาทิตย์จริงก่อน';return}const d=new Date(),s=sp(d.getMonth()+1,d.getDate(),d.getHours()+d.getMinutes()/60);let dz=((s.az-ce.az+540)%360)-180;st.off=Math.round((st.off-dz)*10)/10;save();syncIn();Ms=null;$('arMsg').textContent='คาลิเบรตแล้ว: ปรับทิศ '+(-dz).toFixed(1)+'°'};
 ['shH','shR','shD'].forEach(i=>$(i).oninput=()=>{});
 // run loop only when tab visible
 const tab=$('t-ar');new MutationObserver(()=>{cancelAnimationFrame(raf);if(tab.classList.contains('on'))loop();else setMode('2d')}).observe(tab,{attributes:true,attributeFilter:['class']});if(tab.classList.contains('on'))loop()}
window.AR={st,setMode,_set:(d,m)=>{selDay=d;selMin=m;syncIn();summary()},summary};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init()})();
