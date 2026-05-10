// ── Session Key Management ──────────────────────────────────────────────────
// Generates an ephemeral ECDSA P-256 key pair in memory.
// The private key is NEVER persisted — it dies on page refresh.
// The public key is sent to the server for signature verification.

let sessionKeyPair = null; // { privateKey: CryptoKey, publicKeyJWK: object }

/**
 * Generate a new session key pair and return the public key in JWK format.
 * The private key is stored in module-level memory only.
 */
export async function generateSessionKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // private key NOT extractable
    ['sign', 'verify']
  );

  const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  sessionKeyPair = {
    privateKey: keyPair.privateKey,
    publicKeyJWK
  };

  return publicKeyJWK;
}

/**
 * Sign a request payload using the in-memory private key.
 * Returns { signature, timestamp } to be sent as headers.
 * Returns null if no session key exists (page was refreshed).
 */
export async function signRequest(method, url, body) {
  if (!sessionKeyPair) return null;

  const timestamp = Date.now().toString();

  // Hash the body
  let bodyStr = '';
  if (body) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const bodyBytes = new TextEncoder().encode(bodyStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bodyBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const bodyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Create signing payload: method|url|timestamp|bodyHash
  const payload = `${method}|${url}|${timestamp}|${bodyHash}`;
  const payloadBytes = new TextEncoder().encode(payload);

  // Sign with ECDSA P-256
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    sessionKeyPair.privateKey,
    payloadBytes
  );

  // Convert to base64url
  const signatureArray = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return { signature, timestamp };
}

/**
 * Check if a session key pair exists in memory.
 */
export function hasSessionKey() {
  return sessionKeyPair !== null;
}

/**
 * Clear the session key pair (e.g., on logout).
 */
export function clearSessionKey() {
  sessionKeyPair = null;
}
