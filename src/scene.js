// The film set: espresso machine on a walnut counter, scroll-driven camera and brewing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTexture, plasterTexture, dialTexture, cremaTexture, softDot, puffTexture } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;

// camera path, one key per beat of the story
const KEYS = [
  { p: 0.0, pos: V(0.0, 0.26, 1.7), at: V(0, 0.15, 0), fov: 30 },
  { p: 0.16, pos: V(0.66, 0.38, 0.98), at: V(0, 0.22, 0.06), fov: 30 },
  { p: 0.33, pos: V(0.3, 0.3, 0.66), at: V(0, 0.2, 0.25), fov: 30 },
  { p: 0.5, pos: V(-0.14, 0.16, 0.54), at: V(0, 0.132, 0.275), fov: 28 },
  { p: 0.68, pos: V(-0.24, 0.33, 0.46), at: V(0, 0.115, 0.28), fov: 30 },
  { p: 0.84, pos: V(-0.62, 0.44, 0.98), at: V(0.02, 0.2, 0.05), fov: 32 },
  { p: 1.0, pos: V(-0.3, 0.55, 1.75), at: V(0.12, 0.22, 0), fov: 32 },
];
const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.pos), false, 'centripetal');
const atCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.at), false, 'centripetal');
// map scroll progress to curve parameter so keys land on their p
function curveT(p) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (p <= b.p) return (i + ease((p - a.p) / (b.p - a.p))) / (KEYS.length - 1);
  }
  return 1;
}
function fovAt(p) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (p <= b.p) return THREE.MathUtils.lerp(a.fov, b.fov, ease((p - a.p) / (b.p - a.p)));
  }
  return KEYS[KEYS.length - 1].fov;
}

const NOISE_GLSL = /* glsl */ `
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
`;

// walnut grain from local position, so parts without UVs still look like wood
function woodify(mat) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\n' + NOISE_GLSL)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wg = vLocal.y*55.0 + fbm(vLocal*vec3(60.0,6.0,60.0))*3.0;
        float ring = 0.5+0.5*sin(wg*6.2831);
        float fine = fbm(vLocal*vec3(900.0,40.0,900.0));
        diffuseColor.rgb *= mix(0.55, 1.18, ring*0.55 + fine*0.45);`
      );
  };
}

// final look: warm grade, vignette, grain, a touch of lens fringe
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.0 },
    uGrain: { value: 0.035 },
    uFringe: { value: 0.0007 },
    uFade: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uFringe, uFade; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv-0.5; float r = dot(d,d);
      vec2 off = d*uFringe*(1.0+r*6.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv+off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv-off).b);
      // warm split-tone: shadows toward roast brown, highlights toward cream
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c, c*vec3(1.06,0.98,0.88), 0.6);
      c *= mix(1.0, smoothstep(0.95, 0.12, r*1.9), uVignette);
      c += (rnd(vUv*vec2(1731.0,977.0)+fract(uTime*7.31))-0.5)*uGrain;
      gl_FragColor = vec4(c*uFade, 1.0);
    }`,
};

export function createScene(canvas, { onProgress } = {}) {
  const isSmall = Math.min(innerWidth, innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio, isSmall ? 1.5 : 1.6);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090504');
  scene.fog = new THREE.FogExp2('#090504', 0.16);

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.02, 30);
  camera.position.copy(KEYS[0].pos);

  // ---------- reflections: a dark room with warm softboxes ----------
  {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color('#120a07');
    // soft-edged light cards so chrome reflects glows, not hard rectangles
    const glow = softDot(false);
    const box = (w, h, c, pos, look) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: c, map: glow, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.position.copy(pos);
      m.lookAt(look);
      env.add(m);
    };
    box(5, 3, new THREE.Color(5.5, 4.4, 3.4), V(-2.5, 3, 1.5), V(0, 0, 0)); // big warm key
    box(1.4, 6, new THREE.Color(2.4, 1.2, 0.5), V(3, 1, -1.5), V(0, 0, 0)); // orange strip right
    box(6, 1.2, new THREE.Color(2.2, 1.8, 1.5), V(0, 4, -2), V(0, 0, 0)); // top line
    box(4, 2.4, new THREE.Color(0.9, 0.6, 0.42), V(0, 0.5, 4), V(0, 0, 0)); // faint front bounce
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#2a160c' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    env.add(floor);
    scene.environment = pm.fromScene(env, 0.04).texture;
    scene.environmentIntensity = 0.7;
    pm.dispose();
  }

  // ---------- lights ----------
  const key = new THREE.SpotLight('#ffd6b0', 5.5, 4, 0.55, 0.85, 1.6);
  key.position.set(-0.55, 1.15, 0.7);
  key.target.position.set(0, 0.12, 0.1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 6;
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 3;
  scene.add(key, key.target);
  const rimR = new THREE.SpotLight('#ff8a3d', 3.2, 4, 0.6, 1, 1.4);
  rimR.position.set(0.85, 0.55, -0.7);
  rimR.target.position.set(0, 0.2, 0);
  scene.add(rimR, rimR.target);
  const rimL = new THREE.SpotLight('#ffe0bf', 2.4, 4, 0.6, 1, 1.4);
  rimL.position.set(-0.9, 0.35, -0.5);
  rimL.target.position.set(0, 0.2, 0);
  scene.add(rimL, rimL.target);
  const wallWash = new THREE.SpotLight('#ffab6e', 2.6, 5, 0.9, 1, 1.2);
  wallWash.position.set(0.2, 1.6, 0.2);
  wallWash.target.position.set(0, 0.5, -1.1);
  scene.add(wallWash, wallWash.target);
  scene.add(new THREE.HemisphereLight('#6b4632', '#0a0503', 0.2));
  const cupGlow = new THREE.PointLight('#ffb070', 0, 0.5, 2);
  cupGlow.position.set(0, 0.2, 0.42);
  scene.add(cupGlow);

  // ---------- set: counter, wall, lamp, beans, bokeh ----------
  const wood = woodTexture();
  wood.repeat.set(1.6, 1);
  const counterMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.28 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.9), counterMat);
  counter.position.set(0, -0.03, -0.2);
  counter.receiveShadow = true;
  scene.add(counter);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.03), wallMat);
  wall.position.set(0, 0.95, -1.15);
  wall.receiveShadow = true;
  scene.add(wall);
  const setWallName = (name) => {
    wallMat.map = plasterTexture(name);
    wallMat.needsUpdate = true;
  };

  // pendant lamp, top-left of the wide shot
  const lamp = new THREE.Group();
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#1a120d', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 48, 1, true), shadeMat);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.2, 2.6) });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), bulbMat);
  bulb.position.y = -0.04;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 1.2, 6), new THREE.MeshBasicMaterial({ color: '#050302' }));
  cord.position.y = 0.65;
  lamp.add(shade, bulb, cord);
  lamp.position.set(-0.5, 0.86, -0.15);
  scene.add(lamp);
  const lampLight = new THREE.PointLight('#ffb36b', 1.6, 2.5, 2);
  lampLight.position.set(-0.5, 0.8, -0.15);
  scene.add(lampLight);

  // string of bulbs across the back wall: turns into bokeh when out of focus
  const bulbs = new THREE.Group();
  const bulbGeo = new THREE.SphereGeometry(0.012, 12, 8);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = -2.3 + t * 4.6;
    const y = 1.55 - Math.sin(t * Math.PI * 3) ** 2 * 0.22 - 0.05;
    const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.3).multiplyScalar(0.6 + Math.random() * 0.6) }));
    b.position.set(x, y, -1.1);
    bulbs.add(b);
  }
  scene.add(bulbs);

  // floating bokeh dust in the beam
  const dotTex = softDot(true);
  const dust = new THREE.Points(
    (() => {
      const g = new THREE.BufferGeometry();
      const n = 140, p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        p[i * 3] = (Math.random() - 0.5) * 2.6;
        p[i * 3 + 1] = Math.random() * 1.4;
        p[i * 3 + 2] = -1 + Math.random() * 1.9;
        s[i] = Math.random();
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      return g;
    })(),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uTex: { value: dotTex }, uPx: { value: DPR } },
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.y += mod(uTime*0.012*(0.4+seed) + seed*3.0, 1.4) - 0.2;
          p.x += sin(uTime*0.2+seed*30.0)*0.05;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = (2.0+seed*5.0)*uPx*(1.0/ -mv.z);
          vA = 0.1*smoothstep(0.0,0.3,seed);
        }`,
      fragmentShader: /* glsl */ `uniform sampler2D uTex; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(1.0,0.72,0.45)*t.a*vA, 1.0); }`,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  // coffee beans scattered on the counter
  {
    const beanGeo = new THREE.SphereGeometry(0.0062, 16, 12);
    beanGeo.scale(1, 0.62, 0.78);
    const beanMat = new THREE.MeshPhysicalMaterial({ color: '#2a1408', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    beanMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vL;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvL = position;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vL;').replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float crease = smoothstep(0.0009, 0.0, abs(vL.z + sin(vL.x*500.0)*0.0004)) * step(0.0, vL.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05,0.02,0.01), crease);`
      );
    };
    const N = 90;
    const beans = new THREE.InstancedMesh(beanGeo, beanMat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      // a loose spill to the right of the machine and a few strays
      const cluster = i < 70;
      const a = Math.random() * Math.PI * 2, r = cluster ? Math.sqrt(Math.random()) * 0.07 : 0.05 + Math.random() * 0.25;
      const x = cluster ? 0.3 + Math.cos(a) * r * 1.5 : 0.2 + Math.cos(a) * r;
      const z = cluster ? 0.28 + Math.sin(a) * r : 0.3 + Math.sin(a) * r * 0.6;
      e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
      q.setFromEuler(e);
      m.compose(V(x, 0.0038 + (cluster && r < 0.03 ? 0.006 * Math.random() : 0), z), q, V(1, 1, 1).multiplyScalar(0.9 + Math.random() * 0.25));
      beans.setMatrixAt(i, m);
    }
    beans.castShadow = true;
    beans.receiveShadow = true;
    scene.add(beans);
  }

  // ---------- the machine ----------
  const parts = {};
  const machine = new THREE.Group();
  scene.add(machine);
  const dialMats = {};

  const mats = {
    steel: new THREE.MeshPhysicalMaterial({ color: '#d2cfcb', metalness: 1, roughness: 0.32, clearcoat: 0.25, clearcoatRoughness: 0.3 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: '#f4efe8', metalness: 1, roughness: 0.1 }),
    dark: new THREE.MeshPhysicalMaterial({ color: '#120b08', metalness: 0.4, roughness: 0.4, clearcoat: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#0d0a08', roughness: 0.85 }),
    walnut: new THREE.MeshPhysicalMaterial({ color: '#4a2716', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    brass: new THREE.MeshPhysicalMaterial({ color: '#d9a35f', metalness: 1, roughness: 0.22 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#c2b5a3', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }),
    coffee: new THREE.MeshPhysicalMaterial({ color: '#1c0c05', roughness: 0.1, clearcoat: 1 }),
    crema: (() => {
      const t = cremaTexture();
      return new THREE.MeshPhysicalMaterial({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
    })(),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 2.2 }),
    inlay: new THREE.MeshPhysicalMaterial({ color: '#efe3cf', roughness: 0.35, clearcoat: 0.6, emissive: '#3a2614', emissiveIntensity: 0.35 }),
    needle: new THREE.MeshStandardMaterial({ color: '#b2341a', roughness: 0.4 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 3.2, 0.8) }),
    grate: new THREE.MeshPhysicalMaterial({ color: '#7e7872', metalness: 1, roughness: 0.38 }),
  };
  woodify(mats.walnut);

  const loader = new GLTFLoader();
  const ready = new Promise((resolve, reject) => {
    loader.load(
      './models/machine.glb',
      (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.name) parts[o.name] = parts[o.name] || o;
          if (!o.isMesh) return;
          const name = o.material?.name;
          if (name === 'dial') {
            const side = o.name.endsWith('R') ? 'R' : 'L';
            dialMats[side] = new THREE.MeshStandardMaterial({
              map: side === 'R' ? dialTexture({ max: 16, step: 2, label: 'BREW', red: [11, 16] }) : dialTexture({ max: 3, step: 0.5, label: 'BOILER', red: [2, 3] }),
              roughness: 0.55,
              emissive: '#3a2412',
              emissiveIntensity: 0.25,
            });
            o.material = dialMats[side];
          } else if (mats[name]) {
            o.material = mats[name];
          }
          o.castShadow = name !== 'glass';
          o.receiveShadow = true;
        });
        machine.add(gltf.scene);
        resolve();
      },
      (e) => onProgress?.(e.total ? e.loaded / e.total : 0.5),
      reject
    );
  });

  // ---------- espresso streams ----------
  // Two thin "mouse tails": a bead at each spout, a quick taper, a slow sway and a slight lean together.
  const streamUniforms = { uTime: { value: 0 }, uHead: { value: 0 }, uTail: { value: 0 }, uEnd: { value: 1 } };
  const makeStreamMat = (side) =>
    new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { ...streamUniforms, uSide: { value: side } },
      vertexShader: /* glsl */ `
        uniform float uTime, uSide; varying float vY; varying vec3 vN; varying vec3 vView; varying float vR;
        void main(){
          float y = 1.0 - uv.y;                       // 0 at the spout, 1 at the cup
          vY = y;
          // radius: bead under the spout, then a thin steady tail
          float r = mix(1.0, 0.42, smoothstep(0.0, 0.16, y)) + 0.06*sin(y*40.0 - uTime*30.0)*smoothstep(0.1,0.3,y);
          vR = r;
          vec3 p = position;
          p.xz *= r;
          // lean toward the other stream and sway a little
          p.x -= uSide * 0.0028 * y * y;
          p.x += sin(uTime*3.1 + y*5.0 + uSide)*0.00018*y;
          p.z += cos(uTime*2.3 + y*4.0)*0.00014*y;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          vN = normalize(normalMatrix*normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uHead, uTail, uEnd; varying float vY; varying vec3 vN; varying vec3 vView; varying float vR;
        void main(){
          if (vY > min(uHead, uEnd) || vY < uTail) discard;
          float facing = abs(dot(vN, vView));
          // thin liquid lets light through: amber in the middle, deep brown at the edges
          vec3 deep = vec3(0.018, 0.006, 0.002);
          vec3 amber = vec3(0.17, 0.062, 0.016);
          vec3 c = mix(deep, amber, pow(facing, 1.5) * mix(0.55, 1.0, smoothstep(0.1, 0.5, vY)));
          // glossy streak from the lamp, upper left
          vec3 L = normalize(vec3(-0.6, 0.5, 0.65));
          float spec = pow(max(dot(reflect(-L, vN), vView), 0.0), 24.0) + 0.6 * pow(1.0 - facing, 6.0);
          float ripple = 0.5 + 0.5*sin(vY*90.0 - uTime*42.0);
          c += vec3(0.9, 0.62, 0.38) * spec * (0.45 + 0.55*ripple);
                    float a = smoothstep(0.0, 0.02, vY - uTail) * smoothstep(0.0, 0.02, min(uHead, uEnd) - vY);
          gl_FragColor = vec4(c, 0.94 * max(a, 0.6));
        }`,
    });
  const streams = new THREE.Group();
  const SPOUT_Y = 0.149, CUP_Y = 0.088, GZ = 0.275;
  for (const sx of [-1, 1]) {
    const L = SPOUT_Y - CUP_Y;
    const geo = new THREE.CylinderGeometry(0.0021, 0.0021, L, 16, 90, true);
    const m = new THREE.Mesh(geo, makeStreamMat(sx));
    m.position.set(sx * 0.009, CUP_Y + L / 2, GZ);
    streams.add(m);
  }
  scene.add(streams);

  // ---------- steam ----------
  function makeSteam(n, origin, spread, rise, size) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = origin.x;
      p[i * 3 + 1] = origin.y;
      p[i * 3 + 2] = origin.z;
      s[i] = i / n;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uTex: { value: puffTex }, uAmt: { value: 0 }, uPx: { value: DPR * innerHeight }, uSpread: { value: spread }, uRise: { value: rise }, uSize: { value: size } },
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime, uPx, uSpread, uRise, uSize; varying float vLife; varying float vRot;
        void main(){
          float life = fract(uTime*0.22 + seed*7.31);
          vLife = life;
          vec3 p = position;
          float sw = seed*43.0;
          p.y += life*uRise;
          p.x += sin(life*5.0 + sw)*uSpread*life + (fract(sw)-0.5)*uSpread*0.4;
          p.z += cos(life*4.0 + sw*1.3)*uSpread*life*0.7;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = uSize*(0.35+life*1.4)*uPx/(-mv.z);
          vRot = sw + life*1.5;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform float uAmt; varying float vLife; varying float vRot;
        void main(){
          vec2 c = gl_PointCoord-0.5; float s=sin(vRot), co=cos(vRot);
          vec2 uv = vec2(c.x*co-c.y*s, c.x*s+c.y*co)+0.5;
          float a = texture2D(uTex, uv).a * smoothstep(0.08,0.35,vLife)*(1.0-vLife) * uAmt;
          gl_FragColor = vec4(vec3(1.0,0.93,0.86), a*0.26);
        }`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return mat;
  }
  const puffTex = puffTexture();
  const cupSteam = makeSteam(40, V(0, 0.142, GZ), 0.018, 0.2, 0.045);
  const wandSteam = makeSteam(60, V(-0.147, 0.068, 0.285), 0.03, 0.12, 0.06);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(DPR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 1.6, aperture: 0.004, maxblur: 0.008 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.14, 0.35, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ---------- state ----------
  const state = {
    p: 0, // smoothed scroll progress
    target: 0,
    intro: 0, // 0 = blurred, 1 = in focus (opening pull-focus)
    mx: 0, my: 0, smx: 0, smy: 0,
    burst: 0, // steam wand burst from a click
    running: true,
    mode: 'film', // 'film' | 'contact'
    contact: 0,
  };
  const tmpPos = new THREE.Vector3(), tmpAt = new THREE.Vector3();
  const contactPos = V(0.55, 0.3, 0.95), contactAt = V(-0.05, 0.2, 0.08);

  addEventListener('pointermove', (e) => {
    state.mx = e.clientX / innerWidth - 0.5;
    state.my = e.clientY / innerHeight - 0.5;
  });

  // click the machine: open the steam valve
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), camera);
    return ray.intersectObject(machine, true)[0];
  }
  function steamBurst() {
    state.burst = 1;
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    cupSteam.uniforms.uPx.value = wandSteam.uniforms.uPx.value = DPR * innerHeight;
  }
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    requestAnimationFrame(frame);
    if (!state.running) return;

    state.p += (state.target - state.p) * (1 - Math.exp(-dt * 5));
    state.smx += (state.mx - state.smx) * (1 - Math.exp(-dt * 3));
    state.smy += (state.my - state.smy) * (1 - Math.exp(-dt * 3));
    const p = state.p;

    // camera
    const ct = curveT(p);
    posCurve.getPoint(ct, tmpPos);
    atCurve.getPoint(ct, tmpAt);
    if (state.contact > 0) {
      tmpPos.lerp(contactPos, state.contact);
      tmpAt.lerp(contactAt, state.contact);
    }
    const dist = tmpPos.distanceTo(tmpAt);
    const right = tmpPos.clone().sub(tmpAt).cross(V(0, 1, 0)).normalize();
    tmpPos.addScaledVector(right, -state.smx * 0.06 * dist);
    tmpPos.y += state.smy * 0.04 * dist;
    camera.position.copy(tmpPos);
    camera.lookAt(tmpAt);
    camera.fov = fovAt(p);
    camera.updateProjectionMatrix();

    // focus: opening pull from soft to sharp, then always on the subject
    const blur = (1 - easeOut(state.intro)) * 0.03;
    bokeh.uniforms.focus.value = dist;
    bokeh.uniforms.aperture.value = 0.0028 + (1 - state.intro) * 0.03;
    bokeh.uniforms.maxblur.value = 0.004 + blur;

    // story beats
    const pf = parts.portafilter, lever = parts.lever;
    const lock = ease(seg(p, 0.18, 0.32));
    if (pf) {
      pf.rotation.y = -0.85 * (1 - lock);
      pf.position.y = 0.232 - 0.008 * (1 - lock);
    }
    const lift = ease(seg(p, 0.34, 0.39)) * (1 - ease(seg(p, 0.62, 0.66)));
    if (lever) lever.rotation.x = -0.95 * lift;
    const flow = seg(p, 0.4, 0.62);
    streamUniforms.uHead.value = ease(seg(p, 0.395, 0.42));
    streamUniforms.uTail.value = ease(seg(p, 0.6, 0.64));
    // the stream stops where it meets the rising coffee
    streamUniforms.uEnd.value = (SPOUT_Y - (0.0895 + 0.0305 * ease(seg(p, 0.4, 0.62)))) / (SPOUT_Y - CUP_Y);
    streams.visible = streamUniforms.uHead.value > 0.001 && streamUniforms.uTail.value < 0.999;
    const fill = ease(flow);
    const fillNode = parts.coffee_fill;
    if (fillNode) {
      fillNode.visible = fill > 0.01;
      // follow the inside of the cup as it widens
      const h = 0.012 + 0.03 * fill;
      const rIn = h < 0.0128 ? 0.025 * (h / 0.0128) : h < 0.024 ? 0.025 + ((h - 0.0128) / 0.0112) * 0.0045 : 0.0295 + ((h - 0.024) / 0.0208) * 0.0015;
      const sxz = Math.max(0.2, (rIn - 0.0006) / 0.0308);
      fillNode.scale.set(sxz, Math.max(0.001, fill), sxz);
    }
    const bar = 9 * ease(seg(p, 0.36, 0.45)) * (1 - ease(seg(p, 0.62, 0.68)));
    if (parts.needle_R) parts.needle_R.rotation.z = Math.PI * 0.75 - (bar + Math.sin(t * 13) * 0.08 * (bar > 1 ? 1 : 0)) / 16 * Math.PI * 1.5;
    if (parts.needle_L) parts.needle_L.rotation.z = Math.PI * 0.75 - (1.15 + Math.sin(t * 0.7) * 0.03) / 3 * Math.PI * 1.5;
    cupGlow.intensity = 0.05 * fill;
    cupSteam.uniforms.uAmt.value = 0.75 * seg(p, 0.6, 0.7) + 0.25 * fill;
    state.burst = Math.max(0, state.burst - dt * 0.45);
    const wandAuto = seg(p, 0.78, 0.82) * (1 - seg(p, 0.9, 0.95));
    wandSteam.uniforms.uAmt.value = Math.max(state.burst, wandAuto) * 1.4;
    if (parts.steam_knob) parts.steam_knob.rotation.z = -Math.max(state.burst, wandAuto) * 1.4;

    // life
    for (const m of [cupSteam, wandSteam]) m.uniforms.uTime.value = t;
    streamUniforms.uTime.value = t;
    dust.material.uniforms.uTime.value = t;
    grade.uniforms.uTime.value = t;
    mats.led.color.setRGB(8 * (0.85 + Math.sin(t * 2) * 0.15), 3.2, 0.8);
    lamp.rotation.z = Math.sin(t * 0.5) * 0.015;

    composer.render(dt);
  }

  return {
    ready,
    camera,
    debug: { renderer, composer, bokeh, bloom, grade, scene, key, cupSteam, wandSteam, dust },
    setWallName,
    start() {
      clock.start();
      frame();
    },
    setProgress(p) {
      state.target = clamp01(p);
    },
    snap() {
      state.p = state.target;
      state.smx = state.mx;
      state.smy = state.my;
    },
    setIntro(v) {
      state.intro = v;
    },
    setContact(v) {
      state.contact = v;
    },
    setRunning(v) {
      if (v && !state.running) clock.getDelta();
      state.running = v;
    },
    setFade(v) {
      grade.uniforms.uFade.value = v;
    },
    pick,
    steamBurst,
    get progress() {
      return state.p;
    },
  };
}
