import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const generateUrl = process.env.CATALOGO_GENERATE_URL!;
  const token = process.env.CATALOGO_BEARER_TOKEN!;

  if (!generateUrl || !token) {
    return res.status(500).json({ error: "Faltan env vars: CATALOGO_GENERATE_URL / CATALOGO_BEARER_TOKEN" });
  }

  try {
    const r = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(500).json({ error: data?.error || "Error generando catálogo" });

    return res.status(200).json({ downloadUrl: data.downloadUrl });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error" });
  }
}
