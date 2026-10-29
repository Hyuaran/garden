import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const encoded = process.env.MY_NUMBER_ENCRYPTION_KEY || '';
  const value = Buffer.from(encoded, 'base64');
  if (value.length !== 32 || value.toString('base64') !== encoded) throw new Error('MY_NUMBER_ENCRYPTION_KEY must be 32 bytes in base64');
  return value;
}
/** @param {string} number */
export function encryptMyNumber(number) {
  if (!/^\d{12}$/.test(number)) throw new Error('Invalid my number');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  return { my_number_cipher: Buffer.concat([cipher.update(number, 'utf8'), cipher.final()]).toString('base64'), my_number_iv: iv.toString('base64'), my_number_tag: cipher.getAuthTag().toString('base64'), my_number_last4: number.slice(-4), key_version: 1 };
}
/** @param {{my_number_cipher:string,my_number_iv:string,my_number_tag:string,key_version:number}} row */
export function decryptMyNumber(row) {
  if (row.key_version !== 1) throw new Error('Unsupported key version');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(row.my_number_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.my_number_tag, 'base64'));
  const value = Buffer.concat([decipher.update(Buffer.from(row.my_number_cipher, 'base64')), decipher.final()]).toString('utf8');
  if (!/^\d{12}$/.test(value)) throw new Error('Invalid decrypted my number');
  return value;
}

/** Encrypt the onboarding self/dependent numbers before any database write.
 * Masked values preserve the previous encrypted value; new values replace it.
 * @param {Record<string, any>} fields
 * @param {Record<string, any>} previous
 */
export function encryptOnboardingNumbers(fields, previous = {}) {
  const result = { ...fields };
  const protect = (row, old) => {
    const value = row.my_number;
    if (typeof value === 'string' && /^\d{12}$/.test(value)) {
      return {...row, my_number:'••••••••'+value.slice(-4),my_number_secret:encryptMyNumber(value)};
    }
    if (typeof value === 'string' && /^••••••••\d{4}$/.test(value)) {
      if (/^\d{12}$/.test(old.my_number || '')) return protect({...row,my_number:old.my_number}, {});
      return {...row,my_number:old.my_number || '',my_number_secret:old.my_number_secret || null};
    }
    if (value === undefined) {
      if (/^\d{12}$/.test(old.my_number || '')) return protect({...row,my_number:old.my_number}, {});
      return {...row,my_number:old.my_number || '',my_number_secret:old.my_number_secret || null};
    }
    if (value !== '' && value !== null) throw new Error('Invalid my number');
    return {...row,my_number:'',my_number_secret:null};
  };
  const self = protect(result, previous);
  if (Array.isArray(result.dependents)) self.dependents = result.dependents.map((row, i) => protect(row, previous.dependents?.[i] || {}));
  return self;
}
