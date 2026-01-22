import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

function getBaseUrl() {
  const url = process.env.APP_URL || "";
  return url.replace(/\/$/, "");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const shop = process.env.SHOPIFY_SHOP!;
  const clientId = process.env.SHOPIFY_API_KEY!;
  const scopes = process.env.SHOPIFY_SCOPES || "read_products,read_product_metafields";

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${getBaseUrl()}/api/auth/callback`;

  res.setHeader(
    "Set-Cookie",
    `shopify_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure`
  );

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(302, installUrl);
}
