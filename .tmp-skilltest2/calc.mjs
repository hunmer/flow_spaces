// calc.mjs — 内部计算器：生成 8 份动作 JSON。用完即删，勿交付。
import fs from "fs"; import path from "path";
const REST=[["NOSE",0.004822,0.235567,0.108103],["NECK",0.001913,0.120796,0.002041],
["RIGHT SHOULDER",-0.195457,0.116444,-0.004477],["RIGHT ELBOW",-0.24856,-0.051255,-0.019633],
["RIGHT ARM",-0.271112,-0.177352,0.010273],["LEFT SHOULDER",0.199127,0.117003,-0.007554],
["LEFT ELBOW",0.250889,-0.052755,-0.020888],["LEFT ARM",0.273056,-0.176084,0.00662],
["RIGHT HIP",-0.103781,-0.175351,0.009095],["RIGHT KNEE",-0.119357,-0.304509,0.019407],
["RIGHT LEG",-0.126544,-0.408032,-0.000435],["LEFT HIP",0.106728,-0.174736,0.007826],
["LEFT KNEE",0.12174,-0.303553,0.017612],["LEFT LEG",0.128544,-0.407416,-0.004876],
["RIGHT EYE",-0.052058,0.287936,0.112812],["LEFT EYE",0.06218,0.287775,0.11187],
["RIGHT EAR",-0.096379,0.295435,0.0303],["LEFT EAR",0.104369,0.295121,0.03231]]
.map(([label,x,y,z])=>({label,x,y,z}));
const IDX=Object.fromEntries(REST.map((j,i)=>[j.label,i]));
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s}),len=a=>Math.hypot(a.x,a.y,a.z),norm=a=>mul(a,1/len(a));
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function rotAxis(v,k,rad){const c=Math.cos(rad),s=Math.sin(rad),kxv=cross(k,v),kdv=mul(k,dot(k,v)*(1-c));
  return{x:v.x*c+kxv.x*s+kdv.x,y:v.y*c+kxv.y*s+kdv.y,z:v.z*c+kxv.z*s+kdv.z};}
const HEAD=["NOSE","RIGHT EYE","LEFT EYE","RIGHT EAR","LEFT EAR"];
const NECK_P=REST[IDX["NECK"]];
function mk(N,fn){const frames=[];for(let f=0;f<N;f++){const fr=REST.map(j=>({...j}));fn(fr,f);frames.push(fr);}return frames;}
const setJ=(fr,label,p)=>{fr[IDX[label]]={...p,label};};

// ====== 动作逻辑（示例：16 帧摇头，替换成你的动作）======
const ID="head-shake";
const frames=mk(16,(fr,f)=>{
  const t=f/15,env=Math.min(1,Math.min(t,1-t)*4),ang=0.384*Math.sin(t*Math.PI*2*2.5)*env;
  for(const l of HEAD){const p=fr[IDX[l]];setJ(fr,l,add(NECK_P,rotAxis(sub(p,NECK_P),{x:0,y:1,z:0},ang)));}
});
// ====== 动作逻辑结束 ======

const DIRS=[["south",0],["south-east",45],["east",90],["north-east",135],
            ["north",180],["north-west",225],["west",270],["south-west",315]];
const rotY=(p,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{x:p.x*c+p.z*s,y:p.y,z:-p.x*s+p.z*c,label:p.label};};
const OUT=process.argv[2]||"./out";fs.mkdirSync(OUT,{recursive:true});
for(const[dir,deg]of DIRS){
  const o={character_id:"06ebaee5-f5a0-4c99-b931-5900ce503aaf",template:"mannequin",
    animation:ID,view:"low-top-down",direction:dir,camera_tilt:20,
    rest:deg===0?REST:REST.map(p=>rotY(p,deg)),frame_count:frames.length,
    frames:frames.map((fr,i)=>({frame_index:i,joints:deg===0?fr:fr.map(p=>rotY(p,deg))}))};
  fs.writeFileSync(path.join(OUT,dir==="south"?`${ID}.json`:`${ID}.${dir}.json`),JSON.stringify(o));
}
console.log("OK",ID,frames.length,"frames x8 ->",OUT);
// 顺手自检（有任何输出即不合格，禁止交付）：
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const g=f=>Object.fromEntries(f.joints.map(p=>[p.label,p]));
const s0=g(frames[0]),sN=g(frames[frames.length-1]);
for(const side of["RIGHT","LEFT"])for(const f of frames){const q=g(f);
  if(Math.abs(d(q[side+" SHOULDER"],q[side+" ELBOW"])-0.177)>0.01)console.error("上臂骨长漂移",f.frame_index);
  if(Math.abs(d(q[side+" ELBOW"],q[side+" ARM"])-0.132)>0.01)console.error("前臂骨长漂移",f.frame_index);}
const loop=REST.reduce((s,j)=>s+d(s0[j.label],sN[j.label]),0);
if(loop>0.2)console.error("循环误差",loop.toFixed(3));
console.log("self-check done");
