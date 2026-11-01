// NOAA solar position (Meeus-based). Exposed as window.SUN / module.exports
(function(G){const R=Math.PI/180;
function pos(ms,lat,lon){const jd=ms/864e5+2440587.5,T=(jd-2451545)/36525;
let L0=(280.46646+T*(36000.76983+T*0.0003032))%360;const M=357.52911+T*(35999.05029-0.0001537*T),e=0.016708634-T*(0.000042037+0.0000001267*T);
const C=Math.sin(M*R)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*M*R)*(0.019993-0.000101*T)+Math.sin(3*M*R)*0.000289;
const om=125.04-1934.136*T,lam=L0+C-0.00569-0.00478*Math.sin(om*R);
const eps0=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60,eps=eps0+0.00256*Math.cos(om*R);
const dec=Math.asin(Math.sin(eps*R)*Math.sin(lam*R));const y=Math.tan(eps*R/2)**2;
const Et=4/R*(y*Math.sin(2*L0*R)-2*e*Math.sin(M*R)+4*e*y*Math.sin(M*R)*Math.cos(2*L0*R)-0.5*y*y*Math.sin(4*L0*R)-1.25*e*e*Math.sin(2*M*R));
const d=new Date(ms),utcMin=d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60;
let ha=(utcMin+Et+4*lon)/4-180;if(ha<-180)ha+=360;
const cz=Math.sin(lat*R)*Math.sin(dec)+Math.cos(lat*R)*Math.cos(dec)*Math.cos(ha*R),z=Math.acos(Math.max(-1,Math.min(1,cz)));
let az=Math.atan2(Math.sin(ha*R),Math.cos(ha*R)*Math.sin(lat*R)-Math.tan(dec)*Math.cos(lat*R))/R+180;
let alt=90-z/R;// refraction (NOAA)
const te=Math.tan(alt*R);let rf=0;if(alt>85)rf=0;else if(alt>5)rf=58.1/te-0.07/te**3+0.000086/te**5;else if(alt>-0.575)rf=1735+alt*(-518.2+alt*(103.4+alt*(-12.79+alt*0.711)));else rf=-20.774/te;
return{az:(az+360)%360,alt:alt+rf/3600,altGeo:alt,dec:dec/R,eot:Et}}
// local wall time -> UTC ms, tz hours
function lt(y,m,d,h,tz){return Date.UTC(y,m-1,d,0,0,0)+(h-tz)*36e5}
function riseSet(y,m,d,lat,lon,tz){const f=h=>pos(lt(y,m,d,h,tz),lat,lon).altGeo+0.833;
 const bis=(a,b)=>{for(let i=0;i<40;i++){const c=(a+b)/2;(f(a)<0)===(f(c)<0)?a=c:b=c}return(a+b)/2};
 let r=null,s=null;for(let h=0;h<24;h+=0.25){const a=f(h),b=f(h+0.25);if(a<0&&b>=0&&r==null)r=bis(h,h+0.25);if(a>=0&&b<0)s=bis(h,h+0.25)}return{rise:r,set:s}}
const API={pos,lt,riseSet};if(typeof module!=='undefined')module.exports=API;else G.SUN=API})(this);
