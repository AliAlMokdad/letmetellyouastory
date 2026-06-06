/* ============================================================================
   candle.js — the living flame (WebGL / Three.js, ES module)
   Proven head-on framing (visible) + burn-down with reading progress (LTYS) +
   draft-reactive flicker. Single-flight rAF, pauses off-screen / tab-hidden,
   survives context loss and slow CDN. CSS fallback candle if WebGL/RM off.
   Flame is a combustion SHELL: dark inner cone + bright reaction ring, blackbody
   ramp, height-delayed turbulence, soft-clipped core (no harsh halation). The
   wax glows translucently from within and the room glow rises like warm air.
   ========================================================================== */
const root = document.documentElement;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("candle-canvas");

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch (e) { return false; }
}
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

if (!canvas || reduced || !hasWebGL()) {
  root.classList.add(reduced ? "reduced" : "no-webgl");
} else {
  boot().catch(() => root.classList.add("no-webgl"));
}

async function boot() {
  const THREE = await withTimeout(import("/assets/js/three.module.js?v=160m"), 6000);

  // lowPower uses min(w,h) so a phone booted in landscape still takes the cheap path
  const lowPower = Math.min(window.innerWidth, window.innerHeight) < 760 || (navigator.hardwareConcurrency || 8) <= 4 || window.devicePixelRatio > 2.5;
  const isPhone = () => window.innerWidth <= 720;    // match the CSS breakpoint exactly
  const isShort = () => window.innerHeight <= 600;   // landscape phones / short windows
  let lift = isPhone() ? 1.0 : 0;   // raise the candle on phones so the flame crowns and the wax clears the title
  const burn = (window.LTYS && typeof LTYS.progress === "function") ? LTYS.progress() * 0.7 : 0;
  const waxFlick = { value: 1 };    // flame -> wax coupling: the translucent wax glow pulses with the flame

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowPower, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.95, 5.2);

  scene.add(new THREE.AmbientLight(0x2a2118, 0.6));
  const flameLight = new THREE.PointLight(0xffb066, 6, 9, 2);
  flameLight.position.set(0, 0.55 - burn + lift, 0.35);
  scene.add(flameLight);
  const rim = new THREE.DirectionalLight(0x6688cc, 0.15); rim.position.set(-2, 1, -2); scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  // Framing reacts to viewport (orientation/resize) so the flame always crowns the
  // title instead of impaling it — recomputed in resize().
  function frame() {
    lift = isShort() ? 0.4 : (isPhone() ? 1.0 : 0);   // gentler lift in landscape so the flame never flies off-top
    camera.position.z = isPhone() ? 6.6 : 5.2;        // smaller candle on phones
    group.position.y = lift;
    flameLight.position.y = 0.55 - burn + lift;       // keep the key light married to the flame
  }
  frame();

  // wax body — translucent: the flame's light enters the top centimetre and re-emerges as a
  // warm internal glow, brightest at the lip, pulsing with the flame (onBeforeCompile SSS).
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xb9a87f, roughness: 0.82, metalness: 0.0, emissive: 0x000000, emissiveIntensity: 1.0 });
  waxMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlick = waxFlick;
    sh.uniforms.uWaxTopY = { value: 0.85 };   // local-space y of the cylinder top (height 1.7 => +0.85)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vLocalPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLocalPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n uniform float uFlick; uniform float uWaxTopY; varying vec3 vLocalPos;')
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float waxDepth = clamp((uWaxTopY - vLocalPos.y) / 1.7, 0.0, 1.0);   // 0 at top, 1 at base
        float topGlow = pow(1.0 - waxDepth, 2.6);                           // bright lip, quick falloff
        float rimWrap = pow(1.0 - abs(dot(normalize(vViewPosition), vNormal)), 2.0);
        vec3 waxCore = vec3(1.0, 0.50, 0.20);                               // deep warm transmitted color (NOT white)
        float waxGlow = (topGlow*0.85 + rimWrap*topGlow*0.6) * (0.55 + 0.45*uFlick);
        totalEmissiveRadiance += waxCore * waxGlow * 0.9;
      `);
  };
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.7, 48, 1), waxMat);
  body.position.y = -1.15; group.add(body);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.33, 48), new THREE.MeshStandardMaterial({ color: 0x6f5a39, roughness: 0.30, metalness: 0.0, emissive: 0x3a2510, emissiveIntensity: 0.22 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -0.30 - burn; group.add(pool);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.018, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0x140d08 }));
  wick.position.y = -0.235 - burn; group.add(wick);   // tuck the wick base into the dark inner cone

  const NOISE = (oct) => `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
    #define OCTAVES ${oct}
    float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<OCTAVES;i++){ v+=a*vnoise(p); p*=2.02; a*=0.5;} return v; }`;

  const flameUniforms = { uTime: { value: 0 }, uFlick: { value: 1 } };
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: flameUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: NOISE(lowPower ? 3 : 4) + (lowPower ? "\n#define LOWP\n" : "\n") + `
      varying vec2 vUv; uniform float uTime; uniform float uFlick;
      void main(){
        vec2 p=vUv; float t=p.y; float cx=p.x-0.5;

        // ---- motion: height-DELAYED sway so the tip leans/curls while the base stays planted ----
        float sway = fbm(vec2(0.0, t*0.55 - p.y*1.6)) - 0.5;   // perturbation advects UP the flame
        float grade = smoothstep(0.06, 1.0, t);                // 0 at wick, 1 at tip
        cx += sway * 0.085 * grade;                            // body lean
        #ifndef LOWP
          float tip = fbm(vec2(p.x*1.3, p.y*3.2 - uTime*2.1)) - 0.5;  // fine tip fray (desktop only)
          cx += tip * 0.05 * grade * grade;
        #endif

        // ---- silhouette: rounded shoulder (gaussian) + neck below the tip + soft taper ----
        float base  = smoothstep(0.0,0.07,t);
        float sg = (t-0.30)/0.27; float swell = 1.0 + 0.42*exp(-sg*sg);   // fuller bulbous shoulder (square via *, not pow: GLSL pow() UB for negative base)
        float ng = (t-0.74)/0.13; float neck  = 1.0 - 0.20*exp(-ng*ng);   // gentle waist below the tip
        float taper = pow(max(1.0-t,0.0), 1.32);                  // rounded teardrop point, not a thin spike
        float w = 0.36 * base * taper * swell * neck;
        float d = abs(cx)/max(w,0.001);

        float flame = 1.0 - smoothstep(0.46, 0.92, d);   // soft silhouette
        float edge  = smoothstep(0.30, 0.92, d);         // 0 centre -> 1 at silhouette (cool reaction rim)

        // ---- internal luminous structure: brightness peaks at a RING, dips on the axis ----
        float shell = 1.0 - smoothstep(0.18, 0.62, abs(d - 0.46));   // bright reaction ring
        float coneV = smoothstep(0.02,0.10,t) * (1.0 - smoothstep(0.10,0.40,t)); // dark pocket placed low
        float coneH = 1.0 - smoothstep(0.0, 0.34, d);                            // hugs the centreline
        float cone  = coneV * coneH;                                             // 0..1 dark inner cone
        float lobe  = smoothstep(0.05,0.22,t) * (1.0 - smoothstep(0.45,1.0,t)) + 0.18; // luminous low-mid

        cone  *= 0.78 + 0.32*uFlick;     // couple internal zones to the flicker so the core breathes
        shell *= 0.86 + 0.18*uFlick;

        float T = clamp(shell*lobe - cone*0.60, 0.0, 1.0);   // temperature field
        T -= edge*0.30;                                       // outer reaction edge runs cooler/redder
        T = clamp(T, 0.0, 1.0);

        // ---- blackbody-ish ramp: cool-red root -> orange -> amber -> warm-white core (never harsh white) ----
        vec3 col = vec3(0.62,0.11,0.02);                                 // deep cool red (tip / outer)
        col = mix(col, vec3(0.85,0.26,0.05), smoothstep(0.10,0.34,T));   // red-orange
        col = mix(col, vec3(1.00,0.49,0.12), smoothstep(0.30,0.56,T));   // orange
        col = mix(col, vec3(1.00,0.72,0.30), smoothstep(0.52,0.78,T));   // amber-yellow
        col = mix(col, vec3(1.00,0.84,0.52), smoothstep(0.80,0.97,T));   // warm core kept amber (B well under R) -> no white halation

        // faint blue collar at the very base around the wick
        col = mix(col, vec3(0.30,0.46,0.92),
                  smoothstep(0.0,0.035,t)*(1.0-smoothstep(0.05,0.15,t))*0.6*coneH);

        // translucent reddish outer veil just outside the bright body (kills the cutout edge)
        float veil = max((1.0 - smoothstep(0.80,1.35,d)) - flame, 0.0);
        col = mix(col, vec3(0.85,0.22,0.05), veil*0.55);

        float a = flame*uFlick;
        a *= 0.4 + 0.6*(1.0 - smoothstep(0.65,1.0,t));   // spec-correct alpha fade toward the tip
        a *= 1.0 - cone*0.42;                            // the dark cone is also a touch more transparent
        a  = max(a, veil*0.10*uFlick);                   // give the veil a faint presence
        if(a<0.004) discard;

        float b = 0.42 + T*0.70;                         // brightness from temperature (calmer peak so the core stays warm, not white)
        b = b / (1.0 + 0.50*max(b-1.0,0.0));             // firm Reinhard shoulder -> hot core ~1.06, no white halation
        gl_FragColor = vec4(col*b, a);
      }`,
  });
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.8), flameMat);
  flame.position.y = 0.55 - burn; group.add(flame);

  function makeGlow(size, powv, mul, colorHex, zoff, squash, rise) {
    const u = { uFlick: { value: 1 }, uColor: { value: new THREE.Color(colorHex) }, uPow: { value: powv },
                uMul: { value: mul }, uSquash: { value: squash }, uRise: { value: rise } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying vec2 vUv; uniform float uFlick; uniform vec3 uColor; uniform float uPow; uniform float uMul; uniform float uSquash; uniform float uRise;
        float dither(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 q = vUv - vec2(0.5, 0.5 - uRise);   // bias the bright pool UP on the plane
          q.y *= uSquash;                          // <1 => taller halo than wide
          q.y *= (q.y > 0.0) ? 0.82 : 1.0;         // upper lobe reaches a touch further
          float dd = length(q);
          float a = pow(1.0 - clamp(dd*2.0,0.0,1.0), uPow);
          a += (dither(gl_FragCoord.xy)-0.5)*0.012;   // break 8-bit banding on the soft falloff
          gl_FragColor = vec4(uColor, max(a,0.0)*uMul*uFlick);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size*1.55), m);   // taller than wide
    mesh.position.set(0, 0.55 - burn + size*0.16, zoff);                        // centroid ABOVE the flame (group already carries `lift`)
    group.add(mesh);
    return { mesh, u };
  }
  // wide soft room throw (warmest / reddest) + tight bright core halo (warm-white)
  const glowWide = makeGlow(lowPower ? 3.2 : 3.8, 2.2, 0.22, 0xff8a38, -0.22, 0.62, 0.16);
  const glowCore = makeGlow(1.9, 3.0, 0.24, 0xffb060, -0.12, 0.70, 0.20);

  function dotTexture() {
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d"), grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,220,170,0.85)"); grd.addColorStop(1, "rgba(255,180,120,0)");
    g.fillStyle = grd; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(c);
  }
  const sprite = dotTexture();

  const EMB = lowPower ? 8 : 16;   // a still indoor candle sparks rarely (was 26/46 — that read as a campfire)
  const embPos = new Float32Array(EMB * 3), embData = [], embBase = -0.15 - burn;
  function seedEmber(i, fresh) {
    embData[i] = { x0: (Math.random()-0.5)*0.18, z: (Math.random()-0.5)*0.2, speed: 0.25+Math.random()*0.5,
      sway: 0.05+Math.random()*0.12, phase: Math.random()*6.28, life: fresh ? Math.random() : 0, max: 1.6+Math.random()*1.8 };
  }
  for (let i = 0; i < EMB; i++) seedEmber(i, true);
  const embMat = new THREE.PointsMaterial({ size: lowPower ? 0.05 : 0.055, map: sprite, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff9a44 });
  const embGeo = new THREE.BufferGeometry(); embGeo.setAttribute("position", new THREE.BufferAttribute(embPos, 3));
  const embers = new THREE.Points(embGeo, embMat); group.add(embers);

  const DUST = lowPower ? 60 : 130;
  const dustPos = new Float32Array(DUST * 3), dustVel = [];
  for (let i = 0; i < DUST; i++) {
    dustPos[i*3]=(Math.random()-0.5)*5; dustPos[i*3+1]=(Math.random()-0.5)*4; dustPos[i*3+2]=(Math.random()-0.5)*2.5;
    dustVel.push({ x:(Math.random()-0.5)*0.02, y:(Math.random()-0.2)*0.02, p:Math.random()*6.28 });
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.03, map: sprite, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xcab089 }));
  scene.add(dust);

  // pointer: parallax + a "draft" (velocity) that makes the flame duck
  const target = { x: 0, y: 0 }; let lastPx = 0, lastPy = 0, draft = 0, lastMove = 0;
  const onPointerMove = (e) => {
    const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
    target.x = (nx - 0.5) * 0.5; target.y = (ny - 0.5) * 0.3;
    draft = Math.min(1, draft + Math.hypot(nx - lastPx, ny - lastPy) * 6);
    lastPx = nx; lastPy = ny; lastMove = performance.now();
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  let lastW = 0, lastH = 0, roT = null;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (w === lastW && Math.abs(h - lastH) < 80) return;   // swallow mobile URL-bar height churn (buffer realloc jank)
    lastW = w; lastH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    frame();   // re-derive lift / zoom on orientation + resize
  }
  const ro = new ResizeObserver(() => { if (roT) return; roT = requestAnimationFrame(() => { roT = null; resize(); }); });
  ro.observe(canvas); resize();

  // cheap 1D value noise for non-periodic flicker drift (kills the audible/visible loop)
  function vn(x){ const i=Math.floor(x), f=x-i;
    let a=Math.sin(i*127.1)*43758.5453, b=Math.sin((i+1)*127.1)*43758.5453;
    a-=Math.floor(a); b-=Math.floor(b); const u=f*f*(3-2*f); return a*(1-u)+b*u; }

  let gust = 0, gustTo = 0, gustT = 0, glowLag = 1;
  function flicker(t) {
    let v = 0.90
      + 0.060*Math.sin(t*1.10 + 1.7)   // primary breath ~1.1 Hz (dominant)
      + 0.030*vn(t*0.45)               // sub-breath wander (non-periodic)
      + 0.018*Math.sin(t*3.30 + 0.6)   // gentle secondary
      + 0.010*vn(t*5.0);               // fine shimmer via noise, not a high sine
    if (t > gustT) { gustTo = Math.random() < 0.16 ? Math.random()*0.12 : 0; gustT = t + 0.6 + Math.random()*2.2; }
    gust += (gustTo - gust) * 0.06;    // smooth toward target => flares ramp & recover, no step (no micro-strobe)
    return Math.max(0.62, v - gust - draft*0.3);
  }

  const clock = new THREE.Clock();
  // Gate only on on-screen visibility. Hidden-tab throttling is handled natively
  // by the browser's rAF suspension, so an explicit document.hidden gate would
  // wrongly block even the first synchronous render in a backgrounded tab.
  let rafId = null, onScreen = true;
  function activeNow() { return onScreen && !document.hidden; }
  function loop() {
    rafId = null; if (!activeNow()) return; rafId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    draft *= 0.94; if (performance.now() - lastMove > 1200) draft *= 0.9;
    const f = flicker(t);
    const lean = Math.sin(t*0.5)*0.6;                 // slow lateral lean signal shared by the light + the flame
    flameUniforms.uTime.value = t; flameUniforms.uFlick.value = f;
    glowLag += (f - glowLag) * 0.10;                  // the far-field throw lags the core (whole-plume inertia)
    glowCore.u.uFlick.value = 0.72 + f * 0.46;        // near core: steadier, tracks the current frame
    glowWide.u.uFlick.value = 0.50 + glowLag * 0.40;  // room throw: shimmers most, lags
    flameLight.intensity = 3.2 + f * 2.4;             // ceiling 5.6 — halation insurance
    flameLight.position.x = lean * 0.10;              // cast warmth tracks the visible lean, not the scalar
    flame.scale.x = 0.92 + f * 0.12;
    flame.scale.y = 0.99 + f * 0.05;                  // taller when brighter (the flame draws up as it flares)
    waxFlick.value = f;                               // wax internal glow pulses with the flame
    pool.material.emissiveIntensity = 0.22 + 0.30 * f;

    for (let i = 0; i < EMB; i++) {
      const e = embData[i]; if (e.life <= e.max) e.life += 0.016 * e.speed;   // parked embers (life>max) stop integrating
      if (e.life > e.max) { if (f > 0.97 && Math.random() < 0.15) seedEmber(i, false); else { e.life = e.max + 999; } }
      embPos[i*3] = e.x0 + Math.sin(t*1.5+e.phase) * e.sway * (0.4 + e.life*0.5);
      embPos[i*3+1] = embBase + e.life * 0.9; embPos[i*3+2] = e.z;
    }
    embGeo.attributes.position.needsUpdate = true; embMat.opacity = 0.7 * f;

    for (let i = 0; i < DUST; i++) {
      const v2 = dustVel[i];
      dustPos[i*3] += v2.x*0.02 + Math.sin(t*0.3+v2.p)*0.0009; dustPos[i*3+1] += v2.y*0.02;
      if (dustPos[i*3+1] > 2.2) dustPos[i*3+1] = -2.2; if (dustPos[i*3+1] < -2.2) dustPos[i*3+1] = 2.2;
    }
    dustGeo.attributes.position.needsUpdate = true;

    camera.position.x += (target.x - camera.position.x) * 0.04;
    camera.position.y += (0.95 + target.y - camera.position.y) * 0.04;
    camera.lookAt(0, 0.10, 0);
    flame.lookAt(camera.position.x, flame.position.y, camera.position.z);
    flame.position.x = lean * 0.015;    // whole flame leans a touch with the breath (set AFTER lookAt)
    flame.rotation.z = -lean * 0.02;    // and shears ~1.1deg, AFTER lookAt so lookAt doesn't clobber it
    glowCore.mesh.lookAt(camera.position.x, glowCore.mesh.position.y, camera.position.z);
    glowWide.mesh.lookAt(camera.position.x, glowWide.mesh.position.y, camera.position.z);
    renderer.render(scene, camera);
  }
  function kick() { if (activeNow() && rafId === null) loop(); }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0 });
    io.observe(canvas);
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onScreen = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    window.removeEventListener("pointermove", onPointerMove); ro.disconnect(); if (io) io.disconnect();   // tear down listeners/observers when we fall back to CSS
    root.classList.add("no-webgl"); });

  loop();
  root.classList.add("webgl-on");
}
