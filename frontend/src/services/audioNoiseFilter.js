/**
 * AudioNoiseFilter
 * 
 * Provides human voice bandpass filtering, dynamic noise floor estimation,
 * and a speech gate with hysteresis to eliminate ambient background noise
 * (fans, breathing, earpiece cable rubbing, AC hum).
 */

export class AudioNoiseFilter {
  constructor({
    onVolume = null,          // (volume: number 0-100) => void
    onSpeakingChange = null,  // (isSpeaking: boolean) => void
    minSpeechThreshold = 28,  // Minimum threshold above baseline
    holdTimeMs = 280,         // Hysteresis release hold time in ms
  } = {}) {
    this.onVolume = onVolume;
    this.onSpeakingChange = onSpeakingChange;
    this.minSpeechThreshold = minSpeechThreshold;
    this.holdTimeMs = holdTimeMs;

    this.audioContext = null;
    this.sourceNode = null;
    this.highpassFilter = null;
    this.lowpassFilter = null;
    this.analyser = null;
    this.animFrame = null;
    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    this.noiseFloor = 14;
    this.noiseFloorSamples = [];
    this.isCalibrated = false;
    this.calibrationStartTime = 0;
  }

  start(stream) {
    if (!stream || !stream.getAudioTracks().length) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // 1. High-pass filter (100 Hz): Cuts desk thumps, AC rumble, and earpiece friction
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 105;
      this.highpassFilter.Q.value = 0.707;

      // 2. Low-pass filter (3800 Hz): Cuts high-frequency electrical hiss and fan whistle
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 3800;
      this.lowpassFilter.Q.value = 0.707;

      // 3. Frequency Analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      // Chain: Source -> Highpass -> Lowpass -> Analyser
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.calibrationStartTime = Date.now();
      this.noiseFloorSamples = [];
      this.isCalibrated = false;

      const loop = () => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate vocal energy concentrated in human speech range
        let sum = 0;
        // Bins roughly corresponding to 150 Hz - 3400 Hz
        const startBin = 2;
        const endBin = Math.min(bufferLength, 45);
        for (let i = startBin; i < endBin; i++) {
          sum += dataArray[i];
        }
        const vocalEnergy = sum / (endBin - startBin);

        // Adaptive noise floor calibration for the first 1.5 seconds
        const now = Date.now();
        if (!this.isCalibrated && now - this.calibrationStartTime < 1500) {
          this.noiseFloorSamples.push(vocalEnergy);
          if (this.noiseFloorSamples.length >= 30) {
            const avgFloor = this.noiseFloorSamples.reduce((a, b) => a + b, 0) / this.noiseFloorSamples.length;
            this.noiseFloor = Math.max(8, Math.min(30, avgFloor));
            this.isCalibrated = true;
          }
        }

        // Noise gate calculation
        const dynamicThreshold = Math.max(this.minSpeechThreshold, this.noiseFloor + 14);
        const isVoiceActive = vocalEnergy > dynamicThreshold;

        if (isVoiceActive) {
          this.lastSpeechTime = now;
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange?.(true);
          }
        } else if (this.isSpeaking) {
          // Hysteresis hold time so brief pauses don't cut off speaking state
          if (now - this.lastSpeechTime > this.holdTimeMs) {
            this.isSpeaking = false;
            this.onSpeakingChange?.(false);
          }
        }

        // Scaled volume output (0 when below gate, scaled 0-100 when speaking)
        let normalizedVolume = 0;
        if (vocalEnergy > this.noiseFloor + 4) {
          const effectiveEnergy = vocalEnergy - this.noiseFloor;
          normalizedVolume = Math.min(100, Math.round((effectiveEnergy / 65) * 100));
        }
        this.onVolume?.(normalizedVolume);

        this.animFrame = requestAnimationFrame(loop);
      };

      loop();
    } catch (err) {
      console.warn('AudioNoiseFilter initialization failed:', err);
    }
  }

  stop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch {}
      this.highpassFilter = null;
    }
    if (this.lowpassFilter) {
      try { this.lowpassFilter.disconnect(); } catch {}
      this.lowpassFilter = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {}
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.isSpeaking = false;
    this.onSpeakingChange?.(false);
    this.onVolume?.(0);
  }
}

export default AudioNoiseFilter;
