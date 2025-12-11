import * as SecureStore from "expo-secure-store";

const PRIVATE_KEY_KEY = 'dejest_private_key';
const SEED_PHRASE_KEY = 'dejest_seed_phrase';

export const savePrivateKey = async (privateKey: string) => {
  await SecureStore.setItemAsync(PRIVATE_KEY_KEY, privateKey);
};

export const loadPrivateKey = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(PRIVATE_KEY_KEY);
};

export const deletePrivateKey = async () => {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_KEY);
};

export const saveSeedPhrase = async (seedPhrase: string[]) => {
  await SecureStore.setItemAsync(SEED_PHRASE_KEY, JSON.stringify(seedPhrase));
};

export const loadSeedPhrase = async (): Promise<string[] | null> => {
  const seed = await SecureStore.getItemAsync(SEED_PHRASE_KEY);
  if (!seed) return null;
  try {
    return JSON.parse(seed);
  } catch (error) {
    console.error('[secureStorage] Failed to parse seed phrase:', error);
    return null;
  }
};

export const deleteSeedPhrase = async () => {
  await SecureStore.deleteItemAsync(SEED_PHRASE_KEY);
};
