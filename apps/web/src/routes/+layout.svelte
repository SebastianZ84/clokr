<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { authStore } from "$stores/auth";
  import { onMount } from "svelte";

  const publicRoutes = ["/login"];

  onMount(() => {
    if (!$authStore.accessToken && !publicRoutes.includes($page.url.pathname)) {
      goto("/login");
    }
  });
</script>

<slot />
