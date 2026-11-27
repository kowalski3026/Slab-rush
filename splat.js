/* Slab Rush: gaussian splat world for the Excavator sim (v440).
   A small self-contained 3D gaussian splat renderer on the game's own THREE (window.THREE),
   so the splat lives in the same scene as the excavator, pit and truck.
   File format: antimatter15 .splat, 32 bytes per splat:
     float32 x,y,z | float32 sx,sy,sz | uint8 r,g,b,a | uint8 qw,qx,qy,qz (q*128+128)
   Positions are already in game space (feet, y up, ground at y=0, lot centred on the origin).
   Splats are sorted back to front in a worker and blended over the opaque 3D work. */
(function(){
const T=window.THREE;
const SORT_SRC=`
let pos=null,n=0;
onmessage=e=>{const d=e.data;
 if(d.pos){pos=d.pos;n=d.n;return}
 if(!pos)return;const m=d.view,dep=new Int32Array(n);let mx=-1e9,mn=1e9;
 for(let i=0;i<n;i++){const z=(m[2]*pos[3*i]+m[6]*pos[3*i+1]+m[10]*pos[3*i+2])*4096|0;dep[i]=z;if(z>mx)mx=z;if(z<mn)mn=z}
 const B=65536,sc=(B-1)/((mx-mn)||1),cnt=new Uint32Array(B);for(let i=0;i<n;i++){dep[i]=((dep[i]-mn)*sc)|0;cnt[dep[i]]++}
 const st=new Uint32Array(B);for(let i=1;i<B;i++)st[i]=st[i-1]+cnt[i-1];
 const ord=new Float32Array(n);for(let i=0;i<n;i++)ord[st[dep[i]]++]=i;// ascending view z = farthest first (camera looks down -z)
 postMessage({ord},[ord.buffer])}`;
const VS=`precision highp float;precision highp sampler2D;
uniform sampler2D uData;uniform vec2 uFocal,uView;uniform int uTexW;
in vec3 position;in float sIdx;
uniform mat4 modelViewMatrix,projectionMatrix;
out vec4 vCol;out vec2 vPos;
vec4 tx(int i){return texelFetch(uData,ivec2(i%uTexW,i/uTexW),0);}
void main(){int b=int(sIdx)*4;vec4 t0=tx(b),t1=tx(b+1),t2=tx(b+2),t3=tx(b+3);
 vec4 cam=modelViewMatrix*vec4(t0.xyz,1.);vec4 clip=projectionMatrix*cam;float cl=1.2*clip.w;
 if(cam.z>-.3||clip.x<-cl||clip.x>cl||clip.y<-cl||clip.y>cl){gl_Position=vec4(0.,0.,2.,1.);return;}
 mat3 V=mat3(t1.x,t1.y,t1.z,t1.y,t1.w,t2.x,t1.z,t2.x,t2.y);
 float z2=cam.z*cam.z;
 mat3 J=mat3(-uFocal.x/cam.z,0.,uFocal.x*cam.x/z2, 0.,-uFocal.y/cam.z,uFocal.y*cam.y/z2, 0.,0.,0.);
 mat3 W=transpose(mat3(modelViewMatrix));mat3 Tm=W*J;mat3 c2=transpose(Tm)*V*Tm;
 float a=c2[0][0]+.3,d=c2[1][1]+.3,bb=c2[0][1];float mid=(a+d)/2.,rad=length(vec2((a-d)/2.,bb));
 float l1=mid+rad,l2=mid-rad;if(l2<0.){gl_Position=vec4(0.,0.,2.,1.);return;}
 vec2 dv=normalize(vec2(bb,l1-a));vec2 M=min(sqrt(2.*l1),1024.)*dv,N=min(sqrt(2.*l2),1024.)*vec2(dv.y,-dv.x);
 vCol=t3;vPos=position.xy;vec2 ctr=clip.xy/clip.w;
 gl_Position=vec4(ctr+position.x*M/uView*2.+position.y*N/uView*2.,clip.z/clip.w,1.);}`;
const FS=`precision highp float;in vec4 vCol;in vec2 vPos;out vec4 fc;
void main(){float A=-dot(vPos,vPos);if(A<-4.)discard;float al=exp(A)*vCol.a;if(al<1./255.)discard;fc=vec4(vCol.rgb,al);}`;
function build(buf,opt){opt=opt||{};const row=32,N0=buf.byteLength/row|0,f=new Float32Array(buf),u=new Uint8Array(buf);
 const cut=opt.cut;// [x0,z0,x1,z1,yMax]: drop ground splats inside the dig, the 3D pit shows there instead
 const keep=[];for(let i=0;i<N0;i++){const x=f[i*8],y=f[i*8+1],z=f[i*8+2];if(cut&&x>cut[0]&&x<cut[2]&&z>cut[1]&&z<cut[3]&&y<cut[4])continue;keep.push(i)}
 const n=keep.length,W=2048,H=Math.ceil(n*4/W),data=new Float32Array(W*H*4),pos=new Float32Array(n*3);
 for(let k=0;k<n;k++){const i=keep[k],o=k*16;const x=f[i*8],y=f[i*8+1],z=f[i*8+2],sx=f[i*8+3],sy=f[i*8+4],sz=f[i*8+5];
  const q=[(u[i*32+28]-128)/128,(u[i*32+29]-128)/128,(u[i*32+30]-128)/128,(u[i*32+31]-128)/128],ql=Math.hypot(...q)||1,w=q[0]/ql,qx=q[1]/ql,qy=q[2]/ql,qz=q[3]/ql;
  const R=[1-2*(qy*qy+qz*qz),2*(qx*qy+w*qz),2*(qx*qz-w*qy), 2*(qx*qy-w*qz),1-2*(qx*qx+qz*qz),2*(qy*qz+w*qx), 2*(qx*qz+w*qy),2*(qy*qz-w*qx),1-2*(qx*qx+qy*qy)];
  const M=[R[0]*sx,R[1]*sx,R[2]*sx,R[3]*sy,R[4]*sy,R[5]*sy,R[6]*sz,R[7]*sz,R[8]*sz];
  const s00=M[0]*M[0]+M[3]*M[3]+M[6]*M[6],s01=M[0]*M[1]+M[3]*M[4]+M[6]*M[7],s02=M[0]*M[2]+M[3]*M[5]+M[6]*M[8],s11=M[1]*M[1]+M[4]*M[4]+M[7]*M[7],s12=M[1]*M[2]+M[4]*M[5]+M[7]*M[8],s22=M[2]*M[2]+M[5]*M[5]+M[8]*M[8];
  data.set([x,y,z,0, s00,s01,s02,s11, s12,s22,0,0, u[i*32+24]/255,u[i*32+25]/255,u[i*32+26]/255,u[i*32+27]/255],o);pos.set([x,y,z],k*3)}
 const tex=new T.DataTexture(data,W,H,T.RGBAFormat,T.FloatType);tex.needsUpdate=true;tex.colorSpace=T.NoColorSpace;tex.minFilter=tex.magFilter=T.NearestFilter;
 const g=new T.InstancedBufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array([-2,-2,0, 2,-2,0, 2,2,0, -2,2,0]),3));g.setIndex([0,1,2,0,2,3]);
 const idx=new T.InstancedBufferAttribute(new Float32Array(n),1);idx.setUsage(T.DynamicDrawUsage);g.setAttribute('sIdx',idx);g.instanceCount=n;
 const mat=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:VS,fragmentShader:FS,uniforms:{uData:{value:tex},uFocal:{value:new T.Vector2()},uView:{value:new T.Vector2()},uTexW:{value:W}},
  transparent:true,depthWrite:false,depthTest:true,blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,blendSrcAlpha:T.OneFactor,blendDstAlpha:T.OneMinusSrcAlphaFactor});
 const mesh=new T.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=10;mesh.userData.live=true;mesh.name='splatWorld';
 const wk=new Worker(URL.createObjectURL(new Blob([SORT_SRC],{type:'text/javascript'})));wk.postMessage({pos,n});let busy=false,last=null;
 wk.onmessage=e=>{idx.array.set(e.data.ord);idx.needsUpdate=true;busy=false};
 const vs=new T.Vector2();
 mesh.onBeforeRender=(r,s,c)=>{r.getDrawingBufferSize(vs);mat.uniforms.uView.value.copy(vs);
   const p=c.projectionMatrix.elements;mat.uniforms.uFocal.value.set(p[0]*vs.x/2,p[5]*vs.y/2);
   const m=new T.Matrix4().multiplyMatrices(c.matrixWorldInverse,mesh.matrixWorld).elements;
   if(!busy){const k=m[2].toFixed(3)+m[6].toFixed(3)+m[10].toFixed(3)+(m[14]|0);if(k!==last){last=k;busy=true;wk.postMessage({view:Array.from(m)})}}};
 mesh.userData.dispose=()=>{wk.terminate();tex.dispose();g.dispose();mat.dispose()};
 return mesh}
window.SPLAT={load(url,opt){return fetch(url).then(r=>{if(!r.ok)throw new Error('splat '+r.status);return r.arrayBuffer()}).then(b=>build(b,opt))},build};
})();
