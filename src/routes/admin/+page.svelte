<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";
  import { packageStatuses } from "$lib/validation";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const nextActions: Record<string, Array<{ to: string; label: string; danger?: boolean; needsReason?: boolean }>> = {
    PENDING: [
      { to: "ACTIVE", label: "Approve" },
      { to: "REJECTED", label: "Reject", danger: true, needsReason: true },
    ],
    ACTIVE: [{ to: "INACTIVE", label: "Deactivate", danger: true }],
    INACTIVE: [{ to: "ACTIVE", label: "Reactivate" }],
    REJECTED: [{ to: "PENDING", label: "Reopen" }],
  };
</script>

<svelte:head><title>Package review</title></svelte:head>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">Package review</h1>
  <form method="post" action="/logout">
    <button type="submit" class="btn btn-sm btn-ghost">Sign out</button>
  </form>
</div>

<div role="tablist" class="tabs tabs-boxed mb-4">
  {#each packageStatuses as status (status)}
    <a
      role="tab"
      href="?status={status}"
      class="tab {data.selected === status ? 'tab-active' : ''}"
    >
      {status[0]}{status.slice(1).toLowerCase()}
      <span class="badge badge-sm ml-2">{data.counts[status] ?? 0}</span>
    </a>
  {/each}
</div>

{#if form?.error}
  <p class="alert alert-error py-2 text-sm mb-3" role="alert">{form.error}</p>
{:else if form?.success}
  <p class="alert alert-success py-2 text-sm mb-3" role="status">{form.message}</p>
{/if}

{#if data.packages.length === 0}
  <p class="text-base-content/70">No {data.selected.toLowerCase()} packages.</p>
{:else}
  <ul class="grid gap-3">
    {#each data.packages as pkg (pkg.id)}
      <li class="card bg-base-100 shadow-sm">
        <div class="card-body gap-2">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="card-title text-lg">{pkg.localName}</h2>
            <span class="badge badge-outline">{pkg.iso6393}</span>
          </div>
          <p class="text-sm text-base-content/70">
            {pkg.projectName}{pkg.regionName ? ` · ${pkg.regionName}` : ""}
          </p>
          {#if pkg.rejectionReason}
            <p class="text-xs text-error">Rejected: {pkg.rejectionReason}</p>
          {/if}
          <div class="card-actions mt-2 flex-wrap gap-2">
            {#each nextActions[data.selected] ?? [] as action (action.to)}
              <form method="post" action="?/moderate" use:enhance class="flex items-center gap-2">
                <input type="hidden" name="id" value={pkg.id} />
                <input type="hidden" name="status" value={action.to} />
                {#if action.needsReason}
                  <input
                    type="text"
                    name="reason"
                    required
                    maxlength="2000"
                    placeholder="Reason"
                    aria-label="Rejection reason"
                    class="input input-bordered input-sm"
                  />
                {/if}
                <button
                  type="submit"
                  class="btn btn-sm {action.danger ? 'btn-error' : 'btn-primary'}"
                >
                  {action.label}
                </button>
              </form>
            {/each}
          </div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
