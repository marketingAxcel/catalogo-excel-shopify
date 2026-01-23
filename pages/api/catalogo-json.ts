import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const IVA = 0.19;

async function shopifyGraphQL(query: string, variables: any) {
  const shop = process.env.SHOPIFY_SHOP!;
  const token = process.env.SHOPIFY_ADMIN_TOKEN!;
  const version = process.env.SHOPIFY_API_VERSION || "2026-01";
  const url = `https://${shop}/admin/api/${version}/graphql.json`;

  const resp = await axios.post(url, { query, variables }, { headers: { "X-Shopify-Access-Token": token } });
  if (resp.data.errors) throw new Error(JSON.stringify(resp.data.errors));
  return resp.data.data;
}

function normalize(s: any) {
  return String(s ?? "").trim();
}

function safeNumber(x: any) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function applyDiscount(priceIva: number, pct: number) {
  return round2(priceIva * (1 - pct));
}

function parseCategoryMap(): Record<string, string[]> {
  const raw = process.env.CATEGORY_MAP_JSON || "{}";
  try {
    const obj = JSON.parse(raw);
    const out: Record<string, string[]> = {};
    for (const k of Object.keys(obj || {})) {
      out[normalize(k).toUpperCase()] = (obj[k] || []).map((x: any) => normalize(x).toUpperCase()).filter(Boolean);
    }
    return out;
  } catch {
    return {};
  }
}

function pickCategoryFromCollections(collectionTitles: string[], map: Record<string, string[]>) {
  const set = new Set(collectionTitles.map((t) => normalize(t).toUpperCase()).filter(Boolean));
  for (const cat of Object.keys(map)) {
    const needles = map[cat] || [];
    const hit = needles.some((n) => set.has(normalize(n).toUpperCase()));
    if (hit) return cat;
  }
  return "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });

  const limit = Math.min(Math.max(Number(req.query.limit || 300), 1), 2000);
  const categoryMap = parseCategoryMap();

  const query = `
    query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          featuredImage { url }
          apps: metafield(namespace: "custom", key: "modelos_de_aplicacion") { value }
          collections(first: 50) { nodes { title } }
          variants(first: 100) {
            nodes {
              sku
              price
              inventoryQuantity
            }
          }
        }
      }
    }
  `;

  const groupsMap = new Map<string, any>();
  let cursor: string | null = null;

  while (true) {
    const data = await shopifyGraphQL(query, { cursor });
    const page = data.products;

    for (const p of page.nodes) {
      const collectionTitles: string[] = (p.collections?.nodes || [])
        .map((c: any) => normalize(c.title))
        .filter(Boolean);

      const categoria = pickCategoryFromCollections(collectionTitles, categoryMap);
      if (!categoria) continue;

      const grabado = normalize(p.title);
      const key = `${categoria}||${grabado}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          categoria,
          grabado,
          imagen: normalize(p.featuredImage?.url || ""),
          aplicaciones: normalize(p.apps?.value || ""),
          items: [] as any[],
        });
      }

      const g = groupsMap.get(key);
      if (!g.imagen && p.featuredImage?.url) g.imagen = normalize(p.featuredImage.url);

      for (const v of p.variants?.nodes || []) {
        const sku = normalize(v.sku);
        if (!sku) continue;

        const precioIva = safeNumber(v.price);
        const precioSin = precioIva ? round2(precioIva / (1 + IVA)) : 0;

        const inventario = Number.isFinite(Number(v.inventoryQuantity)) ? Number(v.inventoryQuantity) : 0;

        g.items.push({
          sku,
          inventario,
          precioCatalogoSinIva: precioSin,
          precioCatalogoConIva: precioIva,
          precio35: applyDiscount(precioIva, 0.35),
          precio30: applyDiscount(precioIva, 0.30),
          precio25: applyDiscount(precioIva, 0.25),
          precio20: applyDiscount(precioIva, 0.20),
        });
      }
    }

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;

    const currentCount = Array.from(groupsMap.values()).reduce((acc, g) => acc + (g.items?.length || 0), 0);
    if (currentCount >= limit) break;
  }

  const groups = Array.from(groupsMap.values()).map((g) => {
    const uniq = new Map<string, any>();
    for (const it of g.items || []) uniq.set(it.sku, it);
    g.items = Array.from(uniq.values()).sort((a, b) => a.sku.localeCompare(b.sku));
    return g;
  });

  groups.sort((a, b) => (a.categoria + "||" + a.grabado).localeCompare(b.categoria + "||" + b.grabado));

  res.status(200).json({ ok: true, count: groups.length, groups });
}
