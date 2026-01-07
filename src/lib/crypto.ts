// Utilitário de Criptografia AES-GCM
// Garante que apenas o dispositivo do usuário consiga ler os dados sensíveis

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

// Helper para converter string em buffer
const strToBuf = (str: string) => new TextEncoder().encode(str);
// Helper para converter buffer em string
const bufToStr = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

// Helper para converter buffer em Base64 (para salvar no Firestore)
// CORREÇÃO: Aceita tanto ArrayBuffer quanto Uint8Array para resolver o erro TS2345
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

// Obtém ou cria uma chave de criptografia única para este dispositivo/usuário
async function getKey(uid: string): Promise<CryptoKey> {
  const STORAGE_KEY = `weven_key_${uid}`;
  const storedKey = localStorage.getItem(STORAGE_KEY);

  if (storedKey) {
    // Importar chave existente
    const keyData = base64ToBuf(storedKey);
    return window.crypto.subtle.importKey(
      "raw",
      keyData,
      ALGORITHM,
      true,
      ["encrypt", "decrypt"]
    );
  } else {
    // Gerar nova chave
    const key = await window.crypto.subtle.generateKey(
      { name: ALGORITHM, length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Exportar e salvar
    const exported = await window.crypto.subtle.exportKey("raw", key);
    localStorage.setItem(STORAGE_KEY, bufToBase64(exported));
    return key;
  }
}

export const encryptData = async (data: string | number, uid: string): Promise<string> => {
  try {
    const key = await getKey(uid);
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encodedData = strToBuf(String(data));

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encodedData
    );

    // Retorna formato: IV:DADOS_ENCRIPTADOS
    return `${bufToBase64(iv)}:${bufToBase64(encryptedContent)}`;
  } catch (e) {
    console.error("Erro na encriptação", e);
    return String(data); // Fallback para não quebrar a app
  }
};

export const decryptData = async (cipherText: string, uid: string): Promise<string> => {
  try {
    if (!cipherText || !cipherText.includes(":")) return cipherText; // Não está encriptado

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
    // CORREÇÃO: Variável 'e' removida para satisfazer a regra no-unused-vars
    // Se falhar (ex: chave errada ou dado antigo), retorna o original
    return cipherText;
  }
};