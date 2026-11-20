// Papegaai: hands what the microphone hears to the page (sound.js) in blocks of BLOCK samples. It
// runs on the audio thread while the child records and keeps nothing: every full block is passed
// on and forgotten here. sound.js caps the take at MAX_SECONDS and holds it in memory only.
const BLOCK = 1024;

class PapegaaiCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(BLOCK);
    this.n = 0;
    this.on = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this.on = false;
    };
  }

  process(inputs) {
    if (!this.on) return false; // stopped: the node may be collected
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === BLOCK) {
        this.port.postMessage(this.buf, [this.buf.buffer]);
        this.buf = new Float32Array(BLOCK);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('papegaai-capture', PapegaaiCapture);
