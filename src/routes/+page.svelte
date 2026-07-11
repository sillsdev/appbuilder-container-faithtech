<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function megabytes(bytes: number): string {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
</script>

<svelte:head><title>Glocal Packages</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">Find a Scripture app package</h1>

<form method="get" class="join w-full mb-6">
  <input
    type="search"
    name="q"
    value={data.q}
    placeholder="Language, alternate name, ISO code, or region"
    aria-label="Search packages"
    class="input input-bordered join-item w-full"
  />
  <button type="submit" class="btn btn-primary join-item">Search</button>
</form>

{#if data.packages.length === 0}
  <p class="text-base-content/70">
    {data.q ? `No active packages match “${data.q}”.` : "No active packages yet."}
  </p>
{:else}
  <ul class="grid gap-3">
    {#each data.packages as pkg (pkg.id)}
      <li class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="card-title text-lg">{pkg.localName}</h2>
            <span class="badge badge-outline">{pkg.iso6393}</span>
          </div>
          {#if pkg.regionName}
            <p class="text-sm text-base-content/70">{pkg.regionName}</p>
          {/if}
          {#if pkg.listings[0]?.shortDescription}
            <p class="text-sm">{pkg.listings[0].shortDescription}</p>
          {/if}
          <div class="card-actions items-center justify-between mt-2">
            <span class="text-xs text-base-content/60">{megabytes(pkg.sizeBytes)}</span>
            <a
              href={pkg.publishUrl}
              class="btn btn-sm btn-primary"
              rel="external"
              download
            >
              Download
            </a>
          </div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
