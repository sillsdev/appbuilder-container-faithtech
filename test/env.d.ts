export {};

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      SCRIPTORIA_API_KEY: string;
      SESSION_SECRET: string;
      TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
    }
  }
}
