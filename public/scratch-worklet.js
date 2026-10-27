// A turntable reads the waveform in both directions. The hand supplies a new
// destination; the read head approaches it over one pointer interval, then stops.
class SillageScratchProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    const settings = options.processorOptions || {};
    this.channels = settings.channels || [];
    this.length = Math.min(...this.channels.map(channel => channel.length));
    if (!Number.isFinite(this.length)) this.length = 0;
    this.sourceRate = settings.sourceRate || sampleRate;
    this.position = this.bound((settings.position || 0) * this.sourceRate);
    this.target = this.position;
    this.interval = sampleRate * .016;
    this.velocity = 0;
    this.smoothedGain = 0;
    this.reportFrames = 0;
    this.alive = true;
    this.port.onmessage = ({data}) => {
      if (data.type === 'move' && Number.isFinite(data.position)) {
        this.target = this.bound(data.position * this.sourceRate);
        this.interval = sampleRate * Math.max(.008, Math.min(.05, (data.elapsedMs || 16) / 1000));
      } else if (data.type === 'finish') {
        // A fast mouse move and release may arrive before the next render
        // quantum. Consume that last hand movement before reporting its head.
        this.finishing = Math.ceil(sampleRate * .16);
        if(Math.abs(this.target-this.position)<.02)this.finish();
      }
    };
  }
  finish(){
    if(!this.alive)return;
    this.port.postMessage({type:'finished',position:this.position/this.sourceRate});
    this.alive=false;this.finishing=0;
  }
  bound(value) { return Math.max(0, Math.min(Math.max(0, this.length - 1), value)); }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out?.length || !this.length) return this.alive;
    const maxVelocity = 8 * this.sourceRate / sampleRate;
    // 1.5 ms acceleration smoothing and 2 ms envelope prevent abrupt clicks
    // when a gesture starts, stops or changes direction.
    const slew = 1 - Math.exp(-1 / (sampleRate * .0015));
    const envelope = 1 - Math.exp(-1 / (sampleRate * .002));
    for (let frame = 0; frame < out[0].length; frame++) {
      const distance = this.target - this.position;
      const desired = Math.abs(distance) < .02 ? 0 : Math.max(-maxVelocity, Math.min(maxVelocity, distance / Math.max(1, this.interval)));
      this.velocity += (desired - this.velocity) * slew;
      this.interval = Math.max(1, this.interval - 1);
      const step = Math.abs(this.velocity) > Math.abs(distance) ? distance : this.velocity;
      this.position = this.bound(this.position + step);
      if(this.finishing>0){this.finishing--;if(this.finishing===0||Math.abs(this.target-this.position)<.02)this.finish();}
      const moving = Math.abs(this.velocity) > .0001 && Math.abs(distance) > .01;
      this.smoothedGain += ((moving && this.alive ? 1 : 0) - this.smoothedGain) * envelope;
      const index = Math.floor(this.position), fraction = this.position - index;
      for (let channel = 0; channel < out.length; channel++) {
        const source = this.channels[Math.min(channel, this.channels.length - 1)];
        const a = Number.isFinite(source?.[index]) ? source[index] : 0;
        const b = Number.isFinite(source?.[Math.min(this.length - 1, index + 1)]) ? source[Math.min(this.length - 1, index + 1)] : 0;
        out[channel][frame] = Math.max(-1, Math.min(1, a + (b - a) * fraction)) * this.smoothedGain;
      }
    }
    this.reportFrames += out[0].length;
    if (this.reportFrames >= 1024) {
      this.reportFrames = 0;
      this.port.postMessage({type:'position', position:this.position / this.sourceRate});
    }
    // Remain alive for a final short fade; the host closes/disconnects this node.
    return this.alive || this.smoothedGain > .00001;
  }
}
registerProcessor('sillage-scratch', SillageScratchProcessor);
