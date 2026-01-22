import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import axios from "axios";
import { parse } from "cookie";

function verifyHmac(query: Record<string, any>, secret: string) {
  const { hmac, signature, ...rest } = query;

  const msg = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(",") : rest[k]}`)
    .join("&");

  const digest = crypto.createHmac("sha256", secret).update(msg).digest("hex");
  return digest === hmac;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const shop = process.env.SHOPIFY_SHOP!;
  const clientId = process.env.SHOPIFY_API_KEY!;
  const clientSecret = process.env.SHOPIFY_API_SECRET!;

  const { code, state } = req.query;

  const cookies = parse(req.headers.cookie || "");
  const stateCookie = cookies.shopify_oauth_state;

  if (!stateCookie || stateCookie !== state) {
    return res.status(400).send("State inválido. Reintenta /api/auth/start");
  }

  if (!verifyHmac(req.query as any, clientSecret)) {
    return res.status(400).send("HMAC inválido. Reintenta /api/auth/start");
  }

  if (!code) return res.status(400).send("No llegó code en callback.");

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const tokenResp = await axios.post(tokenUrl, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  const accessToken = tokenResp.data.access_token as string;

  // ✅ Copia este token y guárdalo en Vercel como env var SHOPIFY_ADMIN_TOKEN
  return res
    .status(200)
    .send(
      `✅ App instalada.\n\nCopia y guarda esto en Vercel (Environment Variables):\n\nSHOPIFY_ADMIN_TOKEN=${accessToken}\n\nLuego abre: /api/catalogo`
    );
}
