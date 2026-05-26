import { test, expect } from "../../fixtures/authenticated";
import { AvatarPage } from "../../pages/avatar.page";

const PERSONAS = ["Selam", "Dawit", "Henok", "Saba", "Yonas"];

test.describe("avatar · picker", () => {
  test("renders the five personas with names + intros", async ({ authedPage }) => {
    const avatar = new AvatarPage(authedPage);
    await avatar.goto();

    await expect(avatar.title).toBeVisible();

    for (const name of PERSONAS) {
      await expect(authedPage.getByRole("heading", { level: 2, name })).toBeVisible();
      // Each card surfaces a play-preview button labelled with the name.
      await expect(avatar.playPreview(name)).toBeVisible();
    }
  });

  test("selecting a persona routes into the viewer shell", async ({ authedPage }) => {
    const avatar = new AvatarPage(authedPage);
    await avatar.goto();

    await avatar.personaCard("Selam").click();

    // The viewer mounts asynchronously (dynamic import + GLB fetch). The
    // "Choose another" button is the cheapest signal that we successfully
    // routed into the viewer shell; we deliberately don't wait for the
    // avatar to finish rendering.
    await expect(avatar.chooseAnotherButton).toBeVisible({ timeout: 15_000 });
  });

  test("'Choose another' from the viewer returns to the picker", async ({ authedPage }) => {
    const avatar = new AvatarPage(authedPage);
    await avatar.goto();

    await avatar.personaCard("Dawit").click();
    await expect(avatar.chooseAnotherButton).toBeVisible({ timeout: 15_000 });

    await avatar.chooseAnotherButton.click();
    await expect(avatar.title).toBeVisible();
    await expect(authedPage.getByRole("heading", { level: 2, name: "Selam" })).toBeVisible();
  });
});
