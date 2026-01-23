import { useEffect, useMemo, useState } from "react";

type Item = {
  sku: string;
  inventario: number;
  precioCatalogoSinIva: number;
  precioCatalogoConIva: number;
  precio35: number;
  precio30: number;
  precio25: number;
  precio20: number;
  apps?: string;
};

type Group = {
  categoria: string;
  grabado: string;
  imagen: string;
  apps?: string;
  items: Item[];
};

const CATEGORY_ORDER = ["TOURING", "ADVENTURE", "TRAIL RALLY", "THREE WHEELS", "SCOOTER"];

const money = (n: any) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

export default function Home() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(300);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/catalogo-json?limit=${limit}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Error consultando API");
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (e: any) {
      setErr(e?.message || "Error");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((g) => {
        const headerHit =
          (g.categoria || "").toLowerCase().includes(term) || (g.grabado || "").toLowerCase().includes(term);

        const items = (g.items || []).filter((it) => {
          const sku = (it.sku || "").toLowerCase();
          const apps = (it.apps || "").toLowerCase();
          const inv = String(it.inventario ?? "").toLowerCase();
          return sku.includes(term) || apps.includes(term) || inv.includes(term);
        });

        if (headerHit) return { ...g, items: g.items || [] };
        if (items.length) return { ...g, items };
        return null;
      })
      .filter(Boolean) as Group[];
  }, [groups, q]);

  const byCategory = useMemo(() => {
    const map: Record<string, Group[]> = {};
    for (const c of CATEGORY_ORDER) map[c] = [];
    for (const g of filtered) {
      const c = String(g.categoria || "").toUpperCase();
      if (!map[c]) map[c] = [];
      map[c].push(g);
    }
    return map;
  }, [filtered]);

  return (
    <div style={{ minHeight: "100vh", background: "#181819", color: "#fff", padding: 28 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: "#eeff03" }}>Catálogo llantas Paytton Tires</h1>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU, grabado, categoría, aplicaciones, inventario..."
            style={{
              width: 520,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              outline: "none",
              background: "#0b0b0b",
              color: "#fff",
            }}
          />

          <div style={{ marginLeft: "auto", opacity: 0.8 }}>
            Mostrando: <b>{filtered.length}</b> grabados
          </div>
        </div>

        {err ? (
          <div
            style={{
              background: "#2a0000",
              border: "1px solid #5a0000",
              padding: 12,
              borderRadius: 10,
              marginBottom: 14,
              color: "#ffd7d7",
            }}
          >
            {err}
          </div>
        ) : null}

        {CATEGORY_ORDER.map((cat) => {
          const list = byCategory[cat] || [];
          if (!list.length) return null;

          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#eeff03",
                  borderBottom: "1px solid #222",
                  paddingBottom: 10,
                  marginBottom: 14,
                }}
              >
                {cat}
              </div>

              <div style={{ border: "1px solid #222", borderRadius: 14, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 260px 1fr",
                    background: "#181819",
                    borderBottom: "1px solid #222",
                    padding: "12px 14px",
                    fontWeight: 900,
                    color: "#eeff03",
                    letterSpacing: 0.3,
                  }}
                >
                  <div>IMAGEN</div>
                  <div>GRABADO</div>
                  <div>REFERENCIAS / PRECIOS / INVENTARIO</div>
                </div>

                {list.map((g, gi) => (
                  <div
                    key={`${g.categoria}-${g.grabado}-${gi}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 260px 1fr",
                      borderBottom: "1px solid #141414",
                      background: gi % 2 === 0 ? "#070707" : "#181819",
                    }}
                  >
                    <div style={{ padding: 14, borderRight: "1px solid #141414" }}>
                      {g.imagen ? (
                        <img
                          src={g.imagen}
                          alt={g.grabado}
                          style={{
                            width: 140,
                            height: 140,
                            objectFit: "contain",
                            background: "#0a0a0a",
                            border: "1px solid #222",
                            borderRadius: 10,
                            padding: 8,
                          }}
                        />
                      ) : (
                        <div style={{ opacity: 0.6 }}>Sin imagen</div>
                      )}
                    </div>

                    <div style={{ padding: 14, borderRight: "1px solid #141414", fontWeight: 900, fontSize: 18 }}>
                      {g.grabado}
                    </div>

                    <div style={{ padding: 14, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1300 }}>
                        <thead>
                          <tr style={{ color: "#bbb", fontSize: 12 }}>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              SKU
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              INV
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO CATÁLOGO SIN IVA
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO CATÁLOGO + IVA
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO 35% DCTO CON IVA
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO 30% DCTO CON IVA
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO 25% DCTO CON IVA
                            </th>
                            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              PRECIO 20% DCTO CON IVA
                            </th>
                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #222" }}>
                              MODELOS DE APLICACIÓN
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(g.items || []).map((it, i) => (
                            <tr key={`${it.sku}-${i}`}>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", fontWeight: 900 }}>
                                {it.sku}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {Number(it.inventario || 0).toLocaleString("es-CO")}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precioCatalogoSinIva)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precioCatalogoConIva)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precio35)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precio30)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precio25)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>
                                {money(it.precio20)}
                              </td>
                              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", whiteSpace: "pre-wrap" }}>
                                {it.apps || ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
