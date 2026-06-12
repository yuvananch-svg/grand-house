import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language, Session } from "../types";

interface AuthState {
  session: Session | null;
  language: Language;
  setSession: (session: Session | null) => void;
  setLanguage: (language: Language) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      language: "th",
      setSession: (session) => set({ session }),
      setLanguage: (language) => set({ language })
    }),
    {
      name: "grands-house-auth"
    }
  )
);
