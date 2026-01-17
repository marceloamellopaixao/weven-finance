// Utilitário de Criptografia AES-GCM (Cross-Device)
// A chave é derivada do UID do usuário, garantindo que ele possa
// acessar/descriptografar seus dados em qualquer dispositivo logado.

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const APP_SALT = "WEVEN_FINANCE_SECURE_SALT_2026"; 

// Helper para converter string em buffer
const strToBuf = (str: string) => new TextEncoder().encode(str);
// Helper para converter buffer em string
const bufToStr = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

// Helper para converter buffer em Base64
const bufToBase64 = (buf: ArrayBuffer | Uint8Array) => {
  const binary = String.fromCharCode(...new Uint8Array(buf));
  return window.btoa(binary);
};

// Helper para converter Base64 em buffer
const base64ToBuf = (str: string) => {
  const binary = window.atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// --- CHAVE ATUAL (DETERMINÍSTICA) ---
async function getKey(uid: string): Promise<CryptoKey> {
  if (typeof window === 'undefined') return {} as CryptoKey;

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(uid),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(APP_SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- CHAVE LEGADA (LOCALSTORAGE) ---
// Tenta recuperar a chave aleatória antiga para migração
async function getLegacyKey(uid: string): Promise<CryptoKey | null> {
    if (typeof window === 'undefined') return null;
    const STORAGE_KEY = `weven_key_${uid}`; // Padrão antigo
    const storedKey = localStorage.getItem(STORAGE_KEY);
    
    if (!storedKey) return null;

    try {
        const keyData = base64ToBuf(storedKey);
        return window.crypto.subtle.importKey(
            "raw",
            keyData,
            "AES-GCM",
            true,
            ["encrypt", "decrypt"]
        );
    } catch {
        return null;
    }
}

// --- FUNÇÕES EXPORTADAS ---

export const encryptData = async (data: string | number, uid: string): Promise<string> => {
  try {
    if (typeof window === 'undefined') return String(data);

    const key = await getKey(uid);
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encodedData = strToBuf(String(data));

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encodedData
    );

    return `${bufToBase64(iv)}:${bufToBase64(encryptedContent)}`;
  } catch (e) {
    console.error("Erro na encriptação", e);
    return String(data);
  }
};

export const decryptData = async (cipherText: string, uid: string): Promise<string> => {
  try {
    if (typeof window === 'undefined') return cipherText;
    if (!cipherText || !cipherText.includes(":")) return cipherText;

    const [ivB64, contentB64] = cipherText.split(":");
    const iv = base64ToBuf(ivB64);
    const content = base64ToBuf(contentB64);
    const key = await getKey(uid);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      content
    );

    return bufToStr(decryptedBuffer);
  } catch {
    return cipherText;
  }
};

// Tenta desencriptar usando a chave legada
export const decryptLegacy = async (cipherText: string, uid: string): Promise<string | null> => {
    try {
        if (!cipherText || !cipherText.includes(":")) return null;
        
        const legacyKey = await getLegacyKey(uid);
        if (!legacyKey) return null;

        const [ivB64, contentB64] = cipherText.split(":");
        const iv = base64ToBuf(ivB64);
        const content = base64ToBuf(contentB64);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            legacyKey,
            content
        );

        return bufToStr(decryptedBuffer);
    } catch {
        return null;
    }
};

export const getKeyFingerprint = async (uid: string): Promise<string> => {
    try {
        if (typeof window === 'undefined') return "Carregando...";
        
        const key = await getKey(uid);
        const exported = await window.crypto.subtle.exportKey("raw", key);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", exported);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return `key_${hashHex.substring(0, 8)}...${hashHex.substring(hashHex.length - 8)}_e2ee`;
    } catch (e) {
        console.error("Erro ao gerar fingerprint da chave:", e);
        return "Chave não inicializada, erro na geração do fingerprint.";
    }
}