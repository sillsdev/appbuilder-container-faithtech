<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function formatDate(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 10);
  }
</script>

<svelte:head><title>Administrators</title></svelte:head>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">Administrators</h1>
  <a href="/admin" class="btn btn-ghost btn-sm">← Review queue</a>
</div>

{#if form?.success}
  <p class="alert alert-success py-2 text-sm mb-4" role="status">{form.message}</p>
{:else if form?.error}
  <p class="alert alert-error py-2 text-sm mb-4" role="alert">{form.error}</p>
{/if}

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
  <!-- Existing administrators -->
  <section class="overflow-x-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Email</th><th>Name</th><th>Status</th><th>Created</th><th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.administrators as admin (admin.id)}
          <tr>
            <td class="font-medium">
              {admin.email}
              {#if admin.id === data.currentAdministratorId}
                <span class="badge badge-ghost badge-xs ml-1">you</span>
              {/if}
            </td>
            <td>{admin.displayName ?? "—"}</td>
            <td>
              {#if admin.disabled}
                <span class="badge badge-warning badge-sm">disabled</span>
              {:else}
                <span class="badge badge-success badge-sm">active</span>
              {/if}
            </td>
            <td class="opacity-70">{formatDate(admin.createdAt)}</td>
            <td>
              <div class="flex items-center justify-end gap-2">
                <!-- Reset password -->
                <form method="post" action="?/reset" use:enhance class="join">
                  <input type="hidden" name="id" value={admin.id} />
                  <input
                    type="password"
                    name="password"
                    placeholder="New password"
                    autocomplete="new-password"
                    class="input input-bordered input-xs join-item w-32"
                  />
                  <button class="btn btn-xs join-item">Reset</button>
                </form>
                <!-- Enable / disable -->
                <form method="post" action="?/toggle" use:enhance>
                  <input type="hidden" name="id" value={admin.id} />
                  <input type="hidden" name="disabled" value={admin.disabled ? "false" : "true"} />
                  <button
                    class="btn btn-xs {admin.disabled ? 'btn-success' : 'btn-warning'}"
                    disabled={admin.id === data.currentAdministratorId && !admin.disabled}
                    title={admin.id === data.currentAdministratorId && !admin.disabled
                      ? "You cannot disable your own account"
                      : undefined}
                  >
                    {admin.disabled ? "Enable" : "Disable"}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <!-- Add administrator -->
  <section class="card bg-base-100 shadow-sm h-fit">
    <div class="card-body gap-3">
      <h2 class="card-title text-base">Add administrator</h2>
      <form method="post" action="?/create" use:enhance class="flex flex-col gap-3">
        <label class="form-control">
          <span class="label-text">Email</span>
          <input type="email" name="email" autocomplete="off" required class="input input-bordered input-sm" />
        </label>
        <label class="form-control">
          <span class="label-text">Display name <span class="opacity-50">(optional)</span></span>
          <input type="text" name="displayName" class="input input-bordered input-sm" />
        </label>
        <label class="form-control">
          <span class="label-text">Password</span>
          <input type="password" name="password" autocomplete="new-password" required class="input input-bordered input-sm" />
          <span class="text-xs opacity-60">At least 8 characters.</span>
        </label>
        <button class="btn btn-primary btn-sm">Create</button>
      </form>
    </div>
  </section>
</div>
