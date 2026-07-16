/**
 * Audio helper for playing loud and clear notification sounds
 */
export function playNotificationSound() {
  // 1. Play the standard wav notification at maximum volume
  try {
    const audio = new Audio('/notification.wav');
    audio.volume = 1.0;
    audio.play().catch(err => {
      console.warn("WAV Audio autoplay blocked or failed:", err);
    });
  } catch (e) {
    console.warn("WAV Audio playback exception:", e);
  }

  // 2. Synthesize a crystal-clear, loud, and crisp dual-tone bell chime using Web Audio API.
  // This ensures the alert is extremely audible, high-pitched, and professional,
  // resolving any issues with quiet static wav files.
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      
      const playTone = (startTime: number, frequency: number, duration: number, volume: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Use a mix of 'sine' for purity and 'triangle' for gentle loudness
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, startTime);
        
        // Setup envelope: rapid ramp-up followed by natural exponential decay
        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      
      // Let's create an attention-grabbing, highly resonant triple-bell chime
      // First high bell strike (C6 - 1046.50 Hz)
      playTone(now, 1046.50, 0.6, 0.9);
      
      // Second overlapping third (E6 - 1318.51 Hz) slightly delayed for richness
      playTone(now + 0.08, 1318.51, 0.5, 0.8);
      
      // Third resolving fifth (G6 - 1567.98 Hz) delayed to complete a bright major chord chime
      playTone(now + 0.16, 1567.98, 0.7, 0.9);
    }
  } catch (e) {
    console.warn("Web Audio chime synthesizer failed:", e);
  }
}
