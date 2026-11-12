/**
 * A soft two-note chime, played once when a break is up. It is the only sound
 * in the app, so it is gentle: slow attack, long fade, low volume.
 */
export function playChime(volume = 0.18): void {
  try {
    const ctx = new AudioContext();
    const notes = [
      { frequency: 659.25, offset: 0 }, // E5
      { frequency: 987.77, offset: 0.28 }, // B5
    ];
    const length = 1.6;
    let ended = 0;

    for (const { frequency, offset } of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + length);
      oscillator.onended = () => {
        ended += 1;
        if (ended === notes.length) void ctx.close();
      };
    }
  } catch {
    // Silently fail if Web Audio API is unavailable
  }
}
