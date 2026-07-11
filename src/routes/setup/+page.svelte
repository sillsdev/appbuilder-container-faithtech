<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<svelte:head><title>Set up first administrator</title></svelte:head>

<h1 class="text-2xl font-semibold mb-2">Welcome — create the first administrator</h1>
<p class="text-sm opacity-70 mb-4 max-w-sm">
  This one-time step creates the first administrator account. Once it exists,
  this page is closed and further administrators are managed from the console.
</p>

<form method="post" use:enhance class="card bg-base-100 shadow-sm max-w-sm">
  <div class="card-body gap-3">
    {#if $message}
      <p class="alert alert-error py-2 text-sm" role="alert">{$message}</p>
    {/if}

    <label class="form-control">
      <span class="label-text">Email</span>
      <input
        type="email"
        name="email"
        autocomplete="username"
        bind:value={$form.email}
        aria-invalid={$errors.email ? "true" : undefined}
        class="input input-bordered"
      />
      {#if $errors.email}<span class="text-error text-xs">{$errors.email}</span>{/if}
    </label>

    <label class="form-control">
      <span class="label-text">Display name <span class="opacity-50">(optional)</span></span>
      <input
        type="text"
        name="displayName"
        bind:value={$form.displayName}
        class="input input-bordered"
      />
      {#if $errors.displayName}<span class="text-error text-xs">{$errors.displayName}</span>{/if}
    </label>

    <label class="form-control">
      <span class="label-text">Password</span>
      <input
        type="password"
        name="password"
        autocomplete="new-password"
        bind:value={$form.password}
        aria-invalid={$errors.password ? "true" : undefined}
        class="input input-bordered"
      />
      {#if $errors.password}<span class="text-error text-xs">{$errors.password}</span>{/if}
      <span class="text-xs opacity-60">At least 8 characters.</span>
    </label>

    <button type="submit" class="btn btn-primary" disabled={$submitting}>
      {$submitting ? "Creating…" : "Create administrator"}
    </button>
  </div>
</form>
