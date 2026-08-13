import { expect, test } from "@playwright/test";

test("executes only the signed batch and follows up with its tool output", async ({
  page,
}) => {
  await page.goto("/");
  const composer = page.getByLabel("Message");
  await expect(composer).toBeEnabled();

  await composer.fill("Show me the portfolio.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Stage: /portfolio", { exact: false })).toBeVisible();
  await expect(page.getByText("navigate succeeded", { exact: false })).toBeVisible();
  await expect(page.getByText("The signed navigation completed.")).toBeVisible();
  await expect(page.locator("code", { hasText: "tool-navigate" })).toBeVisible();
});
