// Revoked web unlock codes (unlock-code.js): the code id of each, the 10 random bytes of the payload
// (bytes 6-15) as 20 lowercase hex characters, as the issuer reports it. A code on this list is
// refused when it is entered and no longer opens anything at the next start. Offline: this file
// ships with the website, nothing is fetched.
//
// To revoke a code: add its id here with the date and why in a comment, run `npm run stamp`, merge;
// the website picks it up on the next visit (docs/reference/full-version.md).
export const REVOKED = Object.freeze([
  // 'a1b2c3d4e5f60718293a', // 2026-12-01: shared on a forum
]);
