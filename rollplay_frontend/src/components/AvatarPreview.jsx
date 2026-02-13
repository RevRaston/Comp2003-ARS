// src/components/AvatarPreview.jsx
import { useMemo } from "react";

/**
 * Read-only avatar renderer.
 * Same model as the Profile avatar builder but no controls.
 */

const DEFAULT_AVATAR = {
  displayName: "Player",
  badge: "common",

  bodyShape: "round",
  skin: "#F2C7A5",

  hairStyle: "short",
  hair: "#2C1E1A",

  eyeStyle: "dots",
  eye: "#1A2433",

  mouthStyle: "smile",
  accessory: "none",

  outfit: "hoodie",
  outfitColor: "#7C5CFF",

  bg: "nebula",
  tilt: 0,
};

/* --- helpers (same as builder) --- */

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function bodyPath(shape) {
  if (shape === "square") {
    return `<rect x="110" y="95" rx="54" ry="54" width="180" height="200" />`;
  }
  if (shape === "bean") {
    return `<path d="M135 110 C155 85 205 78 232 98 C260 118 285 140 278 175 C272 210 294 232 274 258 C254 284 215 302 182 292 C150 282 120 258 118 225 C116 192 115 135 135 110 Z" />`;
  }
  // round
  return `<path d="M200 92 c70 0 105 58 105 128 c0 70 -35 118 -105 118 c-70 0 -105 -48 -105 -118 c0 -70 35 -128 105 -128 z" />`;
}

function layerBackground(model) {
  const bg = model.bg;
  if (bg === "none") {
    return `<rect x="0" y="0" width="400" height="400" fill="#0B1020"/>`;
  }
  if (bg === "nebula") {
    return `
      <defs>
        <radialGradient id="bgNeb1" cx="35%" cy="30%" r="70%">
          <stop offset="0" stop-color="#7C5CFF" stop-opacity="0.55"/>
          <stop offset="0.55" stop-color="#1C2A63" stop-opacity="0.15"/>
          <stop offset="1" stop-color="#0B1020" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bgNeb2" cx="70%" cy="65%" r="75%">
          <stop offset="0" stop-color="#20D48A" stop-opacity="0.35"/>
          <stop offset="0.6" stop-color="#0F1730" stop-opacity="0.12"/>
          <stop offset="1" stop-color="#0B1020" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="400" fill="#0B1020"/>
      <rect x="0" y="0" width="400" height="400" fill="url(#bgNeb1)"/>
      <rect x="0" y="0" width="400" height="400" fill="url(#bgNeb2)"/>
    `;
  }
  if (bg === "sunset") {
    return `
      <defs>
        <linearGradient id="bgSun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FF5C86" stop-opacity="0.55"/>
          <stop offset="0.45" stop-color="#FFD166" stop-opacity="0.38"/>
          <stop offset="1" stop-color="#4DD0FF" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="400" fill="#0B1020"/>
      <rect x="0" y="0" width="400" height="400" fill="url(#bgSun)"/>
    `;
  }
  // mint
  return `
    <defs>
      <radialGradient id="bgMint" cx="50%" cy="35%" r="75%">
        <stop offset="0" stop-color="#20D48A" stop-opacity="0.40"/>
        <stop offset="0.55" stop-color="#4DD0FF" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#0B1020" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="400" height="400" fill="#0B1020"/>
    <rect x="0" y="0" width="400" height="400" fill="url(#bgMint)"/>
  `;
}

function layerBody(model) {
  const sil = bodyPath(model.bodyShape);
  return `
    <g aria-label="Body">
      <defs>
        <clipPath id="bodyClip">${sil}</clipPath>
      </defs>
      <g fill="${model.skin}" stroke="rgba(0,0,0,.18)" stroke-width="2">
        ${sil}
      </g>
      <g clip-path="url(#bodyClip)">
        <ellipse cx="200" cy="170" rx="110" ry="70" fill="rgba(255,255,255,.08)" />
        <ellipse cx="200" cy="240" rx="110" ry="80" fill="rgba(0,0,0,.12)" />
      </g>
    </g>
  `;
}

function layerOutfit(model) {
  const color = model.outfitColor;
  const t = model.outfit;
  let path;
  if (t === "tee") {
    path = `M120 292 C145 270 170 260 200 260 C230 260 255 270 280 292 L270 340 C250 358 230 366 200 366 C170 366 150 358 130 340 Z`;
  } else if (t === "armor") {
    path = `M128 294 C152 268 174 258 200 258 C226 258 248 268 272 294 L260 346 C236 366 220 372 200 372 C180 372 164 366 140 346 Z`;
  } else {
    // hoodie
    path = `M120 294 C140 266 165 252 200 252 C235 252 260 266 280 294 L270 346 C248 366 226 374 200 374 C174 374 152 366 130 346 Z`;
  }
  return `
    <g aria-label="Outfit">
      <path d="${path}" fill="${color}" opacity="0.95" />
      <path d="${path}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4" opacity="0.4" />
    </g>
  `;
}

function layerHair(model) {
  const style = model.hairStyle;
  const hair = model.hair;
  if (style === "none") return "";
  let path;
  if (style === "short") {
    path = `M115 165 C125 110 165 90 200 92 C250 95 285 125 290 165 C280 145 265 130 240 122 C220 115 185 118 165 128 C145 138 130 150 115 165 Z`;
  } else if (style === "puff") {
    return `
      <g aria-label="Hair" fill="${hair}">
        <circle cx="150" cy="145" r="26"/>
        <circle cx="185" cy="128" r="30"/>
        <circle cx="220" cy="130" r="30"/>
        <circle cx="255" cy="148" r="26"/>
      </g>
    `;
  } else {
    // long
    path = `M122 178 C120 130 155 92 205 92 C252 92 285 125 288 175 C290 220 276 270 268 298 C246 318 218 328 184 326 C154 322 132 308 118 288 C112 250 120 205 122 178 Z`;
  }
  return `
    <g aria-label="Hair">
      <path d="${path}" fill="${hair}" />
      <path d="${path}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="4" opacity="0.4" />
    </g>
  `;
}

function layerEyes(model) {
  const style = model.eyeStyle;
  const iris = model.eye;

  if (style === "dots") {
    return `
      <g aria-label="Eyes">
        <ellipse cx="168" cy="190" rx="14" ry="11" fill="rgba(255,255,255,.9)" />
        <ellipse cx="232" cy="190" rx="14" ry="11" fill="rgba(255,255,255,.9)" />
        <circle cx="168" cy="190" r="6" fill="${iris}" />
        <circle cx="232" cy="190" r="6" fill="${iris}" />
      </g>
    `;
  }

  if (style === "happy") {
    return `
      <g aria-label="Eyes">
        <path d="M156 188 Q168 176 180 188" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>
        <path d="M220 188 Q232 176 244 188" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>
      </g>
    `;
  }

  // sleepy
  return `
    <g aria-label="Eyes">
      <path d="M152 186 Q168 198 184 186" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>
      <path d="M216 186 Q232 198 248 186" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>
    </g>
  `;
}

function layerMouth(model) {
  const style = model.mouthStyle;
  if (style === "neutral") {
    return `<path d="M175 232 Q200 238 225 232" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>`;
  }
  if (style === "open") {
    return `
      <path d="M176 230 Q200 255 224 230 Q200 220 176 230 Z" fill="#0B1020" opacity="0.92"/>
      <path d="M184 234 Q200 246 216 234" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4" stroke-linecap="round"/>
    `;
  }
  return `<path d="M170 228 Q200 260 230 228" fill="none" stroke="#0B1020" stroke-width="6" stroke-linecap="round"/>`;
}

function layerAccessory(model) {
  const t = model.accessory;
  if (t === "none") return "";
  if (t === "glasses") {
    return `
      <g fill="none" stroke="#0B1020" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="140" y="176" width="50" height="30" rx="12"/>
        <rect x="210" y="176" width="50" height="30" rx="12"/>
        <path d="M190 192 H210" />
      </g>
    `;
  }
  if (t === "earring") {
    return `
      <g fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round">
        <circle cx="122" cy="220" r="8" />
        <path d="M122 212 v-8" />
      </g>
    `;
  }
  // cap
  return `
    <g>
      <path d="M120 160 C130 120 160 98 200 98 C250 98 280 130 282 162 C255 140 230 130 200 130 C170 130 145 140 120 160 Z" fill="#0B1020" />
      <path d="M240 130 C280 132 305 148 310 170 C280 168 260 162 240 156 Z" fill="#0B1020" />
    </g>
  `;
}

function escapeXML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function layerNameplate(model) {
  const name = (model.displayName || "Player").slice(0, 18);
  return `
    <g aria-label="Nameplate">
      <rect x="80" y="330" width="240" height="40" rx="16"
        fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.12)" />
      <text x="200" y="355" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="14" fill="#E8EEFF" style="font-weight:700">
        ${escapeXML(name)}
      </text>
    </g>
  `;
}

function renderAvatarSVG(model) {
  const tilt = Number(model.tilt || 0);

  const layers = [
    layerBackground(model),
    `<ellipse cx="200" cy="380" rx="110" ry="16" fill="rgba(0,0,0,.35)" />`,
    `<g transform="rotate(${tilt} 200 220)">`,
    layerOutfit(model),
    layerBody(model),
    layerHair(model),
    layerEyes(model),
    layerMouth(model),
    layerAccessory(model),
    `</g>`,
    layerNameplate(model),
    `<rect x="24" y="24" width="352" height="352" rx="24" fill="none"
      stroke="rgba(255,255,255,.1)" stroke-width="2" />`,
  ];

  return `
    <svg width="400" height="400" viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg">
      ${layers.join("")}
    </svg>
  `;
}

function parseAvatarModel(raw, nameOverride) {
  let merged = { ...DEFAULT_AVATAR };

  if (raw) {
    try {
      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : { ...raw };
      merged = { ...DEFAULT_AVATAR, ...parsed };
    } catch {
      // ignore parse errors, stick to default
    }
  }

  if (nameOverride) {
    merged.displayName = nameOverride;
  }

  return merged;
}

/**
 * Read-only avatar component for Arena slots, etc.
 * Props:
 *   - avatarJson: string | object | null
 *   - displayName: optional name override
 */
export default function AvatarPreview({ avatarJson, displayName }) {
  const model = useMemo(
    () => parseAvatarModel(avatarJson, displayName),
    [avatarJson, displayName]
  );

  const svgMarkup = useMemo(() => renderAvatarSVG(model), [model]);

  return (
    <div style={outer}>
      <div
        style={inner}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  );
}

const outer = {
  width: "100%",
  height: "100%",
  padding: 10,
  borderRadius: 24,
  background: "radial-gradient(circle at 10% 0%, #1A1030, #050611)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
};

const inner = {
  width: "100%",
  height: "100%",
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(0,0,0,0.85)",
};
