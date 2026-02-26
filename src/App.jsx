import * as React from "react";
import * as XLSX from "xlsx";
import * as THREE from "three";

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
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function safeNum(v, fallback=0) {
  const n = typeof v === "string" ? Number(v.toString().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// UI Colors and styles
const UI = {
  subtext: "#6b7280",
  green: "rgba(16,185,129,0.95)",
  blue: "#0284c7",
  blueLite: "rgba(2,132,199,0.6)",
  red: "rgba(239,68,68,0.9)",
  accent: "#4f46e5",
  accentLight: "#e0e7ff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  bgLight: "#f9fafb",
  bgWhite: "#ffffff",
};

const S = {
  card: {
    padding: "16px",
    backgroundColor: UI.bgWhite,
    border: `1px solid ${UI.border}`,
    borderRadius: "12px",
    marginBottom: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    transition: "all 0.2s ease",
  },
  cardHover: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    borderColor: UI.accent,
  },
  pad: {
    padding: "16px",
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: UI.textPrimary,
    letterSpacing: "0.5px",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  hGroup: {
    display: "flex",
    gap: "10px",
    marginBottom: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    backgroundColor: UI.accentLight,
    color: UI.accent,
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 600,
    marginRight: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  resetBtn: {
    padding: "10px 16px",
    backgroundColor: UI.accent,
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    flexGrow: 1,
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.2)",
  },
  resetBtnHover: {
    backgroundColor: "#4338ca",
    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
    transform: "translateY(-1px)",
  },
  splitWrap: {
    display: "flex",
    height: "100vh",
    backgroundColor: UI.bgWhite,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  left: {
    flex: "0 0 auto",
    overflowY: "auto",
    borderRight: `1px solid ${UI.border}`,
    backgroundColor: UI.bgLight,
    width: "380px",
  },
  splitter: {
    width: "1px",
    backgroundColor: UI.border,
    cursor: "col-resize",
    userSelect: "none",
    transition: "background-color 0.2s",
    "&:hover": {
      backgroundColor: UI.accent,
    },
  },
  right: {
    flex: "1 1 auto",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    backgroundColor: UI.bgWhite,
  },
};

function SliderRow({ label, value, min= -5000, max=5000, step=1, onChange, unit="" }) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div style={{
      ...S.card,
      padding: "14px",
      background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px"}}>
        <label style={{fontSize:"13px", fontWeight:600, color: UI.textPrimary, letterSpacing:"0.3px"}}>{label}</label>
        <span style={{fontSize:"12px", color: UI.accent, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:600}}>{value.toFixed(2)}{unit}</span>
      </div>
      <div style={{position:"relative", marginBottom:"8px"}}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width:"100%",
            height:"6px",
            borderRadius:"3px",
            background: `linear-gradient(to right, ${UI.accent} 0%, ${UI.accent} ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
            outline:"none",
            WebkitAppearance:"none",
            cursor:"pointer",
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            WebkitAppearance: none;
            width: 18px;
            height: 18px;
            borderRadius: 50%;
            background: ${UI.accent};
            cursor: pointer;
            boxShadow: 0 2px 6px rgba(79, 70, 229, 0.3);
            transition: all 0.2s;
          }
          input[type="range"]::-webkit-slider-thumb:hover {
            boxShadow: 0 4px 10px rgba(79, 70, 229, 0.5);
            transform: scale(1.1);
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            borderRadius: 50%;
            background: ${UI.accent};
            border: none;
            cursor: pointer;
            boxShadow: 0 2px 6px rgba(79, 70, 229, 0.3);
          }
        `}</style>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width:"100%",
          padding:"8px 10px",
          border: `1px solid ${UI.border}`,
          borderRadius:"6px",
          fontSize:"12px",
          color: UI.textPrimary,
          fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          transition:"border-color 0.2s",
          boxSizing:"border-box",
        }}
        onFocus={(e) => e.target.style.borderColor = UI.accent}
        onBlur={(e) => e.target.style.borderColor = UI.border}
      />
    </div>
  );
}

function SegButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        backgroundColor: active ? UI.accent : UI.border,
        color: active ? "white" : UI.textSecondary,
        border: "none",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: active ? `0 2px 8px rgba(79, 70, 229, 0.2)` : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.target.style.backgroundColor = "#d1d5db";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.target.style.backgroundColor = UI.border;
        }
      }}
    >
      {children}
    </button>
  );
}

function Canvas3D({ 
  basePos = { x: 0, y: 0, z: 0 }, 
  targetPos = { x: 1000, y: 0, z: 400 },
  boxPos = { x: 1000, y: 0, z: 400 },
  boxDims = { sx: 900, sy: 600, sz: 500 },
  boxRot = { yaw: 0, pitch: 0, roll: 0 },
  orbit = { yaw: 0.6, pitch: 0.45, radius: 3000 },
  outAngles = { etaDeg: 0, thetaDeg: 90, elevDeg: 0, V: 1000 },
}) {
  const containerRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const cameraRef = React.useRef(null);
  const rendererRef = React.useRef(null);
  const boxRef = React.useRef(null);
  



  // Interactive camera control state
  const cameraControlRef = React.useRef({
    yaw: orbit.yaw,
    pitch: orbit.pitch,
    radius: orbit.radius,
  });





  const dragStateRef = React.useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Sync camera control with orbit props
    cameraControlRef.current.yaw = orbit.yaw;
    cameraControlRef.current.pitch = orbit.pitch;
    cameraControlRef.current.radius = orbit.radius;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf9fafb);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5000, 4000, 3000);
    scene.add(directionalLight);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10000, 50, 0xcccccc, 0xeeeeee);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // ===== Angle visualization =====
    // Create torus segments to show azimuth (η) and elevation angles
    const angleRadius = 1500;
    


    // Azimuth arc (around base, in XY plane)
    const aziRadius = angleRadius;
    const aziTubeRadius = 30;
    const aziGeom = new THREE.TorusGeometry(aziRadius, aziTubeRadius, 16, 100);
    const aziMaterial = new THREE.MeshPhongMaterial({ color: 0x3b82f6, emissive: 0x1e40af, transparent: true, opacity: 0.6 });
    const aziTorus = new THREE.Mesh(aziGeom, aziMaterial);
    aziTorus.position.set(basePos.x, 0, basePos.y);
    aziTorus.rotation.x = Math.PI / 2; // Rotate to XY plane
    scene.add(aziTorus);
    
    // Direction line from base towards target (shows azimuth direction)
    const rayLength = Math.max(1000, outAngles.V || 1000);
    const rayDir = new THREE.Vector3(
      Math.cos(deg2rad(outAngles.etaDeg || 0)),
      0,
      Math.sin(deg2rad(outAngles.etaDeg || 0))
    ).normalize();
    const rayGeom = new THREE.BufferGeometry();
    rayGeom.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([
        basePos.x, basePos.z, basePos.y,
        basePos.x + rayDir.x * rayLength, basePos.z + rayDir.z * rayLength * 0.5, basePos.y + rayDir.z * rayLength
      ]),
      3
    ));
    const rayMaterial = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 4 });
    const rayLine = new THREE.Line(rayGeom, rayMaterial);
    scene.add(rayLine);
    
    // Elevation arc (showing polar angle θ)
    const elevRadius = angleRadius * 0.8;
    const elevTubeRadius = 30;
    const elevGeom = new THREE.TorusGeometry(elevRadius, elevTubeRadius, 16, 100);
    const elevMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x059669, transparent: true, opacity: 0.6 });
    const elevTorus = new THREE.Mesh(elevGeom, elevMaterial);
    elevTorus.position.set(basePos.x, basePos.z, basePos.y);
    // Rotate to show elevation plane (YZ plane relative to direction)
    const etaRad = deg2rad(outAngles.etaDeg || 0);
    elevTorus.rotation.z = etaRad;
    scene.add(elevTorus);

    // Create angle labels using canvas texture
    function createTextTexture(text, color = '#fff') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'Bold 48px Arial';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }

    // Azimuth label
    const aziLabelGeom = new THREE.PlaneGeometry(400, 200);
    const aziLabelTex = createTextTexture(`η = ${outAngles.etaDeg.toFixed(1)}°`, '#0284c7');
    const aziLabelMat = new THREE.MeshBasicMaterial({ map: aziLabelTex, transparent: true });
    const aziLabel = new THREE.Mesh(aziLabelGeom, aziLabelMat);
    aziLabel.position.set(basePos.x + 1800 * Math.cos(etaRad), basePos.z + 200, basePos.y + 1800 * Math.sin(etaRad));
    aziLabel.lookAt(basePos.x, basePos.z + 200, basePos.y);
    scene.add(aziLabel);

    // Elevation label
    const elevLabelGeom = new THREE.PlaneGeometry(400, 200);
    const elevLabelTex = createTextTexture(`θ = ${outAngles.thetaDeg.toFixed(1)}°`, '#10b981');
    const elevLabelMat = new THREE.MeshBasicMaterial({ map: elevLabelTex, transparent: true });
    const elevLabel = new THREE.Mesh(elevLabelGeom, elevLabelMat);
    elevLabel.position.set(basePos.x - 800, basePos.z + angleRadius * 0.8 * 0.6, basePos.y);
    elevLabel.lookAt(basePos.x, basePos.z, basePos.y);
    scene.add(elevLabel);

    // Elevation display label
    const elevDisplayGeom = new THREE.PlaneGeometry(400, 200);
    const elevDisplayTex = createTextTexture(`Elev = ${outAngles.elevDeg.toFixed(1)}°`, '#f59e0b');
    const elevDisplayMat = new THREE.MeshBasicMaterial({ map: elevDisplayTex, transparent: true });
    const elevDisplay = new THREE.Mesh(elevDisplayGeom, elevDisplayMat);
    elevDisplay.position.set(basePos.x + 800, basePos.z + angleRadius * 0.8 * 0.6, basePos.y);
    elevDisplay.lookAt(basePos.x, basePos.z, basePos.y);
    scene.add(elevDisplay);

    // Base point (green sphere)
    const baseGeometry = new THREE.SphereGeometry(100, 32, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x10b981 });
    const basePoint = new THREE.Mesh(baseGeometry, baseMaterial);
    basePoint.position.set(basePos.x, basePos.z, basePos.y);
    scene.add(basePoint);

    // Target point (red sphere)
    const targetGeometry = new THREE.SphereGeometry(80, 32, 32);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0xef4444 });
    const targetPoint = new THREE.Mesh(targetGeometry, targetMaterial);
    targetPoint.position.set(targetPos.x, targetPos.z, targetPos.y);
    scene.add(targetPoint);

    // Line from base to target
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([basePos.x, basePos.z, basePos.y, targetPos.x, targetPos.z, targetPos.y]),
      3
    ));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);

    // Box (pavé droit)
    const boxGeometry = new THREE.BoxGeometry(boxDims.sx, boxDims.sz, boxDims.sy);
    const boxMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x6366f1, 
      emissive: 0x4f46e5,
      wireframe: false,
      opacity: 0.8,
      transparent: true,
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(boxPos.x, boxPos.z, boxPos.y);
    
    // Apply rotations (Euler angles)
    box.rotation.order = 'YXZ';
    box.rotation.y = boxRot.yaw;
    box.rotation.x = boxRot.pitch;
    box.rotation.z = boxRot.roll;
    
    // Add wireframe
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 }));
    box.add(wireframe);
    
    scene.add(box);
    boxRef.current = box;

    // ===== Enhanced rotation visualization for box =====
    // Yaw rotation arc (around Z axis - red)
    const yawRadius = 1200;
    const yawTorus = new THREE.Mesh(
      new THREE.TorusGeometry(yawRadius, 40, 16, 100, 0, Math.PI * 1.5),
      new THREE.MeshPhongMaterial({ color: 0xef4444, emissive: 0xdc2626, transparent: true, opacity: 0.7 })
    );
    yawTorus.position.set(boxPos.x, boxPos.z, boxPos.y);
    yawTorus.rotation.y = Math.PI / 2;
    scene.add(yawTorus);

    // Roll axis point (green sphere - left side)
    const rollSphere = new THREE.Mesh(
      new THREE.SphereGeometry(80, 24, 24),
      new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x059669 })
    );
    rollSphere.position.set(boxPos.x - boxDims.sx/2 - 300, boxPos.z, boxPos.y);
    scene.add(rollSphere);

    // Pitch axis point (red sphere - right side)
    const pitchSphere = new THREE.Mesh(
      new THREE.SphereGeometry(80, 24, 24),
      new THREE.MeshPhongMaterial({ color: 0xef4444, emissive: 0xdc2626 })
    );
    pitchSphere.position.set(boxPos.x + boxDims.sx/2 + 300, boxPos.z, boxPos.y);
    scene.add(pitchSphere);

    // Roll rotation arc (around X axis - green, at left)
    const rollTorus = new THREE.Mesh(
      new THREE.TorusGeometry(900, 35, 16, 100, 0, Math.PI * 1.5),
      new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x059669, transparent: true, opacity: 0.7 })
    );
    rollTorus.position.copy(rollSphere.position);
    rollTorus.rotation.z = Math.PI / 2;
    scene.add(rollTorus);

    // Pitch rotation arc (around Y axis - red, at right)
    const pitchTorus = new THREE.Mesh(
      new THREE.TorusGeometry(900, 35, 16, 100, 0, Math.PI * 1.5),
      new THREE.MeshPhongMaterial({ color: 0xef4444, emissive: 0xdc2626, transparent: true, opacity: 0.7 })
    );
    pitchTorus.position.copy(pitchSphere.position);
    pitchTorus.rotation.x = Math.PI / 2;
    scene.add(pitchTorus);

    // Create axis lines for rotation visualization
    const axisLineLength = 1500;
    
    // Roll axis line (green - X axis)
    const rollAxisGeom = new THREE.BufferGeometry();
    rollAxisGeom.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([
        rollSphere.position.x - axisLineLength, rollSphere.position.y, rollSphere.position.z,
        rollSphere.position.x + axisLineLength, rollSphere.position.y, rollSphere.position.z
      ]),
      3
    ));
    const rollAxisLine = new THREE.Line(rollAxisGeom, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 }));
    scene.add(rollAxisLine);

    // Pitch axis line (red - Y axis)
    const pitchAxisGeom = new THREE.BufferGeometry();
    pitchAxisGeom.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([
        pitchSphere.position.x, pitchSphere.position.y - axisLineLength, pitchSphere.position.z,
        pitchSphere.position.x, pitchSphere.position.y + axisLineLength, pitchSphere.position.z
      ]),
      3
    ));
    const pitchAxisLine = new THREE.Line(pitchAxisGeom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 }));
    scene.add(pitchAxisLine);

    // Create rotation labels
    function createSmallLabel(text, color = '#fff') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'Bold 32px Arial';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }

    // Yaw label (top)
    const yawLabelGeom = new THREE.PlaneGeometry(300, 100);
    const yawLabelTex = createSmallLabel(`Yaw: ${boxRot.yaw.toFixed(2)} rad`, '#ef4444');
    const yawLabel = new THREE.Mesh(yawLabelGeom, new THREE.MeshBasicMaterial({ map: yawLabelTex, transparent: true }));
    yawLabel.position.set(boxPos.x, boxPos.z + yawRadius + 400, boxPos.y);
    yawLabel.lookAt(boxPos.x, boxPos.z + 200, boxPos.y);
    scene.add(yawLabel);

    // Roll label (left)
    const rollLabelGeom = new THREE.PlaneGeometry(280, 100);
    const rollLabelTex = createSmallLabel(`Roll: ${boxRot.roll.toFixed(2)} rad`, '#10b981');
    const rollLabel = new THREE.Mesh(rollLabelGeom, new THREE.MeshBasicMaterial({ map: rollLabelTex, transparent: true }));
    rollLabel.position.set(rollSphere.position.x - 600, rollSphere.position.y + 600, rollSphere.position.z);
    rollLabel.lookAt(boxPos.x, boxPos.z, boxPos.y);
    scene.add(rollLabel);

    // Pitch label (right)
    const pitchLabelGeom = new THREE.PlaneGeometry(300, 100);
    const pitchLabelTex = createSmallLabel(`Pitch: ${boxRot.pitch.toFixed(2)} rad`, '#ef4444');
    const pitchLabel = new THREE.Mesh(pitchLabelGeom, new THREE.MeshBasicMaterial({ map: pitchLabelTex, transparent: true }));
    pitchLabel.position.set(pitchSphere.position.x + 600, pitchSphere.position.y + 600, pitchSphere.position.z);
    pitchLabel.lookAt(boxPos.x, boxPos.z, boxPos.y);
    scene.add(pitchLabel);

    // Camera positioning with orbit
    const updateCamera = () => {
      // Use interactive controls if they have been set, otherwise use props
      const yaw = cameraControlRef.current.yaw;
      const pitch = cameraControlRef.current.pitch;
      const distance = cameraControlRef.current.radius;
      
      const x = boxPos.x + distance * Math.cos(yaw) * Math.cos(pitch);
      const y = boxPos.z + distance * Math.sin(pitch);
      const z = boxPos.y + distance * Math.sin(yaw) * Math.cos(pitch);
      
      camera.position.set(x, y, z);
      camera.lookAt(boxPos.x, boxPos.z, boxPos.y);
    };

    updateCamera();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update box rotation
      if (boxRef.current) {
        boxRef.current.rotation.order = 'YXZ';
        boxRef.current.rotation.y = boxRot.yaw;
        boxRef.current.rotation.x = boxRot.pitch;
        boxRef.current.rotation.z = boxRot.roll;
      }

      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    };

    // Mouse controls
    const handleMouseDown = (e) => {
      dragStateRef.current.isDragging = true;
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.lastY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!dragStateRef.current.isDragging) return;
      
      const deltaX = e.clientX - dragStateRef.current.lastX;
      const deltaY = e.clientY - dragStateRef.current.lastY;
      
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.lastY = e.clientY;
      
      // Update yaw (horizontal rotation)
      cameraControlRef.current.yaw += deltaX * 0.01;
      
      // Update pitch (vertical rotation) with constraints
      cameraControlRef.current.pitch += deltaY * 0.01;
      cameraControlRef.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraControlRef.current.pitch));
      
      // Update camera position
      const distance = cameraControlRef.current.radius;
      const x = boxPos.x + distance * Math.cos(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      const y = boxPos.z + distance * Math.sin(cameraControlRef.current.pitch);
      const z = boxPos.y + distance * Math.sin(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      
      camera.position.set(x, y, z);
      camera.lookAt(boxPos.x, boxPos.z, boxPos.y);
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const handleWheel = (e) => {
      e.preventDefault();
      
      const zoomSpeed = 50;
      const direction = e.deltaY > 0 ? 1 : -1;
      
      cameraControlRef.current.radius += direction * zoomSpeed;
      cameraControlRef.current.radius = Math.max(500, Math.min(10000, cameraControlRef.current.radius));
      
      // Update camera position
      const distance = cameraControlRef.current.radius;
      const x = boxPos.x + distance * Math.cos(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      const y = boxPos.z + distance * Math.sin(cameraControlRef.current.pitch);
      const z = boxPos.y + distance * Math.sin(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      
      camera.position.set(x, y, z);
      camera.lookAt(boxPos.x, boxPos.z, boxPos.y);
    };

    // Touch controls (mobile)
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        dragStateRef.current.isDragging = true;
        dragStateRef.current.lastX = e.touches[0].clientX;
        dragStateRef.current.lastY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (!dragStateRef.current.isDragging || e.touches.length !== 1) return;
      
      const deltaX = e.touches[0].clientX - dragStateRef.current.lastX;
      const deltaY = e.touches[0].clientY - dragStateRef.current.lastY;
      
      dragStateRef.current.lastX = e.touches[0].clientX;
      dragStateRef.current.lastY = e.touches[0].clientY;
      
      cameraControlRef.current.yaw += deltaX * 0.01;
      cameraControlRef.current.pitch += deltaY * 0.01;
      cameraControlRef.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraControlRef.current.pitch));
      
      const distance = cameraControlRef.current.radius;
      const x = boxPos.x + distance * Math.cos(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      const y = boxPos.z + distance * Math.sin(cameraControlRef.current.pitch);
      const z = boxPos.y + distance * Math.sin(cameraControlRef.current.yaw) * Math.cos(cameraControlRef.current.pitch);
      
      camera.position.set(x, y, z);
      camera.lookAt(boxPos.x, boxPos.z, boxPos.y);
    };

    const handleTouchEnd = () => {
      dragStateRef.current.isDragging = false;
    };

    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', handleTouchStart);
    renderer.domElement.addEventListener('touchmove', handleTouchMove);
    renderer.domElement.addEventListener('touchend', handleTouchEnd);
    renderer.domElement.style.cursor = 'grab';

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [basePos, targetPos, boxPos, boxDims, boxRot, orbit, outAngles]);

  return <div ref={containerRef} style={{width: '100%', height: '100%'}} />;
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{
      ...S.card,
      overflow: "hidden",
      transition: "all 0.2s ease",
    }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          padding: "2px 0",
          marginBottom: open ? "12px" : 0,
        }}
        onClick={() => setOpen(!open)}
      >
        <div style={{...S.sectionTitle, fontSize:14}}>{title}</div>
        <div style={{
          fontSize: 18,
          color: UI.accent,
          transition: "transform 0.2s ease",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }}>▾</div>
      </div>
      {open && (
        <div style={{animation: "slideDown 0.2s ease"}}>
          <style>{`@keyframes slideDown { from { opacity: 0; } to { opacity: 1; } }`}</style>
          {children}
        </div>
      )}
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

  const baseFromAngles = React.useMemo(()=>computeBase(D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta/60), [D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta]);
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

  // Mode d'affichage
  const [viewMode, setViewMode] = React.useState('3d'); // '2d' | '3d'

  // Vue auto mesurée
  const [viewW, setViewW] = React.useState(1200);
  const [viewH, setViewH] = React.useState(700);
  const [orbit, setOrbit] = React.useState({ yaw:0.6, pitch:0.45, radius:9000 });
  const simRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const dragRef = React.useRef({ type: null, lastX: 0, lastY: 0, lastAngle: 0 });




  // Background image options
  const [bgUrl, setBgUrl] = React.useState("");
  const [bgOffsetX, setBgOffsetX] = React.useState(0);
  const [bgOffsetY, setBgOffsetY] = React.useState(0);
  const [bgScale, setBgScale] = React.useState(1);
  const [bgOpacity, setBgOpacity] = React.useState(0.3);
  const [showGrid, setShowGrid] = React.useState(true);
  
  // Interaction mode
  const [draggingCam, setDraggingCam] = React.useState(false);
  const [draggingTarget, setDraggingTarget] = React.useState(false);
  const [control, setControl] = React.useState(null);
  
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

  // Pointer handlers (minimal implementations)
  const onPointerMove = React.useCallback((e) => {
    if (dragRef.current.type === 'orbit') {
      setOrbit(o => ({
        ...o,
        yaw: o.yaw - (e.movementX * 0.005),
        pitch: clamp(o.pitch - (e.movementY * 0.005), -1.2, 1.2)
      }));
    }
  }, []);

  const onPointerUp = React.useCallback((e) => {
    dragRef.current.type = null;
  }, []);

  const onPointerDownCam = React.useCallback((e) => {
    setDraggingCam(true);
    dragRef.current.type = 'camera';
    e.preventDefault();
  }, []);

  const onPointerDownTarget = React.useCallback((e) => {
    setDraggingTarget(true);
    dragRef.current.type = 'cible';
    e.preventDefault();
  }, []);

  const onPointerDownRotate = React.useCallback((e) => {
    dragRef.current.type = 'rotateTarget';
    e.preventDefault();
  }, []);


  const outputs = { Xt: targ.x, Yt: targ.y, Zt: targ.z };
  const baseForTest = { baseX: base.x, baseY: base.y, baseZ: base.z };
  const targetForTest = { Xt: targ.x, Yt: targ.y, Zt: targ.z };

  // Angles sortants (toujours calculés à partir des positions visibles)
  const outAngles = React.useMemo(()=>computeOutputAngles(base, targ, alpha/60), [base, targ, alpha]);

  // 2D visualization variables
  const scale = 2; // px per unit
  const Rarc = 120;
  const RarcInner = 100;
  const Rbeta = 80;
  const RbetaInner = 60;
  
  // Screen positions
  const camScreenX = viewW / 2;
  const camScreenY = viewH / 2;
  const sx = viewW / 2 + (targ.x - base.x) * scale;
  const sy = viewH / 2 - (targ.y - base.y) * scale;
  
  // Other display variables
  const epsDisp = eps;
  const rectAngle = 0;
  const targetPxW = 300;
  const targetPxH = 100;
  const D1Cx = (D1Lx + D1Rx) / 2;
  const D1Cy = (D1Ly + D1Ry) / 2;
  
  // ===== Import/Export Excel Functions =====
  const downloadTemplate = React.useCallback(() => {
    // Create template with parameter names and example data
    const templateData = [
      { Parameter: 'FLRx', Test1: 0, Test2: 0, Test3: 0 },
      { Parameter: 'FLRy', Test1: 0, Test2: 0, Test3: 0 },
      { Parameter: 'FLRz', Test1: 0, Test2: 0, Test3: 0 },
      { Parameter: 'D1R_x', Test1: -5152, Test2: -5150, Test3: 0 },
      { Parameter: 'D1R_y', Test1: -1246, Test2: 1248, Test3: 0 },
      { Parameter: 'D1L_x', Test1: -5150, Test2: -5150, Test3: 0 },
      { Parameter: 'D1L_y', Test1: 1248, Test2: 1248, Test3: 0 },
      { Parameter: 'CrabAngle', Test1: -0.81, Test2: 0, Test3: 0 },
      { Parameter: 'ChassisID', Test1: 1, Test2: 0, Test3: 0 },
      { Parameter: 'DriveAngle', Test1: 9.99, Test2: 0, Test3: 0 },
      { Parameter: 'SymmetryAngle', Test1: 7.22, Test2: 0, Test3: 0 }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-adjust column widths
    ws['!cols'] = [
      { wch: 18 }, // Parameter
      { wch: 15 }, // Test1
      { wch: 15 }, // Test2
      { wch: 15 }  // Test3
    ];
    
    // Style header row
    for (let col = 0; col < 4; col++) {
      const cellRef = XLSX.utils.encode_col(col) + '1';
      ws[cellRef].s = {
        fill: { fgColor: { rgb: 'FF4F46E5' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "targetplacement_template.xlsx");
  }, []);

  const handleImportExcel = React.useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Parse input file format
        // Row 0: headers (Parameter name, value, then multiple test cases)
        // Rows 1+: parameter names and values, then test data
        
        if (!rows || rows.length < 11) {
          alert('Format invalide. Au moins 11 paramètres attendus (FLRx, FLRy, FLRz, D1Rx, D1Ry, D1Lx, D1Ly, CrabAngle, ChassisID, DriveAngle, SymmetryAngle).');
          return;
        }
        
        // Extract parameters from column 1 (index 1)
        const params = {};
        params.FLRx = safeNum(rows[0]?.[1]);
        params.FLRy = safeNum(rows[1]?.[1]);
        params.FLRz = safeNum(rows[2]?.[1]);
        params.D1Rx = safeNum(rows[3]?.[1]);
        params.D1Ry = safeNum(rows[4]?.[1]);
        params.D1Lx = safeNum(rows[5]?.[1]);
        params.D1Ly = safeNum(rows[6]?.[1]);
        params.CrabAngle = safeNum(rows[7]?.[1]);
        params.ChassisID = safeNum(rows[8]?.[1]);
        params.DriveAngle = safeNum(rows[9]?.[1]);
        params.SymmetryAngle = safeNum(rows[10]?.[1]);
        
        // Extract test cases from columns 2+ (index 2+)
        const testCases = [];
        for (let col = 2; col < rows[0].length; col++) {
          const testCase = {};
          for (let row = 0; row < Math.min(11, rows.length); row++) {
            const paramName = ['FLRx', 'FLRy', 'FLRz', 'D1Rx', 'D1Ry', 'D1Lx', 'D1Ly', 'CrabAngle', 'ChassisID', 'DriveAngle', 'SymmetryAngle'][row];
            testCase[paramName] = safeNum(rows[row]?.[col]);
          }
          if (Object.values(testCase).some(v => v !== 0)) {
            testCases.push(testCase);
          }
        }
        
        // Process test cases and calculate outputs
        const results = [];
        testCases.forEach(test => {
          const flrx = test.FLRx ?? params.FLRx ?? FLRx;
          const flry = test.FLRy ?? params.FLRy ?? FLRy;
          const flrz = test.FLRz ?? params.FLRz ?? FLRz;
          const beta = test.SymmetryAngle ?? params.SymmetryAngle ?? 0;
          const d1Lx = test.D1Lx ?? params.D1Lx ?? D1Lx;
          const d1Ly = test.D1Ly ?? params.D1Ly ?? D1Ly;
          const d1Rx = test.D1Rx ?? params.D1Rx ?? D1Rx;
          const d1Ry = test.D1Ry ?? params.D1Ry ?? D1Ry;
          
          // Compute base position
          const basePos = computeBase(d1Lx, d1Ly, d1Rx, d1Ry, flrx, flry, flrz, beta);
          
          // Use fixed angles for computation
          const rayDir = computeRay(eps, alpha/60, zeta);
          const targetPos = computeTarget(basePos, rayDir, V);
          
          // Compute output angles
          const outAngles = computeOutputAngles(basePos, targetPos, alpha/60);
          
          results.push({
            FLRx: flrx,
            FLRy: flry,
            FLRz: flrz,
            X: targetPos.x.toFixed(2),
            Y: targetPos.y.toFixed(2),
            Z: targetPos.z.toFixed(2),
            Azimuth: outAngles.etaDeg.toFixed(4),
            Elevation: outAngles.elevDeg.toFixed(4),
            Roll: 0
          });
        });
        
        // Export results to Excel
        if (results.length > 0) {
          const ws = XLSX.utils.json_to_sheet(results);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Résultats");
          XLSX.writeFile(wb, "targetplacement_results.xlsx");
          alert(`✅ ${results.length} cas traités et exportés`);
        }
      } catch (err) {
        console.error(err);
        alert('Erreur lors du traitement du fichier');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, alpha, eps, zeta, V]);

  // Helper functions for SVG
  const polarPointScreen = (cx, cy, r, angleDeg) => {
    const rad = deg2rad(angleDeg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  
  const sectorPath = (cx, cy, r1, r2, startDeg, endDeg) => {
    const start = deg2rad(startDeg);
    const end = deg2rad(endDeg);
    const x1 = cx + r1 * Math.cos(start);
    const y1 = cy + r1 * Math.sin(start);
    const x2 = cx + r2 * Math.cos(start);
    const y2 = cy + r2 * Math.sin(start);
    const x3 = cx + r2 * Math.cos(end);
    const y3 = cy + r2 * Math.sin(end);
    const x4 = cx + r1 * Math.cos(end);
    const y4 = cy + r1 * Math.sin(end);
    const largeArc = (end - start) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 ${largeArc} 0 ${x1} ${y1} Z`;
  };
  
  // Mock 3D visualization
  const pBase = { visible: true, x: camScreenX, y: camScreenY, scale: 1 };
  const pBox = { visible: false, x: 0, y: 0, scale: 1 };
  const pTarg = { visible: true, x: sx, y: sy, scale: 1 };
  const boxBounds = { minx: -1000, maxx: 1000, miny: -1000, maxy: 1000 };

  



  // --- UI LEFT: panneau
  const LeftPanel = (
    <div style={{...S.pad, paddingTop:"20px"}}>
      <div style={{marginBottom:24}}>
        <div style={{
          fontSize:24,
          fontWeight:800,
          marginBottom:6,
          color: UI.textPrimary,
          letterSpacing:"-0.5px",
        }}>
          ⚙️ Simulation
        </div>
        <div style={{
          fontSize:13,
          color:UI.textSecondary,
          fontWeight:500,
        }}>
          Paramétrage et visualisation RADAR
        </div>
      </div>
      
      <div style={{
        ...S.card,
        background: `linear-gradient(135deg, ${UI.accentLight} 0%, rgba(79,70,229,0.05) 100%)`,
        borderColor: UI.accent,
        marginBottom:16,
      }}>
        <div style={{fontWeight:600, fontSize:13, marginBottom:10, color: UI.accent}}>📊 Yt — Comparaison</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, fontSize:12}}>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>Formule</div>
            <div style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:14, fontWeight:700, color:UI.textPrimary}}>{Yt_formula.toFixed(3)}</div>
          </div>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>Simulation</div>
            <div style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:14, fontWeight:700, color:UI.textPrimary}}>{Yt_sim.toFixed(3)}</div>
          </div>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>Écart (ΔYt)</div>
            <div style={{
              fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize:14,
              fontWeight:700,
              color: Math.abs(dYt)<1e-6 ? "#059669" : "#dc2626"
            }}>
              {Math.abs(dYt)<1e-6 ? "✓" : "✗"} {dYt.toFixed(6)}
            </div>
          </div>
        </div>
        <div style={{fontSize:11, color:UI.textSecondary, marginTop:10, fontStyle:"italic"}}>
          {ctrl==='manuel'
            ? "📝 Mode Manuel : écart normal si la cible n'est pas pilotée par les angles."
            : "✅ Mode Angles : ΔYt devrait être ≈ 0."}
        </div>
      </div>

      <div style={S.card}>
        <div style={{...S.hGroup, marginBottom:14}}>
          <span style={{...S.badge, marginRight:0}}>📍 Positions</span>
          <SegButton active={ctrl==='angles'} onClick={()=>setCtrl('angles')}>Angles</SegButton>
          <SegButton active={ctrl==='manuel'} onClick={()=>setCtrl('manuel')}>Manuel</SegButton>
        </div>
        <div style={S.hGroup}>
          <span style={{...S.badge, marginRight:0}}>�️ Vue</span>
          <SegButton active={viewMode==='3d'} onClick={()=>setViewMode('3d')}>Vue 3D</SegButton>
          <SegButton active={viewMode==='2d'} onClick={()=>setViewMode('2d')}>Vue 2D</SegButton>
        </div>

        <div style={{...S.card, backgroundColor:"#f0fdf4", borderColor:"#86efac"}}>
          <div style={{fontSize:13, fontWeight:600, color:UI.textPrimary, marginBottom:10}}>📁 Import/Export Excel</div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button
              onClick={downloadTemplate}
              style={{
                flex:"1",
                minWidth:150,
                padding:"8px 12px",
                backgroundColor:"#10b981",
                color:"white",
                borderRadius:"8px",
                border:"none",
                cursor:"pointer",
                fontSize:12,
                fontWeight:600,
                textAlign:"center",
                transition:"all 0.2s ease",
                "&:hover": { backgroundColor:"#059669" }
              }}
              onMouseEnter={e => e.target.style.backgroundColor = "#059669"}
              onMouseLeave={e => e.target.style.backgroundColor = "#10b981"}
            >
              📋 Télécharger template
            </button>
            <label style={{
              flex:"1",
              minWidth:150,
              padding:"8px 12px",
              backgroundColor:UI.accent,
              color:"white",
              borderRadius:"8px",
              cursor:"pointer",
              fontSize:12,
              fontWeight:600,
              textAlign:"center",
              transition:"all 0.2s ease",
              border:"2px solid transparent"
            }}>
              📥 Charger fichier
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleImportExcel}
                style={{display:"none"}}
              />
            </label>
          </div>
          <div style={{fontSize:11, color:UI.textSecondary, marginTop:8, lineHeight:1.4}}>
            1️⃣ Téléchargez le template • 2️⃣ Remplissez vos données • 3️⃣ Chargez le fichier pour traiter
          </div>
        </div>
      </div>

      <Section title="📐 Paramètres – Mode Angles" defaultOpen>
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
          <SliderRow label="ε (zr) [°]" value={eps} onChange={setEps} min={-180} max={180} step={0.01} />
          <SliderRow label="θ (polaire) [°]" value={zeta} onChange={setZeta} min={0} max={180} step={0.01} />
          <SliderRow label="V [mm]" value={V} onChange={setV} min={0} max={20000} step={0.001} />
        </div>
      </Section>

      <Section title="📍 Positions – Mode Manuel" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Base X" value={baseM.x} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Y" value={baseM.y} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Z" value={baseM.z} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,z:v}); }} min={-5000} max={5000} step={0.01} />

          <SliderRow label="Cible X" value={targM.x} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Y" value={targM.y} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Z" value={targM.z} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,z:v}); }} min={-5000} max={5000} step={0.01} />
        </div>
      </Section>

      <Section title="🎲 Contrôles 3D – Pavé Droit" defaultOpen={true}>
        <div style={S.grid2}>
          <SliderRow label="Pos X" value={boxPos.x} onChange={(v)=>{ setBoxPos({...boxPos,x:v}); }} min={-5000} max={10000} step={0.1} />
          <SliderRow label="Pos Y" value={boxPos.y} onChange={(v)=>{ setBoxPos({...boxPos,y:v}); }} min={-5000} max={10000} step={0.1} />
          <SliderRow label="Pos Z" value={boxPos.z} onChange={(v)=>{ setBoxPos({...boxPos,z:v}); }} min={-5000} max={10000} step={0.1} />
          
          <SliderRow label="Dim X" value={boxSX} onChange={setBoxSX} min={100} max={3000} step={1} />
          <SliderRow label="Dim Y" value={boxSY} onChange={setBoxSY} min={100} max={3000} step={1} />
          <SliderRow label="Dim Z" value={boxSZ} onChange={setBoxSZ} min={100} max={3000} step={1} />
          
          <SliderRow label="Yaw [°]" value={boxYaw} onChange={setBoxYaw} min={-180} max={180} step={1} />
          <SliderRow label="Pitch [°]" value={boxPitch} onChange={setBoxPitch} min={-180} max={180} step={1} />
          <SliderRow label="Roll [°]" value={boxRoll} onChange={setBoxRoll} min={-180} max={180} step={1} />
        </div>
        
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12}}>
          <button style={{...S.resetBtn, backgroundColor:"#06b6d4"}} onClick={()=>{
            setBoxPos({x:1000, y:0, z:400});
            setBoxSX(900); setBoxSY(600); setBoxSZ(500);
            setBoxYaw(0); setBoxPitch(0); setBoxRoll(0);
          }}>
            🔄 Réinitialiser Boîte
          </button>
          <button style={{...S.resetBtn, backgroundColor:"#8b5cf6"}} onClick={()=>{
            setOrbit({yaw:0.6, pitch:0.45, radius:3000});
          }}>
            📷 Caméra par défaut
          </button>
        </div>
      </Section>

      <Section title="📹 Caméra Orbitale" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Yaw [rad]" value={orbit.yaw} onChange={(v)=>setOrbit({...orbit,yaw:v})} min={-Math.PI*2} max={Math.PI*2} step={0.01} />
          <SliderRow label="Pitch [rad]" value={orbit.pitch} onChange={(v)=>setOrbit({...orbit,pitch:clamp(v,-Math.PI/2,Math.PI/2)})} min={-Math.PI/2} max={Math.PI/2} step={0.01} />
          <SliderRow label="Rayon [mm]" value={orbit.radius} onChange={(v)=>setOrbit({...orbit,radius:Math.max(500,v)})} min={500} max={10000} step={100} />
        </div>
      </Section>

      <SelfTests base={baseForTest} target={targetForTest} V={V} useAngles={ctrl==='angles'} ray={rayAngles} />

      <>
        <div style={{
          ...S.card,
          background: "linear-gradient(135deg, rgba(251,146,60,0.05) 0%, rgba(249,115,22,0.05) 100%)",
          borderColor: "rgba(249,115,22,0.3)",
        }}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:12, color: UI.textPrimary}}>📤 Sorties (Monde)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, fontSize:12}}>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>X</div>
            <div style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:14, fontWeight:700, color:UI.textPrimary}}>{outputs.Xt.toFixed(1)}</div>
          </div>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>Y</div>
            <div style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:14, fontWeight:700, color:UI.textPrimary}}>{outputs.Yt.toFixed(1)}</div>
          </div>
          <div>
            <div style={{color:UI.textSecondary, fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase"}}>Z</div>
            <div style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize:14, fontWeight:700, color:UI.textPrimary}}>{outputs.Zt.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <div style={{
        ...S.card,
        background: "linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.05) 100%)",
        borderColor: "rgba(99,102,241,0.3)",
      }}>
        <div style={{fontWeight:600, fontSize:13, marginBottom:12, color: UI.textPrimary}}>📊 Angles (Sortie)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr", gap:10, fontSize:12}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:10, borderBottom:`1px solid ${UI.borderLight}`}}>
            <span style={{color:UI.textSecondary}}>η (azimut)</span>
            <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:700, color:UI.textPrimary}}>{outAngles.etaDeg.toFixed(2)}°</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:10, borderBottom:`1px solid ${UI.borderLight}`}}>
            <span style={{color:UI.textSecondary}}>θ (polaire)</span>
            <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:700, color:UI.textPrimary}}>{outAngles.thetaDeg.toFixed(2)}°</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:10, borderBottom:`1px solid ${UI.borderLight}`}}>
            <span style={{color:UI.textSecondary}}>Élévation</span>
            <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:700, color:UI.textPrimary}}>{outAngles.elevDeg.toFixed(2)}°</span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:10, borderBottom:`1px solid ${UI.borderLight}`}}>
            <span style={{color:UI.textSecondary}}>α (drive)</span>
            <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:700, color:UI.accent}}>{alpha.toFixed(2)}′ <span style={{fontSize:11, color:UI.textSecondary}}>({(alpha/60).toFixed(4)}°)</span></span>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span style={{color:UI.textSecondary}}>ε (calc)</span>
            <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight:700, color:UI.textPrimary}}>{outAngles.epsDeg.toFixed(2)}°</span>
          </div>
        </div>
        <div style={{fontSize:11, color:UI.textSecondary, marginTop:12, paddingTop:12, borderTop:`1px solid ${UI.borderLight}`, fontStyle:"italic"}}>
          🔍 V (mesuré) = {outAngles.V.toFixed(3)} mm
        </div>
      </div>

      <div style={{...S.card, background: "linear-gradient(135deg, rgba(34,197,94,0.05) 0%, rgba(22,163,74,0.05) 100%)"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <button
            style={{
              ...S.resetBtn,
              flex:1,
              marginRight:"8px",
              backgroundColor: UI.accent,
            }}
            onClick={()=>{
              setFLRx(5638); setFLRy(0); setFLRz(0);
              setD1Lx(-4300); setD1Ly(1245); setD1Rx(-4300); setD1Ry(-1255);
              setBeta(0); setAlpha(0); setEps(0); setZeta(90); setV(1000);
            }}
          >🔄 Réinitialiser</button>
        </div>
      </div>
      </>
    </div>
  );

  return (
    <SplitPane
      left={LeftPanel}
      right={() => (
        <>
          {viewMode === '3d' ? (
            <div style={{
              width:"100%",
              height:"100%",
              backgroundColor:UI.bgLight,
              display:"flex",
              flexDirection:"column",
              position:"relative",
            }}>
              <Canvas3D
                basePos={base}
                targetPos={targ}
                boxPos={boxPos}
                boxDims={{sx: boxSX, sy: boxSY, sz: boxSZ}}
                boxRot={{yaw: deg2rad(boxYaw), pitch: deg2rad(boxPitch), roll: deg2rad(boxRoll)}}
                orbit={orbit}
                outAngles={outAngles}
              />
              <div style={{
                padding:"12px 16px",
                backgroundColor:UI.bgWhite,
                borderTop:`1px solid ${UI.border}`,
                fontSize:"12px",
                color:UI.textSecondary,
                display:"flex",
                justifyContent:"space-between",
                alignItems:"center",
                flexWrap:"wrap",
                gap:"12px",
              }}>
                <div style={{display:"flex", gap:"16px"}}>
                  <span>📐 Boîte : {boxSX.toFixed(0)}×{boxSY.toFixed(0)}×{boxSZ.toFixed(0)}</span>
                  <span>🎯 Base → Cible : {outAngles.V.toFixed(1)} mm</span>
                </div>
                <div style={{color:UI.accent, fontWeight:600}}>
                  ⚙️ Contrôlez avec la souris et les sliders
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              width:"100%",
              height:"100%",
              backgroundColor:UI.bgLight,
              display:"flex",
              flexDirection:"column",
              position:"relative",
            }}>
              <svg style={{flex:1, width:"100%", height:"100%", background:"#fff"}} viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet">
                {/* Grille légère */}
                {Array.from({length:Math.ceil(viewW/100)}).map((_, i) => (
                  <line key={`vgrid${i}`} x1={i*100} y1={0} x2={i*100} y2={viewH} stroke="#f3f4f6" strokeWidth={1} />
                ))}
                {Array.from({length:Math.ceil(viewH/100)}).map((_, i) => (
                  <line key={`hgrid${i}`} x1={0} y1={i*100} x2={viewW} y2={i*100} stroke="#f3f4f6" strokeWidth={1} />
                ))}
                
                {/* Axes principaux */}
                <line x1={0} y1={viewH/2} x2={viewW} y2={viewH/2} stroke="#e5e7eb" strokeWidth={2} />
                <line x1={viewW/2} y1={0} x2={viewW/2} y2={viewH} stroke="#e5e7eb" strokeWidth={2} />
                
                {/* Étiquettes axes */}
                <text x={viewW - 40} y={viewH/2 - 10} fontSize={12} fill="#9ca3af" fontWeight={600}>+X</text>
                <text x={viewW/2 + 10} y={30} fontSize={12} fill="#9ca3af" fontWeight={600}>+Y</text>
                
                {/* Point de base (vert) */}
                {(() => {
                  const baseX = base.x * 0.15 + viewW/2;
                  const baseY = viewH/2 - base.y * 0.15;
                  return (
                    <g key="base-group">
                      <circle cx={baseX} cy={baseY} r={12} fill="#10b981" />
                      <circle cx={baseX} cy={baseY} r={12} fill="none" stroke="#059669" strokeWidth={2} opacity={0.5} />
                      <text x={baseX + 20} y={baseY - 5} fontSize={11} fill="#10b981" fontWeight={600}>Base</text>
                      <text x={baseX + 20} y={baseY + 10} fontSize={9} fill="#6b7280">({base.x.toFixed(0)}, {base.y.toFixed(0)})</text>
                    </g>
                  );
                })()}
                
                {/* Point cible (rouge) */}
                {(() => {
                  const targX = targ.x * 0.15 + viewW/2;
                  const targY = viewH/2 - targ.y * 0.15;
                  return (
                    <g key="target-group">
                      <circle cx={targX} cy={targY} r={10} fill="#ef4444" />
                      <circle cx={targX} cy={targY} r={10} fill="none" stroke="#dc2626" strokeWidth={2} opacity={0.5} />
                      <text x={targX + 20} y={targY - 5} fontSize={11} fill="#ef4444" fontWeight={600}>Cible</text>
                      <text x={targX + 20} y={targY + 10} fontSize={9} fill="#6b7280">({targ.x.toFixed(0)}, {targ.y.toFixed(0)})</text>
                    </g>
                  );
                })()}
                
                {/* Ligne base-cible */}
                {(() => {
                  const baseX = base.x * 0.15 + viewW/2;
                  const baseY = viewH/2 - base.y * 0.15;
                  const targX = targ.x * 0.15 + viewW/2;
                  const targY = viewH/2 - targ.y * 0.15;
                  return (
                    <line key="connection" x1={baseX} y1={baseY} x2={targX} y2={targY} 
                          stroke="#0284c7" strokeWidth={2.5} strokeDasharray="8,4" opacity={0.8} />
                  );
                })()}
                
                {/* Arc pour l'angle η (azimut) */}
                {(() => {
                  const baseX = base.x * 0.15 + viewW/2;
                  const baseY = viewH/2 - base.y * 0.15;
                  const radius = 80;
                  const startAngle = 0;
                  const endAngle = outAngles.etaDeg * Math.PI / 180;
                  const x1 = baseX + radius * Math.cos(startAngle);
                  const y1 = baseY - radius * Math.sin(startAngle);
                  const x2 = baseX + radius * Math.cos(endAngle);
                  const y2 = baseY - radius * Math.sin(endAngle);
                  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
                  const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
                  
                  // Label pour l'angle
                  const labelAngle = endAngle / 2;
                  const labelRadius = radius + 30;
                  const labelX = baseX + labelRadius * Math.cos(labelAngle);
                  const labelY = baseY - labelRadius * Math.sin(labelAngle);
                  
                  return (
                    <g key="eta-arc">
                      <path d={pathData} stroke="#f59e0b" strokeWidth={3.5} fill="none" opacity={0.9} />
                      <text x={labelX} y={labelY} fontSize={12} fill="#f59e0b" fontWeight={700} textAnchor="middle">
                        η {outAngles.etaDeg.toFixed(1)}°
                      </text>
                    </g>
                  );
                })()}
                
                {/* Boîte cible (rectangle jaune) proportionnel à boxSX/boxSY */}
                {(() => {
                  const targX = targ.x * 0.15 + viewW/2;
                  const targY = viewH/2 - targ.y * 0.15;
                  const w = Math.max(30, boxSX * 0.05); // Échelle adaptée
                  const h = Math.max(20, boxSY * 0.05);
                  return (
                    <g key="box">
                      <rect x={targX - w/2} y={targY - h/2} width={w} height={h} 
                            fill="#fbbf24" fillOpacity={0.85} stroke="#d97706" strokeWidth={2.5} />
                      <text x={targX} y={targY + 3} fontSize={10} fill="#78350f" fontWeight={600} textAnchor="middle">
                        {boxSX.toFixed(0)}×{boxSY.toFixed(0)}
                      </text>
                    </g>
                  );
                })()}
                
                {/* Légende */}
                <g transform={`translate(20, 20)`}>
                  <text fontSize={14} fontWeight={700} fill={UI.textPrimary}>Légende</text>
                  
                  <rect x={0} y={22} width={14} height={14} fill="#4f46e5" />
                  <text x={22} y={32} fontSize={11} fill={UI.textPrimary}>α (drive)</text>
                  
                  <rect x={140} y={22} width={14} height={14} fill="#0284c7" />
                  <text x={162} y={32} fontSize={11} fill={UI.textPrimary}>ε (zr)</text>
                  
                  <rect x={0} y={48} width={14} height={14} fill="#f59e0b" />
                  <text x={22} y={58} fontSize={11} fill={UI.textPrimary}>η = ε−α</text>
                  
                  <rect x={140} y={48} width={14} height={14} fill="#6b7280" />
                  <text x={162} y={58} fontSize={11} fill={UI.textPrimary}>β (sym)</text>
                </g>
                
                {/* Infos détails */}
                <g transform={`translate(20, ${viewH - 110})`}>
                  <text fontSize={13} fontWeight={700} fill={UI.textPrimary} x={0} y={0}>📊 Angles sortants</text>
                  <text fontSize={11} fill={UI.textSecondary} x={0} y={26}>η (azimut): <tspan fill={UI.accent} fontWeight={600}>{outAngles.etaDeg.toFixed(2)}°</tspan></text>
                  <text fontSize={11} fill={UI.textSecondary} x={0} y={48}>θ (polaire): <tspan fill={UI.accent} fontWeight={600}>{outAngles.thetaDeg.toFixed(2)}°</tspan></text>
                  <text fontSize={11} fill={UI.textSecondary} x={0} y={70}>Élévation: <tspan fill={UI.accent} fontWeight={600}>{outAngles.elevDeg.toFixed(2)}°</tspan></text>
                  <text fontSize={11} fill={UI.accent} fontWeight={700} x={0} y={92}>📏 Distance: {outAngles.V.toFixed(1)} mm</text>
                </g>
              </svg>
              <div style={{
                padding:"12px 16px",
                backgroundColor:UI.bgWhite,
                borderTop:`1px solid ${UI.border}`,
                fontSize:"12px",
                color:UI.textSecondary,
              }}>
                <div style={{color:UI.accent, fontWeight:600}}>
                  📊 Vue 2D - Plan XY (vue de dessus)
                </div>
              </div>
            </div>
          )}
        </>
      )}
    />
  );
}
