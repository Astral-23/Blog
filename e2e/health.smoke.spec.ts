import { expect, test } from "@playwright/test";

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.service).toBe("blog");
  expect(typeof body.timestamp).toBe("string");
});
