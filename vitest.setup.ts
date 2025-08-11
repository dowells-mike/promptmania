import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Centralized test environment polyfills
// Crypto (minimal) & randomUUID
if (!globalThis.crypto) {
  const randomUUID = () => {
    // Generate a simple RFC4122 v4 compatible UUID string
    const hex = [...cryptoRandomBytes(16)].map(b => b.toString(16).padStart(2,'0')).join('');
    return `${hex.substring(0,8)}-${hex.substring(8,12)}-4${hex.substring(13,16)}-8${hex.substring(17,20)}-${hex.substring(20,32)}`;
  };
  const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array && array instanceof Uint8Array) {
      for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
  Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues, randomUUID }, configurable: true });
} else if (!globalThis.crypto.randomUUID) {
  // Add randomUUID if missing
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => {
    const hex = [...cryptoRandomBytes(16)].map(b => b.toString(16).padStart(2,'0')).join('');
    return `${hex.substring(0,8)}-${hex.substring(8,12)}-4${hex.substring(13,16)}-8${hex.substring(17,20)}-${hex.substring(20,32)}`;
  }, configurable: true });
}

function cryptoRandomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  for (let i=0;i<len;i++) arr[i] = Math.floor(Math.random()*256);
  return arr;
}

// localStorage polyfill (jsdom usually provides it, but ensure)
if (!('localStorage' in globalThis)) {
  const store: Record<string,string> = {};
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  }, configurable: true });
}

// Clipboard polyfill
if (!navigator.clipboard) {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
}
