import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const IVA = 0.19;

async function shopifyGraphQL(query: string, variables: any) {
  const shop = process.env.SHOPIFY_SHOP!;
  const token = process.env.SHOPIFY_ADMIN_TOKEN!;
  const version = process.env.SHOPIFY_API_VERSION || "2026-01";
  const url = `https://${shop}/admin/api/${version}/graphql.json`;

  const resp = await axios.post(
    url,
    { query, variables },
    { headers: { "X-Shopify-Access-Token": token } }
  );

  if (resp.data.errors) throw new Error(JSON.stringify(resp.data.errors));
  return resp.data.data;
}

function isParentCollection(title: string) {
  return title.includes("/");
}

function normalize(s: any): string {
  return String(s ?? "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) {
    return res.status(400).json({ error: "Falta SHOPIFY_ADMIN_TOKEN" });
  }

  const query = `
    query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          featuredImage { url }
          collections(first: 50) { nodes { title } }
          variants(first: 100) { nodes { sku title price } }
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
        .filter((t: string) => Boolean(t));

      const parents: string[] = collectionTitles.filter((title: string) => isParentCollection(title));
      const treads: string[] = collectionTitles.filter((title: string) => !isParentCollection(title));

      if (!parents.length || !treads.length) continue;

      const imageUrl = p.featuredImage?.url || "";

      for (const parent of parents) {
        if (!groupsMap.has(parent)) {
          groupsMap.set(parent, {
            categoria: parent,
            bloques: new Map<string, any>(),
          });
        }

        const group = groupsMap.get(parent);

        for (const grabado of treads) {
          if (!group.bloques.has(grabado)) {
            group.bloques.set(grabado, {
              grabado,
              imagen: imageUrl,
              items: [] as any[],
            });
          }

          const bloque = group.bloques.get(grabado);
          if (!bloque.imagen && imageUrl) bloque.imagen = imageUrl;

          for (const v of p.variants?.nodes || []) {
            const sku = normalize(v.sku);
            if (!sku) continue;

            const medida = normalize(v.title);
            const precioIva = Number(v.price || 0);
            const precioSin = precioIva ? Math.round((precioIva / (1 + IVA)) * 100) / 100 : 0;

            bloque.items.push({ sku, medida, precioIva, precioSin });
          }
        }
      }
    }

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  const groups = Array.from(groupsMap.values()).map((g) => {
    const bloquesArr = Array.from(g.bloques.values()).map((b: any) => {
      const uniq = new Map<string, any>();
      for (const it of b.items) uniq.set(`${it.sku}||${it.medida}`, it);
      b.items = Array.from(uniq.values()).sort((a, c) => a.sku.localeCompare(c.sku));
      return b;
    });

    bloquesArr.sort((a: any, b: any) => a.grabado.localeCompare(b.grabado));

    return {
      categoria: g.categoria,
      bloques: bloquesArr,
    };
  });

  groups.sort((a, b) => a.categoria.localeCompare(b.categoria));

  return res.status(200).json({ ok: true, count: groups.length, groups });
}
