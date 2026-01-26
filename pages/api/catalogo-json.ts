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

  if (resp.data?.errors) throw new Error(JSON.stringify(resp.data.errors));
  if (!resp.data?.data) throw new Error("Respuesta Shopify inválida (sin data)");

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

function buildReverseTreadToCategory(categoryMap: Record<string, string[]>) {
  const rev = new Map<string, string>();
  for (const cat of Object.keys(categoryMap)) {
    for (const tread of categoryMap[cat] || []) {
      if (!rev.has(tread)) rev.set(tread, cat);
    }
  }
  return rev;
}

function resolveCategoryFromCollections(collectionTitles: string[]) {
  const titlesF = collectionTitles.map(fold);
  for (const cat of CATEGORY_ORDER) {
    if (titlesF.includes(fold(cat))) return cat;
  }
  return "";
}

function resolveTreadFromCollections(collectionTitles: string[], cat: string, categoryMap: Record<string, string[]>) {
  const titlesF = collectionTitles.map(fold);
  const aliases = categoryMap[fold(cat)] || [];
  const treadF = titlesF.find((t) => aliases.includes(t));
  if (!treadF) return "";
  const idx = titlesF.indexOf(treadF);
  return idx >= 0 ? norm(collectionTitles[idx]) : "";
}

function resolveTreadFromMetafields(p: any) {
  const candidates = [
    p.tread1?.value,
    p.tread2?.value,
    p.tread3?.value,
    p.tread4?.value,
    p.tread5?.value,
  ].map(norm);

  return candidates.find((x) => !!x) || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });
  if (!process.env.SHOPIFY_SHOP) return res.status(400).json({ error: "Falta SHOPIFY_SHOP" });

  const debugOn = String(req.query.debug || "") === "1";

  const categoryMap = parseCategoryMap();
  const revTreadToCat = buildReverseTreadToCategory(categoryMap);

  const query = `
    query Products($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          featuredImage { url }
          apps: metafield(namespace: "custom", key: "modelos_de_aplicacion") { value }

          # <-- GRABADO / NOMBRE DE LA LLANTA (ajusta si tu key es diferente)
          tread1: metafield(namespace: "custom", key: "nombre_de_la_llanta") { value }
          tread2: metafield(namespace: "custom", key: "nombre_llanta") { value }
          tread3: metafield(namespace: "custom", key: "nombre_de_llanta") { value }
          tread4: metafield(namespace: "custom", key: "grabado") { value }
          tread5: metafield(namespace: "custom", key: "tread") { value }

          collections(first: 80) { nodes { title } }

          variants(first: 250) {
            nodes { sku price inventoryQuantity }
          }
        }
      }
    }
  `;

  const groupsMap = new Map<string, any>();

  let totalProducts = 0;
  let totalVariants = 0;
  let skippedNoCategory = 0;
  let skippedNoTread = 0;
  const examplesNoCategory: any[] = [];
  const examplesNoTread: any[] = [];

  let cursor: string | null = null;

  while (true) {
    const data = await shopifyGraphQL(query, { cursor });
    const page = data.products;

    for (const p of page.nodes || []) {
      totalProducts += 1;

      const collectionTitles: string[] = (p.collections?.nodes || [])
        .map((c: any) => norm(c.title))
        .filter((t: string) => Boolean(t));

      let categoria = resolveCategoryFromCollections(collectionTitles);

      let grabado = resolveTreadFromMetafields(p);

      if (!grabado && categoria) {
        grabado = resolveTreadFromCollections(collectionTitles, categoria, categoryMap);
      }

      if (!categoria && grabado) {
        const catF = revTreadToCat.get(fold(grabado));
        if (catF) {
          const found = CATEGORY_ORDER.find((c) => fold(c) === catF);
          categoria = found || "";
        }
      }

      if (!categoria) {
        skippedNoCategory += 1;
        if (debugOn && examplesNoCategory.length < 10) {
          examplesNoCategory.push({ title: p.title, collections: collectionTitles });
        }
        continue;
      }

      if (!grabado) {
        skippedNoTread += 1;
        if (debugOn && examplesNoTread.length < 10) {
          examplesNoTread.push({ title: p.title, categoria, collections: collectionTitles });
        }
        continue;
      }

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
          inventario,
          precioCatalogoSinIva,
          precioCatalogoConIva,
          precio35,
          precio30,
          precio25,
          precio20,
          apps: g.apps || "",
        });

        totalVariants += 1;
      }
    }

    if (!page.pageInfo?.hasNextPage) break;
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

  const payload: any = { ok: true, count: groups.length, groups };

  if (debugOn) {
    payload.debug = {
      totalProducts,
      totalVariants,
      skippedNoCategory,
      skippedNoTread,
      examplesNoCategory,
      examplesNoTread,
    };
  }

  res.status(200).json(payload);
}
