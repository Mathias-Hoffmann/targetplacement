import * as React from "react";
import * as XLSX from "xlsx";

// Mini simulation interactive (React + Tailwind)
// VERSION: arcs d'angles PLEINS + rotation de la cible
// - Fond : BLANC quadrillé + option image de fond (taille/position/opacité)
// - Fenêtre de simulation AGRANDIE par défaut (panneau réglages plus étroit)
// - Pas de valeurs collées au schéma (meilleure UX)
// - Arcs colorés remplis pour α, ε, η, β
// - ✅ Variables d'entrée renommées selon votre attente :
//   FLRx, FLRy, FLRz, D1Rx, D1Ry, D1Lx, D1Ly (et rétro-compat: D1c.y / D1c.z si présents)

function deg2rad(d) { return (d * Math.PI) / 180; }
function rad2deg(r) { return (r * 180) / Math.PI; }
function safeNum(v, fallback=0) {
  const n = typeof v === "string" ? Number(v.toString().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function SliderRow({ label, value, min= -5000, max=5000, step=1, onChange, unit="" }) {
  return (
    <div style={S.card}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={S.sectionTitle}>{title}</div>
        <div style={{fontSize:18, color:UI.subtext}}>{open?"▾":"▸"}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full border rounded-md px-2 py-1 text-xs"
      />
    </div>
  );
}

function guessMapping(columns) {
  const by = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const find = (cands) => columns.find((c)=> cands.map(by).includes(by(c)) ) || null;
  return {
    FLRx: find(["FLRx", "FLR_x", "FrontLeftX", "FLX"]),
    FLRy: find(["FLRy", "FLR_y", "FrontLeftY", "FLY"]),
    FLRz: find(["FLRz", "FLR_z", "FrontLeftZ", "FLZ", "D1c.z", "D1Cz", "D1Z"]),
    D1Lx: find(["D1Lx", "D1L.x", "D1LeftX"]),
    D1Ly: find(["D1Ly", "D1L.y", "D1LeftY", "D1c.y", "D1Cy", "D1Y"]),
    D1Rx: find(["D1Rx", "D1R.x", "D1RightX"]),
    D1Ry: find(["D1Ry", "D1R.y", "D1RightY", "D1c.y", "D1Cy", "D1Y"]),
    beta: find(["beta", "symmetry", "symetrie", "β"]),
    alpha: find(["alpha", "drive", "α"]),
    eps: find(["eps", "epsilon", "ε", "eps(zr)"]),
    zeta: find(["zeta", "theta", "ζ", "ζ(xr)", "thetaXR"]),
    piYr: find(["pi", "π", "pi(yr)", "yr"]),
    V: find(["V", "speed", "distance"]),
  };
}

// --- helpers angles/arcs (monde XY ➜ écran SVG) ---
function norm180(a){ let x = ((a + 180) % 360 + 360) % 360 - 180; return x; }
function angleWorldToScreen(a){ return -a; } // Y haut ➜ écran Y bas
function polarPointScreen(cx, cy, r, worldDeg){
  const a = deg2rad(angleWorldToScreen(worldDeg));
  return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
}
function worldToCamera(p, eye, target=[0,0,0], up=[0,0,1]){
  const {r,u,f} = cameraBasis(eye,target,up);
  const pe = sub(p, eye);
  return [dot(pe,r), dot(pe,u), dot(pe,f)];
}
function projectPoint(pWorld, cam, viewport){
  const { eye, target, up, fov, aspect, near } = cam;
  const pc = worldToCamera(pWorld, eye, target, up);
  const z = pc[2];
  if (z <= near) return { visible:false };
  const f = 1 / Math.tan(0.5*fov);
  const x_ndc = (pc[0] * f) / (z * aspect);
  const y_ndc = (pc[1] * f) / (z);
  const sx = (x_ndc + 1) * 0.5 * viewport.w;
  const sy = (1 - y_ndc) * 0.5 * viewport.h;
  return { x:sx, y:sy, z, visible:true, scale: f/z };
}
function screenToRay(px,py, cam, vp){
  const x_ndc = (px / vp.w)*2 - 1;
  const y_ndc = 1 - (py / vp.h)*2;
  const f = 1/Math.tan(0.5*cam.fov);
  const dirCam = norm([ (x_ndc*cam.aspect)/f, y_ndc/f, 1 ]);
  const { r,u,f:fw } = cameraBasis(cam.eye, cam.target, cam.up);
  const dirWorld = norm([ r[0]*dirCam[0] + u[0]*dirCam[1] + fw[0]*dirCam[2],
                          r[1]*dirCam[0] + u[1]*dirCam[1] + fw[1]*dirCam[2],
                          r[2]*dirCam[0] + u[2]*dirCam[1] + fw[2]*dirCam[2] ]);
  return { origin: vec(cam.eye), dir: dirWorld };
}
function intersectRayPlaneZ(origin,dir,planeZ){
  const denom = dir[2]; if (Math.abs(denom) < 1e-8) return null;
  const t = (planeZ - origin[2]) / denom; if (t<=0) return null;
  return add(origin, mulScalar(dir, t));
}

// --------- Scene primitives ------------------------------------------------
function Segment({ a, b, cam, vp, stroke="#94a3b8", width=1, dash }){
  const pa = projectPoint(a, cam, vp), pb = projectPoint(b, cam, vp);
  if(!pa.visible || !pb.visible) return null;
  return <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={stroke} strokeWidth={width} strokeDasharray={dash}/>;
}

function boxVerticesWorld(center, box){
  const { x,y,z } = center;
  const { sx, sy, sz, yaw, pitch, roll } = box;
  const R = mulMat3( mulMat3(Rz(yaw), Rx(pitch)), Ry(roll) );
  const hx=sx/2, hy=sy/2, hz=sz/2;
  const locals = [
    [ +hx, +hy, +hz ], [ -hx, +hy, +hz ], [ -hx, -hy, +hz ], [ +hx, -hy, +hz ],
    [ +hx, +hy, -hz ], [ -hx, +hy, -hz ], [ -hx, -hy, -hz ], [ +hx, -hy, -hz ],
  ];
  return locals.map(v=> add([x,y,z], mulMat3Vec3(R, v)) );
}
const BOX_FACES = [
  [0,1,2,3], [7,6,5,4], [0,3,7,4], [1,5,6,2], [0,4,5,1], [3,2,6,7],
];

function SceneSVG({
  width, height,
  orbit, setOrbit,
  base, target, rect, box,
  interaction,
  onDragBase, onDragTarget, onRotateTarget,
  onDragBox, onRotateBox,
}){
  const vp = { w: width, h: height };
  const { yaw, pitch, radius } = orbit;
  const eye = React.useMemo(()=>{
    const cy=Math.cos(yaw), sy=Math.sin(yaw);
    const cp=Math.cos(pitch), sp=Math.sin(pitch);
    return [ radius*cp*cy, radius*cp*sy, radius*sp ];
  },[yaw,pitch,radius]);
  const cam = React.useMemo(()=>({ eye, target:[0,0,0], up:[0,0,1], fov:deg2rad(50), aspect:width/height, near:1 }),[eye,width,height]);

  const svgRef = React.useRef(null);
  const dragRef = React.useRef({ type:null, lastY:0, lastAngle:0 });

  function rectCornersWorld(center, rect){
    const { x,y,z } = center; const { w,h, yaw, pitch, roll } = rect;
    const R = mulMat3( mulMat3(Rz(yaw), Rx(pitch)), Ry(roll) );
    const hx=w/2, hy=h/2;
    const locals = [ [ hx, hy,0], [-hx, hy,0], [-hx,-hy,0], [ hx,-hy,0] ];
    return locals.map(v=> add([x,y,z], mulMat3Vec3(R, v)) );
  }

  const pBase = projectPoint([base.x,base.y,base.z], cam, vp);
  const pTarg = projectPoint([target.x,target.y,target.z], cam, vp);

  const corners = rectCornersWorld(target, rect);
  const pc = corners.map(c=>projectPoint(c,cam,vp));
  const rectAllVisible = pc.every(p=>p.visible);

  const boxVertsW = boxVerticesWorld(box.center, box.geom);
  const boxProj = boxVertsW.map(v=>projectPoint(v,cam,vp));
  const pBox = projectPoint([box.center.x,box.center.y,box.center.z], cam, vp);
  const boxBounds = React.useMemo(()=>{
    const xs = boxProj.filter(p=>p.visible).map(p=>p.x);
    const ys = boxProj.filter(p=>p.visible).map(p=>p.y);
    if(xs.length===0) return null;
    return { minx:Math.min(...xs), maxx:Math.max(...xs), miny:Math.min(...ys), maxy:Math.max(...ys) };
  },[boxProj]);

  React.useEffect(()=>{
    const el = svgRef.current; if(!el) return;
    const onDown = (e)=>{
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;
      dragRef.current.lastY = y;

      const wantRotate = (interaction==='rotateTarget' || interaction==='free');
      const wantMoveBase = (interaction==='moveBase' || interaction==='free');
      const wantMoveTarget = (interaction==='moveTarget' || interaction==='free');
      const wantOrbit = (interaction==='orbit' || interaction==='free');
      const wantMoveBox = (interaction==='moveBox' || interaction==='free');
      const wantRotateBox = (interaction==='rotateBox' || interaction==='free');

      if (wantRotate && pTarg.visible){
        const dx = x - pTarg.x, dy = y - pTarg.y;
        const dist = Math.hypot(dx,dy);
        const ringR = Math.max(40, 150*pTarg.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand){ dragRef.current.type = 'rotYaw'; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pTarg.x + 2.2*ringR, y: pTarg.y };
        if (Math.hypot(x-ph.x, y-ph.y) < 12){ dragRef.current.type='rotPitch'; e.preventDefault(); return; }
        const rh = { x: pTarg.x - 2.2*ringR, y: pTarg.y };
        if (Math.hypot(x-rh.x, y-rh.y) < 12){ dragRef.current.type='rotRoll'; e.preventDefault(); return; }
      }
      if (wantRotateBox && pBox.visible){
        const dx = x - pBox.x, dy = y - pBox.y;
        const dist = Math.hypot(dx,dy);
        const ringR = Math.max(40, 150*pBox.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand){ dragRef.current.type = 'boxRotYaw'; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pBox.x + 2.2*ringR, y: pBox.y };
        if (Math.hypot(x-ph.x, y-ph.y) < 12){ dragRef.current.type='boxRotPitch'; e.preventDefault(); return; }
        const rh = { x: pBox.x - 2.2*ringR, y: pBox.y };
        if (Math.hypot(x-rh.x, y-rh.y) < 12){ dragRef.current.type='boxRotRoll'; e.preventDefault(); return; }
      }

      if (wantMoveTarget){
        if (rectAllVisible){
          const minx=Math.min(...pc.map(p=>p.x)), maxx=Math.max(...pc.map(p=>p.x));
          const miny=Math.min(...pc.map(p=>p.y)), maxy=Math.max(...pc.map(p=>p.y));
          if (x>=minx && x<=maxx && y>=miny && y<=maxy){ dragRef.current.type='target'; e.preventDefault(); return; }
        } else if (pTarg.visible && Math.hypot(x-pTarg.x,y-pTarg.y)<40){ dragRef.current.type='target'; e.preventDefault(); return; }
      }
      if (wantMoveBox && boxBounds){
        if (x>=boxBounds.minx && x<=boxBounds.maxx && y>=boxBounds.miny && y<=boxBounds.maxy){ dragRef.current.type='box'; e.preventDefault(); return; }
        else if (pBox.visible && Math.hypot(x-pBox.x,y-pBox.y)<40){ dragRef.current.type='box'; e.preventDefault(); return; }
      }
      if (wantMoveBase){
        const pB = pBase; if (pB.visible && Math.hypot((x-pB.x),(y-pB.y)) < 20){ dragRef.current.type='base'; e.preventDefault(); return; }
      }
      if (wantOrbit){ dragRef.current.type='orbit'; }
    };

    const onMove = (e)=>{
      if (!dragRef.current.type) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;

      if (dragRef.current.type==='orbit'){
        setOrbit((o)=>({ ...o, yaw: o.yaw - (e.movementX*0.005), pitch: clamp(o.pitch - (e.movementY*0.005), -1.2, 1.2) }));
        return;
      }
      if (dragRef.current.type==='rotYaw' && pTarg.visible){
        const angle = Math.atan2(y - pTarg.y, x - pTarg.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateTarget({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type==='rotPitch'){
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateTarget({ dyaw:0, dpitch: -dy*0.25, droll:0 });
        return;
      }
      if (dragRef.current.type==='rotRoll'){
        const dx = e.movementX;
        onRotateTarget({ dyaw:0, dpitch:0, droll: dx*0.25 });
        return;
      }
      if (dragRef.current.type==='boxRotYaw' && pBox.visible){
        const angle = Math.atan2(y - pBox.y, x - pBox.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateBox({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type==='boxRotPitch'){
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateBox({ dyaw:0, dpitch: -dy*0.25, droll:0 });
        return;
      }
      if (dragRef.current.type==='boxRotRoll'){
        const dx = e.movementX;
        onRotateBox({ dyaw:0, dpitch:0, droll: dx*0.25 });
        return;
      }

      const { origin, dir } = screenToRay(x,y, cam, vp);
      if (dragRef.current.type==='base'){
        const hit = intersectRayPlaneZ(origin,dir, base.z);
        if (hit){
          let nz=base.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = base.z - dy*(radius/400); }
          onDragBase({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
      if (dragRef.current.type==='target'){
        const hit = intersectRayPlaneZ(origin,dir, target.z);
        if (hit){
          let nz=target.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = target.z - dy*(radius/400); }
          onDragTarget({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
      if (dragRef.current.type==='box'){
        const hit = intersectRayPlaneZ(origin,dir, box.center.z);
        if (hit){
          let nz=box.center.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = box.center.z - dy*(radius/400); }
          onDragBox({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
    };

    const onUp = ()=>{ dragRef.current.type=null; };
    const onWheel = (e)=>{ if (!(interaction==='orbit' || interaction==='free')) return; e.preventDefault(); setOrbit((o)=>({ ...o, radius: clamp(o.radius + e.deltaY*6, 500, 60000) })); };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive:false });
    return ()=>{
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  },[interaction, base, target, box, setOrbit, pTarg.visible, pTarg.x, pTarg.y, pBox.visible, pBox.x, pBox.y, pc, boxBounds]);

  // Peintre: dessine les faces triées par profondeur
  function drawBoxFaces(){
    const faces = BOX_FACES.map((idxs, iFace)=>{
      const pts = idxs.map(i=>boxProj[i]).filter(p=>p.visible);
      if (pts.length!==4) return null;
      const avgZ = pts.reduce((s,p)=>s+p.z,0)/4;
      return { iFace, pts, avgZ };
    }).filter(Boolean);
    faces.sort((a,b)=> b.avgZ - a.avgZ);
    const fills = ["#c7d2fe","#bfdbfe","#93c5fd","#a5b4fc","#60a5fa","#93c5fd"];
    return faces.map(({iFace, pts})=>{
      const poly = pts.map(p=>`${p.x},${p.y}`).join(' ');
      return <polygon key={`boxf${iFace}`} points={poly} fill={fills[iFace%fills.length]} fillOpacity={0.65} stroke={UI.blue} strokeWidth={1.5} />;
    });
  }

  // Grid sol
  const grid = (() => {
    const lines = [], L=6000, step=500;
    for(let x=-L; x<=L; x+=step){ lines.push(<Segment key={`gx${x}`} a={[x,-L,0]} b={[x,L,0]} cam={cam} vp={vp} stroke="#e5e7eb" />); }
    for(let y=-L; y<=L; y+=step){ lines.push(<Segment key={`gy${y}`} a={[-L,y,0]} b={[L,y,0]} cam={cam} vp={vp} stroke="#e5e7eb" />); }
    return lines;
  })();

  return (
    <svg ref={svgRef} width={width} height={height} style={{display:"block", background:"#fff", userSelect:"none"}}>
      {grid}
      {/* Axes */}
      <Segment a={[0,0,0]} b={[2000,0,0]} cam={cam} vp={vp} stroke="#ef4444" width={2} />
      <Segment a={[0,0,0]} b={[0,2000,0]} cam={cam} vp={vp} stroke="#10b981" width={2} />
      <Segment a={[0,0,0]} b={[0,0,2000]} cam={cam} vp={vp} stroke="#3b82f6" width={2} />

      {/* Base */}
      {pBase.visible && <circle cx={pBase.x} cy={pBase.y} r={Math.max(2, 60*pBase.scale)} fill={UI.green} />}

      {/* Boîte */}
      {drawBoxFaces()}
      {pBox.visible && (
        <>
          <circle cx={pBox.x} cy={pBox.y} r={Math.max(2, 48*pBox.scale)} fill={UI.blueLite} stroke={UI.blue} />
          {(interaction==='rotateBox' || interaction==='free') && (
            (() => {
              const r = Math.max(40, 150*pBox.scale);
              return (
                <g>
                  <circle cx={pBox.x} cy={pBox.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                  <circle cx={pBox.x + 2.2*r} cy={pBox.y} r={10} fill={UI.red} />
                  <text x={pBox.x + 2.2*r} y={pBox.y-16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                  <circle cx={pBox.x - 2.2*r} cy={pBox.y} r={10} fill={UI.green} />
                  <text x={pBox.x - 2.2*r} y={pBox.y-16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                  <text x={pBox.x} y={pBox.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
                </g>
              );
            })()
          )}
        </>
      )}

      {/* Cible (rectangle) */}
      {(() => {
        const pc2 = corners.map(c=>projectPoint(c,cam,vp));
        if (pc2.every(p=>p.visible)){
          return (
            <polygon points={pc2.map(p=>`${p.x},${p.y}`).join(' ')} fill="#fde047" stroke="#eab308" strokeWidth={2} />
          );
        }
        return null;
      })()}

      {/* Centres + rayon visuel */}
      {pBase.visible && pTarg.visible && (
        <>
          <circle cx={pTarg.x} cy={pTarg.y} r={Math.max(2, 55*pTarg.scale)} fill="#facc15" stroke="#eab308" />
          <line x1={pBase.x} y1={pBase.y} x2={pTarg.x} y2={pTarg.y} stroke="#0284c7" strokeWidth={2} />
        </>
      )}

      {/* Poignées rotation cible */}
      {(interaction==='rotateTarget' || interaction==='free') && pTarg.visible && (
        <g>
          {(() => {
            const r = Math.max(40, 150*pTarg.scale);
            return (
              <>
                <circle cx={pTarg.x} cy={pTarg.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                <circle cx={pTarg.x + 2.2*r} cy={pTarg.y} r={10} fill={UI.red} />
                <text x={pTarg.x + 2.2*r} y={pTarg.y-16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                <circle cx={pTarg.x - 2.2*r} cy={pTarg.y} r={10} fill={UI.green} />
                <text x={pTarg.x - 2.2*r} y={pTarg.y-16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                <text x={pTarg.x} y={pTarg.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// --------- Physics helpers --------------------------------------------------
function computeBase(D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, betaDeg){
  const D1Cx = D1Lx + (D1Rx - D1Lx)/2;
  const D1Cy = D1Ly + (D1Ry - D1Ly)/2;
  const b = deg2rad(betaDeg);
  const cb = Math.cos(b), sb = Math.sin(b);
  const baseX = D1Cx + (FLRx * cb - FLRy * sb);
  const baseY = D1Cy + (FLRx * sb + FLRy * cb);
  const baseZ = FLRz;
  return { D1Cx, D1Cy, baseX, baseY, baseZ };
}

// Ray en repère sphérique classique : η = eps - alpha (azimut), θ = thetaDeg (polaire)
function computeRay(epsDeg, alphaDeg, thetaDeg){
  const eta = epsDeg - alphaDeg;                // azimut
  const etaRad = deg2rad(eta);
  const theta = deg2rad(thetaDeg);              // polaire (0° = +Z)
  const sθ = Math.sin(theta), cθ = Math.cos(theta);
  const cη = Math.cos(etaRad), sη = Math.sin(etaRad);
  return { rx: cη*sθ, ry: sη*sθ, rz: cθ, eta, etaRad };
}

function computeTarget(base, ray, V){
  return { Xt: base.baseX + V*ray.rx, Yt: base.baseY + V*ray.ry, Zt: base.baseZ + V*ray.rz };
}

function SelfTests({ base, target, V, useAngles, ray }){
  const ok1 = useAngles ? (Math.abs(Math.hypot(ray.rx,ray.ry,ray.rz)-1) < 1e-9) : true;
  const dx = target.Xt - base.baseX, dy = target.Yt - base.baseY, dz = target.Zt - base.baseZ;
  const dist = Math.hypot(dx,dy,dz);
  const ok2 = useAngles ? (Math.abs(dist - V) < 1e-6) : true;
  const rc = computeRay(0,0,90); // η=0°, θ=90° -> (1,0,0)
  const ok3 = Math.abs(rc.rx-1) < 1e-9 && Math.abs(rc.ry) < 1e-9 && Math.abs(rc.rz) < 1e-9;
  // nouveaux tests
  const rUp = computeRay(0,0,0);        // (0,0,1)
  const rDown = computeRay(0,0,180);    // (0,0,-1)
  const rY = computeRay(90,0,90);       // (0,1,0)
  const ok4 = Math.abs(rUp.rx) < 1e-9 && Math.abs(rUp.ry) < 1e-9 && Math.abs(rUp.rz-1) < 1e-9;
  const ok5 = Math.abs(rDown.rx) < 1e-9 && Math.abs(rDown.ry) < 1e-9 && Math.abs(rDown.rz+1) < 1e-9;
  const ok6 = Math.abs(rY.rx) < 1e-9 && Math.abs(rY.ry-1) < 1e-9 && Math.abs(rY.rz) < 1e-9;

  return (
    <div style={S.card}>
      <div style={{fontWeight:600, fontSize:12, marginBottom:6}}>Tests intégrés</div>
      <div style={{fontSize:12, color: ok1?"#065f46":"#991b1b"}}>‣ |r|≈1 (angles) : {ok1?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok2?"#065f46":"#991b1b"}}>‣ ||base→cible|| : {useAngles? (ok2?"V OK":"V KO") : dist.toFixed(3)}</div>
      <div style={{fontSize:12, color: ok3?"#065f46":"#991b1b"}}>‣ r(η=0°,θ=90°)≈(1,0,0) : {ok3?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok4?"#065f46":"#991b1b"}}>‣ r(θ=0°)≈(0,0,1) : {ok4?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok5?"#065f46":"#991b1b"}}>‣ r(θ=180°)≈(0,0,-1) : {ok5?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok6?"#065f46":"#991b1b"}}>‣ r(η=90°,θ=90°)≈(0,1,0) : {ok6?"OK":"KO"}</div>
    </div>
  );
}

// Angles sortants depuis base et cible (quel que soit le mode)
function computeOutputAngles(base, target, alphaDeg){
  const dx = target.z !== undefined ? (target.x - base.x) : (target.Xt - base.baseX);
  const dy = target.z !== undefined ? (target.y - base.y) : (target.Yt - base.baseY);
  const dz = target.z !== undefined ? (target.z - base.z) : (target.Zt - base.baseZ);
  const Vout = Math.hypot(dx,dy,dz);
  if (Vout < 1e-12) return { V:0, etaDeg:0, thetaDeg:0, elevDeg:0, epsDeg:alphaDeg, valid:false };
  const eta = Math.atan2(dy, dx);                 // [-π, π]
  const cosθ = clamp(dz / Vout, -1, 1);
  const theta = Math.acos(cosθ);                   // [0, π]
  const elev = (Math.PI/2) - theta;                // élévation (pitch) en rad
  const etaDeg = rad2deg(eta);
  const thetaDeg = rad2deg(theta);
  const elevDeg = rad2deg(elev);
  const epsDeg = etaDeg + alphaDeg;                // car η = ε - α
  return { V:Vout, etaDeg, thetaDeg, elevDeg, epsDeg, valid:true };
}

// --------- SplitPane (redimensionnable, sans dépendance) -------------------
function SplitPane({ left, right, initial=380, min=280, max=640 }){
  const [lw, setLw] = React.useState(()=> {
    const saved = localStorage.getItem("split:left");
    return saved ? Number(saved) : initial;
  });
  const dragging = React.useRef(false);

  React.useEffect(()=>{
    const onMove = (e)=>{
      if(!dragging.current) return;
      const w = Math.max(min, Math.min(max, e.clientX));
      setLw(w);
      localStorage.setItem("split:left", String(w));
    };
    const onUp = ()=>{
      if(dragging.current){ dragging.current=false; document.body.style.cursor=''; }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  },[min,max]);

  return (
    <div style={S.splitWrap}>
      <div style={{...S.left, width: lw}}>
        {left}
      </div>
      <div
        style={S.splitter}
        onMouseDown={()=>{ dragging.current=true; document.body.style.cursor='col-resize'; }}
        title="Glisser pour redimensionner"
      />
      <div style={S.right}>
        {right()}
      </div>
    </div>
  );
}

// --------- Main component ---------------------------------------------------
export default function Simulation3D_UXClean(){
  // Angles phys.
  const [FLRx, setFLRx] = React.useState(5638);
  const [FLRy, setFLRy] = React.useState(0);
  const [FLRz, setFLRz] = React.useState(0);
  const [D1Lx, setD1Lx] = React.useState(-4300);
  const [D1Ly, setD1Ly] = React.useState(1245);
  const [D1Rx, setD1Rx] = React.useState(-4300);
  const [D1Ry, setD1Ry] = React.useState(-1255);
  const [alpha, setAlpha] = React.useState(0);   // minutes d'arc
  const [eps, setEps] = React.useState(0);       // degrés
  const [zeta, setZeta] = React.useState(90);    // θ (polaire) en degrés
  const [beta, setBeta] = React.useState(0);
  const [V, setV] = React.useState(1000);

  // Mode positions
  const [ctrl, setCtrl] = React.useState('manuel'); // 'angles' | 'manuel'

  const baseFromAngles = React.useMemo(()=>computeBase(D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta), [D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta]);
  const rayAngles = React.useMemo(()=>computeRay(eps, alpha/60, zeta), [eps, alpha, zeta]);
  const targFromAngles = React.useMemo(()=>computeTarget(baseFromAngles, rayAngles, V), [baseFromAngles, rayAngles, V]);

  const [baseM, setBaseM] = React.useState(()=>({ x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ }));
  const [targM, setTargM] = React.useState(()=>({ x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt }));

  const base = ctrl==='angles' ? { x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ } : baseM;
  const targ = ctrl==='angles' ? { x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt } : targM;

    // --- Yt en une ligne (formule) + comparaison
  const Yt_formula = React.useMemo(() =>
    (D1Ly + D1Ry)/2
    + FLRx*Math.sin(deg2rad(beta))
    + FLRy*Math.cos(deg2rad(beta))
    + V*Math.sin(deg2rad(eps - alpha/60))*Math.sin(deg2rad(zeta))
  , [D1Ly, D1Ry, FLRx, FLRy, beta, V, eps, alpha, zeta]);

  const Yt_sim = targ.y;              // valeur actuelle de la scène
  const dYt   = Yt_sim - Yt_formula;  // écart




  // Rectangle cible
  const [rectYaw, setRectYaw]     = React.useState(0);
  const [rectPitch, setRectPitch] = React.useState(0);
  const [rectRoll, setRectRoll]   = React.useState(0);
  const [rectW, setRectW]         = React.useState(800);
  const [rectH, setRectH]         = React.useState(300);

  const rect = React.useMemo(()=>({
    w: rectW, h: rectH,
    yaw: deg2rad(rectYaw), pitch: deg2rad(rectPitch), roll: deg2rad(rectRoll)
  }),[rectW,rectH,rectYaw,rectPitch,rectRoll]);

  // Boîte 3D
  const [boxPos, setBoxPos] = React.useState({ x: 1000, y: 0, z: 400 });
  const [boxYaw, setBoxYaw] = React.useState(0);
  const [boxPitch, setBoxPitch] = React.useState(0);
  const [boxRoll, setBoxRoll] = React.useState(0);
  const [boxSX, setBoxSX] = React.useState(1280);
  const [boxSY, setBoxSY] = React.useState(280);
  const [boxSZ, setBoxSZ] = React.useState(280);

  const box = React.useMemo(()=>({
    center: boxPos,
    geom: { sx: boxSX, sy: boxSY, sz: boxSZ, yaw: deg2rad(boxYaw), pitch: deg2rad(boxPitch), roll: deg2rad(boxRoll) }
  }),[boxPos,boxSX,boxSY,boxSZ,boxYaw,boxPitch,boxRoll]);

  // Vue auto mesurée
  const [viewW, setViewW] = React.useState(1200);
  const [viewH, setViewH] = React.useState(700);
  const [orbit, setOrbit] = React.useState({ yaw:0.6, pitch:0.45, radius:9000 });
  const simRef = React.useRef(null);
  React.useEffect(()=>{
    if (!simRef.current || typeof ResizeObserver==="undefined") return;
    const ro = new ResizeObserver(entries=>{
      const cr = entries[0].contentRect;
      setViewW(Math.max(300, cr.width));
      setViewH(Math.max(300, cr.height));
    });
    ro.observe(simRef.current);
    return ()=> ro.disconnect();
  },[]);

  const [interaction, setInteraction] = React.useState('free'); // 'free'|'orbit'|'moveBase'|'moveTarget'|'rotateTarget'|'moveBox'|'rotateBox'

  const onDragBase = React.useCallback((p)=>{ setCtrl('manuel'); setBaseM(p); },[]);
  const onDragTarget = React.useCallback((p)=>{ setCtrl('manuel'); setTargM(p); },[]);
  const onRotateTarget = React.useCallback(({dyaw=0,dpitch=0,droll=0})=>{
    setRectYaw(a=>a+dyaw); setRectPitch(a=>clamp(a+dpitch,-89,89)); setRectRoll(a=>a+droll);
  },[]);
  const onDragBox = React.useCallback((p)=>{ setBoxPos(p); },[]);
  const onRotateBox = React.useCallback(({dyaw=0,dpitch=0,droll=0})=>{
    setBoxYaw(a=>a+dyaw); setBoxPitch(a=>clamp(a+dpitch,-89,89)); setBoxRoll(a=>a+droll);
  },[]);

  const outputs = { Xt: targ.x, Yt: targ.y, Zt: targ.z };
  const baseForTest = { baseX: base.x, baseY: base.y, baseZ: base.z };
  const targetForTest = { Xt: targ.x, Yt: targ.y, Zt: targ.z };

  // Angles sortants (toujours calculés à partir des positions visibles)
  const outAngles = React.useMemo(()=>computeOutputAngles(base, targ, alpha/60), [base, targ, alpha]);

  



  // --- UI LEFT: panneau
  const LeftPanel = (
    <div style={S.pad}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:20, fontWeight:700, marginBottom:2}}>Settings</div>
        <div style={{fontSize:12, color:UI.subtext}}></div>
        <div style={S.card}>
  <div style={{fontWeight:600, fontSize:12, marginBottom:8}}>Yt — comparaison</div>
  <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12}}>
    <div>Yt (formule) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{Yt_formula.toFixed(3)}</span></div>
    <div>Yt (simulation) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{Yt_sim.toFixed(3)}</span></div>
    <div>ΔYt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: Math.abs(dYt)<1e-6 ? "#065f46" : "#991b1b"}}>{dYt.toFixed(6)}</span></div>
  </div>
  <div style={{fontSize:11, color:UI.subtext, marginTop:6}}>
    {ctrl==='manuel'
      ? "Note : en mode Manuel, un écart est normal si la cible n'est pas pilotée par les angles."
      : "En mode Angles, ΔYt devrait être ~0."}
  </div>
</div>

      </div>

      <div style={S.card}>
        <div style={S.hGroup}>
          <span style={S.badge}>Positions :</span>
          <SegButton active={ctrl==='angles'} onClick={()=>setCtrl('angles')}>Angles</SegButton>
          <SegButton active={ctrl==='manuel'} onClick={()=>setCtrl('manuel')}>Manuel</SegButton>
        </div>
        <div style={S.hGroup}>
          <span style={S.badge}>Interaction :</span>
          <SegButton active={interaction==='free'} onClick={()=>setInteraction('free')}>Libre (Tout)</SegButton>
          <SegButton active={interaction==='orbit'} onClick={()=>setInteraction('orbit')}>Orbite</SegButton>
          <SegButton active={interaction==='moveBase'} onClick={()=>setInteraction('moveBase')}>Caméra</SegButton>
          <SegButton active={interaction==='moveTarget'} onClick={()=>setInteraction('moveTarget')}>Cible</SegButton>
          <SegButton active={interaction==='rotateTarget'} onClick={()=>setInteraction('rotateTarget')}>Rot. Cible</SegButton>
          <SegButton active={interaction==='moveBox'} onClick={()=>setInteraction('moveBox')}>Boîte</SegButton>
          <SegButton active={interaction==='rotateBox'} onClick={()=>setInteraction('rotateBox')}>Rot. Boîte</SegButton>
        </div>
      </div>

      <Section title="Paramètres – Mode Angles" defaultOpen>
        <div style={S.grid2}>
          <SliderRow label="FLRx" value={FLRx} onChange={setFLRx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="FLRy" value={FLRy} onChange={setFLRy} min={-10000} max={10000} step={0.001} />
          <SliderRow label="FLRz" value={FLRz} onChange={setFLRz} min={-5000} max={5000} step={0.001} />

          <SliderRow label="D1Lx" value={D1Lx} onChange={setD1Lx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Ly" value={D1Ly} onChange={setD1Ly} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Rx" value={D1Rx} onChange={setD1Rx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Ry" value={D1Ry} onChange={setD1Ry} min={-10000} max={10000} step={0.001} />

          <SliderRow label="β (sym) [°]" value={beta} onChange={setBeta} min={-180} max={180} step={0.01} />
          <SliderRow label="α drive [′] (minutes)" value={alpha} onChange={setAlpha} min={-10800} max={10800} step={0.01} />
          <SliderRow label="ε (zr) [°]" value={eps} onChange={setEps} min={-180} max={180} step={0.01} />
          <SliderRow label="θ (polaire) [°]" value={zeta} onChange={setZeta} min={0} max={180} step={0.01} />
          <SliderRow label="V" value={V} onChange={setV} min={0} max={20000} step={0.001} />
        </div>
      </Section>

      <Section title="Positions – Mode Manuel" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Base X" value={baseM.x} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Y" value={baseM.y} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Z" value={baseM.z} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,z:v}); }} min={-5000} max={5000} step={0.01} />

          <SliderRow label="Cible X" value={targM.x} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Y" value={targM.y} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Z" value={targM.z} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,z:v}); }} min={-5000} max={5000} step={0.01} />
        </div>
      </Section>

      <SelfTests base={baseForTest} target={targetForTest} V={V} useAngles={ctrl==='angles'} ray={rayAngles} />

      <div style={S.card}>
        <div style={{fontWeight:600, fontSize:12, marginBottom:8, color:"#92400e"}}>Sorties (monde)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12}}>
          <div>Xt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Xt.toFixed(3)}</span></div>
          <div>Yt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Yt.toFixed(3)}</span></div>
          <div>Zt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Zt.toFixed(3)}</span></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{fontWeight:600, fontSize:12, marginBottom:8, color:"#1f2937"}}>Angles (sortie)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, fontSize:12}}>
          <div>η (azimut) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.etaDeg.toFixed(2)}°</span></div>
          <div>θ (polaire) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.thetaDeg.toFixed(2)}°</span></div>
          <div>Élév. = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.elevDeg.toFixed(2)}°</span></div>
          <div>α (drive) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{alpha.toFixed(2)}′</span> <span style={{color:UI.subtext}}>({(alpha/60).toFixed(4)}°)</span></div>
          <div>ε (calc) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.epsDeg.toFixed(2)}°</span></div>
        </div>
        <div style={{fontSize:11, color:UI.subtext, marginTop:6}}>V (mesuré) = {outAngles.V.toFixed(3)}</div>
      </div>

      <div style={{display:"flex", gap:10}}>
        <button
          style={S.resetBtn}
          onClick={()=>{
            setFLRx(5638); setFLRy(0); setFLRz(0);
            setD1Lx(-4300); setD1Ly(1245); setD1Rx(-4300); setD1Ry(-1255);
            setBeta(0); setAlpha(0); setEps(0); setZeta(90); setV(1000);
            const b=computeBase(-4300,1245,-4300,-1255,5638,0,0,0);
            const r=computeRay(0,0,90);
            const t=computeTarget(b,r,1000);
            setBaseM({ x:b.baseX, y:b.baseY, z:b.baseZ });
            setTargM({ x:t.Xt, y:t.Yt, z:t.Zt });
            setCtrl('manuel');
            setRectYaw(0); setRectPitch(0); setRectRoll(0); setRectW(800); setRectH(300);
            setBoxPos({ x: 1000, y: 0, z: 400 });
            setBoxYaw(15); setBoxPitch(-5); setBoxRoll(10);
            setBoxSX(900); setBoxSY(600); setBoxSZ(500);
            setOrbit({ yaw:0.6, pitch:0.45, radius:9000 });
            setInteraction('free');
          }}
        >Réinitialiser</button>
      </div>
    </div>

          {/* Zone de visualisation (immense) */}
          <div className="bg-white rounded-2xl shadow overflow-hidden flex-1">
            <div
              className="relative bg-white"
              style={{ width: viewW + 'px', height: viewH + 'px' }}
            >
              <svg ref={svgRef} width={viewW} height={viewH} className="absolute inset-0"
                   onPointerMove={onPointerMove}
                   onPointerUp={onPointerUp}
                   onPointerCancel={onPointerUp}
                   onPointerLeave={onPointerUp}
              >
                {/* Image de fond (optionnelle) */}
                {bgUrl && (
                  <g transform={`translate(${bgOffsetX},${bgOffsetY}) scale(${bgScale})`} opacity={bgOpacity}>
                    <image href={bgUrl} x={0} y={0} width={viewW} height={viewH} preserveAspectRatio="xMidYMid meet" />
                  </g>
                )}

                {/* Quadrillage */}
                {showGrid && (
                  <>
                    <defs>
                      <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </>
                )}

                {/* Axes */}
                <line x1={viewW/2} y1="0" x2={viewW/2} y2={viewH} stroke="rgba(30,30,30,0.35)" strokeWidth="1.5"/>
                <line x1="0" y1={viewH/2} x2={viewW} y2={viewH/2} stroke="rgba(30,30,30,0.35)" strokeWidth="1.5"/>

                {/* Légende (sans valeurs) */}
                <g transform={`translate(${12}, ${12})`} pointerEvents="none">
                  <rect x="0" y="0" width={220} height={64} rx={10} fill="rgba(255,255,255,0.9)" />
                  <g transform="translate(10,16)"><rect width="12" height="12" rx="2" fill="#6366f1" /><text x="18" y="11" fontSize="12" fill="#111827">α (drive)</text></g>
                  <g transform="translate(10,36)"><rect width="12" height="12" rx="2" fill="#0284c7" /><text x="18" y="11" fontSize="12" fill="#111827">ε (zr)</text></g>
                  <g transform="translate(110,16)"><rect width="12" height="12" rx="2" fill="rgba(245,158,11,0.75)" /><text x="18" y="11" fontSize="12" fill="#111827">η = ε−α</text></g>
                  <g transform="translate(110,36)"><rect width="12" height="12" rx="2" fill="rgba(51,65,85,0.6)" /><text x="18" y="11" fontSize="12" fill="#111827">β (sym)</text></g>
                </g>

                {/* Base SLR.FL / Caméra */}
                {(() => {
                  const cx = camScreenX, cy = camScreenY;
                  const pAlpha = polarPointScreen(cx, cy, Rarc+14, alpha);
                  const pEps   = polarPointScreen(cx, cy, Rarc+14, epsDisp);
                  return (
                    <g>
                      {/* secteur η rempli */}
                      <path d={sectorPath(cx, cy, RarcInner, Rarc, alpha, epsDisp)} fill="rgba(245,158,11,0.35)" stroke="rgba(245,158,11,0.9)" strokeWidth={2} />
                      {/* rayon α */}
                      <line x1={cx} y1={cy} x2={pAlpha.x} y2={pAlpha.y} stroke="#6366f1" strokeWidth={3} />
                      {/* rayon ε */}
                      <line x1={cx} y1={cy} x2={pEps.x} y2={pEps.y} stroke="#0284c7" strokeWidth={3} />
                      {/* point caméra */}
                      <circle cx={cx} cy={cy} r={7} fill="rgba(16,185,129,0.95)"
                              style={{ cursor: control==="camera" ? (draggingCam?"grabbing":"grab") : "default" }}
                              onPointerDown={onPointerDownCam}
                      />
                    </g>
                  );
                })()}

                {/* Vecteur base→cible */}
                <line x1={camScreenX} y1={camScreenY} x2={sx} y2={sy} stroke="rgba(2,132,199,0.7)" strokeWidth="2" />

                {/* Arc β autour de D1c */}
                {(() => {
                  const d1cX = viewW/2 + D1Cx*scale;
                  const d1cY = viewH/2 - D1Cy*scale;
                  const pB = polarPointScreen(d1cX, d1cY, Rbeta+8, beta);
                  return (
                    <g>
                      <line x1={d1cX} y1={d1cY} x2={d1cX + Rbeta + 14} y2={d1cY} stroke="rgba(30,41,59,0.6)" strokeWidth={1.5} />
                      <path d={sectorPath(d1cX, d1cY, RbetaInner, Rbeta, 0, beta)} fill="rgba(51,65,85,0.25)" stroke="rgba(51,65,85,0.9)" strokeWidth={2} />
                      <line x1={d1cX} y1={d1cY} x2={pB.x} y2={pB.y} stroke="rgba(30,41,59,0.9)" strokeWidth={2} />
                    </g>
                  );
                })()}

                {/* Cible */}
                <g transform={`translate(${sx},${sy}) rotate(${rectAngle})`}>
                  <rect x={-targetPxW/2} y={-targetPxH/2} width={targetPxW} height={targetPxH}
                        fill="#facc15" stroke="none"
                        onPointerDown={onPointerDownTarget}
                        style={{ cursor: (control==="cible"||control==="camera") ? (draggingTarget?"grabbing":"grab") : "default" }}
                  />
                  <line x1={0} y1={-targetPxH/2} x2={0} y2={-(targetPxH/2+18)} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
                  <circle cx={0} cy={-(targetPxH/2+26)} r={6} fill="white" stroke="rgba(0,0,0,0.7)" strokeWidth="2"
                          onPointerDown={onPointerDownRotate}
                          style={{ cursor: "grab" }}
                  />
                </g>
              </svg>
            </div>
            <div className="p-3 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:justify-between gap-2">
              <div>Plan : XY (Y vers le haut) – Z base via « FLRz ».</div>
              <div>Échelle : <span className="tabular-nums">{scale}</span> px/unité</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
