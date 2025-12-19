
import * as React from "react";
import * as XLSX from "xlsx"; // Excel import/export (browser)

// ===================== Utils =====================
function deg2rad(d) { return (d * Math.PI) / 180; }
function rad2deg(r) { return (r * 180) / Math.PI; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function safeNum(v, fallback = 0) {
  const n = typeof v === "string" ? Number(v.toString().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}


// Crab angle conversions
function crabMmPerMToDeg(mmPerM) {
  // tan(angle) = (mm/m)/1000
  return rad2deg(Math.atan(safeNum(mmPerM, 0) / 1000));
}
function crabDegToMmPerM(deg) {
  return Math.tan(deg2rad(safeNum(deg, 0))) * 1000;
}

// ===================== Minimal UI theme =====================
const UI = {
  subtext: "#64748b",
  blue: "#2563eb",
  blueLite: "#93c5fd",
  green: "#10b981",
  red: "#ef4444",
};

const S = {
  pad: { padding: 14 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, marginBottom: 10 },
  splitWrap: { display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: "#f8fafc" },
  left: { overflow: "auto", borderRight: "1px solid #e5e7eb", background: "#f8fafc" },
  right: { flex: 1, overflow: "hidden" },
  splitter: { width: 6, cursor: "col-resize", background: "#e5e7eb" },
  hGroup: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  badge: { fontSize: 12, color: "#0f172a", fontWeight: 700 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  resetBtn: { background: "#111827", color: "#fff", padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: "none" },
};

function SegButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid " + (active ? "#1d4ed8" : "#cbd5e1"),
        background: active ? "#dbeafe" : "#fff",
        color: "#0f172a",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={S.card}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen(v => !v)}
      >
        <div style={{ fontWeight: 800, fontSize: 12 }}>{title}</div>
        <div style={{ fontSize: 18, color: UI.subtext }}>{open ? "▾" : "▸"}</div>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, min = -5000, max = 5000, step = 1, onChange, unit = "", extra = "" }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 12, color: UI.subtext, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
          {Number(value).toFixed(3)}{unit}{extra ? " " + extra : ""}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(safeNum(e.target.value, 0))}
        className="w-full accent-blue-600"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(safeNum(e.target.value, 0))}
        className="w-full border rounded-md px-2 py-1 text-xs"
      />
    </div>
  );
}

// ===================== Math: vectors / matrices / camera =====================
function vec(a) { return [a[0], a[1], a[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mulScalar(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  if (l < 1e-12) return [0, 0, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}

function Rx(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}
function Ry(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}
function Rz(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}
function mulMat3(A, B) {
  const out = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return out;
}
function mulMat3Vec3(A, v) {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
  ];
}

function cameraBasis(eye, target, up) {
  const f = norm(sub(target, eye));          // forward
  const r = norm(cross(f, up));              // right
  const u = norm(cross(r, f));               // up (orthonormal)
  return { r, u, f };
}

function worldToCamera(p, eye, target = [0, 0, 0], up = [0, 0, 1]) {
  const { r, u, f } = cameraBasis(eye, target, up);
  const pe = sub(p, eye);
  return [dot(pe, r), dot(pe, u), dot(pe, f)];
}

function projectPoint(pWorld, cam, viewport) {
  const { eye, target, up, fov, aspect, near } = cam;
  const pc = worldToCamera(pWorld, eye, target, up);
  const z = pc[2];
  if (z <= near) return { visible: false };
  const f = 1 / Math.tan(0.5 * fov);
  const x_ndc = (pc[0] * f) / (z * aspect);
  const y_ndc = (pc[1] * f) / (z);
  const sx = (x_ndc + 1) * 0.5 * viewport.w;
  const sy = (1 - y_ndc) * 0.5 * viewport.h;
  return { x: sx, y: sy, z, visible: true, scale: f / z };
}

function screenToRay(px, py, cam, vp) {
  const x_ndc = (px / vp.w) * 2 - 1;
  const y_ndc = 1 - (py / vp.h) * 2;
  const f = 1 / Math.tan(0.5 * cam.fov);

  // dir in camera space
  const dirCam = norm([(x_ndc * cam.aspect) / f, y_ndc / f, 1]);

  // camera basis in world
  const { r, u, f: fw } = cameraBasis(cam.eye, cam.target, cam.up);
  const dirWorld = norm([
    r[0] * dirCam[0] + u[0] * dirCam[1] + fw[0] * dirCam[2],
    r[1] * dirCam[0] + u[1] * dirCam[1] + fw[1] * dirCam[2],
    r[2] * dirCam[0] + u[2] * dirCam[1] + fw[2] * dirCam[2],
  ]);

  return { origin: vec(cam.eye), dir: dirWorld };
}

function intersectRayPlaneZ(origin, dir, planeZ) {
  const denom = dir[2];
  if (Math.abs(denom) < 1e-8) return null;
  const t = (planeZ - origin[2]) / denom;
  if (t <= 0) return null;
  return add(origin, mulScalar(dir, t));
}

// ===================== Scene primitives =====================
function Segment({ a, b, cam, vp, stroke = "#94a3b8", width = 1, dash }) {
  const pa = projectPoint(a, cam, vp), pb = projectPoint(b, cam, vp);
  if (!pa.visible || !pb.visible) return null;
  return <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />;
}

function boxVerticesWorld(center, box) {
  const { x, y, z } = center;
  const { sx, sy, sz, yaw, pitch, roll } = box;
  const R = mulMat3(mulMat3(Rz(yaw), Rx(pitch)), Ry(roll));
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const locals = [
    [+hx, +hy, +hz], [-hx, +hy, +hz], [-hx, -hy, +hz], [+hx, -hy, +hz],
    [+hx, +hy, -hz], [-hx, +hy, -hz], [-hx, -hy, -hz], [+hx, -hy, -hz],
  ];
  return locals.map(v => add([x, y, z], mulMat3Vec3(R, v)));
}

const BOX_FACES = [
  [0, 1, 2, 3], [7, 6, 5, 4], [0, 3, 7, 4], [1, 5, 6, 2], [0, 4, 5, 1], [3, 2, 6, 7],
];

function SceneSVG({
  width, height,
  orbit, setOrbit,
  base, target, rect, box,
  interaction,
  onDragBase, onDragTarget, onRotateTarget,
  onDragBox, onRotateBox,
}) {
  const vp = { w: width, h: height };
  const { yaw, pitch, radius } = orbit;

  const eye = React.useMemo(() => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [radius * cp * cy, radius * cp * sy, radius * sp];
  }, [yaw, pitch, radius]);

  const cam = React.useMemo(
    () => ({ eye, target: [0, 0, 0], up: [0, 0, 1], fov: deg2rad(50), aspect: width / height, near: 1 }),
    [eye, width, height]
  );

  const svgRef = React.useRef(null);
  const dragRef = React.useRef({ type: null, lastY: 0, lastAngle: 0 });

  function rectCornersWorld(center, rect) {
    const { x, y, z } = center;
    const { w, h, yaw, pitch, roll } = rect;
    const R = mulMat3(mulMat3(Rz(yaw), Rx(pitch)), Ry(roll));
    const hx = w / 2, hy = h / 2;
    const locals = [[hx, hy, 0], [-hx, hy, 0], [-hx, -hy, 0], [hx, -hy, 0]];
    return locals.map(v => add([x, y, z], mulMat3Vec3(R, v)));
  }

  const pBase = projectPoint([base.x, base.y, base.z], cam, vp);
  const pTarg = projectPoint([target.x, target.y, target.z], cam, vp);

  const corners = rectCornersWorld(target, rect);
  const pc = corners.map(c => projectPoint(c, cam, vp));
  const rectAllVisible = pc.every(p => p.visible);

  const boxVertsW = boxVerticesWorld(box.center, box.geom);
  const boxProj = boxVertsW.map(v => projectPoint(v, cam, vp));
  const pBox = projectPoint([box.center.x, box.center.y, box.center.z], cam, vp);

  const boxBounds = React.useMemo(() => {
    const xs = boxProj.filter(p => p.visible).map(p => p.x);
    const ys = boxProj.filter(p => p.visible).map(p => p.y);
    if (xs.length === 0) return null;
    return { minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) };
  }, [boxProj]);

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onDown = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      dragRef.current.lastY = y;

      const wantRotate = (interaction === "rotateTarget" || interaction === "free");
      const wantMoveBase = (interaction === "moveBase" || interaction === "free");
      const wantMoveTarget = (interaction === "moveTarget" || interaction === "free");
      const wantOrbit = (interaction === "orbit" || interaction === "free");
      const wantMoveBox = (interaction === "moveBox" || interaction === "free");
      const wantRotateBox = (interaction === "rotateBox" || interaction === "free");

      // Rotation target
      if (wantRotate && pTarg.visible) {
        const dx = x - pTarg.x, dy = y - pTarg.y;
        const dist = Math.hypot(dx, dy);
        const ringR = Math.max(40, 150 * pTarg.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand) { dragRef.current.type = "rotYaw"; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pTarg.x + 2.2 * ringR, y: pTarg.y };
        if (Math.hypot(x - ph.x, y - ph.y) < 12) { dragRef.current.type = "rotPitch"; e.preventDefault(); return; }
        const rh = { x: pTarg.x - 2.2 * ringR, y: pTarg.y };
        if (Math.hypot(x - rh.x, y - rh.y) < 12) { dragRef.current.type = "rotRoll"; e.preventDefault(); return; }
      }

      // Rotation box
      if (wantRotateBox && pBox.visible) {
        const dx = x - pBox.x, dy = y - pBox.y;
        const dist = Math.hypot(dx, dy);
        const ringR = Math.max(40, 150 * pBox.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand) { dragRef.current.type = "boxRotYaw"; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pBox.x + 2.2 * ringR, y: pBox.y };
        if (Math.hypot(x - ph.x, y - ph.y) < 12) { dragRef.current.type = "boxRotPitch"; e.preventDefault(); return; }
        const rh = { x: pBox.x - 2.2 * ringR, y: pBox.y };
        if (Math.hypot(x - rh.x, y - rh.y) < 12) { dragRef.current.type = "boxRotRoll"; e.preventDefault(); return; }
      }

      // Move target
      if (wantMoveTarget) {
        if (rectAllVisible) {
          const minx = Math.min(...pc.map(p => p.x)), maxx = Math.max(...pc.map(p => p.x));
          const miny = Math.min(...pc.map(p => p.y)), maxy = Math.max(...pc.map(p => p.y));
          if (x >= minx && x <= maxx && y >= miny && y <= maxy) { dragRef.current.type = "target"; e.preventDefault(); return; }
        } else if (pTarg.visible && Math.hypot(x - pTarg.x, y - pTarg.y) < 40) {
          dragRef.current.type = "target"; e.preventDefault(); return;
        }
      }

      // Move box
      if (wantMoveBox && boxBounds) {
        if (x >= boxBounds.minx && x <= boxBounds.maxx && y >= boxBounds.miny && y <= boxBounds.maxy) { dragRef.current.type = "box"; e.preventDefault(); return; }
        if (pBox.visible && Math.hypot(x - pBox.x, y - pBox.y) < 40) { dragRef.current.type = "box"; e.preventDefault(); return; }
      }

      // Move base
      if (wantMoveBase) {
        if (pBase.visible && Math.hypot(x - pBase.x, y - pBase.y) < 20) { dragRef.current.type = "base"; e.preventDefault(); return; }
      }

      if (wantOrbit) dragRef.current.type = "orbit";
    };

    const onMove = (e) => {
      if (!dragRef.current.type) return;

      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

      if (dragRef.current.type === "orbit") {
        setOrbit((o) => ({ ...o, yaw: o.yaw - (e.movementX * 0.005), pitch: clamp(o.pitch - (e.movementY * 0.005), -1.2, 1.2) }));
        return;
      }

      // Rot target
      if (dragRef.current.type === "rotYaw" && pTarg.visible) {
        const angle = Math.atan2(y - pTarg.y, x - pTarg.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateTarget({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type === "rotPitch") {
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateTarget({ dyaw: 0, dpitch: -dy * 0.25, droll: 0 });
        return;
      }
      if (dragRef.current.type === "rotRoll") {
        const dx = e.movementX;
        onRotateTarget({ dyaw: 0, dpitch: 0, droll: dx * 0.25 });
        return;
      }

      // Rot box
      if (dragRef.current.type === "boxRotYaw" && pBox.visible) {
        const angle = Math.atan2(y - pBox.y, x - pBox.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateBox({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type === "boxRotPitch") {
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateBox({ dyaw: 0, dpitch: -dy * 0.25, droll: 0 });
        return;
      }
      if (dragRef.current.type === "boxRotRoll") {
        const dx = e.movementX;
        onRotateBox({ dyaw: 0, dpitch: 0, droll: dx * 0.25 });
        return;
      }

      // Drag on plane Z
      const { origin, dir } = screenToRay(x, y, cam, vp);

      if (dragRef.current.type === "base") {
        const hit = intersectRayPlaneZ(origin, dir, base.z);
        if (hit) {
          let nz = base.z;
          if (e.altKey) { const dy = y - dragRef.current.lastY; dragRef.current.lastY = y; nz = base.z - dy * (radius / 400); }
          onDragBase({ x: hit[0], y: hit[1], z: nz });
        }
        return;
      }

      if (dragRef.current.type === "target") {
        const hit = intersectRayPlaneZ(origin, dir, target.z);
        if (hit) {
          let nz = target.z;
          if (e.altKey) { const dy = y - dragRef.current.lastY; dragRef.current.lastY = y; nz = target.z - dy * (radius / 400); }
          onDragTarget({ x: hit[0], y: hit[1], z: nz });
        }
        return;
      }

      if (dragRef.current.type === "box") {
        const hit = intersectRayPlaneZ(origin, dir, box.center.z);
        if (hit) {
          let nz = box.center.z;
          if (e.altKey) { const dy = y - dragRef.current.lastY; dragRef.current.lastY = y; nz = box.center.z - dy * (radius / 400); }
          onDragBox({ x: hit[0], y: hit[1], z: nz });
        }
      }
    };

    const onUp = () => { dragRef.current.type = null; };

    const onWheel = (e) => {
      if (!(interaction === "orbit" || interaction === "free")) return;
      e.preventDefault();
      setOrbit((o) => ({ ...o, radius: clamp(o.radius + e.deltaY * 6, 500, 60000) }));
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [interaction, base, target, box, setOrbit, pTarg.visible, pTarg.x, pTarg.y, pBox.visible, pBox.x, pBox.y, rectAllVisible, boxBounds, radius, cam, vp, onDragBase, onDragTarget, onRotateTarget, onDragBox, onRotateBox]);

  // Painter: sort faces by avg depth
  function drawBoxFaces() {
    const faces = BOX_FACES.map((idxs, iFace) => {
      const pts = idxs.map(i => boxProj[i]).filter(p => p.visible);
      if (pts.length !== 4) return null;
      const avgZ = pts.reduce((s, p) => s + p.z, 0) / 4;
      return { iFace, pts, avgZ };
    }).filter(Boolean);

    faces.sort((a, b) => b.avgZ - a.avgZ);

    const fills = ["#c7d2fe", "#bfdbfe", "#93c5fd", "#a5b4fc", "#60a5fa", "#93c5fd"];
    return faces.map(({ iFace, pts }) => {
      const poly = pts.map(p => `${p.x},${p.y}`).join(" ");
      return <polygon key={`boxf${iFace}`} points={poly} fill={fills[iFace % fills.length]} fillOpacity={0.65} stroke={UI.blue} strokeWidth={1.5} />;
    });
  }

  // Grid floor
  const grid = (() => {
    const lines = [], L = 6000, step = 500;
    for (let x = -L; x <= L; x += step) lines.push(<Segment key={`gx${x}`} a={[x, -L, 0]} b={[x, L, 0]} cam={cam} vp={vp} stroke="#e5e7eb" />);
    for (let y = -L; y <= L; y += step) lines.push(<Segment key={`gy${y}`} a={[-L, y, 0]} b={[L, y, 0]} cam={cam} vp={vp} stroke="#e5e7eb" />);
    return lines;
  })();

  return (
    <svg ref={svgRef} width={width} height={height} style={{ display: "block", background: "#fff", userSelect: "none" }}>
      {grid}

      {/* Axes */}
      <Segment a={[0, 0, 0]} b={[2000, 0, 0]} cam={cam} vp={vp} stroke="#ef4444" width={2} />
      <Segment a={[0, 0, 0]} b={[0, 2000, 0]} cam={cam} vp={vp} stroke="#10b981" width={2} />
      <Segment a={[0, 0, 0]} b={[0, 0, 2000]} cam={cam} vp={vp} stroke="#3b82f6" width={2} />

      {/* Base */}
      {pBase.visible && <circle cx={pBase.x} cy={pBase.y} r={Math.max(2, 60 * pBase.scale)} fill={UI.green} />}

      {/* Box */}
      {drawBoxFaces()}
      {pBox.visible && (
        <>
          <circle cx={pBox.x} cy={pBox.y} r={Math.max(2, 48 * pBox.scale)} fill={UI.blueLite} stroke={UI.blue} />
          {(interaction === "rotateBox" || interaction === "free") && (() => {
            const r = Math.max(40, 150 * pBox.scale);
            return (
              <g>
                <circle cx={pBox.x} cy={pBox.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                <circle cx={pBox.x + 2.2 * r} cy={pBox.y} r={10} fill={UI.red} />
                <text x={pBox.x + 2.2 * r} y={pBox.y - 16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                <circle cx={pBox.x - 2.2 * r} cy={pBox.y} r={10} fill={UI.green} />
                <text x={pBox.x - 2.2 * r} y={pBox.y - 16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                <text x={pBox.x} y={pBox.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
              </g>
            );
          })()}
        </>
      )}

      {/* Target rectangle */}
      {(() => {
        const pc2 = corners.map(c => projectPoint(c, cam, vp));
        if (pc2.every(p => p.visible)) {
          return <polygon points={pc2.map(p => `${p.x},${p.y}`).join(" ")} fill="#fde047" stroke="#eab308" strokeWidth={2} />;
        }
        return null;
      })()}

      {/* Centers + base->target line */}
      {pBase.visible && pTarg.visible && (
        <>
          <circle cx={pTarg.x} cy={pTarg.y} r={Math.max(2, 55 * pTarg.scale)} fill="#facc15" stroke="#eab308" />
          <line x1={pBase.x} y1={pBase.y} x2={pTarg.x} y2={pTarg.y} stroke="#0284c7" strokeWidth={2} />
        </>
      )}

      {/* Target rotation handles */}
      {(interaction === "rotateTarget" || interaction === "free") && pTarg.visible && (
        <g>
          {(() => {
            const r = Math.max(40, 150 * pTarg.scale);
            return (
              <>
                <circle cx={pTarg.x} cy={pTarg.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                <circle cx={pTarg.x + 2.2 * r} cy={pTarg.y} r={10} fill={UI.red} />
                <text x={pTarg.x + 2.2 * r} y={pTarg.y - 16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                <circle cx={pTarg.x - 2.2 * r} cy={pTarg.y} r={10} fill={UI.green} />
                <text x={pTarg.x - 2.2 * r} y={pTarg.y - 16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                <text x={pTarg.x} y={pTarg.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// ===================== Physics helpers =====================
function computeBase(D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, betaDeg) {
  const D1Cx = D1Lx + (D1Rx - D1Lx) / 2;
  const D1Cy = D1Ly + (D1Ry - D1Ly) / 2;
  const b = deg2rad(betaDeg);
  const cb = Math.cos(b), sb = Math.sin(b);

  const baseX = D1Cx + (FLRx * cb - FLRy * sb);
  const baseY = D1Cy + (FLRx * sb + FLRy * cb);
  const baseZ = FLRz;

  return { D1Cx, D1Cy, baseX, baseY, baseZ };
}

// η = eps - alpha (azimut), θ = thetaDeg (polaire, 0° = +Z)
function computeRay(epsDeg, alphaDeg, thetaDeg) {
  const eta = epsDeg - alphaDeg;
  const etaRad = deg2rad(eta);
  const theta = deg2rad(thetaDeg);
  const sθ = Math.sin(theta), cθ = Math.cos(theta);
  const cη = Math.cos(etaRad), sη = Math.sin(etaRad);
  return { rx: cη * sθ, ry: sη * sθ, rz: cθ, eta, etaRad };
}

function computeTarget(base, ray, V) {
  return { Xt: base.baseX + V * ray.rx, Yt: base.baseY + V * ray.ry, Zt: base.baseZ + V * ray.rz };
}

function computeOutputAngles(base, target, alphaDeg) {
  const dx = target.x - base.x;
  const dy = target.y - base.y;
  const dz = target.z - base.z;
  const Vout = Math.hypot(dx, dy, dz);
  if (Vout < 1e-12) return { V: 0, etaDeg: 0, thetaDeg: 0, elevDeg: 0, epsDeg: alphaDeg, valid: false };

  const eta = Math.atan2(dy, dx);
  const cosθ = clamp(dz / Vout, -1, 1);
  const theta = Math.acos(cosθ);
  const elev = (Math.PI / 2) - theta;

  const etaDeg = rad2deg(eta);
  const thetaDeg = rad2deg(theta);
  const elevDeg = rad2deg(elev);
  const epsDeg = etaDeg + alphaDeg; // η = ε - α

  return { V: Vout, etaDeg, thetaDeg, elevDeg, epsDeg, valid: true };
}

function SelfTests({ base, target, V, useAngles, ray }) {
  const ok1 = useAngles ? (Math.abs(Math.hypot(ray.rx, ray.ry, ray.rz) - 1) < 1e-9) : true;
  const dx = target.x - base.x, dy = target.y - base.y, dz = target.z - base.z;
  const dist = Math.hypot(dx, dy, dz);
  const ok2 = useAngles ? (Math.abs(dist - V) < 1e-6) : true;

  const rc = computeRay(0, 0, 90);   // -> (1,0,0)
  const rUp = computeRay(0, 0, 0);   // -> (0,0,1)
  const rDown = computeRay(0, 0, 180); // -> (0,0,-1)
  const rY = computeRay(90, 0, 90);  // -> (0,1,0)

  const ok3 = Math.abs(rc.rx - 1) < 1e-9 && Math.abs(rc.ry) < 1e-9 && Math.abs(rc.rz) < 1e-9;
  const ok4 = Math.abs(rUp.rx) < 1e-9 && Math.abs(rUp.ry) < 1e-9 && Math.abs(rUp.rz - 1) < 1e-9;
  const ok5 = Math.abs(rDown.rx) < 1e-9 && Math.abs(rDown.ry) < 1e-9 && Math.abs(rDown.rz + 1) < 1e-9;
  const ok6 = Math.abs(rY.rx) < 1e-9 && Math.abs(rY.ry - 1) < 1e-9 && Math.abs(rY.rz) < 1e-9;

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>Tests intégrés</div>
      <div style={{ fontSize: 12, color: ok1 ? "#065f46" : "#991b1b" }}>‣ |r|≈1 (angles) : {ok1 ? "OK" : "KO"}</div>
      <div style={{ fontSize: 12, color: ok2 ? "#065f46" : "#991b1b" }}>‣ ||base→cible|| : {useAngles ? (ok2 ? "V OK" : "V KO") : dist.toFixed(3)}</div>
      <div style={{ fontSize: 12, color: ok3 ? "#065f46" : "#991b1b" }}>‣ r(η=0°,θ=90°)≈(1,0,0) : {ok3 ? "OK" : "KO"}</div>
      <div style={{ fontSize: 12, color: ok4 ? "#065f46" : "#991b1b" }}>‣ r(θ=0°)≈(0,0,1) : {ok4 ? "OK" : "KO"}</div>
      <div style={{ fontSize: 12, color: ok5 ? "#065f46" : "#991b1b" }}>‣ r(θ=180°)≈(0,0,-1) : {ok5 ? "OK" : "KO"}</div>
      <div style={{ fontSize: 12, color: ok6 ? "#065f46" : "#991b1b" }}>‣ r(η=90°,θ=90°)≈(0,1,0) : {ok6 ? "OK" : "KO"}</div>
    </div>
  );
}

// ===================== SplitPane =====================
function SplitPane({ left, right, initial = 380, min = 280, max = 640 }) {
  const [lw, setLw] = React.useState(() => {
    const saved = localStorage.getItem("split:left");
    return saved ? Number(saved) : initial;
  });
  const dragging = React.useRef(false);

  React.useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const w = Math.max(min, Math.min(max, e.clientX));
      setLw(w);
      localStorage.setItem("split:left", String(w));
    };
    const onUp = () => {
      if (dragging.current) { dragging.current = false; document.body.style.cursor = ""; }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [min, max]);

  return (
    <div style={S.splitWrap}>
      <div style={{ ...S.left, width: lw }}>{left}</div>
      <div
        style={S.splitter}
        onMouseDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; }}
        title="Glisser pour redimensionner"
      />
      <div style={S.right}>{right()}</div>
    </div>
  );
}

// ===================== Main component =====================
export default function Simulation3D_UXClean() {
  // --- Initial values (constants)
  const INIT = React.useMemo(() => ({
    FLRx: 5638, FLRy: 0, FLRz: 0,
    D1Lx: -4300, D1Ly: 1245, D1Rx: -4300, D1Ry: -1255,
    beta: 0, alpha: 0, crabAngle: 0, zeta: 90, V: 1000,
  }), []);

  // Angles phys.
  const [FLRx, setFLRx] = React.useState(INIT.FLRx);
  const [FLRy, setFLRy] = React.useState(INIT.FLRy);
  const [FLRz, setFLRz] = React.useState(INIT.FLRz);

  const [D1Lx, setD1Lx] = React.useState(INIT.D1Lx);
  const [D1Ly, setD1Ly] = React.useState(INIT.D1Ly);
  const [D1Rx, setD1Rx] = React.useState(INIT.D1Rx);
  const [D1Ry, setD1Ry] = React.useState(INIT.D1Ry);

  const [alpha, setAlpha] = React.useState(INIT.alpha); // minutes d'arc
  const [crabAngle, setCrabAngle] = React.useState(INIT.crabAngle);       // mm/m
  const crabAngleDeg = React.useMemo(() => crabMmPerMToDeg(crabAngle), [crabAngle]);
  const [zeta, setZeta] = React.useState(INIT.zeta);    // θ polaire (deg)
  const [beta, setBeta] = React.useState(INIT.beta);
  const [V, setV] = React.useState(INIT.V);

  // Mode positions
  const [ctrl, setCtrl] = React.useState("manuel"); // 'angles' | 'manuel'

  // Derived: angles mode
  const baseFromAngles = React.useMemo(
    () => computeBase(D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, beta),
    [D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, beta]
  );
  const rayAngles = React.useMemo(
    () => computeRay(crabAngleDeg, alpha / 60, zeta),
    [crabAngleDeg, alpha, zeta]
  );
  const targFromAngles = React.useMemo(
    () => computeTarget(baseFromAngles, rayAngles, V),
    [baseFromAngles, rayAngles, V]
  );

  // Manual positions: initialize from current angles
  const [baseM, setBaseM] = React.useState(() => ({ x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ }));
  const [targM, setTargM] = React.useState(() => ({ x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt }));

  const base = ctrl === "angles"
    ? { x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ }
    : baseM;

  const targ = ctrl === "angles"
    ? { x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt }
    : targM;

  // --- Yt formula vs sim
  const Yt_formula = React.useMemo(() =>
    (D1Ly + D1Ry) / 2
    + FLRx * Math.sin(deg2rad(beta))
    + FLRy * Math.cos(deg2rad(beta))
    + V * Math.sin(deg2rad(crabAngleDeg - alpha / 60)) * Math.sin(deg2rad(zeta)),
    [D1Ly, D1Ry, FLRx, FLRy, beta, V, crabAngleDeg, alpha, zeta]
  );
  const Yt_sim = targ.y;
  const dYt = Yt_sim - Yt_formula;

  // Rectangle target (orientation + size)
  const [rectYaw, setRectYaw] = React.useState(0);
  const [rectPitch, setRectPitch] = React.useState(0);
  const [rectRoll, setRectRoll] = React.useState(0);
  const [rectW, setRectW] = React.useState(800);
  const [rectH, setRectH] = React.useState(300);

  const rect = React.useMemo(() => ({
    w: rectW, h: rectH,
    yaw: deg2rad(rectYaw),
    pitch: deg2rad(rectPitch),
    roll: deg2rad(rectRoll),
  }), [rectW, rectH, rectYaw, rectPitch, rectRoll]);

  // Box 3D
  const [boxPos, setBoxPos] = React.useState({ x: 1000, y: 0, z: 400 });
  const [boxYaw, setBoxYaw] = React.useState(15);
  const [boxPitch, setBoxPitch] = React.useState(-5);
  const [boxRoll, setBoxRoll] = React.useState(10);
  const [boxSX, setBoxSX] = React.useState(900);
  const [boxSY, setBoxSY] = React.useState(600);
  const [boxSZ, setBoxSZ] = React.useState(500);

  const box = React.useMemo(() => ({
    center: boxPos,
    geom: { sx: boxSX, sy: boxSY, sz: boxSZ, yaw: deg2rad(boxYaw), pitch: deg2rad(boxPitch), roll: deg2rad(boxRoll) },
  }), [boxPos, boxSX, boxSY, boxSZ, boxYaw, boxPitch, boxRoll]);

  // View size (auto)
  const [viewW, setViewW] = React.useState(1200);
  const [viewH, setViewH] = React.useState(700);
  const [orbit, setOrbit] = React.useState({ yaw: 0.6, pitch: 0.45, radius: 9000 });

  const simRef = React.useRef(null);
  React.useEffect(() => {
    if (!simRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      setViewW(Math.max(300, cr.width));
      setViewH(Math.max(300, cr.height));
    });
    ro.observe(simRef.current);
    return () => ro.disconnect();
  }, []);

  const [interaction, setInteraction] = React.useState("free"); // 'free'|'orbit'|'moveBase'|'moveTarget'|'rotateTarget'|'moveBox'|'rotateBox'

  const onDragBase = React.useCallback((p) => { setCtrl("manuel"); setBaseM(p); }, []);
  const onDragTarget = React.useCallback((p) => { setCtrl("manuel"); setTargM(p); }, []);
  const onRotateTarget = React.useCallback(({ dyaw = 0, dpitch = 0, droll = 0 }) => {
    setRectYaw(a => a + dyaw);
    setRectPitch(a => clamp(a + dpitch, -89, 89));
    setRectRoll(a => a + droll);
  }, []);
  const onDragBox = React.useCallback((p) => { setBoxPos(p); }, []);
  const onRotateBox = React.useCallback(({ dyaw = 0, dpitch = 0, droll = 0 }) => {
    setBoxYaw(a => a + dyaw);
    setBoxPitch(a => clamp(a + dpitch, -89, 89));
    setBoxRoll(a => a + droll);
  }, []);

  
  // Output angles computed from visible positions
  const outAngles = React.useMemo(() => computeOutputAngles(base, targ, alpha / 60), [base, targ, alpha]);

  // ===================== Excel Import/Export =====================
  const fileInputRef = React.useRef(null);
  const [batchRows, setBatchRows] = React.useState([]); // rows imported from "wide table" (like your DATA.xlsx)

  // Map of editable params (key/value sheet)
  const PARAMS = React.useMemo(() => ({
    FLRx: { get: () => FLRx, set: setFLRx },
    FLRy: { get: () => FLRy, set: setFLRy },
    FLRz: { get: () => FLRz, set: setFLRz },

    D1Lx: { get: () => D1Lx, set: setD1Lx },
    D1Ly: { get: () => D1Ly, set: setD1Ly },
    D1Rx: { get: () => D1Rx, set: setD1Rx },
    D1Ry: { get: () => D1Ry, set: setD1Ry },

    beta: { get: () => beta, set: setBeta },
    alpha: { get: () => alpha, set: setAlpha }, // minutes
    crabAngle: { get: () => crabAngle, set: setCrabAngle }, // mm/m
    zeta: { get: () => zeta, set: setZeta },    // degrees
    V: { get: () => V, set: setV },

    ctrl: { get: () => ctrl, set: (v) => setCtrl(String(v)) },

    "baseM.x": { get: () => baseM.x, set: (v) => setBaseM(p => ({ ...p, x: v })) },
    "baseM.y": { get: () => baseM.y, set: (v) => setBaseM(p => ({ ...p, y: v })) },
    "baseM.z": { get: () => baseM.z, set: (v) => setBaseM(p => ({ ...p, z: v })) },

    "targM.x": { get: () => targM.x, set: (v) => setTargM(p => ({ ...p, x: v })) },
    "targM.y": { get: () => targM.y, set: (v) => setTargM(p => ({ ...p, y: v })) },
    "targM.z": { get: () => targM.z, set: (v) => setTargM(p => ({ ...p, z: v })) },

    rectW: { get: () => rectW, set: setRectW },
    rectH: { get: () => rectH, set: setRectH },
    rectYaw: { get: () => rectYaw, set: setRectYaw },
    rectPitch: { get: () => rectPitch, set: setRectPitch },
    rectRoll: { get: () => rectRoll, set: setRectRoll },

    boxYaw: { get: () => boxYaw, set: setBoxYaw },
    boxPitch: { get: () => boxPitch, set: setBoxPitch },
    boxRoll: { get: () => boxRoll, set: setBoxRoll },
    boxSX: { get: () => boxSX, set: setBoxSX },
    boxSY: { get: () => boxSY, set: setBoxSY },
    boxSZ: { get: () => boxSZ, set: setBoxSZ },
    "boxPos.x": { get: () => boxPos.x, set: (v) => setBoxPos(p => ({ ...p, x: v })) },
    "boxPos.y": { get: () => boxPos.y, set: (v) => setBoxPos(p => ({ ...p, y: v })) },
    "boxPos.z": { get: () => boxPos.z, set: (v) => setBoxPos(p => ({ ...p, z: v })) },
  }), [
    FLRx, FLRy, FLRz,
    D1Lx, D1Ly, D1Rx, D1Ry,
    beta, alpha, crabAngle, zeta, V,
    ctrl,
    baseM, targM,
    rectW, rectH, rectYaw, rectPitch, rectRoll,
    boxYaw, boxPitch, boxRoll, boxSX, boxSY, boxSZ, boxPos
  ]);

  function exportExcelSingle() {
    const inputsRows = Object.entries(PARAMS).map(([key, io]) => ({ key, value: io.get() }));

    const outputsRows = [
      { key: "base.x", value: base.x }, { key: "base.y", value: base.y }, { key: "base.z", value: base.z },
      { key: "targ.x", value: targ.x }, { key: "targ.y", value: targ.y }, { key: "targ.z", value: targ.z },
      { key: "Yt_formula", value: Yt_formula },
      { key: "Yt_sim", value: Yt_sim },
      { key: "dYt", value: dYt },
      { key: "out.V", value: outAngles.V },
      { key: "out.etaDeg", value: outAngles.etaDeg },
      { key: "out.thetaDeg", value: outAngles.thetaDeg },
      { key: "out.elevDeg", value: outAngles.elevDeg },
      { key: "out.epsDeg", value: outAngles.epsDeg },
      { key: "alpha_deg", value: alpha / 60 },
    ];

    const wb = XLSX.utils.book_new();
    const wsIn = XLSX.utils.json_to_sheet(inputsRows, { header: ["key", "value"] });
    const wsOut = XLSX.utils.json_to_sheet(outputsRows, { header: ["key", "value"] });

    XLSX.utils.book_append_sheet(wb, wsIn, "Inputs");
    XLSX.utils.book_append_sheet(wb, wsOut, "Outputs");

    XLSX.writeFile(wb, "simulation_io.xlsx");
  }

  function computeFromRow(row) {
    // Mapping "DATA.xlsx"-style columns -> simulator parameters
    // - D1R_x/y, D1L_x/y -> D1Rx/D1Ry/D1Lx/D1Ly
    // - SymmetryAngle -> beta (deg)  (optional)
    // - DriveAngle -> alphaDeg (deg) -> alphaMinutes = deg*60 (optional)
    // - CrabAngle -> crabAngle (mm/m)
    // - If DriveAngle AND SymmetryAngle are missing: compute alpha then beta:
    //   alpha = atan((D1R.x - D1L.x) / (D1R.y - D1L.y))
    //   beta  = alpha - crabAngle
    // - FrV -> V
    // - Zr -> FLRz (if present)
    // - Xr -> zeta (if present)

    const D1Rx_ = safeNum(row.D1R_x, D1Rx);
    const D1Ry_ = safeNum(row.D1R_y, D1Ry);
    const D1Lx_ = safeNum(row.D1L_x, D1Lx);
    const D1Ly_ = safeNum(row.D1L_y, D1Ly);

    const crabMm_ = safeNum(row.CrabAngle, crabAngle);        // mm/m
    const crabDeg_ = crabMmPerMToDeg(crabMm_);                // degrees

    const hasDrive = row.DriveAngle !== undefined && row.DriveAngle !== null && row.DriveAngle !== "";
    const hasSym   = row.SymmetryAngle !== undefined && row.SymmetryAngle !== null && row.SymmetryAngle !== "";

    let alphaDeg_;
    let beta_;

    if (!hasDrive && !hasSym) {
      alphaDeg_ = rad2deg(Math.atan2((D1Rx_ - D1Lx_), (D1Ry_ - D1Ly_)));
      beta_ = alphaDeg_ - crabDeg_;
    } else {
      beta_ = safeNum(row.SymmetryAngle, beta);
      alphaDeg_ = safeNum(row.DriveAngle, alpha / 60);
    }

    const alphaMin_ = alphaDeg_ * 60;

    const V_ = safeNum(row.FrV, V);
    const FLRz_ = (row.Zr !== undefined && row.Zr !== null && row.Zr !== "") ? safeNum(row.Zr, FLRz) : FLRz;
    const zeta_ = (row.Xr !== undefined && row.Xr !== null && row.Xr !== "") ? safeNum(row.Xr, zeta) : zeta;

    const baseObj = computeBase(D1Lx_, D1Ly_, D1Rx_, D1Ry_, FLRx, FLRy, FLRz_, beta_);
    const rayObj = computeRay(crabDeg_, alphaDeg_, zeta_);
    const targObj = computeTarget(baseObj, rayObj, V_);

    const baseM = { x: baseObj.baseX, y: baseObj.baseY, z: baseObj.baseZ };
    const targM = { x: targObj.Xt, y: targObj.Yt, z: targObj.Zt };
    const out = computeOutputAngles(baseM, targM, alphaDeg_);

    const Yt_formula_row =
      (D1Ly_ + D1Ry_) / 2
      + FLRx * Math.sin(deg2rad(beta_))
      + FLRy * Math.cos(deg2rad(beta_))
      + V_ * Math.sin(deg2rad(crabDeg_ - alphaDeg_)) * Math.sin(deg2rad(zeta_));

    return {
      // normalized inputs
      D1R_x: D1Rx_, D1R_y: D1Ry_, D1L_x: D1Lx_, D1L_y: D1Ly_,
      CrabAngle: crabMm_,
      CrabAngle_deg: crabDeg_,
      DriveAngle: alphaDeg_,
      SymmetryAngle: beta_,
      FrV: V_,
      Zr: FLRz_,
      Xr: zeta_,

      // computed
      alpha_min: alphaMin_,
      base_x: baseM.x, base_y: baseM.y, base_z: baseM.z,
      Xt: targM.x, Yt: targM.y, Zt: targM.z,
      Yt_formula: Yt_formula_row,
      dYt: (targM.y - Yt_formula_row),

      out_V: out.V,
      out_etaDeg: out.etaDeg,
      out_thetaDeg: out.thetaDeg,
      out_elevDeg: out.elevDeg,
      out_epsDeg: out.epsDeg,
    };
  }

  function exportExcelBatch() {
    if (!batchRows || batchRows.length === 0) return;

    const computed = batchRows.map((r, i) => {
      const out = computeFromRow(r);
      return { idx: i + 1, ...r, ...out };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(computed);
    XLSX.utils.book_append_sheet(wb, ws, "BatchOutputs");
    XLSX.writeFile(wb, "simulation_batch_outputs.xlsx");
  }

  async function importExcel(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const ws = wb.Sheets["Inputs"] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) return;

    // Detect format:
    // 1) key/value list (expects columns key,value)
    // 2) wide table (your DATA.xlsx style: D1R_x, D1R_y, ...)
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const hasKeyValue = rows.length > 0 && (
      Object.prototype.hasOwnProperty.call(rows[0], "key") ||
      Object.prototype.hasOwnProperty.call(rows[0], "Key") ||
      Object.prototype.hasOwnProperty.call(rows[0], "param") ||
      Object.prototype.hasOwnProperty.call(rows[0], "Param")
    );

    const isWide = rows.length > 0 && (
      Object.prototype.hasOwnProperty.call(rows[0], "D1R_x") ||
      Object.prototype.hasOwnProperty.call(rows[0], "D1R_y") ||
      Object.prototype.hasOwnProperty.call(rows[0], "D1L_x") ||
      Object.prototype.hasOwnProperty.call(rows[0], "D1L_y")
    );

    if (hasKeyValue) {
      // KEY/VALUE import
      setBatchRows([]);
      for (const r of rows) {
        const key = String(r.key ?? r.Key ?? r.param ?? r.Param ?? "").trim();
        if (!key) continue;

        const io = PARAMS[key];
        if (!io) continue;

        if (key === "ctrl") {
          io.set(String(r.value ?? "").trim());
        } else {
          io.set(safeNum(r.value, io.get()));
        }
      }
      return;
    }

    if (isWide) {
      // WIDE import (batch)
      const filtered = rows.filter(r => {
        // ignore header / blank-ish rows if any
        const k = Object.keys(r || {});
        if (k.length === 0) return false;
        // if first col is a label like "INPUT", skip it
        if (String(r.D1R_x ?? "").toUpperCase() === "INPUT") return false;
        return true;
      });

      setBatchRows(filtered);

      // Also set current UI to the first row so you can preview in the sim
      const r0 = filtered[0];
      if (r0) {
        setCtrl("angles");

        setD1Rx(safeNum(r0.D1R_x, D1Rx));
        setD1Ry(safeNum(r0.D1R_y, D1Ry));
        setD1Lx(safeNum(r0.D1L_x, D1Lx));
        setD1Ly(safeNum(r0.D1L_y, D1Ly));

        setCrabAngle(safeNum(r0.CrabAngle, crabAngle));

        const hasDrive = r0.DriveAngle !== undefined && r0.DriveAngle !== null && r0.DriveAngle !== "";
        const hasSym   = r0.SymmetryAngle !== undefined && r0.SymmetryAngle !== null && r0.SymmetryAngle !== "";

        if (!hasDrive && !hasSym) {
          const D1Rx_ = safeNum(r0.D1R_x, D1Rx);
          const D1Ry_ = safeNum(r0.D1R_y, D1Ry);
          const D1Lx_ = safeNum(r0.D1L_x, D1Lx);
          const D1Ly_ = safeNum(r0.D1L_y, D1Ly);

          const crabDeg_ = crabMmPerMToDeg(safeNum(r0.CrabAngle, crabAngle));
          const alphaDeg_ = rad2deg(Math.atan2((D1Rx_ - D1Lx_), (D1Ry_ - D1Ly_)));
          const beta_ = alphaDeg_ - crabDeg_;

          setAlpha(alphaDeg_ * 60);
          setBeta(beta_);
        } else {
          setBeta(safeNum(r0.SymmetryAngle, beta));
          const alphaDeg_ = safeNum(r0.DriveAngle, alpha / 60);
          setAlpha(alphaDeg_ * 60);
        }

        setV(safeNum(r0.FrV, V));

        if (r0.Zr !== undefined && r0.Zr !== null && r0.Zr !== "") setFLRz(safeNum(r0.Zr, FLRz));
        if (r0.Xr !== undefined && r0.Xr !== null && r0.Xr !== "") setZeta(safeNum(r0.Xr, zeta));
      }
      return;
    }

    // fallback: try key/value-like from first two columns (rare)
    setBatchRows([]);
  }

  // ===================== /Excel Import/Export =====================

  const LeftPanel = (
    <div style={S.pad}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 2 }}>Settings</div>

        <div style={S.card}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>Yt — comparaison</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
            <div>Yt (formule) = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{Yt_formula.toFixed(3)}</span></div>
            <div>Yt (simulation) = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{Yt_sim.toFixed(3)}</span></div>
            <div>ΔYt = <span style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              color: Math.abs(dYt) < 1e-6 ? "#065f46" : "#991b1b"
            }}>{dYt.toFixed(6)}</span></div>
          </div>
          <div style={{ fontSize: 11, color: UI.subtext, marginTop: 6 }}>
            {ctrl === "manuel"
              ? "Note : en mode Manuel, un écart est normal si la cible n'est pas pilotée par les angles."
              : "En mode Angles, ΔYt devrait être ~0."}
          </div>
          {batchRows.length > 0 && (
            <div style={{ fontSize: 11, color: UI.subtext, marginTop: 6 }}>
              Batch chargé : {batchRows.length} lignes (Exporter Batch pour générer un fichier complet).
            </div>
          )}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.hGroup}>
          <span style={S.badge}>Positions :</span>
          <SegButton active={ctrl === "angles"} onClick={() => setCtrl("angles")}>Angles</SegButton>
          <SegButton active={ctrl === "manuel"} onClick={() => setCtrl("manuel")}>Manuel</SegButton>
        </div>
        <div style={{ height: 8 }} />
        <div style={S.hGroup}>
          <span style={S.badge}>Interaction :</span>
          <SegButton active={interaction === "free"} onClick={() => setInteraction("free")}>Libre</SegButton>
          <SegButton active={interaction === "orbit"} onClick={() => setInteraction("orbit")}>Orbite</SegButton>
          <SegButton active={interaction === "moveBase"} onClick={() => setInteraction("moveBase")}>Base</SegButton>
          <SegButton active={interaction === "moveTarget"} onClick={() => setInteraction("moveTarget")}>Cible</SegButton>
          <SegButton active={interaction === "rotateTarget"} onClick={() => setInteraction("rotateTarget")}>Rot. Cible</SegButton>
          <SegButton active={interaction === "moveBox"} onClick={() => setInteraction("moveBox")}>Boîte</SegButton>
          <SegButton active={interaction === "rotateBox"} onClick={() => setInteraction("rotateBox")}>Rot. Boîte</SegButton>
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
          <SliderRow label="α drive [′]" value={alpha} onChange={setAlpha} min={-10800} max={10800} step={0.01} />
          <SliderRow
              label="CrabAngle [mm/m]"
              value={crabAngle}
              onChange={setCrabAngle}
              min={-5000}
              max={5000}
              step={0.01}
              unit=" mm/m"
              extra={`(${crabAngleDeg.toFixed(4)}°)`}
            />
          <SliderRow label="θ (polaire) [°]" value={zeta} onChange={setZeta} min={0} max={180} step={0.01} />
          <SliderRow label="V" value={V} onChange={setV} min={0} max={20000} step={0.001} />
        </div>
      </Section>

      <Section title="Positions – Mode Manuel" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Base X" value={baseM.x} onChange={(v) => { setCtrl("manuel"); setBaseM({ ...baseM, x: v }); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Y" value={baseM.y} onChange={(v) => { setCtrl("manuel"); setBaseM({ ...baseM, y: v }); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Z" value={baseM.z} onChange={(v) => { setCtrl("manuel"); setBaseM({ ...baseM, z: v }); }} min={-5000} max={5000} step={0.01} />

          <SliderRow label="Cible X" value={targM.x} onChange={(v) => { setCtrl("manuel"); setTargM({ ...targM, x: v }); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Y" value={targM.y} onChange={(v) => { setCtrl("manuel"); setTargM({ ...targM, y: v }); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Z" value={targM.z} onChange={(v) => { setCtrl("manuel"); setTargM({ ...targM, z: v }); }} min={-5000} max={5000} step={0.01} />
        </div>
      </Section>

      <SelfTests base={base} target={targ} V={V} useAngles={ctrl === "angles"} ray={rayAngles} />

      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, color: "#92400e" }}>Sorties (monde)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
          <div>Xt = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{targ.x.toFixed(3)}</span></div>
          <div>Yt = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{targ.y.toFixed(3)}</span></div>
          <div>Zt = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{targ.z.toFixed(3)}</span></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, color: "#1f2937" }}>Angles (sortie)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, fontSize: 12 }}>
          <div>η = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{outAngles.etaDeg.toFixed(2)}°</span></div>
          <div>θ = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{outAngles.thetaDeg.toFixed(2)}°</span></div>
          <div>Élév. = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{outAngles.elevDeg.toFixed(2)}°</span></div>
          <div>α = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{alpha.toFixed(2)}′</span> <span style={{ color: UI.subtext }}>({(alpha / 60).toFixed(4)}°)</span></div>
          <div>ε(calc) = <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{outAngles.epsDeg.toFixed(2)}°</span></div>
        </div>
        <div style={{ fontSize: 11, color: UI.subtext, marginTop: 6 }}>V (mesuré) = {outAngles.V.toFixed(3)}</div>
      </div>

      <Section title="Rectangle cible" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Rect W" value={rectW} onChange={setRectW} min={10} max={5000} step={1} />
          <SliderRow label="Rect H" value={rectH} onChange={setRectH} min={10} max={5000} step={1} />
          <SliderRow label="Yaw (°)" value={rectYaw} onChange={setRectYaw} min={-180} max={180} step={0.1} />
          <SliderRow label="Pitch (°)" value={rectPitch} onChange={setRectPitch} min={-89} max={89} step={0.1} />
          <SliderRow label="Roll (°)" value={rectRoll} onChange={setRectRoll} min={-180} max={180} step={0.1} />
        </div>
      </Section>

      <Section title="Boîte 3D" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Box X" value={boxPos.x} onChange={(v) => setBoxPos(p => ({ ...p, x: v }))} min={-20000} max={20000} step={1} />
          <SliderRow label="Box Y" value={boxPos.y} onChange={(v) => setBoxPos(p => ({ ...p, y: v }))} min={-20000} max={20000} step={1} />
          <SliderRow label="Box Z" value={boxPos.z} onChange={(v) => setBoxPos(p => ({ ...p, z: v }))} min={-5000} max={5000} step={1} />

          <SliderRow label="Size X" value={boxSX} onChange={setBoxSX} min={10} max={10000} step={1} />
          <SliderRow label="Size Y" value={boxSY} onChange={setBoxSY} min={10} max={10000} step={1} />
          <SliderRow label="Size Z" value={boxSZ} onChange={setBoxSZ} min={10} max={10000} step={1} />

          <SliderRow label="Yaw (°)" value={boxYaw} onChange={setBoxYaw} min={-180} max={180} step={0.1} />
          <SliderRow label="Pitch (°)" value={boxPitch} onChange={setBoxPitch} min={-89} max={89} step={0.1} />
          <SliderRow label="Roll (°)" value={boxRoll} onChange={setBoxRoll} min={-180} max={180} step={0.1} />
        </div>
      </Section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={S.resetBtn}
          onClick={() => {
            setFLRx(INIT.FLRx); setFLRy(INIT.FLRy); setFLRz(INIT.FLRz);
            setD1Lx(INIT.D1Lx); setD1Ly(INIT.D1Ly); setD1Rx(INIT.D1Rx); setD1Ry(INIT.D1Ry);
            setBeta(INIT.beta); setAlpha(INIT.alpha); setCrabAngle(INIT.crabAngle); setZeta(INIT.zeta); setV(INIT.V);

            const b = computeBase(INIT.D1Lx, INIT.D1Ly, INIT.D1Rx, INIT.D1Ry, INIT.FLRx, INIT.FLRy, INIT.FLRz, INIT.beta);
            const r = computeRay(crabMmPerMToDeg(INIT.crabAngle), INIT.alpha / 60, INIT.zeta);
            const t = computeTarget(b, r, INIT.V);
            setBaseM({ x: b.baseX, y: b.baseY, z: b.baseZ });
            setTargM({ x: t.Xt, y: t.Yt, z: t.Zt });

            setCtrl("manuel");

            setRectYaw(0); setRectPitch(0); setRectRoll(0); setRectW(800); setRectH(300);

            setBoxPos({ x: 1000, y: 0, z: 400 });
            setBoxYaw(15); setBoxPitch(-5); setBoxRoll(10);
            setBoxSX(900); setBoxSY(600); setBoxSZ(500);

            setOrbit({ yaw: 0.6, pitch: 0.45, radius: 9000 });
            setInteraction("free");

            setBatchRows([]);
          }}
        >
          Réinitialiser
        </button>

        <button
          style={{ ...S.resetBtn, background: "#2563eb" }}
          onClick={() => fileInputRef.current?.click()}
        >
          Importer Excel
        </button>

        <button
          style={{ ...S.resetBtn, background: "#10b981" }}
          onClick={exportExcelSingle}
        >
          Exporter Excel
        </button>

        <button
          style={{ ...S.resetBtn, background: batchRows.length ? "#7c3aed" : "#9ca3af", cursor: batchRows.length ? "pointer" : "not-allowed" }}
          onClick={() => { if (batchRows.length) exportExcelBatch(); }}
          title={batchRows.length ? "Génère un fichier pour toutes les lignes importées" : "Importe un fichier type DATA.xlsx pour activer"}
        >
          Exporter Batch
        </button>



        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importExcel(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );

  return (
    <SplitPane
      left={LeftPanel}
      right={() => (
        <div ref={simRef} style={{ width: "100%", height: "100%" }}>
          <SceneSVG
            width={viewW}
            height={viewH}
            orbit={orbit}
            setOrbit={setOrbit}
            base={base}
            target={targ}
            rect={rect}
            box={box}
            interaction={interaction}
            onDragBase={onDragBase}
            onDragTarget={onDragTarget}
            onRotateTarget={onRotateTarget}
            onDragBox={onDragBox}
            onRotateBox={onRotateBox}
          />
        </div>
      )}
    />
  );
}


