import { Alert } from 'react-native';
import { supabase } from './supabase';

/**
 * Calls to levlcast.com. The app reads its own rows straight from
 * Supabase, but everything that changes something (sync, reports, clips,
 * opening a result) goes through the site, signed with the session token.
 */

const APP_URL = process.env.EXPO_PUBLIC_APP_URL!;

export interface ApiReply<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function api<T = any>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {}
): Promise<ApiReply<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'network' } as T };
  }
}

type GoPro = () => void;

function noConnection() {
  Alert.alert('No connection', 'Check your connection and try again.');
}

/** A plan limit: free gets the way to Pro, Pro just gets told when it resets. */
function limitAlert(title: string, message: string | undefined, upgrade: boolean, goPro: GoPro) {
  if (upgrade) {
    Alert.alert(title, message ?? '', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Go Pro', onPress: goPro },
    ]);
  } else {
    Alert.alert(title, message ?? 'It resets at the start of next month.');
  }
}

/**
 * Starts a report on a stream. True when one is on its way. A free
 * streamer who has used this week's report is offered the sealed extra
 * (opens Monday, or right away with Pro).
 */
export async function startReport(vodId: string, goPro: GoPro, sealedExtra = false): Promise<boolean> {
  const r = await api('/api/vods/analyze', { body: sealedExtra ? { vodId, sealedExtra: true } : { vodId } });
  if (r.ok) return true;
  const d = r.data ?? {};
  if (r.status === 0) {
    noConnection();
    return false;
  }
  if (r.status === 409) return true;
  if (d.error === 'limit_reached') {
    if (d.sealed_extra_available) {
      return new Promise((resolve) => {
        Alert.alert("This week's free report is used", d.message ?? '', [
          { text: 'Analyze it sealed', onPress: async () => resolve(await startReport(vodId, goPro, true)) },
          {
            text: 'Go Pro',
            onPress: () => {
              goPro();
              resolve(false);
            },
          },
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        ]);
      });
    }
    limitAlert(d.on_trial ? "This week's free report is used" : 'Monthly limit reached', d.message, !!d.upgrade, goPro);
    return false;
  }
  if (d.error === 'vod_too_short' || d.error === 'vod_too_long') {
    Alert.alert("Can't analyze this one", d.message ?? '');
    return false;
  }
  if (r.status === 429) {
    Alert.alert('Slow down a little', d.error ?? 'Try again in a few minutes.');
    return false;
  }
  Alert.alert("Couldn't start the report", d.message || d.error || 'Try again in a minute.');
  return false;
}

/** Makes a clip of a moment. True when it's being made. */
export async function makeClip(vodId: string, peakIndex: number, goPro: GoPro): Promise<boolean> {
  const r = await api('/api/clips/generate', { body: { vodId, peakIndex } });
  if (r.ok || r.status === 409) return true;
  const d = r.data ?? {};
  if (r.status === 0) {
    noConnection();
    return false;
  }
  if (d.error === 'limit_reached') {
    limitAlert('Clip limit reached', d.message, !!d.upgrade, goPro);
    return false;
  }
  Alert.alert("Couldn't make the clip", d.message || d.error || 'Try again in a minute.');
  return false;
}

/** A 9:16 reel of the stream's best moments. */
export async function makeReel(vodId: string, goPro: GoPro): Promise<boolean> {
  const r = await api('/api/clips/highlight-reel', { body: { vodId } });
  if (r.ok || r.status === 409) return true;
  const d = r.data ?? {};
  if (r.status === 0) {
    noConnection();
    return false;
  }
  if (d.error === 'limit_reached') {
    limitAlert('Clip limit reached', d.message, !!d.upgrade, goPro);
    return false;
  }
  Alert.alert("Couldn't make the reel", d.message || d.error || 'Try again in a minute.');
  return false;
}

/** Deletes a clip after asking. Resolves true once it's gone. */
export function confirmDeleteClip(clipId: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Delete this clip?', "It won't give the clip back to this month's count.", [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await api(`/api/clips/${clipId}`, { method: 'DELETE' });
          if (!r.ok) Alert.alert("Couldn't delete it", r.status === 0 ? 'Check your connection.' : 'Try again in a minute.');
          resolve(r.ok);
        },
      },
    ]);
  });
}

/** Makes a failed clip again: the old one is cleared first. */
export async function retryClip(clipId: string, vodId: string, startSeconds: number, goPro: GoPro): Promise<boolean> {
  const del = await api(`/api/clips/${clipId}`, { method: 'DELETE' });
  if (!del.ok) {
    Alert.alert("Couldn't retry it", 'Try again in a minute.');
    return false;
  }
  const r = await api('/api/clips/generate', { body: { vodId, startSeconds } });
  if (r.ok || r.status === 409) return true;
  const d = r.data ?? {};
  if (d.error === 'limit_reached') {
    limitAlert('Clip limit reached', d.message, !!d.upgrade, goPro);
    return false;
  }
  Alert.alert("Couldn't make the clip", d.message || d.error || 'Try again in a minute.');
  return false;
}

/** Posts a clip as a YouTube Short (a Pro feature). Resolves to its URL. */
export async function postToYouTube(clipId: string, goPro: GoPro): Promise<string | null> {
  const r = await api('/api/youtube/upload', { body: { clipId } });
  if (r.ok && r.data?.url) return r.data.url as string;
  if (r.data?.upgrade) {
    limitAlert('Posting to YouTube is Pro', 'Pro posts your clips as Shorts in one tap.', true, goPro);
    return null;
  }
  Alert.alert("Couldn't post it", r.status === 0 ? 'Check your connection.' : r.data?.error || 'Try again in a minute.');
  return null;
}

export interface SyncReply {
  synced?: number;
  total?: number;
  message?: string;
  error?: string;
}

/** Pulls in new past broadcasts from Twitch. */
export async function syncStreams(): Promise<SyncReply | null> {
  const r = await api<SyncReply>('/api/twitch/vods', { method: 'POST' });
  if (r.ok) return r.data;
  Alert.alert("Couldn't reach Twitch", r.status === 0 ? 'Check your connection and try again.' : r.data?.error || 'Try again in a minute.');
  return null;
}

export interface OpenReply {
  delta: number | null;
  call: 'win' | 'loss' | null;
  placement: boolean;
}

/** Opens a sealed result, with the streamer's call. */
export async function openResult(
  vodId: string,
  call: 'win' | 'loss' | null
): Promise<{ reply: OpenReply | null; error: string | null }> {
  const r = await api(`/api/vods/${vodId}/open`, { body: { call } });
  if (!r.ok) {
    return { reply: null, error: r.data?.error === 'locked' ? 'This one is still locked.' : "That didn't open. Try again." };
  }
  return {
    reply: { delta: r.data.delta ?? null, call: r.data.call ?? null, placement: !!r.data.placement },
    error: null,
  };
}

export interface Usage {
  plan: 'free' | 'pro';
  founding_member: boolean;
  pro_plus: boolean;
  analyses_used: number;
  analyses_limit: number;
  clips_used: number;
  clips_limit: number;
  hours_used: number;
  hours_limit: number;
  period_label: string;
  clips_period_label?: string;
}

export async function getUsage(): Promise<Usage | null> {
  const r = await api<Usage>('/api/usage');
  return r.ok ? r.data : null;
}
