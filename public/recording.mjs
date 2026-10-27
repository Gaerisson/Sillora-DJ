export class MixRecorder extends EventTarget {
  state = 'idle'; startedAt = 0; chunks = []; result = null;
  get duration() { return this.state === 'recording' ? (performance.now() - this.startedAt) / 1000 : this.result?.duration || 0; }
  async start(engine) {
    if (this.state !== 'idle') throw new Error('Un enregistrement est déjà en cours.');
    if (typeof MediaRecorder === 'undefined') throw new Error('L’enregistrement audio est indisponible dans ce navigateur.');
    this.state = 'starting'; this.dispatchEvent(new Event('change'));
    try {
      const context = await engine.init();
      this.destination = context.createMediaStreamDestination(); this.source = (engine.output||engine.limiter);
      this.source.connect(this.destination);
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(this.destination.stream, mimeType ? { mimeType, audioBitsPerSecond: 192000 } : {});
      this.chunks = []; this.result = null; this.error = null;
      this.recorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
      this.recorder.onerror = event => { this.error = new Error(event.error?.message || 'L’enregistrement a échoué.'); this.dispatchEvent(new CustomEvent('warning', { detail: this.error.message })); };
      this.recorder.onstop = () => {
        const type = this.recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
        this.result = { blob: new Blob(this.chunks, { type }), duration: (performance.now() - this.startedAt) / 1000, extension: type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm' };
        this.cleanup(); this.state = 'idle'; this.dispatchEvent(new Event('change'));
        if (this.error) this.rejectStop?.(this.error); else this.resolveStop?.(this.result);
        this.resolveStop = null; this.rejectStop = null; this.stopping = null;
      };
      this.recorder.start(1000); this.startedAt = performance.now(); this.state = 'recording'; this.dispatchEvent(new Event('change'));
    } catch (error) { this.cleanup(); this.state = 'idle'; this.dispatchEvent(new Event('change')); throw error; }
  }
  stop() {
    if (this.stopping) return this.stopping;
    if (this.state !== 'recording') return Promise.reject(new Error('Aucun enregistrement en cours.'));
    this.state = 'stopping'; this.dispatchEvent(new Event('change'));
    const stopping = new Promise((resolve, reject) => { this.resolveStop = resolve; this.rejectStop = reject; });this.stopping=stopping;
    this.recorder.stop(); return stopping;
  }
  cleanup() {
    if (this.destination) { try { this.source.disconnect(this.destination); } catch {} this.destination.stream.getTracks().forEach(track => track.stop()); this.destination.disconnect(); }
    this.destination = null; this.source = null; this.chunks = [];
  }
}
