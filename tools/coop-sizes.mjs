// Measures how big the two-phone codes of Vier op een rij are (spike; docs/design/coop-qr-webrtc.md):
// the whole SDP as Chrome writes it, the same deflated, only the lines that matter, and our own
// codec (coop-codec.js), each with the QR code it needs at error correction L.
// Run: node tools/coop-sizes.mjs
import { deflateSync } from 'node:zlib';
import qrcode from '../web/vendor/qrcode-generator/qrcode.min.js';
import { base45Encode } from '../web/js/transfer.js';
import { fieldsFromSdp, encodeSignal } from '../web/games/vier/coop-codec.js';
import { CHROME_OFFER, CHROME_ANSWER, withCandidates } from '../tests/coop-fixtures.js';

const qrSize = (text, mode) => {
  const qr = qrcode(0, 'L');
  qr.addData(text, mode);
  qr.make();
  const n = qr.getModuleCount();
  return { modules: n, version: (n - 17) / 4 };
};

const KEEP = /^(a=ice-ufrag|a=ice-pwd|a=fingerprint|a=setup|a=candidate)/;
const strip = (sdp) => sdp.split('\r\n').filter((l) => KEEP.test(l)).join('\n');
const packed = (text) => base45Encode(deflateSync(Buffer.from(text), { level: 9 }));

const rows = [];
function measure(label, sdp, kind) {
  const f = fieldsFromSdp(sdp);
  const ours = encodeSignal({ kind, session: 0x12345678, ...f, board: 'big', tokens: ['pup', 'bubble'] });
  const items = [
    ['whole SDP', sdp, 'Byte'],
    ['whole SDP, deflate + base45', packed(sdp), 'Alphanumeric'],
    ['only the 5 kinds of lines', strip(sdp), 'Byte'],
    ['those lines, deflate + base45', packed(strip(sdp)), 'Alphanumeric'],
    ['our codec (base45)', ours, 'Alphanumeric'],
  ];
  for (const [what, text, mode] of items) {
    const q = qrSize(text, mode);
    rows.push({ sdp: label, what, chars: text.length, qr: `v${q.version} (${q.modules}x${q.modules})` });
  }
}

measure('offer, 1 mDNS candidate (Chrome 1255)', CHROME_OFFER, 'offer');
measure('answer, 1 mDNS candidate (Chrome 1255)', CHROME_ANSWER, 'answer');
measure('offer, 2 mDNS candidates', withCandidates(CHROME_OFFER, ['mdns', 'mdns']), 'offer');
measure('offer, 4 candidates (2 mDNS, IPv4, IPv6)', withCandidates(CHROME_OFFER, ['mdns', 'mdns', 'ipv4', 'ipv6']), 'offer');
console.table(rows);
