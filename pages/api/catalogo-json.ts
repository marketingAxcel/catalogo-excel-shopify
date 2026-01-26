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
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function fold(s: any) {
  return norm(s)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCategoryMap(): Record<string, string[]> {
  try {
    const raw = process.env.CATEGORY_MAP_JSON || "{}";
    const obj = JSON.parse(raw);
    const out: Record<string, string[]> = {};
    for (const k of Object.keys(obj)) out[fold(k)] = (obj[k] || []).map((x: any) => fold(x));
    return out;
  } catch {
    return {};
  }
}

function resolveCategory(collectionTitles: string[], categoryMap: Record<string, string[]>) {
  const titlesF = collectionTitles.map(fold);

  for (const cat of CATEGORY_ORDER) {
    const catF = fold(cat);

    if (titlesF.includes(catF)) return cat;

    const aliases = categoryMap[catF] || [];
    const hit = titlesF.some((t) => aliases.includes(t));
    if (hit) return cat;
  }

  return "";
}

function resolveTread(collectionTitles: string[], cat: string, categoryMap: Record<string, string[]>) {
  const titlesF = collectionTitles.map(fold);

  const aliases = categoryMap[fold(cat)] || [];
  const treadF = titlesF.find((t) => aliases.includes(t));
  if (!treadF) return "";

  const idx = titlesF.indexOf(treadF);
  return idx >= 0 ? norm(collectionTitles[idx]) : "";
}

/** NUEVO: Detecta TL/TT desde el título */
function resolveTubeTypeFromTitle(title: string) {
  const m = norm(title).match(/\b(TL|TT)\b/i);
  return m ? m[1].toUpperCase() : "";
}

/** NUEVO: Detecta la medida desde colecciones (preferido) y fallback desde el título */
function resolveSize(collectionTitles: string[], productTitle: string) {
  const titles = (collectionTitles || []).map(norm).filter(Boolean);

  // Ej: 120/70-17, 90/90-17, 130/70-17
  const reMetric = /^\d{2,3}\/\d{2,3}-\d{2}$/;

  // Ej: 2.75-17, 3.00-18, 2.50-17, 3.00-17
  const reInch = /^\d(?:\.\d{2})?-\d{2}$/;

  const fromCollections = titles.find((t) => reMetric.test(t) || reInch.test(t));
  let size = fromCollections || "";

  if (!size) {
    const t = norm(productTitle);

    // 120/70-17
    const m1 = t.match(/\b(\d{2,3}\/\d{2,3}-\d{2})\b/);
    if (m1?.[1]) size = m1[1];

    // 2.75-17 / 3.00-18
    if (!size) {
      const m2 = t.match(/\b(\d(?:\.\d{2})?-\d{2})\b/);
      if (m2?.[1]) size = m2[1];
    }
  }

  const tube = resolveTubeTypeFromTitle(productTitle); // TL/TT
  if (!size) return "";

  return tube ? `${size} ${tube}` : size; // Ej: "120/70-17 TL"
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });
  if (!process.env.SHOPIFY_SHOP) return res.status(400).json({ error: "Falta SHOPIFY_SHOP" });

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

      // NUEVO: medida (una sola por producto, se replica a sus variantes)
      const medida = resolveSize(collectionTitles, p.title || "");

      const key = `${categoria}||${fold(grabado)}`;
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
        const precio30 = Math.round(precioCatalogoConIva * 0.7 * 100) / 100;
        const precio25 = Math.round(precioCatalogoConIva * 0.75 * 100) / 100;
        const precio20 = Math.round(precioCatalogoConIva * 0.8 * 100) / 100;

        const inventario = Number(v.inventoryQuantity ?? 0);

        g.items.push({
          sku,
          medida, // <-- NUEVO
          inventario,
          precioCatalogoSinIva,
          precioCatalogoConIva,
          precio35,
          precio30,
          precio25,
          precio20,
          apps: g.apps || "",
        });
      }
    }

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
    const cf = fold(c);
    const i = CATEGORY_ORDER.findIndex((x) => fold(x) === cf);
    return i === -1 ? 999 : i;
  };

  groups.sort((a, b) => {
    const ca = catIndex(a.categoria);
    const cb = catIndex(b.categoria);
    if (ca !== cb) return ca - cb;
    return fold(a.grabado).localeCompare(fold(b.grabado));
  });

  res.status(200).json({ ok: true, count: groups.length, groups });
}
