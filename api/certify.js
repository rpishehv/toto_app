// api/certify.js — RFC 3161 trusted timestamping via freetsa.org
// Sends a hash to a free Timestamp Authority and returns a signed token

export const config = { runtime: 'edge' };

const TSA_URL = 'https://freetsa.org/tsr';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const { hash } = await req.json();
    if (!hash || typeof hash !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing hash' }), { status: 400 });
    }

    // Build a minimal RFC 3161 timestamp request
    // TSQ = TimeStampReq DER structure
    // We use the SHA-256 OID: 2.16.840.1.101.3.4.2.1
    // Hash must be raw bytes — decode hex to bytes
    const hashBytes = new Uint8Array(hash.match(/.{1,2}/g).map(b => parseInt(b, 16)));

    // Build DER-encoded TSQ manually:
    // SEQUENCE {
    //   INTEGER 1 (version)
    //   SEQUENCE {
    //     SEQUENCE { OID sha256 }
    //     OCTET STRING <hash>
    //   }
    //   BOOLEAN TRUE (certReq)
    // }
    const sha256Oid = new Uint8Array([0x30,0x0d,0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01,0x05,0x00]);
    const hashLen = hashBytes.length;
    const msgImprint = new Uint8Array([
      0x30, sha256Oid.length + hashLen + 4,
      ...sha256Oid,
      0x04, hashLen, ...hashBytes,
    ]);
    const tsq = new Uint8Array([
      0x30, msgImprint.length + 5,
      0x02, 0x01, 0x01,          // version INTEGER 1
      ...msgImprint,
      0x01, 0x01, 0xff,          // certReq BOOLEAN TRUE
    ]);

    // Send to freetsa.org
    const tsaRes = await fetch(TSA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: tsq,
    });

    if (!tsaRes.ok) {
      return new Response(JSON.stringify({
        error: `TSA returned ${tsaRes.status}`,
      }), { status: 502 });
    }

    const tokenBytes = await tsaRes.arrayBuffer();
    // Base64 encode the token for storage
    const token = btoa(String.fromCharCode(...new Uint8Array(tokenBytes)));
    const issuedAt = new Date().toISOString();

    return new Response(JSON.stringify({ token, issuedAt, tsa: 'freetsa.org' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
