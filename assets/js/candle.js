/* ============================================================================
   candle.js — the living flame (WebGL / Three.js, ES module)
   Proven head-on framing (visible) + burn-down with reading progress (LTYS) +
   draft-reactive flicker. Single-flight rAF, pauses off-screen / tab-hidden,
   survives context loss and slow CDN. CSS fallback candle if WebGL/RM off.
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

  const lowPower = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || window.devicePixelRatio > 2.5;
  const lift = lowPower ? 1.0 : 0;   // raise the candle on phones so the flame crowns and the wax clears the title
  const burn = (window.LTYS && typeof LTYS.progress === "function") ? LTYS.progress() * 0.7 : 0;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lowPower, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.4 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.95, 5.4);

  scene.add(new THREE.AmbientLight(0x2a2118, 0.6));
  const flameLight = new THREE.PointLight(0xffb066, 6, 9, 2);
  flameLight.position.set(0, 0.55 - burn + lift, 0.35);
  scene.add(flameLight);
  const rim = new THREE.DirectionalLight(0x6688cc, 0.15); rim.position.set(-2, 1, -2); scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  if (lowPower) camera.position.z = 6.6;   // smaller candle on phones
  group.position.y = lift;                 // and raised so it crowns the title instead of impaling it

  const waxMat = new THREE.MeshStandardMaterial({ color: 0xb9a87f, roughness: 0.78, emissive: 0x3a2a14, emissiveIntensity: 0.12 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.7, 48, 1), waxMat);
  body.position.y = -1.15; group.add(body);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.33, 40), new THREE.MeshStandardMaterial({ color: 0x9a8157, roughness: 0.62, emissive: 0x4a3214, emissiveIntensity: 0.15 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -0.30 - burn; group.add(pool);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0x140d08 }));
  wick.position.y = -0.21 - burn; group.add(wick);

  const NOISE = `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
    float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.02; a*=0.5;} return v; }`;

  const flameUniforms = { uTime: { value: 0 }, uFlick: { value: 1 } };
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: flameUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: NOISE + `
      varying vec2 vUv; uniform float uTime; uniform float uFlick;
      void main(){
        vec2 p=vUv; float t=p.y; float cx=p.x-0.5;
        float n=fbm(vec2(p.x*2.0, p.y*3.6 - uTime*1.7));
        cx += (n-0.5)*0.11*smoothstep(0.04,1.0,t);
        float base=smoothstep(0.0,0.10,t); float taper=pow(max(1.0-t,0.0),0.60);
        float w=0.34*base*taper; float d=abs(cx)/max(w,0.001);
        float flame=1.0-smoothstep(0.55,1.05,d);
        float core=1.0-smoothstep(0.0,0.6,d);
        float heat=clamp(core*(1.0-t*0.55)+(1.0-t)*0.25,0.0,1.0);
        vec3 col=mix(vec3(0.75,0.12,0.03),vec3(1.0,0.45,0.12),smoothstep(0.15,0.45,heat));
        col=mix(col,vec3(1.0,0.78,0.34),smoothstep(0.45,0.72,heat));
        col=mix(col,vec3(1.0,0.96,0.85),smoothstep(0.72,0.95,heat));
        col=mix(col,vec3(0.4,0.55,0.95),smoothstep(0.0,0.05,t)*(1.0-smoothstep(0.05,0.13,t))*0.6*core);
        float a=flame*uFlick; a*=smoothstep(1.0,0.65,t)*0.6+0.4;
        if(a<0.004) discard;
        gl_FragColor=vec4(col*(0.6+heat*0.85), a);
      }`,
  });
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), flameMat);
  flame.position.y = 0.55 - burn; group.add(flame);

  const glowUniforms = { uFlick: { value: 1 }, uColor: { value: new THREE.Color(0xff9a4a) } };
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: glowUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec2 vUv; uniform float uFlick; uniform vec3 uColor;
      void main(){ float dd=distance(vUv,vec2(0.5)); float a=pow(1.0-clamp(dd*2.0,0.0,1.0),2.6); gl_FragColor=vec4(uColor, a*0.42*uFlick);} `,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), glowMat);
  glow.position.set(0, 0.55 - burn, -0.2); group.add(glow);

  function dotTexture() {
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d"), grd = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,220,170,0.85)"); grd.addColorStop(1, "rgba(255,180,120,0)");
    g.fillStyle = grd; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(c);
  }
  const sprite = dotTexture();

  const EMB = lowPower ? 26 : 46;
  const embPos = new Float32Array(EMB * 3), embData = [], embBase = -0.15 - burn;
  function seedEmber(i, fresh) {
    embData[i] = { x0: (Math.random()-0.5)*0.18, z: (Math.random()-0.5)*0.2, speed: 0.25+Math.random()*0.5,
      sway: 0.05+Math.random()*0.12, phase: Math.random()*6.28, life: fresh ? Math.random() : 0, max: 1.6+Math.random()*1.8 };
  }
  for (let i = 0; i < EMB; i++) seedEmber(i, true);
  const embMat = new THREE.PointsMaterial({ size: lowPower ? 0.07 : 0.055, map: sprite, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff9a44 });
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
  window.addEventListener("pointermove", (e) => {
    const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
    target.x = (nx - 0.5) * 0.5; target.y = (ny - 0.5) * 0.3;
    draft = Math.min(1, draft + Math.hypot(nx - lastPx, ny - lastPy) * 6);
    lastPx = nx; lastPy = ny; lastMove = performance.now();
  }, { passive: true });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let gust = 0, gustT = 0;
  function flicker(t) {
    const v = 0.86 + 0.06*Math.sin(t*11.3) + 0.04*Math.sin(t*23.7+1.2) + 0.03*Math.sin(t*5.1+0.6);
    if (t > gustT) { gust = Math.random() < 0.25 ? Math.random()*0.22 : 0; gustT = t + 0.2 + Math.random()*0.9; }
    return Math.max(0.55, v - gust - draft * 0.3);
  }

  const clock = new THREE.Clock();
  // Gate only on on-screen visibility. Hidden-tab throttling is handled natively
  // by the browser's rAF suspension, so an explicit document.hidden gate would
  // wrongly block even the first synchronous render in a backgrounded tab.
  let rafId = null, onScreen = true;
  function activeNow() { return onScreen; }
  function loop() {
    rafId = null; if (!activeNow()) return; rafId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    draft *= 0.94; if (performance.now() - lastMove > 1200) draft *= 0.9;
    const f = flicker(t);
    flameUniforms.uTime.value = t; flameUniforms.uFlick.value = f;
    glowUniforms.uFlick.value = 0.7 + f * 0.5;
    flameLight.intensity = 3.4 + f * 2.6; flameLight.position.x = (f - 0.85) * 0.25;
    flame.scale.x = 0.92 + f * 0.12;

    for (let i = 0; i < EMB; i++) {
      const e = embData[i]; e.life += 0.016 * e.speed; if (e.life > e.max) seedEmber(i, false);
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
    glow.lookAt(camera.position.x, glow.position.y, camera.position.z);
    renderer.render(scene, camera);
  }
  function kick() { if (activeNow() && rafId === null) loop(); }

  document.addEventListener("visibilitychange", () => { kick(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0 }).observe(canvas);
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onScreen = false; root.classList.add("no-webgl"); });

  loop();
  root.classList.add("webgl-on");
}
