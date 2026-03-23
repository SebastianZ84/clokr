<script lang="ts">
  import { goto } from "$app/navigation";
  import { authStore } from "$stores/auth";
  import { api } from "$api/client";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  async function handleLogin() {
    loading = true;
    error = "";
    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE" };
      }>("/auth/login", { email, password });

      authStore.login(res.accessToken, res.refreshToken, res.user);
      goto("/dashboard");
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Anmeldung fehlgeschlagen";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Salon Zeiterfassung</h1>
      <p class="text-gray-500 mt-1">Bitte melden Sie sich an</p>
    </div>

    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      {#if error}
        <div class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      {/if}

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="email">E-Mail</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="max@salon.de"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="password">Passwort</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  </div>
</div>
