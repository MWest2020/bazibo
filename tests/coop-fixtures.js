// Real local descriptions from Chromium 1255 (chrome-headless-shell, RTCPeerConnection with
// iceServers: [] and one data channel), as the two-phone spike of Vier op een rij sees them.
// Used by tests/vier-coop.test.js and tools/coop-sizes.mjs.
export const CHROME_OFFER = [
  'v=0',
  'o=- 7412999231880007638 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1454530697 1 udp 2113937151 f39d5ed5-7a4e-49a2-847a-3140a68bf322.local 36446 typ host generation 0 network-cost 999',
  'a=ice-ufrag:ENoX',
  'a=ice-pwd:mJMiCYKyfUCG/gHS18jiZ/uV',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 91:BA:DC:09:8A:F5:60:EA:51:7B:0F:D6:53:76:4E:65:1F:24:5E:96:F4:5E:2C:EE:F1:B1:B4:15:7A:E2:8A:4B',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

export const CHROME_ANSWER = [
  'v=0',
  'o=- 2235186464379842377 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:2878869323 1 udp 2113937151 2c6ee70f-3183-4871-9ca5-48244c612dc3.local 48731 typ host generation 0 network-cost 999',
  'a=ice-ufrag:q8Zr',
  'a=ice-pwd:3iC7Xx1u0n6tq0Yh0b9w+H2P',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 0C:5D:1E:7A:22:90:AB:41:6F:3B:88:19:E2:07:C4:5A:9D:61:F0:2E:BB:13:48:77:A6:05:CC:39:D4:8E:12:F7',
  'a=setup:active',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

const EXTRA = {
  mdns: (i) => `a=candidate:${900 + i} 1 udp 2113937151 ${['0b8c7f2a-5d41-4e6b-9a3f-7c2d1e0f4a5b', '6e1d2c3b-4a59-4876-a5b4-c3d2e1f0a9b8'][i % 2]}.local ${50000 + i} typ host generation 0 network-cost 999`,
  ipv4: (i) => `a=candidate:${900 + i} 1 udp 2122260223 192.168.178.58 ${50000 + i} typ host generation 0 network-id 1 network-cost 10`,
  ipv6: (i) => `a=candidate:${900 + i} 1 udp 2122197247 fe80::be24:11ff:feeb:e29 ${50000 + i} typ host generation 0 network-id 2 network-cost 10`,
};

/** The offer with its candidate lines replaced by these kinds ('mdns', 'ipv4', 'ipv6'). */
export function withCandidates(sdp, kinds) {
  const lines = sdp.split('\r\n').filter((l) => !l.startsWith('a=candidate:'));
  const at = lines.findIndex((l) => l.startsWith('a=ice-ufrag:'));
  lines.splice(at, 0, ...kinds.map((k, i) => EXTRA[k](i)));
  return lines.join('\r\n');
}
