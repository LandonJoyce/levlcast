/**
 * The replay, as a sculpture.
 *
 * Every minute of the stream is a slab of glazed porcelain standing on a
 * dark stone plinth, as tall as the streamer was talking. The row builds
 * itself, slab by slab, as the replay plays, under a stage light that
 * follows the build. Clips are slabs cast in brushed gold, and throw warm
 * light on their neighbours when they land. Dead air is left as low tiles
 * of red enamel, with a red line inlaid in the plinth in front of them;
 * the momentum crash gets the same line. Chat is a lower row of polished
 * dark stone in front. The plinth stands on a polished floor that holds a
 * soft reflection of it all.
 *
 * It's lit and shot like a real object: a warm key light with soft
 * shadows, a cool fill and a cool rim from behind, contact shadows where
 * slabs meet the plinth and in the gaps between them, faint variation in
 * every surface, a lens with a shallow depth of field while it tracks the
 * build, and bloom only where metal catches the light.
 *
 * Everything comes from one clock. The camera and the build are worked out
 * from where the replay is, never nudged frame to frame, so dragging the
 * scrubber can't send anything somewhere strange.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildChat, clockLabel, sceneAnchors, type ChatLine, type ReplayData, type SceneAnchor } from "./replay-data";

export type ReplayPhase = "intro" | "play" | "paused" | "result";

export interface SceneHud {
  clock: HTMLElement | null;
  stats: HTMLElement | null;
  /** The caption that rides with the build. */
  caption: HTMLElement | null;
  labels: Map<string, HTMLElement>;
  /** HUD blocks the annotations must not cover. */
  avoid: Array<HTMLElement | null>;
  scrubHead: HTMLElement | null;
  chatLines: HTMLElement[];
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  data: ReplayData;
  hud: SceneHud;
  reducedMotion: boolean;
  compact: boolean;
  onPhase: (phase: ReplayPhase) => void;
  onCaption: (index: number) => void;
  /** Run a gold light along the sculpture as the rank bar crosses into the new rank. */
  celebrate: boolean;
  /** Hold the replay at this second (screenshots, debugging). */
  frozenAt?: number | null;
}

export interface ReplayScene {
  toggle(): void;
  replay(): void;
  /** Dragging the scrubber: jump to this minute. */
  seek(minute: number): void;
  /** Let go of the scrubber. */
  release(): void;
  dispose(): void;
}

// ── World and timing ─────────────────────────────────────────────────────
const U = 1.3; // world units between slabs
const PH = 0.7; // plinth height; slabs stand on top of it
const HY = 22; // tallest a slab of the streamer gets
const HC = 6; // tallest a slab of chat gets
const YOU_D = 4.6; // slab depth, streamer row
const CHAT_D = 2.2; // slab depth, chat row
const CHAT_Z = YOU_D / 2 + 1.9 + CHAT_D / 2; // chat row sits in front
const GAP_Z = YOU_D / 2 + 0.95; // inlays run along the gap between the rows
const PL_Z0 = -(YOU_D / 2 + 0.9); // plinth back edge
const PL_Z1 = CHAT_Z + CHAT_D / 2 + 0.9; // plinth front edge
const INTRO = 3.2;
const SWEEP = 22;
const SW_END = INTRO + SWEEP;
const OUTRO = 3.4;
const RESULT_AT = SW_END + 0.7;
const SETTLED = SW_END + OUTRO;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function gaussian(values: number[], sigma: number): number[] {
  const r = Math.ceil(sigma * 3);
  return values.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -r; k <= r; k++) {
      const j = clamp(i + k, 0, values.length - 1);
      const w = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += values[j] * w;
      n += w;
    }
    return s / n;
  });
}

/**
 * How the replay spends its time: nearly stopping on a clip, pausing for a
 * beat on every caption so it can be read, slower through dead air, quick
 * everywhere else.
 */
function buildTimeline(d: ReplayData) {
  const D = d.minutes;
  const N = 3000;
  const cost = new Float64Array(N + 1);
  const dead = (m: number) => d.deadAir.some((s) => m >= s.start && m < s.start + s.minutes);
  for (let i = 1; i <= N; i++) {
    const m = (i / N) * D;
    let speed = 1;
    for (const c of d.clips) speed = Math.min(speed, 1 - (c.best ? 0.95 : 0.92) * Math.exp(-Math.pow((m - c.minute - 0.25) / 1.15, 2)));
    for (const c of d.captions) speed = Math.min(speed, 1 - 0.6 * Math.exp(-Math.pow((m - c.minute - 0.4) / 1.1, 2)));
    if (dead(m)) speed *= 0.55;
    cost[i] = cost[i - 1] + 1 / Math.max(0.05, speed);
  }
  const total = cost[N];
  const tAt = (minute: number) => {
    const f = clamp(minute / D, 0, 1) * N;
    const i = Math.floor(f);
    const j = Math.min(N, i + 1);
    return INTRO + (SWEEP * (cost[i] + (cost[j] - cost[i]) * (f - i))) / total;
  };
  const minuteAt = (t: number) => {
    const want = clamp((t - INTRO) / SWEEP, 0, 1) * total;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cost[mid] < want) lo = mid;
      else hi = mid;
    }
    const span = cost[hi] - cost[lo] || 1;
    return ((lo + (want - cost[lo]) / span) / N) * D;
  };
  return { tAt, minuteAt };
}

/**
 * The page's background colour, adjusted so it comes out exactly right
 * after tone mapping. The neutral tone mapper pulls the darkest values
 * down (x becomes 6.25x² near black), which would leave the stage a
 * shade darker than the page around it.
 */
function toneMappedBackground(hex: string): THREE.Color {
  const target = new THREE.Color(hex);
  const lo = Math.min(target.r, target.g, target.b);
  const x = Math.sqrt(lo / 6.25);
  const offset = x - lo;
  return new THREE.Color(target.r + offset, target.g + offset, target.b + offset);
}

// ── Shaders ──────────────────────────────────────────────────────────────
/**
 * Slabs grow from the plinth as the replay reaches them and settle with a
 * little spring; gold ones land with more bounce. Growth runs on the
 * replay's clock rather than the playhead's position, because the replay
 * nearly stops on a clip, and a gold slab that grew with the playhead
 * would stall at nothing at its big moment. The top keeps its rounded
 * edge at any height: the top of the geometry moves up rather than the
 * whole slab stretching.
 *
 * aSlab: height, bounce, start (replay seconds), duration.
 * aNbr: left and right neighbours' heights and start times, for the
 *       shadow each casts into the gap beside this one.
 */
const SLAB_VERT_DECL = /* glsl */ `
uniform float uClock;
uniform float uReveal;
attribute vec4 aSlab;
attribute vec4 aNbr;
varying vec3 vSlabP;
varying vec3 vSlabW;
varying vec3 vSlabN;
varying vec2 vSlabNbr;
float slabK(float start, float dur) {
  return max(clamp((uClock - start) / max(dur, 1e-3), 0.0, 1.0), uReveal);
}
float slabSpring(float k, float kick) {
  if (k <= 0.0) return 0.0;
  float s = 1.0 - exp(-6.0 * k) * cos((8.0 + 3.5 * kick) * k);
  return mix(s, 1.0, smoothstep(0.82, 1.0, k));
}
`;
const SLAB_VERT_APPLY = /* glsl */ `
  vSlabN = normal;
  vSlabNbr = vec2(0.0);
#ifdef USE_INSTANCING
  if (aSlab.x > 0.0) {
    float sk = slabK(aSlab.z, aSlab.w);
    float sh = max(0.0, aSlab.x * slabSpring(sk, aSlab.y));
    if (sh >= 1.0) {
      if (transformed.y > 0.5) transformed.y += sh - 1.0;
    } else {
      transformed.y *= sh;
    }
    // Not built yet: sunk into the plinth.
    if (sh < 0.02) transformed.y -= 0.45;
    vSlabNbr = vec2(aNbr.x * slabK(aNbr.z, 0.45), aNbr.y * slabK(aNbr.w, 0.45));
  }
  vSlabW = (instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vSlabW = transformed;
#endif
  vSlabP = transformed;
`;
const SLAB_FRAG_DECL = /* glsl */ `
uniform float uGrain;
varying vec3 vSlabP;
varying vec3 vSlabW;
varying vec3 vSlabN;
varying vec2 vSlabNbr;
float slabHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float slabNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(slabHash(i), slabHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(slabHash(i + vec3(0.0, 1.0, 0.0)), slabHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(slabHash(i + vec3(0.0, 0.0, 1.0)), slabHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(slabHash(i + vec3(0.0, 1.0, 1.0)), slabHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;
/** Faint variation in colour and gloss, so no two slabs are CG-identical. */
const SLAB_FRAG_COLOR = /* glsl */ `
  float slabN1 = slabNoise(vSlabW * vec3(2.2, 0.9, 2.2));
  float slabN2 = slabNoise(vSlabW * 9.0);
  diffuseColor.rgb *= 1.0 + uGrain * ((slabN1 - 0.5) * 0.1 + (slabN2 - 0.5) * 0.05);
`;
const SLAB_FRAG_ROUGH = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor * (1.0 + uGrain * (slabN1 - 0.5) * 0.5), 0.05, 1.0);
`;
/**
 * Contact shadows: darker where a slab meets the plinth, and on a side face
 * wherever the neighbour across the narrow gap stands taller than it.
 */
const SLAB_FRAG_AO = /* glsl */ `
  {
    float ao = 1.0 - 0.42 * exp(-max(vSlabP.y, 0.0) / 0.6);
    float side = step(0.55, abs(vSlabN.x));
    float nb = vSlabN.x < 0.0 ? vSlabNbr.x : vSlabNbr.y;
    ao *= 1.0 - side * 0.5 * smoothstep(-0.3, 1.6, nb - vSlabP.y);
    reflectedLight.indirectDiffuse *= ao;
    reflectedLight.indirectSpecular *= mix(1.0, ao, 0.75);
    reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);
    reflectedLight.directSpecular *= mix(1.0, ao, 0.35);
  }
`;

/**
 * The floor: dark polished stone holding a soft reflection (sampled over a
 * small disc, which is what makes it read as stone rather than a mirror),
 * and a contact shadow around the foot of the plinth.
 */
const FLOOR_VERT_DECL = /* glsl */ `
uniform mat4 uReflMatrix;
varying vec4 vReflUv;
varying vec3 vFloorW;
`;
const FLOOR_VERT_APPLY = /* glsl */ `
  vec4 floorW = modelMatrix * vec4(transformed, 1.0);
  vFloorW = floorW.xyz;
  vReflUv = uReflMatrix * floorW;
`;
const FLOOR_FRAG_DECL = /* glsl */ `
uniform sampler2D tRefl;
uniform float uReflStrength;
uniform float uReflBlur;
uniform vec4 uPlinth;
varying vec4 vReflUv;
varying vec3 vFloorW;
`;
const FLOOR_FRAG_APPLY = /* glsl */ `
  {
    vec2 ruv = vReflUv.xy / max(vReflUv.w, 1e-4);
    vec2 taps[12];
    taps[0] = vec2(-0.326, -0.406); taps[1] = vec2(-0.840, -0.074); taps[2] = vec2(-0.696, 0.457);
    taps[3] = vec2(-0.203, 0.621); taps[4] = vec2(0.962, -0.195); taps[5] = vec2(0.473, -0.480);
    taps[6] = vec2(0.519, 0.767); taps[7] = vec2(0.185, -0.893); taps[8] = vec2(0.507, 0.064);
    taps[9] = vec2(0.896, 0.412); taps[10] = vec2(-0.322, -0.933); taps[11] = vec2(-0.792, -0.598);
    vec3 refl = vec3(0.0);
    for (int i = 0; i < 12; i++) refl += texture2D(tRefl, ruv + taps[i] * uReflBlur).rgb;
    refl /= 12.0;
    vec3 floorV = normalize(cameraPosition - vFloorW);
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(floorV.y, 0.0, 1.0), 5.0);
    outgoingLight += refl * uReflStrength * (0.3 + 0.7 * fres);
    float dx = max(max(uPlinth.x - vFloorW.x, vFloorW.x - uPlinth.y), 0.0);
    float dz = max(max(uPlinth.z - vFloorW.z, vFloorW.z - uPlinth.w), 0.0);
    outgoingLight *= 1.0 - 0.6 * exp(-length(vec2(dx, dz)) / 0.9);
  }
`;

/** Film grain and a faint lens vignette, in display space. */
const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.022 }, uVignette: { value: 0.14 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q * vec2(1.0, 1.2)) * 1.25);
      c.rgb += (hash(gl_FragCoord.xy + fract(uTime * 7.3) * 91.7) - 0.5) * uAmount;
      gl_FragColor = c;
    }
  `,
};

// ── Scene ────────────────────────────────────────────────────────────────
export function createReplayScene(opts: SceneOptions): ReplayScene {
  const { canvas, data, hud, reducedMotion, compact, onPhase, onCaption } = opts;
  const D = data.minutes;
  const timeline = buildTimeline(data);
  const clipAt = data.clips.map((c) => timeline.tAt(c.minute));
  // Only the example has chat lines; a real stream's chat text isn't kept.
  const chat: Array<ChatLine & { at: number }> = data.illustrativeChat
    ? buildChat(data).map((c) => ({ ...c, at: timeline.tAt(c.minute) }))
    : [];

  // One slab per minute, or per few minutes on a very long stream.
  const mps = Math.max(1, Math.ceil(D / 220));
  const slabs = Math.ceil(D / mps);
  const L = slabs * U;
  const X = (minute: number) => (minute / mps) * U;
  const slabX = (i: number) => (i + 0.5) * U;

  const isDeadMinute = (m: number) => data.deadAir.some((s) => m >= s.start && m < s.start + s.minutes);
  const maxChat = Math.max(1, ...data.chat);
  type Kind = "you" | "gold" | "dead" | "none";
  // Before the stream really began (a starting-soon screen): no slab.
  const offlineSlabs = Math.floor((data.offline ?? 0) / mps);
  const youH: number[] = [];
  const chatH: number[] = [];
  const kinds: Kind[] = [];
  for (let i = 0; i < slabs; i++) {
    const m0 = i * mps;
    const m1 = Math.min(D, m0 + mps);
    let pace = 0;
    let talk = 0;
    let dead = 0;
    for (let m = m0; m < m1; m++) {
      pace += clamp((data.pace[m] - 25) / 165, 0, 1);
      talk += data.chat[m];
      if (isDeadMinute(m)) dead++;
    }
    const n = m1 - m0;
    const p = pace / n;
    const c = Math.pow(talk / n / maxChat, 0.85);
    let kind: Kind = dead * 2 >= n ? "dead" : "you";
    if (data.clips.some((cl) => cl.minute >= m0 && cl.minute < m1)) kind = "gold";
    if (i < offlineSlabs) kind = "none";
    kinds.push(kind);
    youH.push(kind === "none" ? 0 : kind === "dead" ? 0.3 : 0.8 + Math.pow(p, 1.1) * (HY - 0.8));
    chatH.push(0.35 + c * (HC - 0.35));
  }
  const slabAt = (minute: number) => clamp(Math.floor(minute / mps), 0, slabs - 1);
  const kickOf = (i: number) => (kinds[i] === "gold" ? 1.6 : kinds[i] === "dead" ? 0.1 : 0.35);
  // When each slab starts growing (replay seconds) and how long it takes.
  const riseStart = Array.from({ length: slabs }, (_, i) => timeline.tAt(i * mps));
  const riseDur = kinds.map((k) => (k === "gold" ? 1.2 : 0.45));
  // A much smoother height for the camera, so it glides over the tops.
  const camH = gaussian(youH, 6);
  const camHAt = (minute: number) => camH[slabAt(minute)];

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.4 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Shadows are drawn once a frame, before the reflection, and reused.
  renderer.shadowMap.autoUpdate = false;

  const bg = toneMappedBackground("#100d0e");
  const scene = new THREE.Scene();
  scene.background = bg;
  const fog = new THREE.Fog(bg, 60, 400);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 2000);
  const disposables: Array<{ dispose(): void }> = [];

  // Studio reflections. Materials that need their own strength carry the
  // map themselves: three.js overrides a material's intensity with the
  // scene's whenever it falls back to scene.environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.3;
  room.dispose();
  pmrem.dispose();
  disposables.push(envMap);

  // ── Lights ──
  scene.add(new THREE.HemisphereLight("#dfe7f3", "#130e0f", 0.3));
  const key = new THREE.DirectionalLight("#fff1e2", 2.1);
  key.position.set(L / 2 - 64, 86, 80);
  key.target.position.set(L / 2, 0, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(compact ? 2048 : 4096, compact ? 1024 : 2048);
  const sc = key.shadow.camera;
  sc.left = -L * 0.62 - 16;
  sc.right = L * 0.62 + 16;
  sc.top = 50;
  sc.bottom = -50;
  sc.near = 1;
  sc.far = 720;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  scene.add(key, key.target);
  // A cool rim from behind, so silhouettes lift off the dark.
  const rim = new THREE.DirectionalLight("#cfdcff", 0.9);
  rim.position.set(L / 2 + 40, 118, -72);
  rim.target.position.set(L / 2, 6, 0);
  scene.add(rim, rim.target);

  const stage = new THREE.SpotLight("#fff0e2", 0, 0, 0.4, 1, 2);
  scene.add(stage, stage.target);
  const stageWarm = new THREE.Color("#fff0e2");
  const stageRed = new THREE.Color("#ff9486");

  // ── Floor, with a soft reflection ──
  const reflTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const reflMatrix = new THREE.Matrix4();
  const floorU = {
    tRefl: { value: reflTarget.texture },
    uReflMatrix: { value: reflMatrix },
    uReflStrength: { value: 0.62 },
    uReflBlur: { value: compact ? 0.006 : 0.0042 },
    uPlinth: { value: new THREE.Vector4(-1.6, L + 1.6, PL_Z0, PL_Z1) },
  };
  const floorGeo = new THREE.PlaneGeometry(L + 900, 700).rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ color: "#120e0f", roughness: 0.9, metalness: 0, envMapIntensity: 0 });
  floorMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, floorU);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${FLOOR_VERT_DECL}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${FLOOR_VERT_APPLY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FLOOR_FRAG_DECL}`)
      .replace("#include <opaque_fragment>", `${FLOOR_FRAG_APPLY}\n#include <opaque_fragment>`);
  };
  floorMat.customProgramCacheKey = () => "rp-floor";
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(L / 2, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  disposables.push(floorGeo, floorMat, reflTarget);

  // ── Materials ──
  const riseU = {
    uClock: { value: -10 },
    uReveal: { value: 0 },
  };
  const patchSlab = <M extends THREE.Material>(m: M, cacheKey: string, grain: number | null): M => {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, riseU);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${SLAB_VERT_DECL}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${SLAB_VERT_APPLY}`);
      if (grain !== null) {
        shader.uniforms.uGrain = { value: grain };
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\n${SLAB_FRAG_DECL}`)
          .replace("#include <color_fragment>", `#include <color_fragment>\n${SLAB_FRAG_COLOR}`)
          .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${SLAB_FRAG_ROUGH}`)
          .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${SLAB_FRAG_AO}`);
      }
    };
    m.customProgramCacheKey = () => `rp-slab-${cacheKey}`;
    return m;
  };
  const depthMat = patchSlab(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), "depth", null);

  const porcelain = patchSlab(
    new THREE.MeshPhysicalMaterial({
      color: "#ebe4dd",
      roughness: 0.5,
      clearcoat: 0.32,
      clearcoatRoughness: 0.42,
      envMap,
      envMapIntensity: 0.5,
    }),
    "porcelain",
    1
  );
  const gold = patchSlab(
    new THREE.MeshPhysicalMaterial({
      color: "#e8b24c",
      metalness: 1,
      roughness: 0.38,
      envMap,
      envMapIntensity: 1.5,
    }),
    "gold",
    0.4
  );
  const enamel = patchSlab(
    new THREE.MeshPhysicalMaterial({
      color: "#c3423a",
      roughness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMap,
      envMapIntensity: 0.6,
    }),
    "enamel",
    0.5
  );
  const stone = patchSlab(
    new THREE.MeshPhysicalMaterial({
      color: "#2f2928",
      roughness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      envMap,
      envMapIntensity: 0.7,
    }),
    "stone",
    0.7
  );
  disposables.push(depthMat, porcelain, gold, enamel, stone);

  // ── The plinth ──
  const plinthGeo = new RoundedBoxGeometry(L + 3.2, PH, PL_Z1 - PL_Z0, 4, 0.14);
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: "#1d1919",
    roughness: 0.78,
    clearcoat: 0.18,
    clearcoatRoughness: 0.5,
    envMap,
    envMapIntensity: 0.22,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.set(L / 2, PH / 2, (PL_Z0 + PL_Z1) / 2);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  scene.add(plinth);
  disposables.push(plinthGeo, plinthMat);

  // Half-hour notches cut into the plinth's front face.
  const notchGeo = new THREE.BoxGeometry(0.07, PH * 0.5, 0.02);
  const notchMat = new THREE.MeshStandardMaterial({ color: "#4d4443", roughness: 0.6 });
  disposables.push(notchGeo, notchMat);
  for (let m = 30; m < D; m += 30) {
    const notch = new THREE.Mesh(notchGeo, notchMat);
    notch.position.set(X(m), PH * 0.5, PL_Z1 + 0.004);
    scene.add(notch);
  }

  // ── Slabs ──
  const slabRow = (
    idx: number[],
    heights: number[],
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    z: number,
    lag = 0
  ) => {
    const g = geo.clone();
    const slab = new Float32Array(idx.length * 4);
    const nbr = new Float32Array(idx.length * 4);
    idx.forEach((i, n) => {
      slab.set([heights[i], kickOf(i), riseStart[i] + lag, riseDur[i]], n * 4);
      const l = i > 0 ? i - 1 : i;
      const r = i < slabs - 1 ? i + 1 : i;
      nbr.set([i > 0 ? heights[l] : 0, i < slabs - 1 ? heights[r] : 0, riseStart[l] + lag, riseStart[r] + lag], n * 4);
    });
    g.setAttribute("aSlab", new THREE.InstancedBufferAttribute(slab, 4));
    g.setAttribute("aNbr", new THREE.InstancedBufferAttribute(nbr, 4));
    const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, idx.length));
    mesh.count = idx.length;
    const mtx = new THREE.Matrix4();
    idx.forEach((i, n) => {
      mtx.makeTranslation(slabX(i), PH, z);
      mesh.setMatrixAt(n, mtx);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = depthMat;
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(g);
    return mesh;
  };

  const youGeo = new RoundedBoxGeometry(U * 0.62, 1, YOU_D, 3, 0.1).translate(0, 0.5, 0);
  const chatGeo = new RoundedBoxGeometry(U * 0.62, 1, CHAT_D, 3, 0.1).translate(0, 0.5, 0);
  // Gold slabs are a touch wider: cast pieces among the porcelain.
  const goldGeo = new RoundedBoxGeometry(U * 0.9, 1, YOU_D, 3, 0.12).translate(0, 0.5, 0);
  disposables.push(youGeo, chatGeo, goldGeo);

  const all = Array.from({ length: slabs }, (_, i) => i);
  slabRow(all.filter((i) => kinds[i] === "you"), youH, youGeo, porcelain, 0);
  slabRow(all.filter((i) => kinds[i] === "gold"), youH, goldGeo, gold, 0);
  slabRow(all.filter((i) => kinds[i] === "dead"), youH, youGeo, enamel, 0);
  if (data.hasChat) slabRow(all, chatH, chatGeo, stone, CHAT_Z, 0.06);

  // Where each slab will stand, marked faintly on the plinth ahead of the build.
  const tickGeo = new THREE.BoxGeometry(U * 0.62, 0.01, YOU_D);
  const tickMat = new THREE.MeshStandardMaterial({ color: "#262020", roughness: 0.95, envMapIntensity: 0.2 });
  const ticks = new THREE.InstancedMesh(tickGeo, tickMat, slabs);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < slabs; i++) {
    mtx.makeTranslation(slabX(i), PH + 0.003, 0);
    ticks.setMatrixAt(i, mtx);
  }
  ticks.receiveShadow = true;
  scene.add(ticks);
  disposables.push(tickGeo, tickMat);

  // ── Inlays: lines set into the plinth between the rows ──
  const inlayGeo = new THREE.BoxGeometry(1, 0.03, 0.16).translate(0.5, 0, 0);
  const redInlay = new THREE.MeshPhysicalMaterial({ color: "#c3423a", emissive: "#4a100d", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const goldInlay = new THREE.MeshPhysicalMaterial({ color: "#e8b24c", emissive: "#2e1f06", roughness: 0.3, metalness: 1, envMap, envMapIntensity: 1.6 });
  disposables.push(inlayGeo, redInlay, goldInlay);
  interface Inlay {
    mesh: THREE.Mesh;
    x0: number;
    x1: number;
  }
  const inlays: Inlay[] = [];
  const addInlay = (m0: number, m1: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(inlayGeo, mat);
    mesh.position.set(X(m0), PH + 0.008, GAP_Z);
    mesh.scale.set(0.001, 1, 1);
    mesh.receiveShadow = true;
    scene.add(mesh);
    inlays.push({ mesh, x0: X(m0), x1: X(m1) });
  };
  for (const s of data.deadAir) addInlay(s.start, s.start + s.minutes, redInlay);
  if (data.crash) addInlay(data.crash.start, data.crash.start + data.crash.minutes, redInlay);
  for (const c of data.clips) addInlay(c.minute - 1, c.minute + 2, goldInlay);

  // Each gold slab lights its neighbours when it lands, then keeps a low glow.
  const clipLights = data.clips.map((c) => {
    const i = slabAt(c.minute);
    const light = new THREE.PointLight("#ffd48a", 0, 30, 2);
    light.position.set(slabX(i) - 1.5, PH + youH[i] + 5, 9);
    scene.add(light);
    return light;
  });

  // The promotion: a gold light runs along the tops.
  const sweep = new THREE.PointLight("#ffc861", 0, 36, 2);
  scene.add(sweep);

  // ── Post ──
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: compact ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  // Depth of field, with its depth pass taught how the slabs grow.
  const bokeh = compact ? null : new BokehPass(scene, camera, { focus: 100, aperture: 0, maxblur: 0.006 });
  if (bokeh) {
    const bokehDepth = (bokeh as unknown as { _materialDepth?: THREE.Material })._materialDepth;
    if (bokehDepth) patchSlab(bokehDepth, "bokeh-depth", null);
    composer.addPass(bokeh);
    disposables.push(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.3, 1.7);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FINISH);
  composer.addPass(finish);
  disposables.push(target, composer, bloom, finish);

  // ── Camera ──
  let width = 1;
  let height = 1;
  const clipNear = (x: number) => {
    let v = 0;
    data.clips.forEach((c) => {
      v = Math.max(v, Math.exp(-Math.pow((x - X(c.minute)) / (U * 12), 2)) * (c.best ? 1 : 0.75));
    });
    return v;
  };
  const fit = () => clamp(1.45 / (width / height), 1, 2.3);
  const portrait = () => width / height < 0.9;
  /** Place the camera at an angle and distance from what it looks at. */
  const aim = (look: THREE.Vector3, az: number, el: number, d: number, pos: THREE.Vector3) => {
    pos.set(
      look.x + Math.sin(az) * Math.cos(el) * d,
      look.y + Math.sin(el) * d,
      look.z + Math.cos(az) * Math.cos(el) * d
    );
  };
  const followPose = (m: number, pos: THREE.Vector3, look: THREE.Vector3) => {
    const x = X(m);
    const h = camHAt(m);
    const c = clipNear(x);
    // Aim a little behind the build front, so the front sits right of
    // centre with the empty plinth ahead of it.
    look.set(x - 7 * U, PH + h * 0.5 + 3, 1);
    aim(look, -0.46 + 0.05 * c, 0.38 + 0.03 * c, (104 - 16 * c) * fit(), pos);
  };
  // The opening: low along the empty plinth, then the crane up as it builds.
  const introPose = (pos: THREE.Vector3, look: THREE.Vector3) => {
    look.set(U * 10, PH + 2.5, 2);
    aim(look, -1.05, 0.12, 46 * fit(), pos);
  };
  const overviewPose = (pos: THREE.Vector3, look: THREE.Vector3, drift: number) => {
    if (portrait()) {
      look.set(L * 0.56, PH + 3, -2);
      pos.set(-40 + drift * 10, 64, 76);
      return;
    }
    // A three-quarter view down the length: the stream reads left to right
    // and recedes, so the whole thing fills the frame.
    const az = -0.5 + drift * 0.05;
    const halfH = Math.atan(Math.tan(((camera.fov * Math.PI) / 180) / 2) * camera.aspect);
    const d = (L * Math.cos(Math.abs(az)) * 0.56) / Math.tan(halfH);
    look.set(L * 0.5, PH + 11, 0);
    aim(look, az, 0.34, d, pos);
  };

  // ── State ──
  let t = reducedMotion ? SETTLED + 0.01 : 0;
  let playing = !reducedMotion;
  let frozen: number | null = opts.frozenAt ?? null;
  if (frozen != null) {
    t = frozen;
    playing = false;
  }
  let dragging = false;
  let tv = t;
  let lastPhase: ReplayPhase | null = null;
  let lastCaption = -2;
  let shownNewest = -2;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tA = new THREE.Vector3();
  const tB = new THREE.Vector3();

  /** The same growth the shader does, for pinning words to a slab's top. */
  const grownHeight = (i: number, clockV: number, reveal: number) => {
    const k = Math.max(clamp((clockV - riseStart[i]) / riseDur[i], 0, 1), reveal);
    if (k <= 0) return 0;
    const s = 1 - Math.exp(-6 * k) * Math.cos((8 + 3.5 * kickOf(i)) * k);
    const e = smooth(0.82, 1, k);
    return Math.max(0, youH[i] * (s * (1 - e) + e));
  };

  const anchors: Array<SceneAnchor & { world: THREE.Vector3; w?: number; h?: number }> = sceneAnchors(data).map((a) => {
    let world: THREE.Vector3;
    if (a.kind === "clip" || a.kind === "crash") {
      const i = slabAt(a.minute);
      world = new THREE.Vector3(slabX(i), PH + youH[i] + 0.9, 0);
    } else if (a.kind === "dead") world = new THREE.Vector3(X(a.minute), PH + 0.9, 0);
    else if (a.kind === "row") world = new THREE.Vector3(-2.2, PH * 0.6, a.index === 0 ? 0 : CHAT_Z);
    else world = new THREE.Vector3(X(a.minute), 0, PL_Z1 + 2.6);
    return { ...a, world };
  });
  const rank = (a: SceneAnchor) =>
    a.kind === "clip" ? (data.clips[a.index].best ? 0 : 1) : a.kind === "crash" ? 2 : a.kind === "dead" ? 3 : a.kind === "row" ? 4 : 5;
  anchors.sort((a, b) => rank(a) - rank(b));

  let reflDiv = compact ? 3 : 2;
  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    width = Math.max(1, parent.clientWidth);
    height = Math.max(1, parent.clientHeight);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
    const div = reflDiv;
    reflTarget.setSize(Math.max(1, Math.round((width * dpr) / div)), Math.max(1, Math.round((height * dpr) / div)));
    camera.aspect = width / height;
    camera.fov = portrait() ? 50 : 32;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  // ── Reflection: the scene again, from a camera mirrored under the floor ──
  const mirror = new THREE.PerspectiveCamera();
  const rNormal = new THREE.Vector3(0, 1, 0);
  const rOrigin = new THREE.Vector3(0, 0, 0);
  const rPlane = new THREE.Plane();
  const rLook = new THREE.Vector3();
  const rRot = new THREE.Matrix4();
  const rClip = new THREE.Vector4();
  const rQ = new THREE.Vector4();
  const black = new THREE.Color(0, 0, 0);
  const fogColor = new THREE.Color();
  const renderReflection = () => {
    const cam = camera.position;
    rRot.extractRotation(camera.matrixWorld);
    rLook.set(0, 0, -1).applyMatrix4(rRot).add(cam);
    mirror.position.set(cam.x, -cam.y, cam.z);
    mirror.up.set(0, 1, 0).applyMatrix4(rRot).reflect(rNormal);
    mirror.lookAt(rLook.x, -rLook.y, rLook.z);
    mirror.near = camera.near;
    mirror.far = camera.far;
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    reflMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    reflMatrix.multiply(mirror.projectionMatrix);
    reflMatrix.multiply(mirror.matrixWorldInverse);
    // An oblique near plane, so nothing below the floor gets into the reflection.
    rPlane.setFromNormalAndCoplanarPoint(rNormal, rOrigin);
    rPlane.applyMatrix4(mirror.matrixWorldInverse);
    rClip.set(rPlane.normal.x, rPlane.normal.y, rPlane.normal.z, rPlane.constant);
    const pm = mirror.projectionMatrix;
    rQ.x = (Math.sign(rClip.x) + pm.elements[8]) / pm.elements[0];
    rQ.y = (Math.sign(rClip.y) + pm.elements[9]) / pm.elements[5];
    rQ.z = -1;
    rQ.w = (1 + pm.elements[10]) / pm.elements[14];
    rClip.multiplyScalar(2 / rClip.dot(rQ));
    pm.elements[2] = rClip.x;
    pm.elements[6] = rClip.y;
    pm.elements[10] = rClip.z + 1 - 0.003;
    pm.elements[14] = rClip.w;

    floor.visible = false;
    const bgSaved = scene.background;
    fogColor.copy(fog.color);
    scene.background = black;
    fog.color.copy(black);
    renderer.setRenderTarget(reflTarget);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.setRenderTarget(null);
    scene.background = bgSaved;
    fog.color.copy(fogColor);
    floor.visible = true;
  };

  const phaseNow = (): ReplayPhase => {
    if (t >= RESULT_AT) return "result";
    if (dragging || (!playing && frozen == null)) return t < INTRO ? "intro" : "paused";
    return t < INTRO ? "intro" : "play";
  };

  // ── Words next to the action ──
  interface Box {
    l: number;
    t: number;
    r: number;
    b: number;
  }
  const v = new THREE.Vector3();
  const project = (p: THREE.Vector3) => {
    v.copy(p).project(camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, behind: v.z > 1 };
  };

  const SKY = 8;
  let sky = new Float32Array(1);
  /** The highest point of the built sculpture in each 8px column of the screen. */
  const buildSkyline = (clockV: number, reveal: number) => {
    const n = Math.ceil(width / SKY) + 2;
    if (sky.length !== n) sky = new Float32Array(n);
    sky.fill(1e9);
    for (let i = 0; i < slabs; i++) {
      const gh = grownHeight(i, clockV, reveal);
      if (gh < 0.05) continue;
      for (const z of [YOU_D / 2, -YOU_D / 2]) {
        const p = project(tB.set(slabX(i), PH + gh, z));
        if (p.behind) continue;
        const b0 = Math.max(0, Math.floor((p.x - 7) / SKY));
        const b1 = Math.min(n - 1, Math.floor((p.x + 7) / SKY));
        for (let b = b0; b <= b1; b++) if (p.y < sky[b]) sky[b] = p.y;
      }
    }
  };
  const overSculpture = (b: Box) => {
    const b0 = Math.max(0, Math.floor(b.l / SKY));
    const b1 = Math.min(sky.length - 1, Math.floor(b.r / SKY));
    for (let k = b0; k <= b1; k++) if (b.b > sky[k] - 10) return true;
    return false;
  };

  /**
   * Put a note above a point with a hairline down to it: try a few heights,
   * to the right of the line first, then to the left, and take the first
   * spot that covers nothing else and isn't over the sculpture.
   */
  const placeAbove = (
    el: HTMLElement,
    p: { x: number; y: number },
    w: number,
    h: number,
    lifts: number[],
    boxes: Box[],
    floorY: number
  ): Box | null => {
    const hitsBoxes = (b: Box) => boxes.some((k) => b.l < k.r && b.r > k.l && b.t < k.b && b.b > k.t);
    const hits = (b: Box) => overSculpture(b) || hitsBoxes(b);
    if (p.y > floorY || p.x < 0 || p.x > width) return null;
    for (const lift of lifts) {
      for (const flip of [false, true]) {
        const l = flip ? p.x - w : p.x;
        const tt = p.y - lift - h;
        const card = { l: l - 6, t: tt - 6, r: l + w + 6, b: tt + h + 4 };
        const lead = { l: p.x - 2, t: tt + h, r: p.x + 2, b: p.y - 6 };
        if (card.l < 10 || card.r > width - 10 || card.t < 64) continue;
        if (hits(card) || hitsBoxes(lead)) continue;
        el.style.transform = `translate3d(${l.toFixed(1)}px, ${tt.toFixed(1)}px, 0)`;
        el.style.setProperty("--lx", `${(p.x - l).toFixed(1)}px`);
        el.style.setProperty("--lead", `${(p.y - tt - h).toFixed(1)}px`);
        el.dataset.flip = flip ? "1" : "0";
        return card;
      }
    }
    return null;
  };

  /** Beside a point instead of above it, with a short line across to it. */
  const placeSide = (
    el: HTMLElement,
    p: { x: number; y: number },
    w: number,
    h: number,
    boxes: Box[],
    floorY: number
  ): Box | null => {
    const hitsBoxes = (b: Box) => boxes.some((k) => b.l < k.r && b.r > k.l && b.t < k.b && b.b > k.t);
    for (const gap of [34, 70]) {
      for (const side of ["r", "l"] as const) {
        const l = side === "r" ? p.x + gap : p.x - gap - w;
        const tt = clamp(p.y - h * 0.3, 64, floorY - h - 8);
        const card = { l: l - 6, t: tt - 6, r: l + w + 6, b: tt + h + 6 };
        if (card.l < 10 || card.r > width - 10) continue;
        if (overSculpture(card) || hitsBoxes(card)) continue;
        el.style.transform = `translate3d(${l.toFixed(1)}px, ${tt.toFixed(1)}px, 0)`;
        el.style.setProperty("--sw", `${gap - 6}px`);
        el.style.setProperty("--sy", `${(p.y - tt).toFixed(1)}px`);
        el.dataset.side = side;
        return card;
      }
    }
    return null;
  };

  const writeHud = (m: number, exact: number, clockV: number, phase: ReplayPhase, reveal: number) => {
    const stageBox = canvas.getBoundingClientRect();
    const boxes: Box[] = [];
    for (const b of hud.avoid) {
      if (!b || Number(getComputedStyle(b).opacity) < 0.1) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      boxes.push({ l: r.left - stageBox.left - 8, t: r.top - stageBox.top - 8, r: r.right - stageBox.left + 8, b: r.bottom - stageBox.top + 8 });
    }
    const floorY = boxes.reduce((y, b) => (b.b >= height - 10 ? Math.min(y, b.t) : y), height);
    const done = reveal >= 1;
    const stacked = width <= 760;
    buildSkyline(clockV, reveal);

    // The caption first: it's what's happening now, at the newest slab.
    if (hud.caption) {
      let on = !done && phase !== "intro";
      if (on && !stacked) {
        const i = slabAt(Math.max(0, m - mps * 0.8));
        const top = grownHeight(i, clockV, reveal);
        const p = project(tA.set(slabX(i), PH + top + 0.9, 0));
        const w = hud.caption.offsetWidth;
        const h = hud.caption.offsetHeight;
        hud.caption.dataset.side = "";
        let box = p.behind ? null : placeAbove(hud.caption, p, w, h, [70, 120, 170, 230, 290], boxes, floorY);
        if (!box && !p.behind) box = placeSide(hud.caption, p, w, h, boxes, floorY);
        hud.caption.dataset.docked = box ? "0" : "1";
        if (!box) {
          const clockBox = hud.avoid[1]?.getBoundingClientRect();
          const l = width - w - Math.max(18, Math.min(56, width * 0.04));
          const tt = clockBox ? clockBox.bottom - stageBox.top + 26 : 210;
          hud.caption.style.transform = `translate3d(${l.toFixed(1)}px, ${tt.toFixed(1)}px, 0)`;
          box = { l: l - 6, t: tt - 6, r: l + w + 6, b: tt + h + 6 };
        }
        boxes.push(box);
      }
      hud.caption.dataset.on = on ? "1" : "0";
    }

    for (const a of anchors) {
      const el = hud.labels.get(a.id);
      if (!el) continue;
      if (a.w === undefined) {
        a.w = el.offsetWidth;
        a.h = el.offsetHeight;
      }
      const w = a.w ?? 160;
      const h = a.h ?? 40;
      const p = project(a.world);
      let on = false;
      if (!p.behind) {
        if (a.kind === "time") {
          const l = p.x - w / 2;
          const box = { l: l - 4, t: p.y - 2, r: l + w + 4, b: p.y + h + 2 };
          const clear = !boxes.some((k) => box.l < k.r && box.r > k.l && box.t < k.b && box.b > k.t);
          on = clear && p.y + h < floorY && l > 8 && l + w < width - 8;
          if (on) {
            el.style.transform = `translate3d(${l.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
            boxes.push(box);
          }
        } else if (a.kind === "row") {
          const l = p.x - w - 10;
          const tt = p.y - h / 2;
          const box = { l: l - 4, t: tt - 2, r: p.x, b: tt + h + 2 };
          const clear = !boxes.some((k) => box.l < k.r && box.r > k.l && box.t < k.b && box.b > k.t);
          on = clear && l > 8 && tt + h < floorY && tt > 64;
          if (on) {
            el.style.transform = `translate3d(${l.toFixed(1)}px, ${tt.toFixed(1)}px, 0)`;
            boxes.push(box);
          }
        } else {
          // A moment gets its note once the caption has moved on from it.
          const shown = done || exact >= a.minute + 2.5 * mps;
          if (shown) {
            const box = placeAbove(el, p, w, h, a.kind === "dead" || a.kind === "crash" ? [60, 110, 160, 210, 260, 310] : [34, 80, 126, 172, 218], boxes, floorY);
            if (box) {
              boxes.push(box);
              on = true;
            }
          }
        }
      }
      el.dataset.on = on ? "1" : "0";
    }

    // Clock, live numbers and the scrubber follow the pointer exactly; the
    // camera and the build glide to catch up.
    const mi = Math.min(D - 1, Math.floor(exact));
    if (hud.clock) hud.clock.textContent = clockLabel(exact);
    if (hud.stats) hud.stats.textContent = `${data.pace[mi]} words/min · ${data.chat[mi]} chat/min`;
    if (hud.scrubHead) hud.scrubHead.style.transform = `translateX(${((exact / D) * 100).toFixed(3)}cqw)`;
  };

  const writeChat = () => {
    let newest = -1;
    for (let i = 0; i < chat.length && chat[i].at <= t; i++) newest = i;
    if (newest === shownNewest) return;
    const forward = newest === shownNewest + 1 && !dragging;
    shownNewest = newest;
    const n = hud.chatLines.length;
    hud.chatLines.forEach((el, k) => {
      const i = newest - (n - 1 - k);
      const line = i >= 0 ? chat[i] : null;
      el.textContent = line ? line.text : "";
      el.dataset.tone = line ? line.tone : "plain";
      el.dataset.fresh = "0";
    });
    const last = hud.chatLines[n - 1];
    if (forward && last && newest >= 0) {
      void last.offsetWidth;
      last.dataset.fresh = "1";
    }
  };

  // ── Frame ──
  const focusPoint = new THREE.Vector3();
  const render = (dt: number) => {
    // The clock the pictures run on: the real one, eased while dragging.
    if (frozen != null || reducedMotion) tv = t;
    else tv += (t - tv) * (1 - Math.exp(-dt * (dragging ? 9 : 45)));
    const exact = t <= INTRO ? 0 : t >= SW_END ? D : timeline.minuteAt(t);
    const m = tv <= INTRO ? 0 : tv >= SW_END ? D : timeline.minuteAt(tv);
    const playX = X(m);

    let reveal = 0;
    let stageOn = 1;
    let lens = 1; // depth of field: full while tracking, gone for the overview
    if (tv < INTRO) {
      const k = easeInOut(clamp(tv / INTRO, 0, 1));
      introPose(tA, tB);
      followPose(0, camPos, camLook);
      camPos.lerpVectors(tA, camPos, k);
      camLook.lerpVectors(tB, camLook, k);
      stageOn = smooth(INTRO * 0.35, INTRO, tv);
    } else if (tv < SW_END) {
      followPose(m, camPos, camLook);
    } else {
      const k = easeInOut(clamp((tv - SW_END) / OUTRO, 0, 1));
      const drift = reducedMotion ? 0 : Math.sin(Math.max(0, tv - SETTLED) * 0.1) * smooth(SW_END, SETTLED, tv);
      followPose(D, tA, tB);
      overviewPose(camPos, camLook, drift);
      camPos.lerpVectors(tA, camPos, k);
      camLook.lerpVectors(tB, camLook, k);
      reveal = smooth(0, 0.5, k);
      stageOn = 1 - smooth(0, 0.6, k);
      lens = 1 - smooth(0, 0.7, k);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.updateMatrixWorld();
    const dist = camPos.distanceTo(camLook);
    fog.near = dist * 0.85;
    fog.far = dist * 2.6;

    riseU.uClock.value = tv;
    riseU.uReveal.value = reveal;

    // The stage light follows the build, and turns red over dead air.
    let deadNow = 0;
    for (const s of data.deadAir) deadNow = Math.max(deadNow, smooth(s.start - 1, s.start + 0.5, m) * (1 - smooth(s.start + s.minutes, s.start + s.minutes + 1.5, m)));
    const h = camHAt(m);
    stage.position.set(playX - 16, PH + 60 + h * 0.3, 52);
    stage.target.position.set(playX + 2, PH + h * 0.35, 0);
    stage.color.copy(stageWarm).lerp(stageRed, deadNow * 0.85);
    stage.intensity = 1100 * stageOn * (1 - 0.3 * deadNow);
    key.intensity = 1.7 + 0.6 * (1 - stageOn);

    // Gold slabs: a flare of warm light as each lands, settling to a glow.
    const clock = frozen != null ? frozen : t;
    let goldFocus = 0;
    clipLights.forEach((light, i) => {
      const age = tv - clipAt[i];
      const landed = age >= 0 || reveal > 0;
      const flare = landed && tv < SW_END ? Math.exp(-Math.max(0, age) * 1.6) : 0;
      light.intensity = landed ? 30 + 110 * flare : 0;
      goldFocus = Math.max(goldFocus, Math.exp(-Math.pow((tv - clipAt[i] - 0.4) / 0.9, 2)));
    });

    // Inlays draw themselves as the replay passes.
    for (const inl of inlays) {
      const k = reveal > 0 ? 1 : clamp((playX - inl.x0) / (inl.x1 - inl.x0), 0, 1);
      inl.mesh.scale.x = Math.max(0.001, (inl.x1 - inl.x0) * k);
      inl.mesh.visible = k > 0;
    }

    // The promotion, in step with the result's bar crossing over.
    const waveT = t - RESULT_AT - 1.35;
    if (opts.celebrate && !reducedMotion && waveT > 0 && waveT < 1.8) {
      const x = -10 + (waveT / 1.8) * (L + 20);
      sweep.position.set(x, PH + HY * 0.75, 5);
      sweep.intensity = 420 * Math.sin((waveT / 1.8) * Math.PI);
    } else {
      sweep.intensity = 0;
    }

    // The lens: focus on the build front, a little shallower as a gold
    // slab lands, and fully open once the camera pulls back.
    if (bokeh) {
      const i = slabAt(Math.max(0, m - mps * 0.5));
      focusPoint.set(slabX(i), PH + grownHeight(i, tv, reveal) * 0.6, 0);
      const u = bokeh.uniforms as Record<string, THREE.IUniform>;
      u.focus.value = camPos.distanceTo(focusPoint);
      u.aperture.value = reducedMotion ? 0 : (0.00011 + 0.00008 * goldFocus) * lens;
    }

    finish.uniforms.uTime.value = clock;
    const phase = phaseNow();
    writeHud(m, exact, tv, phase, reveal);
    writeChat();

    let cap = -1;
    if (t < SW_END) for (let i = 0; i < data.captions.length; i++) if (data.captions[i].minute <= exact + 0.01) cap = i;
    if (cap !== lastCaption) {
      lastCaption = cap;
      onCaption(cap);
    }
    if (phase !== lastPhase) {
      lastPhase = phase;
      onPhase(phase);
    }

    renderer.shadowMap.needsUpdate = true;
    renderReflection();
    composer.render(dt);
  };

  let raf = 0;
  let last = performance.now();
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  });
  io.observe(canvas);
  let perfFrames = 0;
  let perfTime = 0;
  let lightened = false;
  const lighten = () => {
    lightened = true;
    if (bokeh) bokeh.enabled = false;
    reflDiv = 4;
    resize();
  };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    // A frame's timestamp can be a moment before this scene was created, so
    // the first step can come out negative. Time never runs backwards.
    const raw = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, raw);
    last = now;
    if (!visible || document.hidden) return;
    if (!lightened && opts.frozenAt == null && !compact) {
      perfFrames++;
      if (perfFrames > 20) perfTime += Math.min(raw, 0.25);
      if (perfFrames === 110 && perfTime / 90 > 1 / 34) lighten();
    }
    if (playing && frozen == null && !dragging) t += dt;
    if (!playing && frozen == null && t >= SW_END) t += dt;
    render(dt);
    const w = window as unknown as { __replayFrames?: number; __replayMarks?: object };
    w.__replayFrames = (w.__replayFrames ?? 0) + 1;
    w.__replayMarks ??= { clips: clipAt, dead: data.deadAir.map((s) => timeline.tAt(s.start)), sweepEnd: SW_END, result: RESULT_AT };
  };
  raf = requestAnimationFrame(loop);

  return {
    toggle() {
      frozen = null;
      if (t >= SW_END) {
        t = 0;
        tv = 0;
        playing = !reducedMotion;
      } else {
        playing = !playing;
      }
    },
    replay() {
      frozen = null;
      t = reducedMotion ? SETTLED + 0.01 : 0;
      tv = t;
      playing = !reducedMotion;
    },
    seek(minute: number) {
      frozen = null;
      if (!dragging) {
        dragging = true;
        if (t >= SW_END) tv = SW_END - 0.001;
      }
      t = minute >= D - 0.05 ? SW_END - 0.001 : Math.max(INTRO, timeline.tAt(clamp(minute, 0, D)));
    },
    release() {
      if (!dragging) return;
      dragging = false;
      playing = !reducedMotion;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
