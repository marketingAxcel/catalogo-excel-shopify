"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  sku: string;
  medida?: string;
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

const num = (n: any) => Number(n || 0).toLocaleString("es-CO");

function InfoBox({ label, value }: { label: string; value: any }) {
  return (
    <div
    style={{
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.04)",
      borderRadius: 12,
      padding: 10,
    }}
    >
    <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{value}</div>
    </div>
  );
}

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
        const medida = (it.medida || "").toLowerCase();
        const apps = (it.apps || "").toLowerCase();
        const inv = String(it.inventario ?? "").toLowerCase();
        return sku.includes(term) || medida.includes(term) || apps.includes(term) || inv.includes(term);
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
    <div style={{ minHeight: "100vh", background: "#070707", color: "#fff", padding: 28 }}>
    <style>{`
        @media (max-width: 767px) {
          .wrap {
            padding: 14px !important;
          }
          .searchInput {
            width: 100% !important;
          }
          .headerRow {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .counter {
            margin-left: 0 !important;
          }
          .desktopOnly {
            display: none !important;
          }
          .mobileOnly {
            display: block !important;
          }
        }
      `}</style>
      
      <div className="wrap" style={{ maxWidth: 1500, margin: "0 auto" }}>
      <img src="/img/banner-catalogo.png" style={{width: "100%", marginBottom: 20}} />
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: "#eeff03" }}>Catálogo llantas Paytton Tires</h1>
      <div className="headerRow" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <input
      className="searchInput"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Buscar por SKU, medida, grabado, categoría, aplicaciones, inventario..."
      style={{
        width: 520,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        outline: "none",
        background: "#0b0b0b",
        color: "#fff",
        marginTop: "10px",
      }}
      />
      
      <div className="counter" style={{ marginLeft: "auto", opacity: 0.8 }}>
      {loading ? (
        <>Cargando...</>
      ) : (
        <>
        Mostrando: <b>{filtered.length}</b> grabados
        </>
      )}
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
          
          <div className="desktopOnly" style={{ display: "block" }}>
          <div style={{ border: "1px solid #222", borderRadius: 14, overflow: "hidden" }}>
          <div
          style={{
            display: "grid",
            gridTemplateColumns: "500px 140px 1fr",
            background: "#070707",
            borderBottom: "1px solid #222",
            padding: "20px",
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
              gridTemplateColumns: "500px 140px 1fr",
              borderBottom: "1px solid #141414",
              background: "#070707",
            }}
            >
            <div style={{ padding: 20, borderRight: "1px solid #141414" }}>
            {g.imagen ? (
              <img
              src={g.imagen}
              alt={g.grabado}
              style={{
                width: 450,
                height: 450,
                objectFit: "contain",
                borderRadius: 10,
                padding: 8,
              }}
              />
            ) : (
              <div style={{ opacity: 0.6 }}>Sin imagen</div>
            )}
            </div>
            
            <div
            style={{
              padding: 20,
              borderRight: "1px solid #141414",
              fontWeight: 900,
              fontSize: 18,
              textAlign: "center",
            }}
            >
            {g.grabado}
            </div>
            
            <div style={{ padding: 20, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
            <thead>
            <tr style={{ color: "#bbb", fontSize: 12 }}>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>SKU</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>MEDIDA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>INV</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO CATÁLOGO SIN IVA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO CATÁLOGO + IVA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO 35% DCTO SIN IVA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO 30% DCTO SIN IVA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO 25% DCTO SIN IVA</th>
            <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #222" }}>PRECIO 20% DCTO SIN IVA</th>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #222" }}>MODELOS DE APLICACIÓN</th>
            </tr>
            </thead>
            <tbody>
            {(g.items || []).map((it, i) => (
              <tr key={`${it.sku}-${i}`}>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", fontWeight: 900 }}>{it.sku}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "center", fontWeight: 900, whiteSpace: "nowrap" }}>
              {it.medida || ""}
              </td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{num(it.inventario)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precioCatalogoSinIva)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precioCatalogoConIva)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precio35)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precio30)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precio25)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", textAlign: "right" }}>{money(it.precio20)}</td>
              <td style={{ padding: "8px 8px", borderBottom: "1px solid #141414", whiteSpace: "pre-wrap", textTransform: "lowercase" }}>
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
          
          <div className="mobileOnly" style={{ display: "none" }}>
          <div style={{ display: "grid", gap: 14 }}>
          {list.map((g, gi) => (
            <div
            key={`${g.categoria}-${g.grabado}-${gi}-m`}
            style={{
              border: "1px solid #222",
              borderRadius: 16,
              overflow: "hidden",
              background: "#070707",
            }}
            >
            <div
            style={{
              padding: 14,
              borderBottom: "1px solid #141414",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
            >
            <div style={{ minWidth: 0 }}>
            <div style={{ color: "#eeff03", fontWeight: 900, fontSize: 16, letterSpacing: 0.2 }}>{g.grabado}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{cat}</div>
            </div>
            
            <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
            >
            {g.items?.length || 0} refs
            </div>
            </div>
            
            <div style={{ padding: 14, borderBottom: "1px solid #141414" }}>
            {g.imagen ? (
              <img
              src={g.imagen}
              alt={g.grabado}
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 14,
                background: "#0b0b0b",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: 10,
              }}
              />
            ) : (
              <div style={{ opacity: 0.6 }}>Sin imagen</div>
            )}
            </div>
            
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
            {(g.items || []).map((it, i) => (
              <div
              key={`${it.sku}-${i}-m`}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 16,
                padding: 12,
                background: "rgba(255,255,255,0.03)",
              }}
              >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 14 }}>
              {it.sku}
              {it.medida ? (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75, fontWeight: 800, whiteSpace: "nowrap" }}>
                {it.medida}
                </span>
              ) : null}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
              INV: <b style={{ color: "#eeff03" }}>{num(it.inventario)}</b>
              </div>
              </div>
              
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <InfoBox label="Precio (IVA)" value={money(it.precioCatalogoConIva)} />
              <InfoBox label="Precio sin IVA" value={money(it.precioCatalogoSinIva)} />
              </div>
              
              <details
              style={{
                marginTop: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.25)",
                padding: 10,
              }}
              >
              <summary style={{ cursor: "pointer", color: "#eeff03", fontWeight: 900, fontSize: 12 }}>
              Ver más (descuentos y aplicaciones)
              </summary>
              
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <InfoBox label="35% Dcto" value={money(it.precio35)} />
              <InfoBox label="30% Dcto" value={money(it.precio30)} />
              <InfoBox label="25% Dcto" value={money(it.precio25)} />
              <InfoBox label="20% Dcto" value={money(it.precio20)} />
              </div>
              
              {it.apps ? (
                <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>Modelos de aplicación</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", opacity: 0.9 }}>{it.apps}</div>
                </div>
              ) : null}
              </details>
              </div>
            ))}
            </div>
            </div>
          ))}
          </div>
          </div>
          </div>
        );
      })}
      </div>
      </div>
    );
  }
  