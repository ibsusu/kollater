
import { type IHasher } from 'hash-wasm/dist/lib/WASMInterface';
// let sodiumPromise = import('libsodium-wrappers').then(async _sodium => {
//   await _sodium.ready;
//   console.log("sodium ready");
//   return _sodium;
// });

let hashwasmPromise = import('hash-wasm').then(mod => mod);
// console.log("sodiumPromise", sodiumPromise);
import _sodium from 'libsodium-wrappers';
let sod = await _sodium;
await sod.ready;
let sodium = sod;
let {createBLAKE3} = await hashwasmPromise;
export const hashers: Record<string,IHasher> = {};


// console.log("sodium", self.sodium.to_base64( new Uint8Array([22, 245])));


// console.log("sodium", Object.getOwnPropertyNames(self.sodium));
//@ts-ignore
// console.log("sodium crypto is", sodium.crypto_generichash(sodium.crypto_generichash_BYTES, new Uint8Array([22, 245])));

const base58_map = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
//@ts-ignore
function to_base58 (B,A){var d=[],s="",i,j,c,n;for(i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s}
//@ts-ignore
function from_b58 (S,A){var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)}


await createBLAKE3(32).then(hasher => {hashers.b3Hasher = hasher;});

export function randomNumber (count=1){
  let rb = sodium.randombytes_buf(4*count);
  return rb;
}

export function randomString (size: number, count=1){
  return sodium.randombytes_buf(size*count);
}

export function concatByteArray(a: Uint8Array, b: Uint8Array) {
  let c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}
export function concatByteArray3(a: Uint8Array, b: Uint8Array, c: Uint8Array){
  let d = new Uint8Array(a.length + b.length + c.length);
  d.set(a);
  d.set(b, a.length);
  d.set(c, a.length+b.length);
  return d;
}


export function getFingerprint(publicKey64: string){
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  //let pk = publicKey.slice(sodium.crypto_sign_BYTES, sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES);
  let fingerprint = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, publicKey);
  let fingerprint58 = to_base58(fingerprint, base58_map);
  return fingerprint58;
}

export function getFingerprintRaw (publicKey: Uint8Array){
  let fingerprint = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, publicKey);
  return fingerprint;
};

export function getPublicKeyName (publicKey64: string){
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let nameBytesLength = publicKey.length - sodium.crypto_sign_BYTES - sodium.crypto_sign_PUBLICKEYBYTES - sodium.crypto_box_PUBLICKEYBYTES - 1;
  let nameBytes = new Uint8Array(nameBytesLength);
  nameBytes.set(publicKey.slice(publicKey.length-nameBytesLength, publicKey.length));
  let name = sodium.to_string(nameBytes);
  return name;
}

export function createKeyPair(name="", getFingerprint=false){
  let crypt = sodium.crypto_box_keypair();
  let sign = sodium.crypto_sign_keypair();
  let publicKey = concatByteArray(sign.publicKey, crypt.publicKey);
  let privateKey = concatByteArray3(sign.privateKey, crypt.privateKey, crypt.publicKey);
  let privateKey64 = sodium.to_base64(privateKey, sodium.base64_variants.URLSAFE_NO_PADDING);
  let nameBytes = sodium.from_string(name);
  let paddedNameByteLength = Math.min(nameBytes.length, 100);

  let paddedName = new Uint8Array(paddedNameByteLength + 1); // that '1' is for the flag byte.  we'd better not run out of space in case we need more flags.  right now we only use it for public or private.  i don't think it'll grow.
  paddedName.set(nameBytes.slice(0,100), 1);
  publicKey = concatByteArray(publicKey, paddedName);

  publicKey[sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES+sodium.crypto_box_PUBLICKEYBYTES] = 1; // public key flag
  let signedPublicKey = signCombined(publicKey, privateKey64);
  privateKey = concatByteArray(privateKey, paddedName);
  if(getFingerprint){
    let fingerprint = getFingerprintRaw(signedPublicKey);
    return {publicKey: signedPublicKey, privateKey, fingerprint};
  }
  return {publicKey: signedPublicKey, privateKey}
}

export function signCombined (message: Uint8Array, privateKey64: string) {
  let privateKey = sodium.from_base64(privateKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let sk = privateKey.slice(0,sodium.crypto_sign_SECRETKEYBYTES);
  let signedMessage = sodium.crypto_sign(message, sk);
  return signedMessage;
}

export function verifyCombined(signedMessage: Uint8Array, publicKey64: string) {
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let pk = publicKey.slice(sodium.crypto_sign_BYTES, sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES);
  let message = sodium.crypto_sign_open(signedMessage, pk);
  if (!message) {
    return null;
  }
  return message;
}

export function signDetached (message: Uint8Array, privateKey64: string) {
  let privateKey = sodium.from_base64(privateKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let sk = privateKey.slice(0,sodium.crypto_sign_SECRETKEYBYTES);
  let signature = sodium.crypto_sign_detached(message, sk);
  return signature;
}

export function verifyDetached(signature: Uint8Array, message: Uint8Array, publicKey64: string) {
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let pk = publicKey.slice(sodium.crypto_sign_BYTES, sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES);
  let valid = sodium.crypto_sign_verify_detached(signature, message, pk);
  return valid;
};

export function encryptStringWithKey (message: string, publicKey64: string) {
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let pk = publicKey.slice(sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES,
                           sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES+sodium.crypto_box_PUBLICKEYBYTES);
  let messageBytes = sodium.from_string(message);
  return sodium.to_base64(sodium.crypto_box_seal(messageBytes, pk), sodium.base64_variants.URLSAFE_NO_PADDING);
};

export function decryptStringWithKey (cipher64: string, publicKey64: string, privateKey64: string) {
  let privateKey = sodium.from_base64(privateKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let publicKey = sodium.from_base64(publicKey64, sodium.base64_variants.URLSAFE_NO_PADDING);
  let pk = publicKey.slice(sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES,
                           sodium.crypto_sign_BYTES+sodium.crypto_sign_PUBLICKEYBYTES+sodium.crypto_box_PUBLICKEYBYTES);
  let sk = privateKey.slice(sodium.crypto_sign_SECRETKEYBYTES,
                            sodium.crypto_sign_SECRETKEYBYTES+sodium.crypto_box_SECRETKEYBYTES);
  let cipher = sodium.from_base64(cipher64, sodium.base64_variants.URLSAFE_NO_PADDING);
  if (cipher.length < sodium.crypto_box_MACBYTES) {
      throw "Short message";
  }
  return sodium.to_string(sodium.crypto_box_seal_open(cipher, pk, sk));
}

export function encryptWithPassword (inBytes: Uint8Array, password: string){    
  let passwordBytes = sodium.crypto_generichash(32, sodium.from_string(password));
  let res = sodium.crypto_secretstream_xchacha20poly1305_init_push(passwordBytes);
  let [state_out, header] = [res.state, res.header];
  let c = sodium.crypto_secretstream_xchacha20poly1305_push(state_out,
    inBytes, null,
    sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL);
  let encryptedBytes = concatByteArray(header, c);
  return encryptedBytes;
};

export function decryptWithPassword (inBytes: Uint8Array, password: string){
  let passwordBytes = sodium.crypto_generichash(32, sodium.from_string(password));
  let header = inBytes.slice(0, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES);
  let encryptedBytes = inBytes.slice(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES);
  let state_in = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, passwordBytes);
  let r1 = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in, encryptedBytes);
  let [decryptedBytes, _tag1] = [r1.message, r1.tag];
  return decryptedBytes;
};

export function hashToBytes(inBytes: Uint8Array){
  hashers.b3Hasher.init();
  hashers.b3Hasher.update(inBytes);
  let hashBytes = hashers.b3Hasher.digest('binary')
  return hashBytes
}

export async function blobHashToString(blob: Blob){
  // hashers.b3Hasher.init();
  // hashers.b3Hasher.update(await blob.arrayBuffer());
  // let hashBytes = hashers.b3Hasher.digest('binary');
  const hashBytes = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, new Uint8Array(await blob.arrayBuffer()));
  const hash64 = sodium.to_base64(hashBytes, sodium.base64_variants.URLSAFE_NO_PADDING);
  return hash64;
}

export async function hashToString(message: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', message);
  return sodium.to_base64(new Uint8Array(hashBuffer), sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function init(): boolean{
  return true;
}