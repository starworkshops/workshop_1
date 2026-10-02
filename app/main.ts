import {
  address,
  createClient,
  createKeyPairSignerFromBytes,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  type Address,
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
  listContent,
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
const walletDialog =
  document.querySelector<HTMLDialogElement>("#wallet-dialog")!;
const walletList = document.querySelector<HTMLElement>(
  "[data-testid=wallet-list]",
)!;
const walletClose = document.querySelector<HTMLButtonElement>(
  "[data-wallet-close]",
)!;
const sealList = document.querySelector<HTMLElement>(
  "[data-testid=seal-list]",
)!;
const sealCount = document.querySelector<HTMLElement>(
  "[data-testid=seal-count]",
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

type RpcClient = Pick<DemoClient, "rpc">;

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

async function getSealAddress(author: Address) {
  const [address] = await getProgramDerivedAddress({
    programAddress: SOLANA_CONTENT_SEAL_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("seal")),
      getAddressEncoder().encode(author),
    ],
  });
  return address;
}

async function refresh(client: DemoClient, author: TransactionSigner) {
  const sealAddress = await getSealAddress(author.address);
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

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function safeSourceUrl(value: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

async function renderSealCard(client: RpcClient, record: ContentRecord) {
  const card = document.createElement("article");
  card.className = "seal-card";

  let state: "verified" | "invalid" | "warning" = "warning";
  let verification = "No se encontró el sello on-chain";
  let version = "—";

  try {
    const author = address(record.author);
    const sealAddress = await getSealAddress(author);
    const seal = await fetchMaybeContentSeal(client.rpc, sealAddress);
    if (seal.exists) {
      version = seal.data.version.toString();
      const calculatedHash = toHex(
        await sha256(
          canonicalContent({
            title: record.title,
            description: record.description,
            sourceUrl: record.source_url,
          }),
        ),
      );
      const matches =
        seal.data.author === author &&
        toHex(seal.data.contentHash) === calculatedHash;
      state = matches ? "verified" : "invalid";
      verification = matches
        ? "Verificado on-chain"
        : "El contenido no coincide";
    }
  } catch {
    verification = "No se pudo verificar";
  }

  const top = document.createElement("div");
  top.className = "seal-card-top";
  const heading = document.createElement("h3");
  heading.textContent = record.title;
  const badge = document.createElement("span");
  badge.className = "verification-badge";
  badge.dataset.state = state;
  badge.textContent = verification;
  top.append(heading, badge);

  const description = document.createElement("p");
  description.className = "seal-description";
  description.textContent = record.description;

  const source = safeSourceUrl(record.source_url);
  const sourceLink = document.createElement("a");
  sourceLink.className = "source-link";
  sourceLink.textContent = source ? "Abrir contenido ↗" : "Sin URL asociada";
  if (source) {
    sourceLink.href = source;
    sourceLink.target = "_blank";
    sourceLink.rel = "noreferrer";
  } else {
    sourceLink.removeAttribute("href");
  }

  const metadata = document.createElement("div");
  metadata.className = "seal-metadata";
  const wallet = document.createElement("div");
  const walletLabel = document.createElement("span");
  walletLabel.textContent = "Wallet firmante";
  const walletValue = document.createElement("code");
  walletValue.textContent = shortAddress(record.author);
  walletValue.title = record.author;
  wallet.append(walletLabel, walletValue);

  const versionBlock = document.createElement("div");
  const versionLabel = document.createElement("span");
  versionLabel.textContent = "Versión";
  const versionValue = document.createElement("strong");
  versionValue.textContent = version;
  versionBlock.append(versionLabel, versionValue);
  metadata.append(wallet, versionBlock);

  card.append(top, description, sourceLink, metadata);
  return card;
}

async function refreshSealList(client: RpcClient) {
  sealList.innerHTML = '<p class="empty-list">Actualizando sellos…</p>';
  try {
    const records = await listContent();
    sealCount.textContent = `${records.length} ${records.length === 1 ? "sello" : "sellos"}`;
    if (!records.length) {
      sealList.innerHTML =
        '<p class="empty-list">Todavía no hay sellos públicos. El primero puede ser el tuyo.</p>';
      return;
    }
    const cards = await Promise.all(
      records.map((record) => renderSealCard(client, record)),
    );
    sealList.replaceChildren(...cards);
  } catch (error) {
    sealCount.textContent = "No disponible";
    sealList.innerHTML = "";
    const message = document.createElement("p");
    message.className = "empty-list error-copy";
    message.textContent = `No se pudo cargar el registro público: ${error instanceof Error ? error.message : String(error)}`;
    sealList.append(message);
  }
}

async function activate(client: DemoClient, author: TransactionSigner) {
  submit.disabled = false;
  await refresh(client, author);
  status.textContent = `Conectado a ${chain === "solana:localnet" ? "Localnet" : "Devnet"}`;

  form.onsubmit = async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const values = {
        title: title.value,
        description: description.value,
        sourceUrl: sourceUrl.value,
      };
      const contentHash = await sha256(canonicalContent(values));
      const sealAddress = await getSealAddress(author.address);
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
        updated_at: new Date().toISOString(),
      };
      await saveContent(record);
      await refresh(client, author);
      await refreshSealList(client);
      status.textContent = `Confirmado · ${result.context.signature.slice(0, 12)}…`;
    } catch (error) {
      status.textContent = `Error · ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      submit.disabled = false;
    }
  };
}

function resetConnectedView() {
  submit.disabled = true;
  proofStatus.textContent = "Conectá una wallet para ver tu sello";
  proofStatus.dataset.state = "empty";
  proofHash.textContent = "—";
  proofVersion.textContent = "0";
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
    await refreshSealList(client);
    await activate(client, author);
    return;
  }

  const client = createClient()
    .use(walletSigner({ chain, storage: localStorage }))
    .use(solanaRpc({ rpcUrl }));
  await client.wallet.whenReady();
  await refreshSealList(client as unknown as RpcClient);

  let activatedAddress: string | undefined;
  const renderWalletOptions = () => {
    const state = client.wallet.getState();
    walletList.replaceChildren();

    if (!state.wallets.length) {
      const empty = document.createElement("p");
      empty.className = "wallet-empty";
      empty.textContent =
        "No encontramos una wallet compatible. Instalá una wallet que implemente Wallet Standard y recargá la página.";
      walletList.append(empty);
      return;
    }

    for (const candidate of state.wallets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wallet-option";
      button.disabled = state.status === "connecting";

      const icon = document.createElement("img");
      icon.src = candidate.icon;
      icon.alt = "";
      icon.width = 38;
      icon.height = 38;

      const name = document.createElement("span");
      name.textContent = candidate.name;
      const active = state.connected?.wallet.name === candidate.name;
      const detail = document.createElement("small");
      detail.textContent = active ? "Conectada" : "Conectar";
      button.append(icon, name, detail);
      button.addEventListener("click", () => {
        status.textContent = `Conectando ${candidate.name}…`;
        void client.wallet
          .connect(candidate)
          .then(() => walletDialog.close())
          .catch(showFatal);
      });
      walletList.append(button);
    }

    if (state.connected) {
      const disconnect = document.createElement("button");
      disconnect.type = "button";
      disconnect.className = "disconnect-button";
      disconnect.textContent = "Desconectar wallet";
      disconnect.addEventListener("click", () => {
        void client.wallet
          .disconnect()
          .then(() => walletDialog.close())
          .catch(showFatal);
      });
      walletList.append(disconnect);
    }
  };

  const renderWallets = () => {
    const state = client.wallet.getState();
    walletControls.replaceChildren();
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "wallet-trigger";
    trigger.disabled =
      state.status === "pending" || state.status === "reconnecting";
    trigger.textContent = state.connected
      ? `${state.connected.wallet.name} · ${shortAddress(state.connected.account.address)}`
      : state.status === "reconnecting"
        ? "Reconectando wallet…"
        : "Conectar wallet";
    trigger.addEventListener("click", () => {
      renderWalletOptions();
      walletDialog.showModal();
    });
    walletControls.append(trigger);

    if (state.connected?.signer) {
      if (activatedAddress !== state.connected.account.address) {
        activatedAddress = state.connected.account.address;
        void activate(
          client as unknown as DemoClient,
          state.connected.signer,
        ).catch(showFatal);
      }
      renderWalletOptions();
      return;
    }

    activatedAddress = undefined;
    resetConnectedView();
    status.textContent = state.wallets.length
      ? "Conectá una wallet para crear o actualizar tu sello"
      : "No se detectaron wallets compatibles";
    renderWalletOptions();
  };

  walletClose.addEventListener("click", () => walletDialog.close());
  walletDialog.addEventListener("click", (event) => {
    if (event.target === walletDialog) walletDialog.close();
  });
  client.wallet.subscribe(renderWallets);
  renderWallets();
}

function showFatal(error: unknown) {
  status.textContent = `Error · ${error instanceof Error ? error.message : String(error)}`;
}

start().catch(showFatal);
