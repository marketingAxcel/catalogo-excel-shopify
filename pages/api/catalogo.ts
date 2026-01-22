import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import ExcelJS from "exceljs";

const IVA = 0.19;

// ✅ EDITA ESTO con tus colecciones hijas reales
const PARENT_BY_CHILD: Record<string, string[]> = {
  TOURING: ["mrf", "snake", "angus", "esport"],
};

function parentFromCollections(titles: string[]): string {
  const lower = titles.map((t) => t.toLowerCase());
  for (const parent of Object.keys(PARENT_BY_CHILD)) {
    const children = PARENT_BY_CHILD[parent];
    const hit = children.some((child) => lower.some((t) => t.includes(child.toLowerCase())));
    if (hit) return parent;
  }
  return "";
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN) {
    return res.status(400).send("Falta SHOPIFY_ADMIN_TOKEN. Primero instala en /api/auth/start");
  }

  // ⚠️ Embebido de imágenes puede volver lento el endpoint.
  // Default: NO embebemos imágenes. Si quieres: /api/catalogo?embedImages=1
  const embedImages = String(req.query.embedImages || "0") === "1";

  const query = `
    query Products($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          productType
          featuredImage { url }
          nombre: metafield(namespace: "custom", key: "nombre_de_la_llanta") { value }
          apps: metafield(namespace: "custom", key: "modelos_de_aplicacion") { value }
          collections(first: 20) { nodes { title } }
          variants(first: 50) { nodes { sku title price } }
        }
      }
    }
  `;

  const products: any[] = [];
  let cursor: string | null = null;

  while (true) {
    const data = await shopifyGraphQL(query, { cursor });
    const page = data.products;
    products.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("CATALOGO");

  ws.columns = [
    { header: "CATEGORÍA", key: "categoria", width: 18 },
    { header: "IMAGEN", key: "imagen", width: 18 },
    { header: "NOMBRE DE LA LLANTA", key: "nombre", width: 34 },
    { header: "REF INTERNA", key: "sku", width: 18 },
    { header: "MEDIDA", key: "medida", width: 18 },
    { header: "PRECIO + IVA", key: "precioIva", width: 16 },
    { header: "PRECIO SIN IVA", key: "precioSin", width: 18 },
    { header: "APLICACIONES", key: "apps", width: 60 },
  ];

  // Header negro + amarillo
  ws.getRow(1).height = 22;
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.font = { bold: true, color: { argb: "FFFFD400" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  let rowIndex = 2;

  for (const p of products) {
    const collections = (p.collections?.nodes || []).map((c: any) => c.title);
    const categoriaPadre = parentFromCollections(collections);
    const categoria = categoriaPadre || (p.productType || "");

    const nombre = (p.nombre?.value || "").trim() || p.title;
    const appsText = (p.apps?.value || "").trim();
    const imageUrl = p.featuredImage?.url || "";

    for (const v of (p.variants?.nodes || [])) {
      const sku = (v.sku || "").trim();
      if (!sku) continue;

      const medida = (v.title || "").trim();
      const precioIva = Number(v.price || 0);
      const precioSin = precioIva ? Math.round((precioIva / (1 + IVA)) * 100) / 100 : 0;

      const row = ws.addRow({
        categoria,
        imagen: imageUrl,
        nombre,
        sku,
        medida,
        precioIva,
        precioSin,
        apps: appsText,
      });

      row.height = 70;

      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FF333333" } },
          left: { style: "thin", color: { argb: "FF333333" } },
          bottom: { style: "thin", color: { argb: "FF333333" } },
          right: { style: "thin", color: { argb: "FF333333" } },
        };
      });

      // (Opcional) embebido de imagen
      if (embedImages && imageUrl.startsWith("http")) {
        try {
          const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
          const ext = imageUrl.toLowerCase().includes(".jpg") || imageUrl.toLowerCase().includes(".jpeg")
            ? "jpeg"
            : "png";

          const imageId = wb.addImage({
            buffer: Buffer.from(imgResp.data),
            extension: ext as any,
          });

          // Columna B (index 2) => col 1 en coordenadas 0-based de exceljs
          ws.addImage(imageId, {
            tl: { col: 1, row: rowIndex - 1 },
            ext: { width: 90, height: 90 },
          });
        } catch {}
      }

      rowIndex += 1;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="catalogo_paytton.xlsx"`);
  return res.status(200).send(Buffer.from(buffer));
}
