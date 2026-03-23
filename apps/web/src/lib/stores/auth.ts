import { writable } from "svelte/store";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    email: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  } | null;
}

function createAuthStore() {
  const initial: AuthState = {
    accessToken: typeof localStorage !== "undefined" ? localStorage.getItem("accessToken") : null,
    refreshToken: typeof localStorage !== "undefined" ? localStorage.getItem("refreshToken") : null,
    user: null,
  };

  const { subscribe, set, update } = writable<AuthState>(initial);

  return {
    subscribe,
    login(accessToken: string, refreshToken: string, user: AuthState["user"]) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      set({ accessToken, refreshToken, user });
    },
    setTokens(accessToken: string, refreshToken: string) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      update((s) => ({ ...s, accessToken, refreshToken }));
    },
    logout() {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = { subscribe: (run: (v: boolean) => void) => authStore.subscribe((s) => run(!!s.accessToken)) };
