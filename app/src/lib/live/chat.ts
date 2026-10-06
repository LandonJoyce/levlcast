/**
 * Reads a channel's Twitch chat anonymously, the way an embedded chat does:
 * no login, and nothing sent but the handshake. The dock uses it to count
 * chatters, spot first-time chatters and catch raids.
 */

export interface ChatMessage {
  user: string;
  name: string;
  text: string;
  /** Twitch marks a person's first ever message in this channel. */
  firstTime: boolean;
  at: number;
}

export interface ChatHandlers {
  message(m: ChatMessage): void;
  raid(from: string, viewers: number): void;
  status(s: "connecting" | "connected" | "error"): void;
}

const TWITCH_IRC = "wss://irc-ws.chat.twitch.tv:443";

/** A Twitch clip link: clips.twitch.tv/<id> (or its embed), or twitch.tv/<channel>/clip/<id>. */
const CLIP_LINK = /(?:clips\.twitch\.tv\/(?:embed\?clip=)?|twitch\.tv\/(\w{3,25})\/clip\/)([A-Za-z0-9_-]{4,100})/i;

/**
 * The clip id in a chat message, from a !clip bot or someone sharing one.
 * A link naming another channel doesn't count; a clips.twitch.tv link
 * doesn't say whose it is, so the server checks those.
 */
export function clipIdIn(text: string, channel: string): string | null {
  const m = CLIP_LINK.exec(text);
  if (!m) return null;
  if (m[1] && m[1].toLowerCase() !== channel.toLowerCase()) return null;
  return m[2];
}

function unescapeTag(v: string): string {
  return v.replace(/\\s/g, " ").replace(/\\:/g, ";").replace(/\\r/g, "\r").replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
}

/** One IRC line: tags, who sent it, the command and the message text. */
export function parseIrc(line: string): { tags: Record<string, string>; nick: string; command: string; trailing: string } {
  let rest = line;
  const tags: Record<string, string> = {};
  if (rest.startsWith("@")) {
    const end = rest.indexOf(" ");
    for (const pair of rest.slice(1, end).split(";")) {
      const eq = pair.indexOf("=");
      if (eq > 0) tags[pair.slice(0, eq)] = unescapeTag(pair.slice(eq + 1));
    }
    rest = rest.slice(end + 1);
  }
  let nick = "";
  if (rest.startsWith(":")) {
    const end = rest.indexOf(" ");
    const prefix = rest.slice(1, end);
    nick = prefix.includes("!") ? prefix.slice(0, prefix.indexOf("!")) : "";
    rest = rest.slice(end + 1);
  }
  const colon = rest.indexOf(" :");
  const head = colon >= 0 ? rest.slice(0, colon) : rest;
  const trailing = colon >= 0 ? rest.slice(colon + 2) : "";
  const command = head.split(" ")[0] ?? "";
  return { tags, nick, command, trailing };
}

export class TwitchChat {
  private ws: WebSocket | null = null;
  private stopped = false;
  private backoff = 2000;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private channel: string, private on: ChatHandlers, private url: string = TWITCH_IRC) {}

  connect(): void {
    this.stopped = false;
    this.on.status("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send("PASS SCHMOOPIIE");
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${this.channel.toLowerCase()}`);
    };
    ws.onmessage = (e) => {
      for (const line of String(e.data).split("\r\n")) {
        if (line) this.handle(line);
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.stopped) return;
      this.on.status("error");
      this.retry = setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 60_000);
    };
  }

  close(): void {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.ws?.close();
    this.ws = null;
  }

  private handle(line: string): void {
    if (line.startsWith("PING")) {
      this.ws?.send(line.replace("PING", "PONG"));
      return;
    }
    const { tags, nick, command, trailing } = parseIrc(line);
    if (command === "001" || command === "ROOMSTATE") {
      this.backoff = 2000;
      this.on.status("connected");
      return;
    }
    if (command === "PRIVMSG") {
      this.on.message({
        user: nick,
        name: tags["display-name"] || nick,
        text: trailing,
        firstTime: tags["first-msg"] === "1",
        at: Date.now(),
      });
      return;
    }
    if (command === "USERNOTICE" && tags["msg-id"] === "raid") {
      this.on.raid(tags["msg-param-displayName"] || tags["msg-param-login"] || "someone", Number(tags["msg-param-viewerCount"] ?? 0));
    }
  }
}
