// Vier op een rij on two phones in the same room (spike, only with ?test&coop in the address; see
// docs/design/coop-qr-webrtc.md). No server, no internet, no STUN or TURN: phone 1 makes a WebRTC
// offer with an empty iceServers list and shows it as a QR code (coop-codec.js), phone 2 scans it
// and shows its answer as a QR code, phone 1 scans that, and a data channel opens over the local
// Wi-Fi. DTLS is always on (WebRTC cannot turn it off). The codes are untrusted until
// decodeSignal has checked them; the messages that travel are judged in vier.js (coop-proto.js).
//
// This file owns the "Samen op twee telefoons" screen (#screen-vier-coop), the camera while it
// scans, and the RTCPeerConnection. It closes everything when the child leaves the screen or the
// game, and when the app goes to the background.
import { drawQr, makeReader } from '../../js/transfer-ui.js';
import { fieldsFromSdp, encodeSignal, decodeSignal, buildSdp, newSession } from './coop-codec.js';
import { BYE } from './coop-proto.js';

const $ = (sel) => document.querySelector(sel);
const GATHER_MS = 4000; // host candidates come within milliseconds; never wait longer than this
const CONNECT_MS = 20000; // after phone 1 scanned the answer: then "it does not work"
const DISCONNECT_GRACE_MS = 4000; // 'disconnected' may come back by itself (a Wi-Fi hiccup)
const SCAN_MS = 180;
const CONNECTED_MS = 900; // "Verbonden!" stays a moment before the board

/**
 * `hooks`: onConnected({ role, board, tokens }) when the channel opens; onMessage(raw) for every
 * message; onLost(reason) when an open connection goes away (not when we close it ourselves).
 */
export function createCoop(shell, hooks) {
  const { t, tap } = shell;
  let pc = null;
  let ch = null;
  let role = 0; // 1 = showed the first code (player 1), 2 = scanned it (player 2)
  let session = 0;
  let setup = null; // { board, tokens }
  let state = 'idle'; // idle | making | showing | scanning | connecting | open | closed
  let want = null; // what the camera looks for: 'offer' | 'answer'
  let stream = null;
  let scanning = false;
  let scanTimer = 0;
  let camGen = 0;
  let busy = false;
  let connectTimer = 0;
  let graceTimer = 0;
  let lastCode = '';
  let lastQr = 0;
  let kinds = '';

  const onScreen = () => $('#screen-vier-coop').classList.contains('active');
  const panes = ['pick', 'show', 'scan'];
  function pane(name) {
    for (const p of panes) $(`#coop-${p}`).hidden = p !== name;
  }
  function say(id, text) {
    $(id).textContent = text;
  }
  function diag(text) {
    const el = $('#coop-diag');
    el.textContent = text;
    el.hidden = !text;
  }

  // ---------- the connection ----------

  function rtc() {
    const p = new RTCPeerConnection({ iceServers: [] }); // host candidates only: nothing leaves the room
    // one channel, agreed on both sides (id 0): a channel the other phone opens is refused
    const c = p.createDataChannel('vier', { negotiated: true, id: 0, ordered: true });
    p.ondatachannel = (e) => e.channel.close();
    c.onopen = () => p === pc && opened();
    c.onclose = () => p === pc && lost('closed');
    c.onmessage = (e) => p === pc && state === 'open' && hooks.onMessage(e.data);
    p.onconnectionstatechange = () => {
      if (p !== pc) return;
      const s = p.connectionState;
      if (s === 'failed' || s === 'closed') lost(s);
      else if (s === 'disconnected') {
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => p === pc && p.connectionState !== 'connected' && lost('disconnected'), DISCONNECT_GRACE_MS);
      } else if (s === 'connected') clearTimeout(graceTimer);
    };
    return [p, c];
  }

  function gathered(p) {
    return new Promise((resolve) => {
      if (p.iceGatheringState === 'complete') return resolve();
      const timer = setTimeout(resolve, GATHER_MS);
      p.addEventListener('icegatheringstatechange', () => {
        if (p.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  /** Our local description, gathered, as fields for a code. `setupRole`: what it must say. */
  async function localFields(p, setupRole) {
    await gathered(p);
    const f = fieldsFromSdp(p.localDescription?.sdp);
    if (f.setup !== setupRole) throw new Error('sdp');
    kinds = f.candidates.map((c) => (c.kind === 1 ? 'mDNS' : c.kind === 4 ? 'IPv4' : 'IPv6')).join('+');
    return f;
  }

  function opened() {
    if (state === 'open' || state === 'closed') return;
    clearTimeout(connectTimer);
    stopCamera();
    state = 'open';
    pane('show');
    $('#coop-qr').hidden = true;
    $('#coop-next').hidden = true;
    say('#coop-show-msg', t('vier.coop.connected'));
    $('#coop-show-msg').classList.add('ok');
    const info = { role, board: setup.board, tokens: setup.tokens.slice() };
    setTimeout(() => {
      if (state === 'open') hooks.onConnected(info);
    }, CONNECTED_MS);
  }

  /** The connection went away by itself (or could not be made). */
  function lost(reason) {
    if (state === 'closed' || state === 'idle') return;
    const was = state;
    close(false);
    if (was === 'open') hooks.onLost(reason);
    else failed();
  }

  /** Close everything: the channel, the connection, the camera. `bye`: tell the other phone first. */
  function close(bye = true) {
    clearTimeout(connectTimer);
    clearTimeout(graceTimer);
    stopCamera();
    if (ch && bye && ch.readyState === 'open') {
      try {
        ch.send(BYE);
      } catch {
        /* closing anyway */
      }
    }
    const p = pc;
    pc = null; // the handlers of the old connection see it is gone
    ch = null;
    if (p) {
      try {
        p.close();
      } catch {
        /* already closed */
      }
    }
    if (state !== 'idle') state = 'closed';
  }

  function failed(key = 'vier.coop.failed') {
    close(false);
    state = 'idle';
    if (!onScreen()) return;
    pane('pick');
    say('#coop-pick-msg', t(key));
  }

  // ---------- phone 1: show the offer, then scan the answer ----------

  async function host() {
    close(false);
    role = 1;
    state = 'making';
    session = newSession();
    pane('show');
    $('#coop-qr').hidden = true;
    $('#coop-next').hidden = true;
    $('#coop-show-msg').classList.remove('ok');
    say('#coop-show-msg', t('vier.coop.making'));
    try {
      const [p, c] = rtc();
      pc = p;
      ch = c;
      await p.setLocalDescription(await p.createOffer());
      const f = await localFields(p, 'actpass');
      if (p !== pc) return;
      showCode(encodeSignal({ kind: 'offer', session, ...f, board: setup.board, tokens: setup.tokens }));
      say('#coop-show-msg', t('vier.coop.showOffer'));
      $('#coop-next').hidden = false;
    } catch (e) {
      failed(e?.message === 'no-network' ? 'vier.coop.noNetwork' : 'vier.coop.failed');
    }
  }

  function showCode(text) {
    lastCode = text;
    state = 'showing';
    $('#coop-qr').hidden = false;
    lastQr = drawQr($('#coop-qr'), text);
    diag(t('vier.coop.diag', { chars: text.length, n: lastQr, kinds }));
  }

  // ---------- phone 2: scan the offer, then show the answer ----------

  function guest() {
    close(false);
    role = 2;
    session = 0;
    startCamera('offer');
  }

  /** One QR text from the camera. */
  async function take(text) {
    let f;
    try {
      f = decodeSignal(text, want);
    } catch (e) {
      const m = e?.message;
      if (m === 'not-ours') return; // some other QR code in view: keep looking
      say('#coop-scan-msg', t(m === 'wrong-kind' ? (want === 'offer' ? 'vier.coop.wrongOffer' : 'vier.coop.wrongAnswer') : m === 'version' ? 'vier.coop.version' : 'vier.coop.bad'));
      return;
    }
    if (want === 'answer' && f.session !== session) {
      say('#coop-scan-msg', t('vier.coop.otherGame'));
      return;
    }
    busy = true;
    try {
      if (want === 'offer') await answer(f);
      else await connect(f);
    } finally {
      busy = false;
    }
  }

  async function answer(f) {
    // stop reading, but keep the camera until our candidates are gathered: Chrome may then give
    // the local address itself instead of an mDNS name (it does for pages that use the camera),
    // and one side's usable address is enough for the two phones to find each other
    scanning = false;
    clearTimeout(scanTimer);
    session = f.session;
    setup = { board: f.board, tokens: f.tokens };
    state = 'making';
    pane('show');
    $('#coop-qr').hidden = true;
    $('#coop-next').hidden = true;
    $('#coop-show-msg').classList.remove('ok');
    say('#coop-show-msg', t('vier.coop.making'));
    try {
      const [p, c] = rtc();
      pc = p;
      ch = c;
      await p.setRemoteDescription({ type: 'offer', sdp: buildSdp(f) });
      await p.setLocalDescription(await p.createAnswer());
      const mine = await localFields(p, 'active');
      stopCamera();
      if (p !== pc) return;
      if (state === 'open') return; // it connected already (phone 1 was very quick)
      showCode(encodeSignal({ kind: 'answer', session, ...mine }));
      say('#coop-show-msg', t('vier.coop.showAnswer'));
    } catch (e) {
      failed(e?.message === 'no-network' ? 'vier.coop.noNetwork' : 'vier.coop.failed');
    }
  }

  async function connect(f) {
    stopCamera();
    state = 'connecting';
    pane('show');
    $('#coop-qr').hidden = true;
    $('#coop-next').hidden = true;
    say('#coop-show-msg', t('vier.coop.connecting'));
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: buildSdp(f) });
    } catch {
      failed();
      return;
    }
    connectTimer = setTimeout(() => state === 'connecting' && failed(), CONNECT_MS);
  }

  // ---------- the camera (like Voortgang overzetten: only while scanning) ----------

  function stopCamera() {
    camGen++;
    scanning = false;
    clearTimeout(scanTimer);
    if (stream) for (const track of stream.getTracks()) track.stop();
    stream = null;
    const v = $('#coop-video');
    if (v) v.srcObject = null;
    $('#coop-scan .transfer-cam')?.classList.remove('on');
  }

  async function startCamera(kind) {
    stopCamera();
    want = kind;
    state = 'scanning';
    const gen = ++camGen;
    pane('scan');
    say('#coop-scan-msg', t(kind === 'offer' ? 'vier.coop.scanOffer' : 'vier.coop.scanAnswer'));
    if (!navigator.mediaDevices?.getUserMedia) {
      failed('vier.coop.noCamera');
      return;
    }
    let got;
    try {
      got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      if (gen === camGen) failed('vier.coop.noCamera');
      return;
    }
    if (gen !== camGen || !onScreen() || document.hidden) {
      for (const track of got.getTracks()) track.stop();
      return;
    }
    stream = got;
    const v = $('#coop-video');
    v.srcObject = stream;
    try {
      await v.play();
    } catch {
      /* a muted inline video may play without it */
    }
    if (gen !== camGen) return;
    $('#coop-scan .transfer-cam').classList.add('on');
    const read = await makeReader();
    if (gen !== camGen) return;
    scanning = true;
    const loop = async () => {
      if (!scanning || gen !== camGen) return;
      if (!document.hidden && v.readyState >= 2 && !busy) {
        for (const text of await read(v)) {
          if (gen !== camGen) return;
          await take(text);
        }
      }
      if (scanning && gen === camGen) scanTimer = setTimeout(loop, SCAN_MS);
    };
    loop();
  }

  // ---------- the screen ----------

  $('#coop-host').addEventListener('click', () => {
    tap();
    say('#coop-pick-msg', '');
    host();
  });
  $('#coop-guest').addEventListener('click', () => {
    tap();
    say('#coop-pick-msg', '');
    guest();
  });
  $('#coop-next').addEventListener('click', () => {
    tap();
    startCamera('answer');
  });
  $('#coop-back').addEventListener('click', () => {
    tap();
    back();
  });

  /** The back arrow (and the Android back button): close everything, back to the menu. */
  function back() {
    close(true);
    state = 'idle';
    shell.show('vier-menu');
  }

  // leaving the screen any other way closes the connection too (it stays open only for the board)
  shell.onShow((name) => {
    if (name === 'vier-coop') return;
    stopCamera();
    if (name !== 'vier' && state !== 'idle' && state !== 'closed') {
      close(true);
      state = 'idle';
    }
  });

  // the background: nothing stays open (on the board vier.js shows the lost card)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || state === 'idle' || state === 'closed') return;
    const was = state;
    close(true);
    if (was === 'open') hooks.onLost('background');
    else {
      state = 'idle';
      pane('pick');
      say('#coop-pick-msg', t('vier.coop.restart'));
    }
  });

  return {
    /** Open the screen. `menuSetup`: { board, tokens } from the menu (used when this phone shows the first code). */
    open(menuSetup) {
      close(false);
      state = 'idle';
      setup = { board: menuSetup.board, tokens: menuSetup.tokens.slice() };
      pane('pick');
      say('#coop-pick-msg', '');
      diag('');
      shell.show('vier-coop');
    },
    send(text) {
      if (state !== 'open' || !ch || ch.readyState !== 'open') return false;
      try {
        ch.send(text);
        return true;
      } catch {
        return false;
      }
    },
    close(bye = true) {
      close(bye);
      state = 'idle';
    },
    back,
    testHook() {
      return {
        state: () => ({ state, role, session, want, kinds, qr: lastQr, code: lastCode, pc: pc?.connectionState || null, ch: ch?.readyState || null, camera: !!stream }),
        // what a cheating or garbled phone could send: raw text, straight onto the channel
        sendRaw: (text) => {
          if (!ch || ch.readyState !== 'open') return false;
          ch.send(text);
          return true;
        },
        take: (text) => take(text),
      };
    },
  };
}
