import { expect, test } from "@playwright/test";

test("home renders latest posts embed", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "最新の記事" })).toBeVisible();
  await expect(page.locator(".post-list .post-card")).toHaveCount(1);
  await expect(page.locator(".post-card > a.post-card-link").first()).toHaveAttribute("href", "/blog/1");
});

test("blog list card is fully clickable and navigates", async ({ page }) => {
  await page.goto("/blog");

  const firstCardLink = page.locator(".post-card > a.post-card-link").first();
  await expect(firstCardLink).toBeVisible();
  await firstCardLink.click();

  await expect(page).toHaveURL(/\/blog\/1$/);
  await expect(page.getByRole("heading", { level: 1, name: "ついに" })).toBeVisible();
});
