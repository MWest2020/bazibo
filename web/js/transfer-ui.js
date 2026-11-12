// The "Voortgang overzetten" screen: send (QR codes on this screen) and receive (camera or pasted
// text). The codes themselves are made and checked in transfer.js; this file only shows them.
// The camera is used only while the receive tab is open, and only to look for our QR codes.
import qrcode from '../vendor/qrcode-generator/qrcode.min.js';
import * as store from './storage.js';
import { GAMES } from './games.js';
import { ART_KEEP } from './storage.js';
import { fitParts, hasArt, countDrawings, droppedDrawings, createCollector, partsFromText, decodeText, summarize, mergeTransfer, replaceTransfer } from './transfer.js';

const $ = (sel) => document.querySelector(sel);
const CYCLE_MS = 1500;
const SCAN_MS = 180;

/** Draw one QR code (alphanumeric text) on a canvas, with a white quiet zone. */
export function drawQr(canvas, text) {
  const qr = qrcode(0, 'L'); // L: the screen-to-camera path is clean, smaller codes scan better
  qr.addData(text, 'Alphanumeric');
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const scale = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / (n + quiet * 2)));
  const size = (n + quiet * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  return n;
}

/** A frame (video or image) -> the QR text in it, or null. BarcodeDetector first, else jsQR. */
let detector;
let jsQR = null;
async function makeReader() {
  if (detector === undefined) {
    detector = null;
    try {
      if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      detector = null;
    }
  }
  if (!detector && !jsQR) jsQR = (await import('../vendor/jsqr/jsqr.min.js')).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (source) => {
    if (detector) {
      try {
        const found = await detector.detect(source);
        return found.map((f) => f.rawValue);
      } catch {
        return [];
      }
    }
    const w0 = source.videoWidth || source.naturalWidth || source.width;
    const h0 = source.videoHeight || source.naturalHeight || source.height;
    if (!w0 || !h0) return [];
    const k = Math.min(1, 720 / Math.max(w0, h0));
    canvas.width = Math.round(w0 * k);
    canvas.height = Math.round(h0 * k);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    return hit ? [hit.data] : [];
  };
}

export function createTransfer({ t, show, showOverlay, hideOverlay, onShow, tap }) {
  let tab = 'send';
  let parts = [];
  let partAt = 0;
  let cycleTimer = 0;
  let withArt = true;
  let withDrawings = true;
  let stream = null;
  let scanTimer = 0;
  let scanning = false;
  let busy = false;
  const collector = createCollector();
  let card = null; // the card on screen: 'ask' (merge or replace), 'done' (reloads), 'error'

  /** The Android back button on one of this screen's cards. */
  function onBackCard() {
    if (card === 'done') location.reload(); // the new save is stored: start every game from it
    else cancelReceive();
  }

  const gameTitle = (id) => {
    const g = GAMES.find((x) => x.id === id);
    return g ? t(g.titleKey) : id;
  };

  // ---------- send ----------

  function stopCycle() {
    clearInterval(cycleTimer);
    cycleTimer = 0;
  }

  function showPart() {
    if (!parts.length) return;
    drawQr($('#transfer-qr'), parts[partAt]);
    $('#transfer-part').textContent = parts.length > 1 ? t('transfer.part', { i: partAt + 1, n: parts.length }) : '';
  }

  async function makeCodes() {
    stopCycle();
    const save = store.snapshot();
    const canDrop = hasArt(save);
    const drawings = countDrawings(save);
    $('#transfer-noart').hidden = !canDrop;
    $('#transfer-noart').setAttribute('aria-pressed', String(!withArt));
    $('#transfer-nodraw').hidden = !drawings;
    $('#transfer-nodraw').setAttribute('aria-pressed', String(!withDrawings));
    $('#transfer-code').hidden = true;
    $('#transfer-send-msg').textContent = '';
    try {
      const fit = await fitParts(save, { withArt, withDrawings });
      parts = fit.parts;
      // the oldest drawings that did not fit in the codes are named, never left out silently
      if (fit.leftOut) $('#transfer-send-msg').textContent = t('transfer.leftOut', { n: fit.leftOut });
    } catch (e) {
      parts = [];
      const ctx = $('#transfer-qr').getContext('2d');
      ctx.clearRect(0, 0, $('#transfer-qr').width, $('#transfer-qr').height);
      $('#transfer-part').textContent = '';
      $('#transfer-send-msg').textContent = e?.message === 'too-big' && withArt && canDrop ? t('transfer.tooBigArt') : t('transfer.tooBig');
      return;
    }
    partAt = 0;
    showPart();
    if (parts.length > 1) {
      cycleTimer = setInterval(() => {
        if (document.hidden) return;
        partAt = (partAt + 1) % parts.length;
        showPart();
      }, CYCLE_MS);
    }
  }

  $('#transfer-noart').addEventListener('click', () => {
    tap();
    withArt = !withArt;
    makeCodes();
  });
  $('#transfer-nodraw').addEventListener('click', () => {
    tap();
    withDrawings = !withDrawings;
    makeCodes();
  });

  $('#transfer-copy').addEventListener('click', async () => {
    tap();
    if (!parts.length) return;
    const text = parts.join('\n');
    const box = $('#transfer-code');
    box.value = text;
    box.hidden = false;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      box.focus();
      box.select();
    }
    $('#transfer-send-msg').textContent = copied ? t('transfer.copied') : t('transfer.copyHand');
  });

  // ---------- receive ----------

  function setStatus(text) {
    $('#transfer-status').textContent = text;
  }

  function progressText() {
    return collector.total ? t('transfer.progress', { have: collector.have, n: collector.total }) : t('transfer.scanHint');
  }

  let camGen = 0; // every start and stop gets a new number: a start that finishes late sees it

  function stopCamera() {
    camGen++;
    scanning = false;
    clearTimeout(scanTimer);
    if (stream) for (const track of stream.getTracks()) track.stop();
    stream = null;
    const v = $('#transfer-video');
    v.srcObject = null;
    $('.transfer-cam').classList.remove('on');
  }

  function noCamera() {
    $('.transfer-cam').hidden = true; // the paste box moves up
    setStatus(t('transfer.noCamera'));
  }

  const receiving = () => tab === 'receive' && $('#screen-transfer').classList.contains('active') && !document.hidden;

  async function startCamera() {
    stopCamera();
    const gen = ++camGen;
    $('.transfer-cam').hidden = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      noCamera();
      return;
    }
    let got;
    try {
      got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      if (gen === camGen) noCamera();
      return;
    }
    if (gen !== camGen || !receiving()) {
      for (const track of got.getTracks()) track.stop(); // started too late: the child left or tapped again
      return;
    }
    stream = got;
    const v = $('#transfer-video');
    v.srcObject = stream;
    try {
      await v.play();
    } catch {
      /* some WebViews need no play() for a muted inline video */
    }
    if (gen !== camGen) return; // stopped meanwhile (stopCamera already ended the tracks)
    $('.transfer-cam').classList.add('on');
    setStatus(progressText());
    const read = await makeReader();
    if (gen !== camGen) return;
    scanning = true;
    const loop = async () => {
      if (!scanning) return;
      if (!document.hidden && v.readyState >= 2 && !busy) {
        for (const text of await read(v)) await take(text);
      }
      if (scanning) scanTimer = setTimeout(loop, SCAN_MS);
    };
    loop();
  }

  /** One part from the camera or the paste box. */
  async function take(text) {
    const r = collector.add(text);
    if (r === 'other-set') {
      setStatus(t('transfer.other'));
      $('#transfer-again').hidden = false;
      return;
    }
    if (r === 'not-ours' || r === 'dup') return;
    setStatus(progressText());
    if (r === 'complete') await finish();
  }

  async function finish() {
    busy = true;
    const text = collector.text();
    collector.reset();
    let payload;
    try {
      payload = await decodeText(text);
    } catch (e) {
      // stop here: scanning on would read the same broken set again and wipe this message
      stopCamera();
      busy = false;
      const code = e?.message || 'format';
      setStatus(t(`transfer.err.${{ 'too-big': 'tooBig' }[code] || code}`));
      $('#transfer-again').hidden = false;
      return;
    }
    stopCamera();
    askWhatToDo(payload);
  }

  function summaryText(payload) {
    const list = summarize(payload).map(({ id, n }) => `${gameTitle(id)}: ${n}`);
    return list.length ? t('transfer.summary', { list: list.join(' · ') }) : t('transfer.empty');
  }

  /** Merging can take the gallery over its cap of generated mandalas: then say so first. */
  function capNote(payload) {
    const ids = new Set();
    for (const g of [store.snapshot().games?.kleuren, payload.games?.kleuren]) {
      for (const [id, e] of Object.entries(g?.art || {})) if (id.startsWith('m:') && !e?.gone) ids.add(id);
    }
    const art = ids.size > ART_KEEP ? ` ${t('transfer.capNote', { n: ART_KEEP })}` : '';
    const left = droppedDrawings(store.snapshot(), payload);
    return left ? `${art} ${t('transfer.drawNote', { n: left })}` : art;
  }

  function askWhatToDo(payload) {
    card = 'ask';
    showOverlay({
      title: t('transfer.got'),
      text: `${summaryText(payload)} ${t('transfer.choose')}${capNote(payload)}`,
      buttons: [
        [t('transfer.merge'), 'big primary', () => apply(mergeTransfer(store.snapshot(), payload))],
        [t('transfer.replace'), 'big secondary', () => confirmReplace(payload)],
        [t('common.cancel'), 'big secondary', cancelReceive],
      ],
    });
  }

  function confirmReplace(payload) {
    showOverlay({
      title: t('transfer.sure'),
      text: [t('transfer.sureText'), payload.noArt ? t('transfer.sureKeepArt') : '', payload.noDrawings ? t('transfer.sureKeepDrawings') : ''].filter(Boolean).join(' '),
      buttons: [
        [t('transfer.replace'), 'big primary', () => apply(replaceTransfer(store.snapshot(), payload))],
        [t('common.cancel'), 'big secondary', () => askWhatToDo(payload)],
      ],
    });
  }

  function cancelReceive() {
    card = null;
    hideOverlay();
    busy = false;
    if (tab === 'receive') startCamera();
  }

  async function apply(next) {
    showOverlay({ title: t('busy.title'), text: '', buttons: [] });
    if (!(await store.applyTransfer(next))) {
      card = 'error';
      showOverlay({ title: t('problem.title'), text: t('transfer.cantSave'), buttons: [[t('common.ok'), 'big primary', cancelReceive]] });
      return;
    }
    card = 'done';
    showOverlay({
      title: t('transfer.done'),
      text: t('transfer.doneText'),
      // reload so every game and the settings start from the new save
      buttons: [[t('common.ok'), 'big primary', () => location.reload()]],
    });
  }

  $('#transfer-again').addEventListener('click', () => {
    tap();
    collector.reset();
    busy = false;
    $('#transfer-again').hidden = true;
    setStatus(progressText());
    if (tab === 'receive' && !scanning) startCamera();
  });

  $('#transfer-use').addEventListener('click', async () => {
    tap();
    const lines = partsFromText($('#transfer-input').value);
    if (!lines.length) return;
    collector.reset();
    let complete = false;
    for (const line of lines) {
      const r = collector.add(line);
      if (r === 'complete') complete = true;
      if (r === 'other-set') {
        setStatus(t('transfer.other'));
        collector.reset();
        return;
      }
    }
    if (complete) await finish();
    else if (collector.total) setStatus(t('transfer.err.parts', { list: collector.missing().join(', ') }));
    else setStatus(t('transfer.err.format'));
  });

  // ---------- tabs and leaving ----------

  function setTab(next) {
    tab = next;
    for (const b of document.querySelectorAll('[data-transfer]')) b.setAttribute('aria-pressed', String(b.dataset.transfer === tab));
    $('#transfer-send').hidden = tab !== 'send';
    $('#transfer-receive').hidden = tab !== 'receive';
    if (tab === 'send') {
      stopCamera();
      makeCodes();
    } else {
      stopCycle();
      busy = false;
      collector.reset();
      $('#transfer-again').hidden = true;
      setStatus(t('transfer.scanHint'));
      startCamera();
    }
  }

  document.querySelectorAll('[data-transfer]').forEach((b) =>
    b.addEventListener('click', () => {
      tap();
      setTab(b.dataset.transfer);
    }),
  );

  onShow((name) => {
    if (name === 'transfer') {
      withArt = true;
      withDrawings = true;
      setTab('send');
    } else {
      stopCycle();
      stopCamera();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!$('#screen-transfer').classList.contains('active') || tab !== 'receive') return;
    if (document.hidden) stopCamera();
    else if (!busy) startCamera();
  });

  return {
    onBackCard,
    testHook: () => ({
      parts: () => parts.slice(),
      take: (text) => take(text),
      tab: () => tab,
      readImage: async (url) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const read = await makeReader();
        return read(img);
      },
    }),
  };
}
