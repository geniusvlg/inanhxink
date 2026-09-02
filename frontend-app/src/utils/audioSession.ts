/** Safari 16.4+: play through the media session so the silent switch does not mute us. */
export function setPlaybackAudioSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    /* Safari-only API */
  }
}
