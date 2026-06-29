// api/certify.js — RFC 3161 trusted timestamping via freetsa.org
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const { hash } = await req.json();
    if (!hash || typeof hash !== 'string' || hash.length < 16) {
      return new Response(JSON.stringify({ error: 'Missing or invalid hash' }), { status: 400 });
    }

    // Pad hash to 32 bytes (SHA-256) if shorter
    const paddedHash = hash.padEnd(64, '0').slice(0, 64);
    const hashBytes = new Uint8Array(paddedHash.match(/.{1,2}/g).map(b => parseInt(b, 16)));

    // Build RFC 3161 TimeStampReq in DER encoding
    // SHA-256 OID: 2.16.840.1.101.3.4.2.1
    const sha256OidBytes = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
    const nullBytes = [0x05, 0x00];

    // AlgorithmIdentifier: SEQUENCE { OID, NULL }
    const algId = [
      0x30, sha256OidBytes.length + nullBytes.length,
      ...sha256OidBytes,
      ...nullBytes,
    ];

    // OCTET STRING containing hash
    const hashOctet = [0x04, hashBytes.length, ...hashBytes];

    // MessageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING }
    const msgImprint = [
      0x30, algId.length + hashOctet.length,
      ...algId,
      ...hashOctet,
    ];

    // version INTEGER 1
    const version = [0x02, 0x01, 0x01];

    // certReq BOOLEAN TRUE
    const certReq = [0x01, 0x01, 0xff];

    // TimeStampReq: SEQUENCE { version, MessageImprint, certReq }
    const tsqContent = [...version, ...msgImprint, ...certReq];
    const tsq = new Uint8Array([0x30, tsqContent.length, ...tsqContent]);

    // Send to freetsa.org
    const tsaRes = await fetch('https://freetsa.org/tsr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Accept': 'application/timestamp-reply',
      },
      body: tsq,
    });

    if (!tsaRes.ok) {
      return new Response(JSON.stringify({
        error: `TSA returned HTTP ${tsaRes.status}`,
      }), { status: 502 });
    }

    const tokenBytes = new Uint8Array(await tsaRes.arrayBuffer());

    // Check if response is an error (starts with text instead of DER SEQUENCE 0x30)
    if (tokenBytes[0] !== 0x30) {
      const errText = new TextDecoder().decode(tokenBytes);
      return new Response(JSON.stringify({ error: `TSA error: ${errText.slice(0,100)}` }), { status: 502 });
    }

    // Base64 encode the token
    let binary = '';
    tokenBytes.forEach(b => binary += String.fromCharCode(b));
    const token = btoa(binary);
    const issuedAt = new Date().toISOString();

    return new Response(JSON.stringify({ token, issuedAt, tsa: 'freetsa.org', hashUsed: paddedHash }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
