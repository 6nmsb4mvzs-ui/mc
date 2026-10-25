import * as THREE from './three.module.js';

const mount = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(34, 1, .1, 250);
camera.position.set(16, 37, 34);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
mount.appendChild(renderer.domElement);

const root = new THREE.Group(); scene.add(root);
const actor = new THREE.Group(); root.add(actor);
const hemi = new THREE.HemisphereLight(0xe5f4d1, 0x34382c, 2.25); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1d8, 3.2); key.position.set(-12, 30, 24); key.castShadow = true; key.shadow.mapSize.set(1024,1024); scene.add(key);
const fill = new THREE.DirectionalLight(0xc1dc91, 1.7); fill.position.set(20,18,-22); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({color:0x41433b,roughness:.95}));
floor.rotation.x=-Math.PI/2; floor.position.y=-.035; floor.receiveShadow=true; scene.add(floor);
const groundRing = new THREE.Mesh(new THREE.RingGeometry(2.2,2.23,64), new THREE.MeshBasicMaterial({color:0x8cab5b,transparent:true,opacity:.22,side:THREE.DoubleSide})); groundRing.rotation.x=-Math.PI/2; groundRing.position.y=-.026; scene.add(groundRing);
const grid = new THREE.GridHelper(8,24,0x65724d,0x394034); grid.position.y=-.024; grid.material.transparent=true; grid.material.opacity=.28; scene.add(grid);
let gridOn=true, slim=false, itemOn=true, paused=false, anim='idle', intensity=1, speed=1, fov=34, zoom=1;
const armorSlots=['helmet','chestplate','leggings','boots']; const armorNames={helmet:'Helmet',chestplate:'Chestplate',leggings:'Leggings',boots:'Boots'};
const armorSelection={helmet:'netherite',chestplate:'netherite',leggings:'netherite',boots:'netherite'}; const armorTrim=Object.fromEntries(armorSlots.map(s=>[s,{pattern:'none',material:'amethyst',custom:'#a947ef',fit:1,glint:false}])); let activeArmorSlot='helmet'; let armorMeshesBySlot={}; let trimMeshes=[]; let armorMaterialImages={};
let skinSource=null, skinImage=null, skinLabel='Default';
let heldKind='sword', heldMaterial='iron', itemRequest=0;
const localImageCache=new Map();
const parts={};
const actorMeshes=[];

const playerRig={
  head:{size:[8,8,8],pivot:[0,24,0],center:[0,4,0]},
  torso:{size:[8,12,4],pivot:[0,18,0],center:[0,0,0]},
  arm:{size:[4,12,4],pivotY:24,center:[0,-6,0]},
  leg:{size:[4,12,4],pivotY:12,center:[0,-6,0]}
};

const defaultCanvas=document.createElement('canvas'); defaultCanvas.width=64; defaultCanvas.height=64;
const dc=defaultCanvas.getContext('2d');
dc.fillStyle='#cea47e';dc.fillRect(8,8,8,8);dc.fillRect(16,8,8,8);dc.fillRect(0,8,8,8);dc.fillRect(24,8,8,8);dc.fillRect(8,0,8,8);dc.fillRect(16,0,8,8);
dc.fillStyle='#6a472f';dc.fillRect(8,8,8,3);dc.fillRect(0,8,8,3);dc.fillRect(16,8,8,3);dc.fillRect(24,8,8,3);
dc.fillStyle='#272521';dc.fillRect(10,12,2,2);dc.fillRect(16,12,2,2);dc.fillStyle='#a95e54';dc.fillRect(12,14,3,1);
dc.fillStyle='#397f82';dc.fillRect(20,20,8,12);dc.fillStyle='#315d70';dc.fillRect(20,20,8,2);
dc.fillStyle='#cea47e';dc.fillRect(44,20,4,12);dc.fillRect(52,20,4,12);dc.fillRect(40,20,4,12);dc.fillRect(48,20,4,12);
dc.fillRect(36,52,4,12);dc.fillRect(44,52,4,12);dc.fillRect(32,52,4,12);dc.fillRect(40,52,4,12);
dc.fillStyle='#354c82';dc.fillRect(4,20,4,12);dc.fillRect(12,20,4,12);dc.fillRect(0,20,4,12);dc.fillRect(8,20,4,12);
dc.fillRect(20,52,4,12);dc.fillRect(28,52,4,12);dc.fillRect(16,52,4,12);dc.fillRect(24,52,4,12);
dc.fillStyle='#30352d';dc.fillRect(4,20,4,2);dc.fillRect(12,20,4,2);dc.fillRect(0,20,4,2);dc.fillRect(8,20,4,2);
skinSource=defaultCanvas;

function atlasMaterial(rect, source=skinSource) {
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
  if(source) { try { const sw=source.naturalWidth||source.width||64, sh=source.naturalHeight||source.height||64; ctx.drawImage(source,0,0,Math.min(64,sw),Math.min(64,sh)); } catch {} }
  const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace; texture.magFilter=THREE.NearestFilter; texture.minFilter=THREE.NearestFilter;
  texture.repeat.set(rect[2]/64,rect[3]/64); texture.offset.set(rect[0]/64,1-(rect[1]+rect[3])/64); texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({map:texture, roughness:.84, metalness:0});
}

function boxPart(name,size,pos,uv,group=actor,source=skinSource) {
  const geo=new THREE.BoxGeometry(...size); const mats=uv.map(r=>atlasMaterial(r,source));
  const mesh=new THREE.Mesh(geo,mats); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.position.set(...pos); group.add(mesh); parts[name]=mesh; actorMeshes.push(mesh); return mesh;
}

// Correct Minecraft Java Edition armor texture UV coordinates (64x32 atlas).
// Face order: right (-X), left (+X), top (+Y), bottom (-Y), front (+Z), back (-Z).
// humanoid.png layout:
//   Head:      row 0-15,  col 0-31
//   Body:      row 16-31, col 16-39
//   Right arm: row 16-31, col 40-55
// humanoid_leggings.png layout:
//   Right leg: row 16-31, col 0-15
//   Body:      row 16-31, col 16-39

const headArmorUV = [[0,8,8,8],[16,8,8,8],[8,0,8,8],[16,0,8,8],[8,8,8,8],[24,8,8,8]];
const torsoArmorUV = [[16,20,4,12],[28,20,4,12],[20,16,8,4],[28,16,8,4],[20,20,8,12],[32,20,8,12]];
const armArmorUV = [[40,20,4,12],[48,20,4,12],[44,16,4,4],[48,16,4,4],[44,20,4,12],[52,20,4,12]];
const rightLegArmorUV = [[0,20,4,12],[8,20,4,12],[4,16,4,4],[8,16,4,4],[4,20,4,12],[12,20,4,12]];
const leftLegArmorUV = [[0,20,4,12],[8,20,4,12],[4,16,4,4],[8,16,4,4],[4,20,4,12],[12,20,4,12]];
const rightBootArmorUV = [[0,26,4,6],[8,26,4,6],[4,26,4,4],[8,26,4,4],[4,26,4,6],[12,26,4,6]];
const leftBootArmorUV = [[0,26,4,6],[8,26,4,6],[4,26,4,4],[8,26,4,4],[4,26,4,6],[12,26,4,6]];

function makeModel(){
  while(actor.children.length) actor.remove(actor.children[0]); Object.keys(parts).forEach(k=>delete parts[k]); actorMeshes.length=0;
  const ar=slim?3:4;

  const torsoJoint=new THREE.Group();torsoJoint.position.set(...playerRig.torso.pivot);actor.add(torsoJoint);parts.torso=torsoJoint;
  boxPart('torsoMesh',playerRig.torso.size,playerRig.torso.center,[[16,20,4,12],[28,20,4,12],[20,16,8,4],[28,16,8,4],[20,20,8,12],[32,20,8,12]],torsoJoint);
  const headJoint=new THREE.Group();headJoint.position.set(...playerRig.head.pivot);actor.add(headJoint);parts.head=headJoint;
  boxPart('headMesh',playerRig.head.size,playerRig.head.center,[[0,8,8,8],[16,8,8,8],[8,0,8,8],[16,0,8,8],[8,8,8,8],[24,8,8,8]],headJoint);
  const hat=boxPart('hat',[8.5,8.5,8.5],playerRig.head.center,[[32,8,8,8],[48,8,8,8],[40,0,8,8],[48,0,8,8],[40,8,8,8],[56,8,8,8]],headJoint); hat.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});
  const armReach=4+ar/2, armSize=[ar,...playerRig.arm.size.slice(1)], armCenter=playerRig.arm.center;
  const rightArm=new THREE.Group();rightArm.position.set(-armReach,playerRig.arm.pivotY,0);actor.add(rightArm);parts.rightArm=rightArm;
  boxPart('rightArmSkin',armSize,armCenter,[[40,20,4,12],[48,20,4,12],[44,16,4,4],[48,16,4,4],[44,20,4,12],[52,20,4,12]],rightArm);
  const rightSleeve=boxPart('rightSleeve',[ar+.24,12.24,4.24],armCenter,[[40,36,4,12],[48,36,4,12],[44,32,4,4],[48,32,4,4],[44,36,4,12],[52,36,4,12]],rightArm);rightSleeve.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});
  const leftArm=new THREE.Group();leftArm.position.set(armReach,playerRig.arm.pivotY,0);actor.add(leftArm);parts.leftArm=leftArm;
  boxPart('leftArmSkin',armSize,armCenter,[[32,52,4,12],[40,52,4,12],[36,48,4,4],[40,48,4,4],[36,52,4,12],[44,52,4,12]],leftArm);
  const leftSleeve=boxPart('leftSleeve',[ar+.24,12.24,4.24],armCenter,[[48,52,4,12],[56,52,4,12],[52,48,4,4],[56,48,4,4],[52,52,4,12],[60,52,4,12]],leftArm);leftSleeve.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});
  const rightLeg=new THREE.Group();rightLeg.position.set(-2,playerRig.leg.pivotY,0);actor.add(rightLeg);parts.rightLeg=rightLeg;
  boxPart('rightLegSkin',playerRig.leg.size,playerRig.leg.center,[[0,20,4,12],[8,20,4,12],[4,16,4,4],[8,16,4,4],[4,20,4,12],[12,20,4,12]],rightLeg);
  const rightPants=boxPart('rightPants',[4.24,12.24,4.24],[0,-6,0],[[0,36,4,12],[8,36,4,12],[4,32,4,4],[8,32,4,4],[4,36,4,12],[12,36,4,12]],rightLeg);rightPants.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});
  const leftLeg=new THREE.Group();leftLeg.position.set(2,playerRig.leg.pivotY,0);actor.add(leftLeg);parts.leftLeg=leftLeg;
  boxPart('leftLegSkin',playerRig.leg.size,playerRig.leg.center,[[16,52,4,12],[24,52,4,12],[20,48,4,4],[24,48,4,4],[20,52,4,12],[28,52,4,12]],leftLeg);
  const leftPants=boxPart('leftPants',[4.24,12.24,4.24],[0,-6,0],[[0,52,4,12],[8,52,4,12],[4,48,4,4],[8,48,4,4],[4,52,4,12],[12,52,4,12]],leftLeg);leftPants.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});
  const jacket=boxPart('jacket',[8.2,12.2,4.2],[0,0,0],[[16,36,4,12],[28,36,4,12],[20,32,8,4],[28,32,8,4],[20,36,8,12],[32,36,8,12]],torsoJoint); jacket.material.forEach(m=>{m.transparent=true;m.alphaTest=.1});

  armorMeshesBySlot={helmet:[],chestplate:[],leggings:[],boots:[]}; trimMeshes=[];
  const addArmor=(slot,parent,size,pos,uv,name)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),uv.map(r=>atlasMaterial(r,null)));mesh.name=name;mesh.position.set(...pos);mesh.scale.setScalar(armorTrim[slot].fit);mesh.castShadow=true;mesh.receiveShadow=true;mesh.visible=false;parent.add(mesh);armorMeshesBySlot[slot].push({mesh,uv,parent,size,pos});return mesh};

  addArmor('helmet',headJoint,[8.5,8.5,8.5],[0,4,0],headArmorUV,'armor-helmet');
  addArmor('chestplate',torsoJoint,[8.4,12.4,4.4],[0,0,0],torsoArmorUV,'armor-chest');
  addArmor('chestplate',rightArm,[ar+.4,12.4,4.4],[0,-6,0],armArmorUV,'armor-right-arm');
  addArmor('chestplate',leftArm,[ar+.4,12.4,4.4],[0,-6,0],armArmorUV,'armor-left-arm');
  addArmor('leggings',rightLeg,[4.35,12.35,4.35],[0,-6,0],rightLegArmorUV,'armor-right-leg');
  addArmor('leggings',leftLeg,[4.35,12.35,4.35],[0,-6,0],leftLegArmorUV,'armor-left-leg');
  addArmor('boots',rightLeg,[4.45,6.45,4.45],[0,-9,0],rightBootArmorUV,'armor-right-boot');
  addArmor('boots',leftLeg,[4.45,6.45,4.45],[0,-9,0],leftBootArmorUV,'armor-left-boot');

  const sword=new THREE.Group(); sword.name='item';
  const handle=new THREE.Mesh(new THREE.BoxGeometry(1.15,5,1.15),new THREE.MeshStandardMaterial({color:0x755036,roughness:.8}));handle.position.y=-2; sword.add(handle);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(2,12,1),new THREE.MeshStandardMaterial({color:0xb6c1b0,metalness:.75,roughness:.25}));blade.position.y=6.5;sword.add(blade);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(5,1.4,1.3),new THREE.MeshStandardMaterial({color:0xd1bd8d,metalness:.6,roughness:.35}));guard.position.y=.6;sword.add(guard);
  sword.position.set(0,-10,1.5);sword.rotation.z=-.55;rightArm.add(sword);parts.item=sword;
  setVisibility();loadHeldItem();
}

function setVisibility(){ ['hat','jacket','rightSleeve','leftSleeve','rightPants','leftPants'].forEach(n=>{if(parts[n])parts[n].visible=true});for(const slot of armorSlots)for(const entry of armorMeshesBySlot[slot]||[])entry.mesh.visible=armorSelection[slot]!=='none';if(parts.item)parts.item.visible=itemOn;}
makeModel();

function loadLocalImage(url){if(localImageCache.has(url))return localImageCache.get(url);const task=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Asset could not be loaded: '+url));img.src=url});localImageCache.set(url,task);return task}

async function createTrimImage(pattern,material,custom,leggings=false){
  const src=`../assets/minecraft/textures/trims/entity/${leggings?'humanoid_leggings':'humanoid'}/${pattern}.png`;
  const [mask,keyImg,palette]=await Promise.all([loadLocalImage(src),loadLocalImage('../assets/minecraft/textures/trims/color_palettes/trim_palette.png'),material==='custom'?Promise.resolve(null):loadLocalImage(`../assets/minecraft/textures/trims/color_palettes/${material}.png`)]);
  const c=document.createElement('canvas');c.width=64;c.height=32;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(mask,0,0,64,32);const md=cx.getImageData(0,0,64,32);
  const k=document.createElement('canvas');k.width=keyImg.naturalWidth;k.height=keyImg.naturalHeight;const kx=k.getContext('2d',{willReadFrequently:true});kx.drawImage(keyImg,0,0);const kd=kx.getImageData(0,0,k.width,k.height).data;
  let pd=null,pc=0;if(palette){const q=document.createElement('canvas');q.width=palette.naturalWidth;q.height=palette.naturalHeight;const qx=q.getContext('2d',{willReadFrequently:true});qx.drawImage(palette,0,0);pd=qx.getImageData(0,0,q.width,q.height).data;pc=q.width*q.height}
  for(let i=0;i<md.data.length;i+=4){if(!md.data[i+3])continue;let best=0,dist=1e9;for(let j=0;j<k.width*k.height;j++){const d=Math.abs(md.data[i]-kd[j*4])+Math.abs(md.data[i+1]-kd[j*4+1])+Math.abs(md.data[i+2]-kd[j*4+2]);if(d<dist){dist=d;best=j}}if(material==='custom'){const shade=.42+.58*(md.data[i]/255),hex=custom.replace('#','');md.data[i]=parseInt(hex.slice(0,2),16)*shade;md.data[i+1]=parseInt(hex.slice(2,4),16)*shade;md.data[i+2]=parseInt(hex.slice(4,6),16)*shade}else{const j=Math.min(pc-1,best)*4;md.data[i]=pd[j];md.data[i+1]=pd[j+1];md.data[i+2]=pd[j+2]}}
  cx.putImageData(md,0,0);return c;
}

async function leatherLayer(path){
  const [base,overlay]=await Promise.all([loadLocalImage(`../assets/minecraft/textures/entity/equipment/${path}/leather.png`),loadLocalImage(`../assets/minecraft/textures/entity/equipment/${path}/leather_overlay.png`)]);
  const c=document.createElement('canvas');c.width=64;c.height=32;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(base,0,0,64,32);const d=cx.getImageData(0,0,64,32);
  for(let i=0;i<d.data.length;i+=4){d.data[i]=d.data[i]*160/255;d.data[i+1]=d.data[i+1]*101/255;d.data[i+2]=d.data[i+2]*64/255}
  cx.putImageData(d,0,0);cx.drawImage(overlay,0,0,64,32);return c;
}

function disposeTrimMeshes(){for(const t of trimMeshes){t.parent.remove(t);t.geometry.dispose();t.material.forEach(m=>{m.map?.dispose();m.dispose()})}trimMeshes=[]}

async function updateArmorRender(){
  const jobs=armorSlots.map(async slot=>{
    const material=armorSelection[slot];
    for(const entry of armorMeshesBySlot[slot]||[]){
      const mesh=entry.mesh;mesh.visible=material!=='none';mesh.scale.setScalar(armorTrim[slot].fit);
      if(material==='none')continue;
      let images=armorMaterialImages[material];
      if(!images){
        let body,legs;
        if(material==='leather'){[body,legs]=await Promise.all([leatherLayer('humanoid'),leatherLayer('humanoid_leggings')])}
        else{
          body=await loadLocalImage(`../assets/minecraft/textures/entity/equipment/humanoid/${material}.png`);
          legs=body;
          if(material!=='turtle_scute')legs=await loadLocalImage(`../assets/minecraft/textures/entity/equipment/humanoid_leggings/${material}.png`);
        }
        images=armorMaterialImages[material]={body,legs};
      }
      const source=slot==='leggings'?images.legs:images.body;
      mesh.material.forEach((m,i)=>{m.dispose();mesh.material[i]=atlasMaterial(entry.uv[i],source);mesh.material[i].roughness=material==='leather'?.9:.57;mesh.material[i].metalness=['iron','gold','diamond','netherite','copper'].includes(material)?.22:0});
    }
  });
  try{await Promise.all(jobs)}catch(e){toast('Could not load armor textures from the included resource pack.');return}
  disposeTrimMeshes();
  for(const slot of armorSlots){
    const info=armorTrim[slot];
    if(armorSelection[slot]==='none'||info.pattern==='none'||info.material==='none'||armorSelection[slot]==='leather')continue;
    try{
      const source=await createTrimImage(info.pattern,info.material==='custom'?'custom':info.material,info.custom,slot==='leggings');
      for(const entry of armorMeshesBySlot[slot]){
        const overlay=new THREE.Mesh(new THREE.BoxGeometry(entry.size[0]+.06,entry.size[1]+.06,entry.size[2]+.06),entry.uv.map(r=>{const m=atlasMaterial(r,source);m.transparent=true;m.alphaTest=.025;m.depthWrite=false;m.side=THREE.DoubleSide;return m}));
        overlay.position.set(...entry.pos);overlay.scale.setScalar(info.fit);overlay.renderOrder=3;entry.parent.add(overlay);trimMeshes.push(overlay);
      }
    }catch(err){console.warn('Trim texture failed',info.pattern,err)}
  }
  setVisibility();
}

function loadArmorSet(material){armorSelection[activeArmorSlot]=material;updateArmorRender();renderPanel()}
function applyFullArmorSet(){const material=armorSelection[activeArmorSlot];for(const slot of armorSlots)armorSelection[slot]=material;updateArmorRender();renderPanel()}
updateArmorRender();

function makePixelItem(image){
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,16,16);const pixels=ctx.getImageData(0,0,16,16).data;
  const visible=[];for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;if(pixels[i+3]>16)visible.push([x,y,pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255])}
  const group=new THREE.Group();const scale=.68;
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.92,.92,.72),new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.48,metalness:.12}),visible.length);
  const dummy=new THREE.Object3D();
  visible.forEach(([x,y,r,g,b],i)=>{dummy.position.set((x-7.5)*scale,(7.5-y)*scale,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(r,g,b))});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  const grip=heldKind==='sword'?[12,14]:[8,14];group.position.set(-(grip[0]-7.5)*scale,-10.4-(7.5-grip[1])*scale,2.65);group.scale.setScalar(scale);return group;
}

async function loadHeldItem(){
  const request=++itemRequest;const name=`${heldMaterial}_${heldKind}.png`;
  try{const image=await loadLocalImage(`../assets/minecraft/textures/item/${name}`);if(request!==itemRequest)return;const group=makePixelItem(image);group.name='vanilla-item';if(parts.item?.parent)parts.item.parent.remove(parts.item);parts.item=group;group.visible=itemOn;parts.rightArm.add(group)}
  catch{toast(`Couldn't load ${name}. The ZIP should include the Minecraft item textures.`)}
}

let bgColor='#252923';
function resize(){const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(mount); resize();

const lookTarget=new THREE.Vector3(0,17,0);
const baseRadius=56;
let dragging=false,lastX=0,lastY=0,theta=.35,phi=1.18,freeMode=false,mouseYaw=0,mousePitch=0;
const heldKeys=new Set();

function syncOrbitCamera(){const radius=baseRadius/zoom;camera.position.set(lookTarget.x+Math.sin(theta)*Math.sin(phi)*radius,lookTarget.y+Math.cos(phi)*radius,lookTarget.z+Math.cos(theta)*Math.sin(phi)*radius);camera.lookAt(lookTarget)}
syncOrbitCamera();

renderer.domElement.tabIndex=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(freeMode)return;dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);document.querySelector('#drag-hint').style.opacity='.2'});
renderer.domElement.addEventListener('pointermove',e=>{
 if(document.pointerLockElement===renderer.domElement){mouseYaw-=e.movementX*.0025;mousePitch=Math.max(-1.35,Math.min(1.35,mousePitch-e.movementY*.0025));const dir=new THREE.Vector3(Math.sin(mouseYaw)*Math.cos(mousePitch),Math.sin(mousePitch),Math.cos(mouseYaw)*Math.cos(mousePitch));camera.lookAt(camera.position.clone().add(dir));return}
 if(!dragging||freeMode)return;theta-=(e.clientX-lastX)*.008;phi=Math.max(.32,Math.min(2.7,phi+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;syncOrbitCamera();
});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom+(e.deltaY<0?.08:-.08))},{passive:false});

function setZoom(v){const next=Math.max(.55,Math.min(1.7,v));if(freeMode){const dir=new THREE.Vector3();camera.getWorldDirection(dir);camera.position.addScaledVector(dir,(next-zoom)*12)}else{zoom=next;syncOrbitCamera()}zoom=next;camera.updateProjectionMatrix();document.querySelector('#zoom-label').textContent=zoom.toFixed(1)+'x'}

function resetCamera(){if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();freeMode=false;theta=.35;phi=1.18;zoom=1;camera.fov=34;camera.updateProjectionMatrix();syncOrbitCamera();document.querySelector('#zoom-label').textContent='1.0x';document.querySelector('#free-camera').textContent='⌖ Free move';document.querySelector('#drag-hint').innerHTML='DRAG TO ORBIT <span>·</span> FREE MOVE FOR WASD'}

document.querySelector('#free-camera').addEventListener('click',()=>{freeMode=true;dragging=false;const dir=lookTarget.clone().sub(camera.position).normalize();mouseYaw=Math.atan2(dir.x,dir.z);mousePitch=Math.asin(dir.y);document.querySelector('#free-camera').textContent='ESC to exit';document.querySelector('#drag-hint').textContent='WASD MOVE · Q/E VERTICAL · MOUSE LOOK · ESC TO EXIT';renderer.domElement.requestPointerLock()});

document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement)return;if(freeMode){freeMode=false;const offset=camera.position.clone().sub(lookTarget);const radius=Math.max(1,offset.length());theta=Math.atan2(offset.x,offset.z);phi=Math.acos(THREE.MathUtils.clamp(offset.y/radius,-1,1));zoom=Math.max(.55,Math.min(1.7,baseRadius/radius));syncOrbitCamera();document.querySelector('#zoom-label').textContent=zoom.toFixed(1)+'x';document.querySelector('#free-camera').textContent='⌖ Free move';document.querySelector('#drag-hint').innerHTML='DRAG TO ORBIT <span>·</span> FREE MOVE FOR WASD'}});
document.addEventListener('pointerlockerror',()=>{freeMode=false;document.querySelector('#free-camera').textContent='⌖ Free move';document.querySelector('#drag-hint').innerHTML='DRAG TO ORBIT <span>·</span> FREE MOVE FOR WASD';toast('Free camera is unavailable here. Drag to orbit instead.')});
document.addEventListener('keydown',e=>{if(!freeMode||e.target.matches('input,textarea,select'))return;const k=e.code;if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(k)){heldKeys.add(k);e.preventDefault()}});
document.addEventListener('keyup',e=>heldKeys.delete(e.code));
window.addEventListener('blur',()=>heldKeys.clear());

const clock=new THREE.Clock();let elapsed=0;
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused)elapsed+=dt*speed;
  for(const slot of armorSlots){const glow=armorTrim[slot].glint;for(const entry of armorMeshesBySlot[slot]||[])for(const m of entry.mesh.material){m.emissive.set(glow?0xb94cff:0x000000);m.emissiveIntensity=glow?.32+.18*Math.sin(elapsed*5):0}}
  if(freeMode&&heldKeys.size){const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=forward.clone().cross(new THREE.Vector3(0,1,0)).normalize();const move=new THREE.Vector3();if(heldKeys.has('KeyW'))move.add(forward);if(heldKeys.has('KeyS'))move.sub(forward);if(heldKeys.has('KeyD'))move.add(right);if(heldKeys.has('KeyA'))move.sub(right);if(heldKeys.has('KeyE'))move.y+=1;if(heldKeys.has('KeyQ'))move.y-=1;if(move.lengthSq())camera.position.addScaledVector(move.normalize(),dt*(heldKeys.has('ShiftLeft')||heldKeys.has('ShiftRight')?15:7.5))}
  const t=elapsed*2.3;const wave=anim==='wave';
  parts.rightArm.rotation.set(0,0,0);parts.leftArm.rotation.set(0,0,0);parts.rightLeg.rotation.set(0,0,0);parts.leftLeg.rotation.set(0,0,0);parts.head.rotation.set(0,0,0);parts.torso.position.y=18;parts.torso.rotation.set(0,0,0);
  if(anim==='idle'){parts.torso.position.y=18+Math.sin(t)*.12*intensity;parts.rightArm.rotation.x=Math.sin(t*.8)*.035*intensity;parts.head.rotation.y=Math.sin(t*.4)*.08*intensity}
  if(anim==='walk'||anim==='run'){const rate=anim==='run'?2:1;parts.rightArm.rotation.x=Math.sin(t*rate)*.58*intensity;parts.leftArm.rotation.x=-Math.sin(t*rate)*.58*intensity;parts.rightLeg.rotation.x=-Math.sin(t*rate)*.53*intensity;parts.leftLeg.rotation.x=Math.sin(t*rate)*.53*intensity;parts.torso.position.y=18+Math.abs(Math.sin(t*rate))*.15*intensity}
  if(wave){parts.rightArm.rotation.z=-2.35+Math.sin(t*2.5)*.28*intensity;parts.rightArm.rotation.x=-.24;parts.head.rotation.y=Math.sin(t*.7)*.12}
  if(anim==='hero'){parts.rightArm.rotation.x=-.34;parts.leftArm.rotation.x=.26;parts.leftArm.rotation.z=.18;parts.head.rotation.y=-.16;parts.torso.rotation.z=-.04}
  if(parts.item)parts.item.rotation.z=anim==='walk'?-.08+Math.sin(t)*.08:anim==='wave'?.04:anim==='hero'?.12:0;
  renderer.render(scene,camera);
}
animate();

// --- UI Panel rendering ---

const panel=document.querySelector('#panel-content');
const poses=[['Idle','idle',''],['Walking','walk','walk'],['Running','run','walk'],['Waving','wave','wave'],['Hero pose','hero','hero']];
const tabs={poses:'Poses',look:'Look',lighting:'Lighting',camera:'Camera'};
let activeTab='poses';

function panelHeader(label,action=''){return `<div class="panel-topline"><span class="panel-label">${label}</span>${action?`<button class="tiny-action" data-action="${action}">Reset</button>`:''}</div>`}
function slider(label,id,min,max,val,step='1',suffix=''){return `<div class="setting"><div class="setting-head"><span>${label}</span><output id="${id}-out">${val}${suffix}</output></div><input class="range" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" /></div>`}

function posePanel(){return `${panelHeader('POSE LIBRARY')}<label class="search"><span>⌕</span><input id="pose-search" placeholder="Find a pose…" /></label><div class="category-row"><span>▦ &nbsp; All poses</span><small>05 &nbsp;⌄</small></div><div class="pose-grid">${poses.map(([name,id,cls])=>`<button class="pose-card ${anim===id?'selected':''}" data-pose="${id}"><span class="pose-art"><i class="shadow"></i><i class="silhouette ${cls}"></i></span><span class="pose-name">${name}</span></button>`).join('')}</div><div class="section-spacer"></div>${panelHeader('ANIMATION')} ${slider('Speed','anim-speed',.25,2,speed,.05,'x')} ${slider('Intensity','anim-intensity',0,2,intensity,.05,'x')}<div class="toggle-row"><span>Loop animation</span><button class="toggle on" id="loop-toggle"></button></div>`}

function lookPanel(){
 const mats=[['none','None',''],['leather','Leather','leather'],['chainmail','Chainmail','chainmail'],['iron','Iron','iron'],['copper','Copper','copper'],['gold','Gold','golden'],['diamond','Diamond','diamond'],['netherite','Netherite','netherite']];if(activeArmorSlot==='helmet')mats.push(['turtle_scute','Turtle','turtle']);
 const slotIcons=Object.fromEntries(armorSlots.map(slot=>{const m=armorSelection[slot];const prefix=m==='none'?'netherite':m==='gold'?'golden':m==='turtle_scute'?'turtle':m;return [slot,`${prefix}_${slot}`]}));
 const icon=(path,label,on,attrs='')=>`<button class="armor-icon ${on?'active':''}" ${attrs} title="${label}"><img src="../assets/minecraft/textures/item/${path}.png" alt="${label}"></button>`;
 const slotGrid=armorSlots.map(slot=>icon(slotIcons[slot],armorNames[slot],activeArmorSlot===slot,`data-armor-slot="${slot}"`)).join('');
 const materialGrid=mats.map(([id,label,tex])=>id==='none'?`<button class="armor-icon armor-none ${armorSelection[activeArmorSlot]==='none'?'active':''}" data-armor-material="none">NONE</button>`:icon(`${tex}_${activeArmorSlot}`,label,armorSelection[activeArmorSlot]===id,`data-armor-material="${id}"`)).join('');
 const patterns=['none','bolt','coast','dune','eye','flow','host','raiser','rib','sentry','shaper','silence','snout','spire','tide','vex','ward','wayfinder','wild'];
 const patternGrid=patterns.map(name=>name==='none'?`<button class="armor-icon armor-none ${armorTrim[activeArmorSlot].pattern==='none'?'active':''}" data-trim-pattern="none">NONE</button>`:icon(`${name}_armor_trim_smithing_template`,name,armorTrim[activeArmorSlot].pattern===name,`data-trim-pattern="${name}"`)).join('');
 const trims=[['none','None',''],['amethyst','Amethyst','amethyst_shard'],['copper','Copper','copper_ingot'],['diamond','Diamond','diamond'],['emerald','Emerald','emerald'],['gold','Gold','gold_ingot'],['iron','Iron','iron_ingot'],['lapis','Lapis','lapis_lazuli'],['netherite','Netherite','netherite_ingot'],['quartz','Quartz','quartz'],['redstone','Redstone','redstone'],['resin','Resin','resin_brick'],['custom','Custom','']];
 const trimGrid=trims.map(([id,label,tex])=>id==='none'||id==='custom'?`<button class="armor-icon armor-none ${armorTrim[activeArmorSlot].material===id?'active':''}" data-trim-material="${id}" title="${label}">${id==='custom'?'COLOR':'NONE'}</button>`:icon(tex,label,armorTrim[activeArmorSlot].material===id,`data-trim-material="${id}"`)).join('');
 const itemOptions=[['wooden','Wood'],['stone','Stone'],['iron','Iron'],['copper','Copper'],['golden','Gold'],['diamond','Diamond'],['netherite','Netherite']];
 return `${panelHeader('CHARACTER LOOK')}<div class="panel-label">MODEL TYPE</div><div class="choice-row" style="margin:9px 0 18px"><button class="choice ${!slim?'active':''}" data-model="classic">Classic · 4px</button><button class="choice ${slim?'active':''}" data-model="slim">Slim · 3px</button></div>${panelHeader('COSMETICS')}<div class="armor-section"><div class="armor-section-head"><span>Armor</span><button class="tiny-action" data-action="full-set">Full set</button></div><div class="armor-slot-grid">${slotGrid}</div><section class="armor-detail"><header><b>${armorNames[activeArmorSlot]}</b><button class="armor-clear" data-armor-material="none" aria-label="Remove armor">×</button></header><div class="armor-subhead">EQUIPMENT</div><div class="armor-choice-grid">${materialGrid}</div><div class="armor-subhead">ARMOR TRIM</div><div class="armor-choice-grid">${patternGrid}</div><div class="armor-subhead">TRIM MATERIAL</div><div class="armor-choice-grid">${trimGrid}</div><div class="armor-custom-row"><span>Custom color</span><input type="color" id="armor-custom-color" value="${armorTrim[activeArmorSlot].custom}" aria-label="Custom trim color"></div>${slider('Fit','armor-fit',.94,1.08,armorTrim[activeArmorSlot].fit,.01,'x')}<div class="toggle-row"><span>Enchanted glint</span><button class="toggle ${armorTrim[activeArmorSlot].glint?'on':''}" data-toggle="armor-glint"></button></div></section></div><div class="section-spacer"></div><div class="toggle-row"><span>Hold an item</span><button class="toggle ${itemOn?'on':''}" data-toggle="item"></button></div><label class="field-label" for="item-kind">Held item</label><select class="select" id="item-kind"><option value="sword" ${heldKind==='sword'?'selected':''}>Sword</option><option value="pickaxe" ${heldKind==='pickaxe'?'selected':''}>Pickaxe</option></select><label class="field-label" for="item-material">Material</label><select class="select" id="item-material">${itemOptions.map(([id,name])=>`<option value="${id}" ${heldMaterial===id?'selected':''}>${name}</option>`).join('')}</select><div class="mini-note">Armor uses the supplied Minecraft resource pack textures and trim masks.</div><button class="choice" style="width:100%" data-action="upload">+ &nbsp; Import skin PNG</button>`
}

function lightingPanel(){return `${panelHeader('LIGHTING')}<div class="panel-label">STUDIO PRESET</div><div class="choice-row" style="margin:9px 0 18px"><button class="choice active" data-light="studio">Soft studio</button><button class="choice" data-light="warm">Warm</button><button class="choice" data-light="cool">Cool</button></div>${slider('Light intensity','light-intensity',.5,4,2.2,.1,'x')}${panelHeader('BACKGROUND')}<div class="swatches">${[['#252923','active'],['#202532',''],['#332921',''],['#dedfd9',''],['#121312','']].map(([c,a])=>`<button class="swatch ${a}" style="background:${c}" data-bg="${c}" aria-label="Background ${c}"></button>`).join('')}</div><div class="toggle-row" style="margin-top:13px"><span>Show ground grid</span><button class="toggle ${gridOn?'on':''}" data-toggle="grid"></button></div><div class="toggle-row"><span>Ground shadow</span><button class="toggle ${floor.visible?'on':''}" data-toggle="shadow"></button></div>`}

function cameraPanel(){return `${panelHeader('CAMERA')}<div class="panel-label">PERSPECTIVE</div>${slider('Field of view','fov',20,70,fov,1,'°')}${slider('Camera zoom','camera-zoom',.55,1.7,zoom,.01,'x')}<div class="section-spacer"></div>${panelHeader('QUICK VIEWS')}<div class="choice-row" style="flex-wrap:wrap"><button class="choice" data-view="front">Front</button><button class="choice" data-view="side">Side</button><button class="choice" data-view="back">Back</button><button class="choice" data-view="three">3 / 4</button></div><div class="mini-note" style="margin-top:17px">Drag inside the preview to orbit freely. Scroll or use the zoom buttons to adjust distance.</div><button class="choice" style="width:100%" data-action="reset-camera">↺ &nbsp; Reset camera</button>`}

function renderPanel(){document.querySelector('#panel-title').textContent=tabs[activeTab];panel.innerHTML=activeTab==='poses'?posePanel():activeTab==='look'?lookPanel():activeTab==='lighting'?lightingPanel():cameraPanel();}
renderPanel();

function setPose(name){anim=name;paused=false;document.querySelector('#play-toggle').textContent='II';document.querySelector('#play-toggle').title='Pause animation';elapsed=0;renderPanel()}

panel.addEventListener('click',e=>{
 const pose=e.target.closest('[data-pose]');if(pose){setPose(pose.dataset.pose);return}
 const model=e.target.closest('[data-model]');if(model){slim=model.dataset.model==='slim';makeModel();updateArmorRender();renderPanel();return}
 const slot=e.target.closest('[data-armor-slot]');if(slot){activeArmorSlot=slot.dataset.armorSlot;renderPanel();return}
 const am=e.target.closest('[data-armor-material]');if(am){armorSelection[activeArmorSlot]=am.dataset.armorMaterial;updateArmorRender();renderPanel();return}
 const full=e.target.closest('[data-action=full-set]');if(full){applyFullArmorSet();return}
 const pat=e.target.closest('[data-trim-pattern]');if(pat){armorTrim[activeArmorSlot].pattern=pat.dataset.trimPattern;updateArmorRender();renderPanel();return}
 const tm=e.target.closest('[data-trim-material]');if(tm){armorTrim[activeArmorSlot].material=tm.dataset.trimMaterial;updateArmorRender();renderPanel();return}
 const tog=e.target.closest('[data-toggle]');if(tog){const k=tog.dataset.toggle;if(k==='item')itemOn=!itemOn;if(k==='armor-glint')armorTrim[activeArmorSlot].glint=!armorTrim[activeArmorSlot].glint;if(k==='grid'){gridOn=!gridOn;grid.visible=gridOn;groundRing.visible=gridOn}if(k==='shadow')floor.visible=!floor.visible;setVisibility();renderPanel();return}
 const bg=e.target.closest('[data-bg]');if(bg){bgColor=bg.dataset.bg;scene.background=new THREE.Color(bgColor);renderer.setClearColor(bgColor,1);document.querySelectorAll('[data-bg]').forEach(b=>b.classList.toggle('active',b===bg));document.querySelector('.viewport-wrap').style.background=bgColor;return}
 const light=e.target.closest('[data-light]');if(light){const p=light.dataset.light;key.color.set(p==='warm'?0xffcf96:p==='cool'?0xb4ccff:0xfff1d8);fill.color.set(p==='cool'?0x8bb6ff:0xc1dc91);document.querySelectorAll('[data-light]').forEach(b=>b.classList.toggle('active',b===light));return}
 const view=e.target.closest('[data-view]');if(view){theta=view.dataset.view==='front'?0:view.dataset.view==='side'?Math.PI/2:view.dataset.view==='back'?Math.PI:.46;phi=1.32;syncOrbitCamera();return}
 const action=e.target.closest('[data-action]')?.dataset.action;if(action==='upload')document.querySelector('#skin-file').click();if(action==='reset-camera')resetCamera();
});

panel.addEventListener('change',e=>{if(e.target.id==='item-kind'){heldKind=e.target.value;loadHeldItem()}if(e.target.id==='item-material'){heldMaterial=e.target.value;loadHeldItem()}});
panel.addEventListener('input',e=>{const x=e.target;if(x.id==='armor-fit'){armorTrim[activeArmorSlot].fit=+x.value;for(const entry of armorMeshesBySlot[activeArmorSlot]||[])entry.mesh.scale.setScalar(+x.value);for(const m of trimMeshes)m.scale.setScalar(armorTrim[activeArmorSlot].fit);document.querySelector('#armor-fit-out').value=(+x.value).toFixed(2)+'x'}if(x.id==='armor-custom-color'){armorTrim[activeArmorSlot].custom=x.value;updateArmorRender()}if(x.id==='anim-speed'){speed=+x.value;document.querySelector('#anim-speed-out').value=Number(speed).toFixed(2)+'x'}if(x.id==='anim-intensity'){intensity=+x.value;document.querySelector('#anim-intensity-out').value=Number(intensity).toFixed(2)+'x'}if(x.id==='fov'){fov=+x.value;camera.fov=fov;camera.updateProjectionMatrix();document.querySelector('#fov-out').value=fov+'°'}if(x.id==='camera-zoom'){setZoom(+x.value);document.querySelector('#camera-zoom-out').value=zoom.toFixed(2)+'x'}if(x.id==='light-intensity'){hemi.intensity=+x.value;document.querySelector('#light-intensity-out').value=Number(x.value).toFixed(1)+'x'}});
panel.addEventListener('keyup',e=>{if(e.target.id==='pose-search'){document.querySelectorAll('.pose-card').forEach(c=>c.hidden=!c.textContent.toLowerCase().includes(e.target.value.toLowerCase()))}});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));renderPanel()}));

function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2400)}
function applySkin(img,name){skinSource=img;skinLabel=name;makeModel();updateArmorRender();document.querySelector('#skin-name').textContent=name.replace(/\.png$/i,'');document.querySelector('#skin-count').textContent='02';const thumb=document.querySelector('#skin-thumb');thumb.innerHTML='';thumb.style.backgroundImage=`url(${img.src||img.toDataURL?.()})`;thumb.style.backgroundSize='cover';thumb.style.backgroundPosition='center';toast('Skin applied to your character.');}
document.querySelector('#upload-trigger').addEventListener('click',()=>document.querySelector('#skin-file').click());
document.querySelector('#skin-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.type!=='image/png'){toast('Please choose a PNG skin.');return}const img=new Image();img.onload=()=>{skinImage=img;applySkin(img,file.name)};img.src=URL.createObjectURL(file)});
document.body.addEventListener('dragover',e=>{e.preventDefault()});document.body.addEventListener('drop',e=>{e.preventDefault();const file=[...e.dataTransfer.files].find(f=>f.type==='image/png');if(file){const img=new Image();img.onload=()=>applySkin(img,file.name);img.src=URL.createObjectURL(file)}else toast('Drop a PNG skin to import it.')});
document.querySelector('#zoom-in').addEventListener('click',()=>setZoom(zoom+.1));document.querySelector('#zoom-out').addEventListener('click',()=>setZoom(zoom-.1));document.querySelector('#reset-camera').addEventListener('click',resetCamera);document.querySelector('#center-char').addEventListener('click',()=>{lookTarget.set(0,17,0);if(!freeMode)syncOrbitCamera()});
document.querySelector('#grid-toggle').addEventListener('click',e=>{gridOn=!gridOn;grid.visible=gridOn;groundRing.visible=gridOn;e.currentTarget.classList.toggle('active-tool',gridOn)});
document.querySelector('#fullscreen').addEventListener('click',()=>document.querySelector('#viewport-wrap').requestFullscreen?.());
document.querySelector('#play-toggle').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'▶':'II';e.currentTarget.title=paused?'Play animation':'Pause animation'});
document.querySelector('#restart-animation').addEventListener('click',()=>{elapsed=0;paused=false;document.querySelector('#play-toggle').textContent='II'});
document.querySelector('#replay-animation').addEventListener('click',()=>{elapsed=0;paused=false;document.querySelector('#play-toggle').textContent='II'});
setInterval(()=>{const s=((elapsed%2)+2)%2;document.querySelector('#timecode').textContent=`00:${String(Math.floor(s)).padStart(2,'0')} / 00:02`},100);

document.querySelector('#export-btn').addEventListener('click',async e=>{
 const btn=e.currentTarget;if(!renderer.domElement.captureStream||!window.MediaRecorder){toast('Video recording is not supported in this browser.');return}
 btn.disabled=true;btn.innerHTML='<span class="download">◌</span> Recording 2 seconds…';toast('Recording a 2 second, 60 FPS preview…');
 const stream=renderer.domElement.captureStream(60);let chunks=[];let mime='video/webm;codecs=vp9';if(!MediaRecorder.isTypeSupported(mime))mime='video/webm;codecs=vp8';if(!MediaRecorder.isTypeSupported(mime))mime='video/webm';
 try{const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:9000000});recorder.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='blockframe-preview-2s.webm';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);btn.disabled=false;btn.innerHTML='<span class="download">↓</span> Export video <span class="export-arrow">↗</span>';toast('Your 2 second video has been downloaded.')};recorder.start();setTimeout(()=>recorder.stop(),2000)}catch(err){btn.disabled=false;btn.innerHTML='<span class="download">↓</span> Export video <span class="export-arrow">↗</span>';toast('Could not record video in this browser.')}
});

// --- Settings & Update System ---

let updateState = { current: '?.?.?', latest: null, hasUpdate: false, changelog: '', checking: false, error: null };

const settingsOverlay = document.querySelector('#settings-overlay');
const settingsBody = document.querySelector('#settings-body');
const settingsBtn = document.querySelector('#settings-btn');
const settingsClose = document.querySelector('#settings-close');
const updateBadge = document.querySelector('#update-badge');

function openSettings() {
  settingsOverlay.hidden = false;
  renderSettings();
}

function closeSettings() {
  settingsOverlay.hidden = true;
}

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !settingsOverlay.hidden) closeSettings(); });

function renderSettings() {
  const st = updateState;
  const dotClass = st.checking ? 'checking' : st.hasUpdate ? 'available' : st.error ? '' : 'current';
  const statusText = st.checking ? 'Checking for updates…' : st.hasUpdate ? `Update available: v${st.latest}` : st.error ? 'Could not check for updates' : 'You are up to date';

  settingsBody.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">UPDATES</div>
      <div class="update-card ${st.hasUpdate ? 'has-update' : ''}">
        <div class="update-status">
          <span class="update-dot ${dotClass}"></span>
          <span class="update-title">${statusText}</span>
        </div>
        <div class="update-detail">
          ${st.hasUpdate ? `<strong>v${st.latest}</strong> &mdash; ${st.changelog}<br><br>Current version: v${st.current}` : st.error ? st.error : `Version ${st.current}`}
        </div>
        <div class="update-actions">
          <button class="update-btn update-btn-secondary" id="check-update-btn" ${st.checking ? 'disabled' : ''}>
            ${st.checking ? 'Checking…' : 'Check for updates'}
          </button>
          ${st.hasUpdate ? `<button class="update-btn update-btn-primary" id="download-update-btn">Download update</button>` : ''}
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">GENERAL</div>
      <div class="settings-row">
        <span class="settings-row-label">App version</span>
        <span class="settings-row-value">v${st.current}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Renderer</span>
        <span class="settings-row-value">${renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1'}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Platform</span>
        <span class="settings-row-value">${window.blockframe?.isElectron ? 'Desktop (Electron)' : 'Browser'}</span>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">Auto-check updates</span>
        <div class="settings-row-action">
          <button class="toggle ${localStorage.getItem('bf-auto-update') !== 'false' ? 'on' : ''}" id="auto-update-toggle"></button>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">ABOUT</div>
      <div class="settings-about">
        <strong>Blockframe Skin Studio</strong><br>
        3D Minecraft skin viewer with armor, trims, poses, and export.<br><br>
        <a href="#" id="repo-link">View on GitHub</a>
      </div>
    </div>
  `;

  document.querySelector('#check-update-btn')?.addEventListener('click', performUpdateCheck);
  document.querySelector('#download-update-btn')?.addEventListener('click', () => {
    const url = `https://github.com/6nmsb4mvzs-ui/mc/releases`;
    if (window.blockframe?.openExternal) window.blockframe.openExternal(url);
    else window.open(url, '_blank');
  });
  document.querySelector('#auto-update-toggle')?.addEventListener('click', e => {
    const on = !e.currentTarget.classList.contains('on');
    try { localStorage.setItem('bf-auto-update', on ? 'true' : 'false'); } catch {}
    renderSettings();
  });
  document.querySelector('#repo-link')?.addEventListener('click', e => {
    e.preventDefault();
    const url = 'https://github.com/6nmsb4mvzs-ui/mc';
    if (window.blockframe?.openExternal) window.blockframe.openExternal(url);
    else window.open(url, '_blank');
  });
}

async function performUpdateCheck() {
  updateState.checking = true;
  updateState.error = null;
  if (!settingsOverlay.hidden) renderSettings();

  try {
    if (window.blockframe?.checkUpdate) {
      const result = await window.blockframe.checkUpdate();
      if (result.error) throw new Error(result.error);
      updateState.current = result.current;
      updateState.latest = result.latest;
      updateState.hasUpdate = result.hasUpdate;
      updateState.changelog = result.changelog || '';
    } else {
      const resp = await fetch('https://raw.githubusercontent.com/6nmsb4mvzs-ui/mc/main/version.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const remote = await resp.json();
      let localVersion = '1.0.0';
      try { const lv = await fetch('./version.json'); if (lv.ok) localVersion = (await lv.json()).version; } catch {}
      updateState.current = localVersion;
      updateState.latest = remote.version;
      updateState.hasUpdate = remote.version !== localVersion;
      updateState.changelog = remote.changelog || '';
    }
  } catch (err) {
    updateState.error = err.message;
  }

  updateState.checking = false;
  updateBadge.hidden = !updateState.hasUpdate;
  if (!settingsOverlay.hidden) renderSettings();
  if (updateState.hasUpdate) toast(`Update available: v${updateState.latest}`);
}

async function initVersion() {
  try {
    if (window.blockframe?.getVersion) {
      const v = await window.blockframe.getVersion();
      updateState.current = v.version || '1.0.0';
    }
  } catch {}
}

initVersion();

let autoCheck = true;
try { autoCheck = localStorage.getItem('bf-auto-update') !== 'false'; } catch {}
if (autoCheck) setTimeout(performUpdateCheck, 4000);

// --- Startup complete ---

window.__blockframeReady=true;
document.querySelector('#loading').classList.add('hide');setTimeout(()=>document.querySelector('#loading').remove(),350);
