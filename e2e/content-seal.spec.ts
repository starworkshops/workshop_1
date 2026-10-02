import { expect, test } from "@playwright/test";

test("a visitor seals and verifies external content", async ({ page }) => {
  await page.goto("/");
  const previousVersion = Number(
    await page.getByTestId("proof-version").textContent(),
  );

  await page.getByLabel("Título").fill("Publicación E2E");
  await page
    .getByLabel("Descripción")
    .fill("Contenido completo guardado fuera de la cadena");
  await page.getByRole("button", { name: "Sellar contenido" }).click();

  await expect(page.getByTestId("status")).toContainText("Confirmado");
  await expect(page.getByTestId("proof-status")).toHaveText(
    "✓ Contenido verificado",
  );
  await expect(page.getByTestId("proof-version")).toHaveText(
    String(previousVersion + 1),
  );
  await expect(page.getByTestId("proof-hash")).not.toHaveText("—");

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("content-seal:"),
    );
    if (!key) throw new Error("No se encontró el contenido externo");
    const record = JSON.parse(localStorage.getItem(key)!) as {
      description: string;
    };
    record.description += " alterado";
    localStorage.setItem(key, JSON.stringify(record));
  });
  await page.reload();

  await expect(page.getByTestId("proof-status")).toHaveText(
    "✕ El contenido externo fue modificado",
  );
  await page.screenshot({ path: "../assets/demo-ui.png", fullPage: true });
});
