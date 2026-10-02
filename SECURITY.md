# Alcance de seguridad

Este repositorio acompaña una demo educativa para Localnet y Devnet. Fue verificado el 2 de octubre de 2026 con Anchor 1.2.0, Agave 4.3.0, Solana Kit 8.4.0, Supabase JS 2.117.2, Node.js 22 y Playwright 1.63.0.

La migración eliminó el cliente legado de Anchor/Web3.js del frontend. `npm audit` reportó cero vulnerabilidades conocidas en el árbol instalado al momento de la entrega. Eso no convierte al ejemplo en un producto listo para Mainnet.

Antes de producción:

1. Volvé a ejecutar build, integración, E2E y auditoría desde un clon limpio.
2. Revisá signer y writable accounts, seeds de PDA, límites de datos, arithmetic checks y errores.
3. Protegé el upgrade authority con el esquema operativo apropiado; no lo dejes en una laptop personal.
4. Usá RPC de producción, observabilidad, alertas y un plan de recuperación.
5. Verificá que el binario desplegado corresponda al código fuente y documentá el Program ID.
6. Separá por completo claves y configuración de Localnet, Devnet y Mainnet.
7. Reemplazá las políticas públicas de la demo por autenticación, verificación de firma y límites de escritura.

El hash demuestra integridad: permite detectar que el contenido externo cambió. No impide que alguien borre o reemplace la copia externa, no cifra el contenido y no demuestra por sí solo cuándo fue publicado fuera de la cadena.

La clave inyectada por Playwright se crea sólo para Localnet. No copies ese patrón para custodiar fondos reales en un navegador.

Referencias:

- https://solana.com/docs/tools/production-readiness
- https://solana.com/docs/programs/deploying
- https://www.anchor-lang.com/docs
