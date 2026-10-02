# Sello verificable con Solana y Supabase

Ejemplo educativo de arquitectura híbrida. Supabase guarda un título, una descripción y una URL; el navegador calcula su SHA-256; Solana conserva solamente ese hash, la wallet autora y una versión en una PDA. Si el contenido externo cambia, la aplicación lo detecta.

## Stack verificado

- Anchor CLI y `anchor-lang` 1.2.0.
- Agave/Solana CLI 4.3.0 estable.
- Solana Kit 8.4.0 y Wallet Standard.
- Codama renderer 2.5.0.
- Supabase JS 2.117.2 con publishable key.
- Vite 8.3.2, TypeScript 7.0.2 y Playwright 1.63.0.
- Node.js 22.12 o superior.

## Qué demuestra

- Una PDA determinística por wallet guarda una huella SHA-256 de 32 bytes.
- Supabase conserva contenido grande, consultable y económico.
- El registro público lista los sellos y la wallet firmante aun sin conectar una wallet.
- Un único botón abre el selector de todas las wallets compatibles con Wallet Standard.
- La aplicación compara el hash externo con el estado on-chain.
- Una modificación en la base produce `El contenido externo fue modificado`.
- El E2E cubre creación, firma, confirmación, verificación y detección de alteraciones.

## Preparación local

```bash
npm install
npx playwright install chromium
mkdir -p .localnet
solana-keygen new --no-bip39-passphrase --silent -o .localnet/id.json
npm run setup
anchor test --validator legacy --skip-build
```

Sin variables de Supabase, la web usa `localStorage` como reemplazo local. Esto permite que integración y E2E sean reproducibles sin Internet. La arquitectura real usa Supabase.

## Crear el proyecto en Supabase

1. Creá un proyecto Free desde el dashboard.
2. Abrí **SQL Editor** y ejecutá `supabase/schema.sql`.
3. Abrí **Connect** y copiá Project URL y la **publishable key** `sb_publishable_…`.
4. Creá `.env.local` a partir de `.env.example`:

```dotenv
VITE_RPC_URL=https://api.devnet.solana.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

La publishable key puede estar en el navegador porque sólo habilita lo que permiten los grants y Row Level Security. Nunca uses una secret key o una `service_role` en Vite.

La política incluida permite escritura pública para simplificar la demostración. No garantiza disponibilidad: otra persona podría reemplazar el contenido externo, aunque no puede fabricar un contenido diferente que coincida con el hash firmado. Para producción, autenticá la wallet, verificá la firma en un backend o Edge Function, limitá frecuencia y restringí las políticas.

## Deploy a Devnet

```bash
solana config set --url devnet
solana config get
solana airdrop 2 ./.localnet/id.json --url devnet
solana balance ./.localnet/id.json --url devnet
solana address --keypair ./.localnet/id.json
anchor keys sync
anchor build --arch v3
anchor program deploy \
  --provider.cluster devnet \
  --provider.wallet ./.localnet/id.json \
  --use-rpc
npm run client:generate
npm run build:web
```

`anchor keys sync` adopta el Program ID de la keypair local. Regenerá el cliente después para que la web use esa dirección.

## Publicar la web en Vercel

1. Subí el repositorio a un repositorio personal de GitHub.
2. En Vercel elegí **Add New → Project** e importalo.
3. Seleccioná Vite o configurá `npm run build:web` y `dist`.
4. Agregá `VITE_RPC_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Publicá y probá la URL con una wallet de Devnet.

Vite incorpora las variables `VITE_*` en el bundle: no son secretos. Vercel Hobby está orientado a uso personal y no comercial dentro de sus límites; revisá condiciones y cuotas antes de publicar un producto.

## Cómo demostrar la verificación

1. Sellá un contenido desde la web y esperá `✓ Contenido verificado`.
2. En Supabase abrí **Table Editor → content_seals**.
3. Cambiá una letra de `description`, sin cambiar `content_hash`.
4. Recargá la web: aparece `✕ El contenido externo fue modificado`.
5. Volvé a sellar desde la web: la versión aumenta y ambos lados vuelven a coincidir.

## Mainnet y costo real

El deploy en Mainnet necesita SOL. Medí siempre el binario que realmente vas a desplegar:

```bash
wc -c < target/deploy/solana_content_seal.so
solana rent $(wc -c < target/deploy/solana_content_seal.so) --url mainnet-beta
```

`solana rent` estima el mínimo rent-exempt para esa cantidad de bytes. Reservá algo más para metadata, buffers y fees. Si una actualización necesita más espacio, el CLI cobra la diferencia. El RPC provisto no paga estas cantidades ni las fees de las transacciones.

Medición verificada el 2 de octubre de 2026: binario de **130.680 bytes** y mínimo rent-exempt orientativo de **0,66450464 SOL** consultado contra Mainnet.

## Seguridad

- Nunca publiques `.localnet/`, una seed phrase ni `target/deploy/*-keypair.json`.
- No uses una wallet con fondos reales para pruebas.
- Confirmá cluster, RPC y Program ID antes de desplegar.
- No guardes secret keys de Supabase en el frontend.
- El hash aporta integridad, no disponibilidad ni confidencialidad.
- Antes de Mainnet, revisá authorities, verificación reproducible, RLS, límites, monitoreo y respuesta a incidentes.

Referencias oficiales: [PDA](https://solana.com/docs/core/pda), [deploy de programas](https://solana.com/docs/programs/deploying), [Solana Kit](https://solana.com/docs/frontend/client), [API keys de Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel y Git](https://vercel.com/docs/git) y [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).
