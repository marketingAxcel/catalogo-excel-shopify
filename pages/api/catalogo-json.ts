import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const IVA = 0.19;

function normalize(s: any): string {
  return String(s ?? "").trim();
}
function keyNorm(s: any): string {
  return normalize(s).toUpperCase();
}

type CategoryMap = Record<string, string[]>;

function readCategoryMap(): { order: string[]; mapNorm: Record<string, Set<string>> } {
  const raw = process.env.CATEGORY_MAP_JSON || "{}";
  let parsed: CategoryMap;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("CATEGORY_MAP_JSON inválido. Revisa comas, comillas y llaves.");
  }

  const order = Object.keys(parsed).map((k) => normalize(k)); // mantiene el orden del JSON
  const mapNorm: Record<string, Set<string>> = {};

  for (const cat of order) {
    const list = parsed[cat] || parsed[keyNorm(cat)] || [];
    mapNorm[cat] = new Set(list.map((x) => keyNorm(x)));
  }

  return { order, mapNorm };
}

function resolveCategoryAndTread(collectionTitles: string[], order: string[], mapNorm: Record<string, Set<string>>) {
  const colsNorm = collectionTitles.map((t) => ({ raw: normalize(t), norm: keyNorm(t) }));

  for (const cat of order) {
    const allowed = mapNorm[cat];
    for (const c of colsNorm) {
      if (allowed.has(c.norm)) {
        return { categoria: cat, grabado: c.raw };
      }
    }
  }
  return null;
}

async function shopifyGraphQL(query: string, variables: any) {
  const shop = process.env.SHOPIFY_SHOP!;
  const token = process.env.SHOPIFY_ADMIN_TOKEN!;
  const version = process.env.SHOPIFY_API_VERSION || "2026-01";
  const url = `https://${shop}/admin/api/${version}/graphql.json`;

  const resp = await axios.post(url, { query, variables }, { headers: { "X-Shopify-Access-Token": token } });
  if (resp.data.errors) throw new Error(JSON.stringify(resp.data.errors));
  return resp.data.data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });

  const limit = Math.min(Number(req.query.limit ?? 2000), 5000);
  const { order, mapNorm } = readCategoryMap();

  const query = `
    query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          featuredImage { url }
          apps: metafield(namespace: "custom", key: "modelos_de_aplicacion") { value }
          collections(first: 50) { nodes { title } }
          variants(first: 100) { nodes { sku title price } }
        }
      }
    }
  `;

  const groupsMap = new Map<string, any>();
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const data = await shopifyGraphQL(query, { cursor });
    const page = data.products;

    for (const p of page.nodes) {
      const collectionTitles: string[] = (p.collections?.nodes || [])
        .map((c: any) => normalize(c.title))
        .filter(Boolean);

      const resolved = resolveCategoryAndTread(collectionTitles, order, mapNorm);
      if (!resolved) continue;

      const imageUrl = p.featuredImage?.url || "";
      const appsText = normalize(p.apps?.value);

      const key = `${resolved.categoria}||${resolved.grabado}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          categoria: resolved.categoria,
          grabado: resolved.grabado,
          imagen: imageUrl,
          items: [] as any[],
        });
      }

      const g = groupsMap.get(key);
      if (!g.imagen && imageUrl) g.imagen = imageUrl;

      for (const v of p.variants?.nodes || []) {
        const sku = normalize(v.sku);
        if (!sku) continue;

        const medida = normalize(v.title);
        const precioIva = Number(v.price || 0);
        const precioSin = precioIva ? Math.round((precioIva / (1 + IVA)) * 100) / 100 : 0;

        g.items.push({ sku, medida, precioIva, precioSin, apps: appsText });
        total += 1;
        if (total >= limit) break;
      }
      if (total >= limit) break;
    }

    if (total >= limit) break;
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  const groups = Array.from(groupsMap.values()).map((g) => {
    const uniq = new Map<string, any>();
    for (const it of g.items) uniq.set(`${it.sku}||${it.medida}`, it);
    g.items = Array.from(uniq.values()).sort((a, b) => a.sku.localeCompare(b.sku));
    return g;
  });

  groups.sort((a, b) => {
    const ia = order.indexOf(a.categoria);
    const ib = order.indexOf(b.categoria);
    if (ia !== ib) return ia - ib;
    return a.grabado.localeCompare(b.grabado);
  });

  return res.status(200).json({ ok: true, count: groups.length, groups });
}
