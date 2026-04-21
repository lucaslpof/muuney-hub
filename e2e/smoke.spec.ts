import { test, expect } from "@playwright/test";

/**
 * Muuney.hub E2E Smoke Test
 * ---------------------------------
 * Validates the critical path um beta tester percorre no dia-a-dia:
 *   1. Landing pública carrega (SEO tags presentes)
 *   2. Login via credenciais beta (E2E_USER_EMAIL + E2E_USER_PASSWORD)
 *   3. Dashboard renderiza Hero KPIs
 *   4. Navegação Macro → Crédito → Renda Fixa → Fundos → Ofertas funciona
 *   5. Logout limpa session
 *
 * Credenciais via env vars. Em CI, usar conta dedicada (NÃO usar Lucas admin).
 * Skip gracefully se credenciais ausentes (PR externo sem secrets).
 */

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

const hasAuthCreds = Boolean(EMAIL && PASSWORD);

test.describe("muuney.hub smoke", () => {
  test("landing pública renderiza e expõe SEO tags", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/muuney/i);
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /\.png$/);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /.+/);
  });

  test("login page renderiza formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });
});

test.describe("muuney.hub authenticated flow", () => {
  test.skip(!hasAuthCreds, "E2E_USER_EMAIL / E2E_USER_PASSWORD não configurados");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill(EMAIL!);
    await page.getByLabel(/senha/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  });

  test("Dashboard hero KPIs renderizam", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /dashboard/i }).first()).toBeVisible();
    // Hero KPIs: Selic + IPCA + Câmbio + Fundos monitorados (aguarda fetch)
    await expect(page.getByText(/Selic/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/IPCA/i).first()).toBeVisible();
  });

  test("navega Macro → Crédito → Renda Fixa → Fundos → Ofertas", async ({ page }) => {
    const routes = [
      { path: "/macro", heading: /Panorama Macroeconômico|Macro/i },
      { path: "/credito", heading: /Crédito/i },
      { path: "/renda-fixa", heading: /Renda Fixa/i },
      { path: "/fundos", heading: /Fundos/i },
      { path: "/ofertas", heading: /Ofertas Públicas/i },
    ];

    for (const r of routes) {
      await page.goto(r.path);
      await expect(page.getByRole("heading", { name: r.heading }).first()).toBeVisible({
        timeout: 20_000,
      });
      // Valida que não há erro fatal
      await expect(page.getByText(/Something went wrong|ErrorBoundary/i)).toHaveCount(0);
    }
  });

  test("logout encerra sessão e volta para landing/login", async ({ page }) => {
    const logoutBtn = page.getByRole("button", { name: /sair|logout/i }).first();
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/(login|$)/, { timeout: 10_000 });
    }
    // Pos-logout, acesso a /dashboard redireciona para login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
