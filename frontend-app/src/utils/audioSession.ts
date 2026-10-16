type AudioSessionLike = { type: string };

const playbackContexts = new Set<AudioContext>();

function audioSession(): AudioSessionLike | undefined {
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
}

function setAudioSessionType(type: string) {
  try {
    const session = audioSession();
    if (session) session.type = type;
  } catch {
    /* Safari-only API */
  }
}

/** Safari 16.4+: play through the media session so the silent switch does not mute us. */
export function setPlaybackAudioSession() {
  setAudioSessionType('playback');
}

export function registerPlaybackAudioContext(ctx: AudioContext) {
  playbackContexts.add(ctx);
}

export function releasePlaybackAudioContext(ctx: AudioContext) {
  playbackContexts.delete(ctx);
  if (ctx.state !== 'closed') void ctx.close().catch(() => {});
}

/**
 * `playback` refuses microphone capture and iOS never shows the permission
 * prompt. Switch to play-and-record, and pause any mix AudioContext, before
 * getUserMedia. Both must happen in the same click turn.
 */
export function prepareMicrophoneCapture() {
  setAudioSessionType('play-and-record');
  playbackContexts.forEach(ctx => {
    if (ctx.state === 'running') void ctx.suspend();
  });
}
