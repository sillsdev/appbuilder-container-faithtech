<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<svelte:head><title>Administrator sign in</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">Administrator sign in</h1>

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
      <span class="label-text">Password</span>
      <input
        type="password"
        name="password"
        autocomplete="current-password"
        bind:value={$form.password}
        aria-invalid={$errors.password ? "true" : undefined}
        class="input input-bordered"
      />
      {#if $errors.password}<span class="text-error text-xs">{$errors.password}</span>{/if}
    </label>

    <button type="submit" class="btn btn-primary" disabled={$submitting}>
      {$submitting ? "Signing in…" : "Sign in"}
    </button>
  </div>
</form>
