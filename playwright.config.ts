import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const walletPath = process.env.ANCHOR_WALLET;
if (!walletPath)
  throw new Error("ANCHOR_WALLET is required. Run through `anchor test`.");

const testWallet = readFileSync(walletPath, "utf8").trim();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --mode e2e",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_E2E_WALLET: testWallet,
      VITE_RPC_URL: process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899",
    },
  },
});
