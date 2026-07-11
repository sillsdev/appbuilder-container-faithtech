<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<div class="min-h-screen bg-base-200 text-base-content">
  <header class="navbar bg-base-100 shadow-sm px-4">
    <a href="/" class="btn btn-ghost text-lg font-semibold">Glocal Packages</a>
    <div class="flex-1"></div>
    <a href="/admin" class="btn btn-sm btn-outline">Admin</a>
  </header>
  <main class="mx-auto max-w-3xl p-4">
    {@render children()}
  </main>
</div>
