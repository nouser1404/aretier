// js/templates.js
import {
    flattenTriangleBySides,
    circleCircleIntersection,
    pickUpperPoint,
    v2,
    len2,
    sub2
  } from "./flatten.js";
  
  import { dist3, rad2deg, clamp } from "./geometry.js";
  
  export function buildTriangleTemplate2D(model, i) {
    const n = model.base.length;
    const A = model.A;
    const Vi = model.base[i];
    const Vj = model.base[(i + 1) % n];
  
    const base = dist3(Vi, Vj);
    const left = dist3(A, Vi);
    const right = dist3(A, Vj);
  
    const tri = flattenTriangleBySides(base, left, right);
    const Vi2D = tri.A;
    const Vj2D = tri.B;
    const A2D = tri.C;
  
    const apex = angleOppositeSide(base, left, right);
    const baseLeft = angleOppositeSide(right, base, left);
    const baseRight = angleOppositeSide(left, base, right);
  
    return {
      type: "triangle",
      i,
      pts: { Vi2D, Vj2D, A2D },
      lengths: { base, left, right },
      angles: {
        apexDeg: rad2deg(apex),
        baseLeftDeg: rad2deg(baseLeft),
        baseRightDeg: rad2deg(baseRight),
      }
    };
  }
  
  export function buildFrustumTemplate2D(model, i) {
    if (!model.trunc) throw new Error("Pas de tronquage actif.");
  
    const n = model.base.length;
    const Vi = model.base[i];
    const Vj = model.base[(i + 1) % n];
    const Ti = model.trunc[i];
    const Tj = model.trunc[(i + 1) % n];
  
    const baseLow = dist3(Vi, Vj);
    const baseHigh = dist3(Ti, Tj);
    const legI = dist3(Vi, Ti);
    const legJ = dist3(Vj, Tj);
    const diagVjTi = dist3(Vj, Ti);
  
    const Vi2D = v2(0, 0);
    const Vj2D = v2(baseLow, 0);
  
    const triTi = flattenTriangleBySides(baseLow, legI, diagVjTi);
    const Ti2D = triTi.C;
  
    const ints = circleCircleIntersection(Vj2D, legJ, Ti2D, baseHigh);
    const Tj2D = pickUpperPoint(ints);
    if (!Tj2D) throw new Error("Impossible de placer Tj (intersection cercles).");
  
    return {
      type: "frustum",
      i,
      pts: { Vi2D, Vj2D, Ti2D, Tj2D },
      lengths: { baseLow, baseHigh, legI, legJ }
    };
  }
  
  export function templateToSVG(template, options = {}) {
    const units = options.units ?? "mm";
    const margin = options.marginMm ?? 10;
    const stroke = options.stroke ?? "#111";
    const stroke2 = options.stroke2 ?? "#666";
    const text = options.text ?? "#111";
  
    let pts = [];
    let segments = [];
  
    if (template.type === "triangle") {
      const { Vi2D, Vj2D, A2D } = template.pts;
      pts = [Vi2D, Vj2D, A2D];
      segments = [
        ["base", Vi2D, Vj2D],
        ["côté", Vj2D, A2D],
        ["côté", A2D, Vi2D],
      ];
    } else {
      const { Vi2D, Vj2D, Ti2D, Tj2D } = template.pts;
      // Vi -> Vj -> Tj -> Ti
      pts = [Vi2D, Vj2D, Tj2D, Ti2D];
      segments = [
        ["base basse", Vi2D, Vj2D],
        ["montant", Vj2D, Tj2D],
        ["base haute", Tj2D, Ti2D],
        ["montant", Ti2D, Vi2D],
      ];
    }
  
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs) - margin;
    const maxX = Math.max(...xs) + margin;
    const minY = Math.min(...ys) - margin;
    const maxY = Math.max(...ys) + margin;
    const w = maxX - minX;
    const h = maxY - minY;
  
    const tx = -minX;
    const ty = -minY;
  
    const polyPoints = pts.map(pt => `${pt.x + tx},${pt.y + ty}`).join(" ");
    const title = template.type === "triangle"
      ? `Gabarit face ${template.i} (triangle)`
      : `Gabarit face ${template.i} (tronqué)`;
  
    const dimTexts = segments.map(([label, a, b]) => {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const L = len2(sub2(b, a));
      return `<text x="${mid.x + tx}" y="${mid.y + ty - 2}" font-size="4" fill="${text}" text-anchor="middle">${L.toFixed(1)} ${units}</text>`;
    }).join("\n");
  
    const extra = (template.type === "triangle")
      ? `<text x="10" y="12" font-size="5" fill="${text}">Apex: ${template.angles.apexDeg.toFixed(2)}°</text>`
      : "";
  
    return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${w}${units}" height="${h}${units}"
       viewBox="0 0 ${w} ${h}">
    <title>${escapeXML(title)}</title>
    <rect x="0" y="0" width="${w}" height="${h}" fill="white"/>
    <g transform="translate(${tx},${ty})">
      <polygon points="${polyPoints}" fill="none" stroke="${stroke}" stroke-width="0.6"/>
      ${dimTexts}
    </g>
    ${extra}
    <text x="10" y="${h - 6}" font-size="4" fill="${stroke2}">${escapeXML(title)}</text>
  </svg>`;
  }
  
  export function downloadSVG(filename, svgText) {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function angleOppositeSide(a, b, c) {
    const cosA = clamp((b*b + c*c - a*a) / (2*b*c), -1, 1);
    return Math.acos(cosA);
  }
  
  function escapeXML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
  