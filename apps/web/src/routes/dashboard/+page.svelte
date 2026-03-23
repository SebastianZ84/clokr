<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$api/client";
  import { authStore } from "$stores/auth";
  import { format } from "date-fns";
  import { de } from "date-fns/locale";

  let clockedIn = false;
  let activeEntryId: string | null = null;
  let loading = false;
  let clockLoading = false;
  let breakMinutes = 0;
  let overtimeBalance = 0;
  let recentEntries: unknown[] = [];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const entries = await api.get<{ id: string; endTime: string | null; startTime: string }[]>(
        `/time-entries?from=${today}&to=${today}`
      );
      recentEntries = entries;

      const openEntry = entries.find((e) => !e.endTime);
      if (openEntry) {
        clockedIn = true;
        activeEntryId = openEntry.id;
      }

      if ($authStore.user?.role !== "ADMIN") {
        const employeeId = $authStore.user?.id;
        if (employeeId) {
          try {
            const account = await api.get<{ balanceHours: string }>(`/overtime/${employeeId}`);
            overtimeBalance = parseFloat(account.balanceHours);
          } catch {}
        }
      }
    } finally {
      loading = false;
    }
  }

  async function handleClock() {
    clockLoading = true;
    try {
      if (!clockedIn) {
        const res = await api.post<{ entry: { id: string } }>("/time-entries/clock-in", {
          source: "MOBILE",
        });
        activeEntryId = res.entry.id;
        clockedIn = true;
      } else if (activeEntryId) {
        await api.post(`/time-entries/${activeEntryId}/clock-out`, { breakMinutes });
        clockedIn = false;
        activeEntryId = null;
        breakMinutes = 0;
      }
      await loadData();
    } finally {
      clockLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white border-b px-6 py-4 flex justify-between items-center">
    <h1 class="text-xl font-bold text-gray-900">✂️ Salon Zeiterfassung</h1>
    <div class="text-sm text-gray-500">
      {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
    <!-- Stempeluhr -->
    <div class="bg-white rounded-2xl shadow-sm border p-6 text-center">
      <p class="text-sm text-gray-500 mb-2">
        {clockedIn ? "🟢 Eingestempelt" : "⚪ Ausgestempelt"}
      </p>
      <p class="text-4xl font-mono font-bold text-gray-900 mb-6">
        {format(new Date(), "HH:mm:ss")}
      </p>

      {#if clockedIn}
        <div class="mb-4">
          <label class="text-sm text-gray-600" for="break">Pause (Minuten)</label>
          <input
            id="break"
            type="number"
            bind:value={breakMinutes}
            min="0"
            class="ml-2 w-20 border rounded px-2 py-1 text-center"
          />
        </div>
      {/if}

      <button
        on:click={handleClock}
        disabled={clockLoading}
        class="px-8 py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50
          {clockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}"
      >
        {clockLoading ? "..." : clockedIn ? "Ausstempeln" : "Einstempeln"}
      </button>
    </div>

    <!-- Überstunden-Konto -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl border p-4">
        <p class="text-sm text-gray-500">Überstunden</p>
        <p class="text-2xl font-bold {overtimeBalance >= 60 ? 'text-red-600' : overtimeBalance >= 40 ? 'text-yellow-600' : 'text-green-600'}">
          {overtimeBalance >= 0 ? "+" : ""}{overtimeBalance.toFixed(1)}h
        </p>
      </div>
      <div class="bg-white rounded-xl border p-4">
        <p class="text-sm text-gray-500">Heute gearbeitet</p>
        <p class="text-2xl font-bold text-gray-900">
          {recentEntries.length > 0 ? "✓" : "-"}
        </p>
      </div>
      <div class="bg-white rounded-xl border p-4">
        <p class="text-sm text-gray-500">Woche</p>
        <p class="text-2xl font-bold text-gray-900">-</p>
      </div>
    </div>

    <!-- Navigation -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each [
        { href: "/time-entries", icon: "🕐", label: "Zeiteinträge" },
        { href: "/leave", icon: "🌴", label: "Urlaub" },
        { href: "/overtime", icon: "⏱️", label: "Überstunden" },
        { href: "/reports", icon: "📊", label: "Berichte" },
      ] as item}
        <a
          href={item.href}
          class="bg-white rounded-xl border p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div class="text-2xl mb-1">{item.icon}</div>
          <div class="text-sm font-medium text-gray-700">{item.label}</div>
        </a>
      {/each}
    </div>
  </main>
</div>
