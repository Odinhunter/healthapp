import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { Database } from '../types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048-byte limit per key.
// Supabase JWT sessions exceed this, so we chunk large values.
const CHUNK_SIZE = 2048;

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunks: string[] = [];
    let index = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${index}`);
      if (chunk === null) break;
      chunks.push(chunk);
      index++;
    }
    return chunks.length > 0 ? chunks.join('') : null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) ?? [];
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk))
    );
  },

  removeItem: async (key: string): Promise<void> => {
    let index = 0;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}.${index}`);
      if (existing === null) break;
      await SecureStore.deleteItemAsync(`${key}.${index}`);
      index++;
    }
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
