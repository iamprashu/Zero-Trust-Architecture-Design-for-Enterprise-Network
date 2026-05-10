// ── Session Key Management ──────────────────────────────────────────────────
// Generates an ECDSA P-256 key pair.
// The private key is non-extractable and stored in IndexedDB to survive page reloads.
// Because it is non-extractable, it cannot be stolen/copied to another device.
// The public key is sent to the server for signature verification.

let inMemorySessionKeyPair = null; // { privateKey: CryptoKey, publicKeyJWK: object }

// ── IndexedDB Wrapper ───────────────────────────────────────────────────────
const DB_NAME = 'ZeroTrustSecurityDB';
const STORE_NAME = 'sessionKeys';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveKeyToDB(keyObj) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(keyObj, 'currentSessionKey');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKeyFromDB() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get('currentSessionKey');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteKeyFromDB() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete('currentSessionKey');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Restore the session key pair from IndexedDB (e.g., on page load).
 */
export async function restoreSessionKey() {
  try {
    const stored = await loadKeyFromDB();
    if (stored && stored.privateKey && stored.publicKeyJWK) {
      inMemorySessionKeyPair = stored;
      return true;
    }
  } catch (e) {
    console.warn("Failed to restore session key from DB", e);
  }
  return false;
}

/**
 * Generate a new session key pair and return the public key in JWK format.
 */
export async function generateSessionKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // CRITICAL: private key NOT extractable (cannot be stolen)
    ['sign', 'verify']
  );

  const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  const keyObj = {
    privateKey: keyPair.privateKey,
    publicKeyJWK
  };

  inMemorySessionKeyPair = keyObj;
  
  // Persist to IndexedDB so it survives page reloads
  await saveKeyToDB(keyObj);

  return publicKeyJWK;
}

/**
 * Sign a request payload using the private key.
 * Returns { signature, timestamp } to be sent as headers.
 */
export async function signRequest(method, url, body) {
  if (!inMemorySessionKeyPair) return null;

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
    inMemorySessionKeyPair.privateKey,
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
 * Check if a session key pair is available.
 */
export function hasSessionKey() {
  return inMemorySessionKeyPair !== null;
}

/**
 * Clear the session key pair (e.g., on logout).
 */
export async function clearSessionKey() {
  inMemorySessionKeyPair = null;
  await deleteKeyFromDB();
}
