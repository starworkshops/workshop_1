import { readFile, writeFile } from "node:fs/promises";

const path = "app/generated/js/package.json";
const packageJson = JSON.parse(await readFile(path, "utf8"));
packageJson.type = "module";
packageJson.main = "src/generated/index.ts";
await writeFile(path, `${JSON.stringify(packageJson, null, 2)}\n`);
