import { loadState, saveState } from "./logic";
import type { AppState } from "./types";

export interface GrandHouseRepository {
  load(): AppState;
  save(state: AppState): void;
}

export const localRepository: GrandHouseRepository = {
  load: loadState,
  save: saveState,
};

// SupabaseRepository จะ implement interface เดียวกันในรอบ backend จริง
// โดยต้องใช้ Auth/RLS และไม่ใช้ service role key ใน frontend
