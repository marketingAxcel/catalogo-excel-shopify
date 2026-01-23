import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const IVA = 0.19;

const CATEGORY_ORDER = ["TOURING", "ADVENTURE", "TRAIL RALLY", "THREE WHEELS", "SCOOTER"];

async function shopifyGraphQL(query: string, variables: any) {
  const shop = process.env.SHOPIFY_SHOP!;
  const token = process.env.SHOPIFY_ADMIN_TOKEN!;
  const version = process.env.SHOPIFY_API_VERSION || "2026-01";
  const url = `https://${shop}/admin/api/${version}/graphql.json`;

  const resp = await axios.post(url, { query, variables }, { headers: { "X-Shopify-Access-Token": token } });
  if (resp.data.errors) throw new Error(JSON.stringify(resp.data.errors));
  return resp.data.data;
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function upper(s: any) {
  return norm(s).toUpperCase();
}

function parseCategoryMap(): Record<string, string[]> {
  try {
    const raw = process.env.CATEGORY_MAP_JSON || "{}";
    const obj = JSON.parse(raw);
    const out: Record<string, string[]> = {};
    for (const k of Object.keys(obj)) out[upper(k)] = (obj[k] || []).map((x: any) => upper(x));
    return out;
  } catch {
    return {};
  }
}

function resolveCategory(collectionTitles: string[], categoryMap: Record<string, string[]>) {
  const titlesU = collectionTitles.map(upper);

  for (const cat of CATEGORY_ORDER) {
    if (titlesU.includes(cat)) return cat;

    const aliases = categoryMap[cat] || [];
    const hit = titlesU.some((t) => aliases.includes(t));
    if (hit) return cat;
  }

  return "";
}

function resolveTread(collectionTitles: string[], cat: string, categoryMap: Record<string, string[]>) {
  const titlesU = collectionTitles.map(upper);

  const aliases = categoryMap[cat] || [];
  const treadU = titlesU.find((t) => aliases.includes(t));
  if (!treadU) return "";

  const idx = titlesU.indexOf(treadU);
  return idx >= 0 ? norm(collectionTitles[idx]) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });
  if (!process.env.SHOPIFY_SHOP) return res.status(400).json({ error: "Falta SHOPIFY_SHOP" });

  const limit = Math.min(Math.max(Number(req.query.limit || 300), 1), 5000);

  const categoryMap = parseCategoryMap();

  const query = `
    query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          featuredImage { url }
          apps: metafield(namespace: "custom", key: "modelos_de_aplicacion") { value }
          collections(first: 80) { nodes { title } }
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
  let fetchedVariants = 0;

  while (true) {
    const data = await shopifyGraphQL(query, { cursor });
    const page = data.products;

    for (const p of page.nodes) {
      const collectionTitles: string[] = (p.collections?.nodes || [])
        .map((c: any) => norm(c.title))
        .filter((t: string) => Boolean(t));

      const categoria = resolveCategory(collectionTitles, categoryMap);
      if (!categoria) continue;

      const grabado = resolveTread(collectionTitles, categoria, categoryMap);
      if (!grabado) continue;

      const key = `${categoria}||${upper(grabado)}`;
      const imageUrl = p.featuredImage?.url || "";
      const appsText = norm(p.apps?.value || "");

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          categoria,
          grabado,
          imagen: imageUrl,
          apps: appsText,
          items: [] as any[],
        });
      }

      const g = groupsMap.get(key);
      if (!g.imagen && imageUrl) g.imagen = imageUrl;
      if (!g.apps && appsText) g.apps = appsText;

      for (const v of p.variants?.nodes || []) {
        const sku = norm(v.sku);
        if (!sku) continue;

        const precioCatalogoConIva = Number(v.price || 0);
        const precioCatalogoSinIva = precioCatalogoConIva
          ? Math.round((precioCatalogoConIva / (1 + IVA)) * 100) / 100
          : 0;

        const precio35 = Math.round(precioCatalogoConIva * 0.65 * 100) / 100;
        const precio30 = Math.round(precioCatalogoConIva * 0.70 * 100) / 100;
        const precio25 = Math.round(precioCatalogoConIva * 0.75 * 100) / 100;
        const precio20 = Math.round(precioCatalogoConIva * 0.80 * 100) / 100;

        const inventario = Number(v.inventoryQuantity ?? 0);

        g.items.push({
          sku,
          inventario,
          precioCatalogoSinIva,
          precioCatalogoConIva,
          precio35,
          precio30,
          precio25,
          precio20,
          apps: g.apps || "",
        });

        fetchedVariants += 1;
        if (fetchedVariants >= limit) break;
      }

      if (fetchedVariants >= limit) break;
    }

    if (fetchedVariants >= limit) break;
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  const groups = Array.from(groupsMap.values()).map((g) => {
    const uniq = new Map<string, any>();
    for (const it of g.items) uniq.set(it.sku, it);
    g.items = Array.from(uniq.values()).sort((a, b) => a.sku.localeCompare(b.sku));
    return g;
  });

  const catIndex = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(upper(c));
    return i === -1 ? 999 : i;
  };

  groups.sort((a, b) => {
    const ca = catIndex(a.categoria);
    const cb = catIndex(b.categoria);
    if (ca !== cb) return ca - cb;
    return upper(a.grabado).localeCompare(upper(b.grabado));
  });

  res.status(200).json({ ok: true, count: groups.length, groups });
}
