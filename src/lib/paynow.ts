import { appUrl } from "./app-url";
import { Paynow as PaynowClient } from "paynow";

export function getPaynow(returnUrl = `${appUrl()}/register`) {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID;
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY;
  if (!integrationId || !integrationKey) throw new Error("Paynow is not configured.");
  return new PaynowClient(integrationId, integrationKey, `${appUrl()}/api/paynow/result`, returnUrl);
}