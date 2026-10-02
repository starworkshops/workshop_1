import {
  createClient,
  createKeyPairSignerFromBytes,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  type TransactionSigner,
} from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { walletSigner } from "@solana/kit-plugin-wallet";
import {
  fetchMaybeContentSeal,
  getInitializeSealInstructionAsync,
  getUpdateSealInstructionAsync,
  SOLANA_CONTENT_SEAL_PROGRAM_ADDRESS,
} from "./generated/js/src/generated/index";
import {
  contentStoreLabel,
  loadContent,
  saveContent,
  type ContentRecord,
} from "./content-store";
import "./style.css";

const rpcUrl = (import.meta.env.VITE_RPC_URL ??
  "https://api.devnet.solana.com") as `http${string}`;
const chain = rpcUrl.includes("127.0.0.1")
  ? "solana:localnet"
  : "solana:devnet";

const status = document.querySelector<HTMLElement>("[data-testid=status]")!;
const proofStatus = document.querySelector<HTMLElement>(
  "[data-testid=proof-status]",
)!;
const proofHash = document.querySelector<HTMLElement>(
  "[data-testid=proof-hash]",
)!;
const proofVersion = document.querySelector<HTMLElement>(
  "[data-testid=proof-version]",
)!;
const storeLabel = document.querySelector<HTMLElement>("[data-testid=store]")!;
const walletControls = document.querySelector<HTMLElement>(
  "[data-testid=wallet-controls]",
)!;
const form = document.querySelector<HTMLFormElement>("#seal-form")!;
const title = document.querySelector<HTMLInputElement>("#title")!;
const description =
  document.querySelector<HTMLTextAreaElement>("#description")!;
const sourceUrl = document.querySelector<HTMLInputElement>("#source-url")!;
const submit = form.querySelector<HTMLButtonElement>("button")!;

storeLabel.textContent = contentStoreLabel;

type DemoClient = ReturnType<typeof createClient> & {
  rpc: Parameters<typeof fetchMaybeContentSeal>[0];
  sendTransaction: (instructions: readonly unknown[]) => Promise<{
    context: { signature: string };
  }>;
};

function canonicalContent(values: {
  title: string;
  description: string;
  sourceUrl: string;
}) {
  return JSON.stringify({
    title: values.title.trim(),
    description: values.description.trim(),
    sourceUrl: values.sourceUrl.trim(),
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

function toHex(bytes: Uint8Array | readonly number[]) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function getSealAddress(author: TransactionSigner) {
  const [address] = await getProgramDerivedAddress({
    programAddress: SOLANA_CONTENT_SEAL_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("seal")),
      getAddressEncoder().encode(author.address),
    ],
  });
  return address;
}

async function refresh(client: DemoClient, author: TransactionSigner) {
  const sealAddress = await getSealAddress(author);
  const seal = await fetchMaybeContentSeal(client.rpc, sealAddress);
  const content = await loadContent(author.address);

  if (content) {
    title.value = content.title;
    description.value = content.description;
    sourceUrl.value = content.source_url;
  }

  if (!seal.exists) {
    proofStatus.textContent = "Todavía no existe un sello on-chain";
    proofStatus.dataset.state = "empty";
    proofHash.textContent = "—";
    proofVersion.textContent = "0";
    return seal;
  }

  const onChainHex = toHex(seal.data.contentHash);
  proofHash.textContent = `${onChainHex.slice(0, 12)}…${onChainHex.slice(-8)}`;
  proofVersion.textContent = seal.data.version.toString();

  if (!content) {
    proofStatus.textContent = "Sello válido; contenido externo no disponible";
    proofStatus.dataset.state = "warning";
    return seal;
  }

  const storedHash = toHex(
    await sha256(
      canonicalContent({
        title: content.title,
        description: content.description,
        sourceUrl: content.source_url,
      }),
    ),
  );
  const verified = storedHash === onChainHex;
  proofStatus.textContent = verified
    ? "✓ Contenido verificado"
    : "✕ El contenido externo fue modificado";
  proofStatus.dataset.state = verified ? "verified" : "invalid";
  return seal;
}

async function activate(client: DemoClient, author: TransactionSigner) {
  submit.disabled = false;
  await refresh(client, author);
  status.textContent = `Conectado a ${chain === "solana:localnet" ? "Localnet" : "Devnet"}`;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const values = {
        title: title.value,
        description: description.value,
        sourceUrl: sourceUrl.value,
      };
      const contentHash = await sha256(canonicalContent(values));
      const sealAddress = await getSealAddress(author);
      const existing = await fetchMaybeContentSeal(client.rpc, sealAddress);
      status.textContent = "Esperando firma y confirmación…";
      const instruction = existing.exists
        ? await getUpdateSealInstructionAsync({
            author,
            contentHash: Array.from(contentHash),
          })
        : await getInitializeSealInstructionAsync({
            author,
            contentHash: Array.from(contentHash),
          });
      const result = await client.sendTransaction([instruction]);

      const record: ContentRecord = {
        author: author.address,
        title: values.title.trim(),
        description: values.description.trim(),
        source_url: values.sourceUrl.trim(),
        content_hash: toHex(contentHash),
      };
      await saveContent(record);
      await refresh(client, author);
      status.textContent = `Confirmado · ${result.context.signature.slice(0, 12)}…`;
    } catch (error) {
      status.textContent = `Error · ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      submit.disabled = false;
    }
  });
}

async function start() {
  submit.disabled = true;
  const rawTestWallet = import.meta.env.VITE_E2E_WALLET;

  if (rawTestWallet) {
    const author = await createKeyPairSignerFromBytes(
      Uint8Array.from(JSON.parse(rawTestWallet) as number[]),
    );
    const client = createClient()
      .use(signer(author))
      .use(solanaRpc({ rpcUrl })) as unknown as DemoClient;
    walletControls.innerHTML = `<span>E2E local · <code>${author.address.slice(0, 8)}…</code></span>`;
    await activate(client, author);
    return;
  }

  const client = createClient()
    .use(walletSigner({ chain, storage: localStorage }))
    .use(solanaRpc({ rpcUrl }));
  await client.wallet.whenReady();

  let activatedAddress: string | undefined;
  const renderWallets = () => {
    const state = client.wallet.getState();
    walletControls.replaceChildren();
    if (state.connected?.signer) {
      const label = document.createElement("span");
      label.innerHTML = `Wallet conectada · <code>${state.connected.account.address.slice(0, 8)}…</code>`;
      walletControls.append(label);
      if (activatedAddress !== state.connected.account.address) {
        activatedAddress = state.connected.account.address;
        void activate(
          client as unknown as DemoClient,
          state.connected.signer,
        ).catch(showFatal);
      }
      return;
    }
    if (!state.wallets.length) {
      walletControls.textContent =
        "Instalá una wallet compatible con Wallet Standard o ejecutá el E2E local.";
      status.textContent = "Esperando una wallet";
      return;
    }
    for (const candidate of state.wallets) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Conectar ${candidate.name}`;
      button.addEventListener("click", () => {
        status.textContent = `Conectando ${candidate.name}…`;
        void client.wallet.connect(candidate).catch(showFatal);
      });
      walletControls.append(button);
    }
  };

  client.wallet.subscribe(renderWallets);
  renderWallets();
}

function showFatal(error: unknown) {
  status.textContent = `Error · ${error instanceof Error ? error.message : String(error)}`;
}

start().catch(showFatal);
