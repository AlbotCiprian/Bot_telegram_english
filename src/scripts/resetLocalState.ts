import { closeResetResources, wipeBotState } from "../services/resetService.js";

async function resetLocalState() {
  await wipeBotState();
  await closeResetResources();

  console.log("Bot state reset complete.");
}

resetLocalState().catch(async (error) => {
  console.error("Failed to reset local bot state.", error);
  await closeResetResources();
  process.exit(1);
});
