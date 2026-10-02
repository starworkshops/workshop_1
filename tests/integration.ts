import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createClient,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signerFromFile } from "@solana/kit-plugin-signer";
import {
  fetchContentSeal,
  getInitializeSealInstructionAsync,
  getUpdateSealInstructionAsync,
  SOLANA_CONTENT_SEAL_PROGRAM_ADDRESS,
} from "../app/generated/js/src/generated/index";

const walletPath = process.env.ANCHOR_WALLET;
if (!walletPath)
  throw new Error("ANCHOR_WALLET es obligatorio; ejecutá con anchor test.");

const rpcUrl = (process.env.ANCHOR_PROVIDER_URL ??
  "http://127.0.0.1:8899") as `http${string}`;
const client = await createClient()
  .use(signerFromFile(walletPath))
  .use(solanaRpc({ rpcUrl }));

function contentHash(value: string) {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

const [sealAddress] = await getProgramDerivedAddress({
  programAddress: SOLANA_CONTENT_SEAL_PROGRAM_ADDRESS,
  seeds: [
    getBytesEncoder().encode(new TextEncoder().encode("seal")),
    getAddressEncoder().encode(client.identity.address),
  ],
});

const firstHash = contentHash("contenido inicial");
await client.sendTransaction([
  await getInitializeSealInstructionAsync({
    author: client.identity,
    contentHash: Array.from(firstHash),
  }),
]);
let seal = await fetchContentSeal(client.rpc, sealAddress);
assert.deepEqual(Array.from(seal.data.contentHash), Array.from(firstHash));
assert.equal(seal.data.version, 1n);
assert.equal(seal.data.author, client.identity.address);
console.log("✓ crea una PDA determinística por autora");

const secondHash = contentHash("contenido actualizado");
await client.sendTransaction([
  await getUpdateSealInstructionAsync({
    author: client.identity,
    contentHash: Array.from(secondHash),
  }),
]);
seal = await fetchContentSeal(client.rpc, sealAddress);
assert.deepEqual(Array.from(seal.data.contentHash), Array.from(secondHash));
assert.equal(seal.data.version, 2n);
console.log("✓ actualiza el hash y aumenta la versión");

assert.equal(seal.data.contentHash.length, 32);
console.log("✓ conserva sólo una huella SHA-256 de 32 bytes on-chain");
