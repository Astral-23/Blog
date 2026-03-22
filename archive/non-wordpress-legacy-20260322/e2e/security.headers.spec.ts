import { expect, test } from "@playwright/test";

test("root response includes security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);

  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("media response includes type and nosniff", async ({ request }) => {
  const response = await request.get("/media/sample-grid.svg");
  expect(response.status()).toBe(200);

  const headers = response.headers();
  expect(headers["content-type"]).toContain("image/svg+xml");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
