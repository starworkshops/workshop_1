import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const walletPath = process.env.ANCHOR_WALLET;
if (!walletPath)
  throw new Error("ANCHOR_WALLET is required. Run through `anchor test`.");

const testWallet = readFileSync(walletPath, "utf8").trim();
const port = Number(process.env.E2E_PORT ?? "4173");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --mode e2e --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.E2E_PORT,
    env: {
      ...process.env,
      VITE_E2E_WALLET: testWallet,
      VITE_RPC_URL: process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899",
    },
  },
});
