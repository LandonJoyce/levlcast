/**
 * A small client for OBS's built-in WebSocket server (obs-websocket 5, in
 * OBS 28 and later). It runs in the dock on the streamer's own computer:
 * the connection is to localhost, and the password never leaves the machine.
 *
 * It reads four things: how loud the mic is (to tell talking from quiet),
 * whether the mic is muted, which scene is on air, and whether OBS is
 * streaming. It never changes anything in OBS.
 */

export type ObsStatus = "off" | "connecting" | "connected" | "error";

export interface ObsInput {
  name: string;
  kind: string;
}

export interface ObsHandlers {
  status(s: ObsStatus, detail?: string): void;
  /** The chosen mic's peak level in dB, about 20 times a second. -Infinity is silence. */
  level(db: number): void;
  /** The chosen mic was muted or unmuted in OBS. A muted mic still reports levels, so this decides. */
  muted(m: boolean): void;
  scene(name: string): void;
  streaming(active: boolean): void;
  inputs(list: ObsInput[], mic: string | null): void;
}

export interface ObsOptions {
  port: number;
  password: string;
  mic: string | null;
}

// Event subscription bits (obs-websocket 5 protocol).
const SUB_SCENES = 1 << 2;
const SUB_INPUTS = 1 << 3;
const SUB_OUTPUTS = 1 << 6;
const SUB_VOLUME = 1 << 16;

/** Inputs that are microphones on Windows, Mac and Linux. */
const MIC_KIND = /input_capture/;

async function sha256b64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export class ObsLink {
  private ws: WebSocket | null = null;
  private mic: string | null;
  private pending = new Map<string, (data: Record<string, unknown> | null) => void>();
  private reqSeq = 0;
  private stopped = false;
  private opened = false;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: ObsOptions, private on: ObsHandlers) {
    this.mic = opts.mic;
  }

  connect(): void {
    this.stopped = false;
    this.opened = false;
    this.on.status("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${this.opts.port}`, "obswebsocket.json");
    } catch {
      this.on.status("error", "Couldn't open a connection to OBS.");
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.opened = true;
    };
    ws.onmessage = (e) => void this.handle(String(e.data));
    ws.onclose = (e) => {
      this.ws = null;
      if (this.stopped) return;
      if (e.code === 4009) {
        this.on.status("error", "Wrong password. Copy it again from OBS: Tools, WebSocket Server Settings, Show Connect Info.");
        return; // a wrong password won't fix itself
      }
      this.on.status(
        "error",
        this.opened
          ? "Lost the connection to OBS. Reconnecting."
          : "Can't reach OBS. Make sure it's open and the WebSocket server is on (Tools, WebSocket Server Settings)."
      );
      this.retry = setTimeout(() => this.connect(), 5000);
    };
  }

  close(): void {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.ws?.close();
    this.ws = null;
    this.on.status("off");
  }

  setMic(name: string): void {
    this.mic = name;
    void this.checkMute();
  }

  private async checkMute(): Promise<void> {
    if (!this.mic) return;
    const r = await this.request("GetInputMute", { inputName: this.mic });
    if (r) this.on.muted(Boolean(r.inputMuted));
  }

  private send(op: number, d: unknown): void {
    this.ws?.send(JSON.stringify({ op, d }));
  }

  private request(requestType: string, requestData?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const requestId = `lc-${++this.reqSeq}`;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.send(6, { requestType, requestId, ...(requestData ? { requestData } : {}) });
      setTimeout(() => {
        if (this.pending.delete(requestId)) resolve(null);
      }, 5000);
    });
  }

  private async handle(raw: string): Promise<void> {
    let msg: { op: number; d: Record<string, any> };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const d = msg.d ?? {};

    if (msg.op === 0) {
      // Hello: answer with the password proof if OBS asks for one.
      const identify: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: SUB_SCENES | SUB_INPUTS | SUB_OUTPUTS | SUB_VOLUME };
      if (d.authentication) {
        const secret = await sha256b64(this.opts.password + d.authentication.salt);
        identify.authentication = await sha256b64(secret + d.authentication.challenge);
      }
      this.send(1, identify);
      return;
    }

    if (msg.op === 2) {
      this.on.status("connected");
      const [scene, stream, inputs] = await Promise.all([
        this.request("GetCurrentProgramScene"),
        this.request("GetStreamStatus"),
        this.request("GetInputList"),
      ]);
      const sceneName = (scene?.currentProgramSceneName ?? scene?.sceneName) as string | undefined;
      if (sceneName) this.on.scene(sceneName);
      if (stream) this.on.streaming(Boolean(stream.outputActive));
      const list = ((inputs?.inputs ?? []) as Array<{ inputName: string; inputKind: string }>).map((i) => ({ name: i.inputName, kind: i.inputKind }));
      if (!this.mic || !list.some((i) => i.name === this.mic)) {
        this.mic = list.find((i) => MIC_KIND.test(i.kind))?.name ?? null;
      }
      this.on.inputs(list, this.mic);
      await this.checkMute();
      return;
    }

    if (msg.op === 7) {
      const done = this.pending.get(d.requestId);
      if (done) {
        this.pending.delete(d.requestId);
        done(d.requestStatus?.result ? (d.responseData ?? {}) : null);
      }
      return;
    }

    if (msg.op === 5) {
      const data = d.eventData ?? {};
      switch (d.eventType) {
        case "InputVolumeMeters": {
          const input = (data.inputs as Array<{ inputName: string; inputLevelsMul: number[][] }> | undefined)?.find((i) => i.inputName === this.mic);
          if (!input) return;
          // Each channel is [magnitude, peak, input peak], as multipliers.
          const peak = Math.max(0, ...(input.inputLevelsMul ?? []).map((ch) => Number(ch?.[1] ?? 0)));
          this.on.level(peak > 0 ? 20 * Math.log10(peak) : -Infinity);
          return;
        }
        case "InputMuteStateChanged":
          if (data.inputName === this.mic) this.on.muted(Boolean(data.inputMuted));
          return;
        case "CurrentProgramSceneChanged":
          if (data.sceneName) this.on.scene(String(data.sceneName));
          return;
        case "StreamStateChanged":
          this.on.streaming(Boolean(data.outputActive));
          return;
      }
    }
  }
}
