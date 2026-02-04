import { useState, useMemo, useEffect } from "react";

/**
 * Lightweight avatar model inspired by Alex's builder.
 * Fully client-side, generates SVG via string + dangerouslySetInnerHTML.
 */

const DEFAULT_AVATAR = {
  displayName: "Player",
  badge: "common", // common | rare | epic (for future use)

  bodyShape: "round",   // round | square | bean
  skin: "#F2C7A5",

  hairStyle: "short",   // short | puff | long | none
  hair: "#2C1E1A",

  eyeStyle: "dots",     // dots | happy | sleepy
  eye: "#1A2433",

  mouthStyle: "smile",  // smile | neutral | open

  accessory: "none",    // none | glasses | earring | cap

  outfit: "hoodie",     // hoodie | tee | armor
  outfitColor: "#7C5CFF",

  bg: "nebula",         // nebula | sunset | mint | none
  tilt: 0,
};

const BODY_SHAPES = [
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "bean", label: "Bean" },
];

const HAIR_STYLES = [
  { value: "short", label: "Short" },
  { value: "puff", label: "Puff" },
  { value: "long", label: "Long" },
  { value: "none", label: "None" },
];

const EYE_STYLES = [
  { value: "dots", label: "Dots" },
  { value: "happy", label: "Happy" },
  { value: "sleepy", label: "Sleepy" },
];

const MOUTH_STYLES = [
  { value: "smile", label: "Smile" },
  { value: "neutral", label: "Neutral" },
  { value: "open", label: "Open" },
];

const ACCESSORIES = [
  { value: "none", label: "None" },
  { value: "glasses", label: "Glasses" },
  { value: "earring", label: "Earring" },
  { value: "cap", label: "Cap" },
];

const OUTFITS = [
  { value: "hoodie", label: "Hoodie" },
  { value: "tee", label: "T-Shirt" },
  { value: "armor", label: "Armor" },
];

const BACKGROUNDS = [
  { value: "nebula", label: "Nebula" },
  { value: "sunset", label: "Sunset" },
  { value: "mint", label: "Mint" },
  { value: "none", label: "None" },
];

// Simple palettes for randomize
const PALETTES = {
  skins: [
    "#F7D4B5", "#F2C7A5", "#E9B894", "#DDA57E",
    "#C98F6B", "#B97B58", "#A86949", "#8E553D",
  ],
  hairs: [
    "#2C1E1A", "#3A2B22", "#1A1A1A",
    "#6B4B3A", "#B8865B", "#D7C29B",
  ],
  eyes: ["#1A2433", "#0B1020", "#2C3E50", "#2D1E55", "#1F3B33"],
  outfits: ["#7C5CFF", "#20D48A", "#FF5C86", "#FFD166", "#4DD0FF", "#B3FF75"],
};

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* --- SVG helpers --- */

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

function escapeXML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderAvatarSVG(model) {
  const tilt = Number(model.tilt || 0);

  const layers = [
    layerBackground(model),
    `<ellipse cx="200" cy="380" rx="110" ry="16" fill="rgba(0,0,0,.35)" />`, // ground shadow
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

/* --- React component --- */

export default function AvatarBuilder({ initialAvatar, onAvatarChange }) {
  const [avatar, setAvatar] = useState(() => {
    if (initialAvatar) {
      try {
        return { ...DEFAULT_AVATAR, ...JSON.parse(initialAvatar) };
      } catch {
        return { ...DEFAULT_AVATAR };
      }
    }
    return { ...DEFAULT_AVATAR };
  });

  // push changes up if parent wants them
  useEffect(() => {
    if (onAvatarChange) {
      onAvatarChange(avatar);
    }
  }, [avatar, onAvatarChange]);

  const svgMarkup = useMemo(() => renderAvatarSVG(avatar), [avatar]);

  function update(field, value) {
    setAvatar((prev) => ({ ...prev, [field]: value }));
  }

  function randomize() {
    setAvatar((prev) => ({
      ...prev,
      skin: randPick(PALETTES.skins),
      hair: randPick(PALETTES.hairs),
      eye: randPick(PALETTES.eyes),
      outfitColor: randPick(PALETTES.outfits),
      bodyShape: randPick(BODY_SHAPES).value,
      hairStyle: randPick(HAIR_STYLES).value,
      eyeStyle: randPick(EYE_STYLES).value,
      mouthStyle: randPick(MOUTH_STYLES).value,
      accessory: randPick(ACCESSORIES).value,
      outfit: randPick(OUTFITS).value,
      bg: randPick(BACKGROUNDS).value,
      tilt: Math.floor(Math.random() * 21) - 10,
    }));
  }

  return (
    <div style={wrapperStyle}>
      <div style={leftColStyle}>
        <div
          style={avatarBoxStyle}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>

      <div style={rightColStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Display Name</label>
          <input
            style={inputStyle}
            value={avatar.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            maxLength={18}
          />
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Body</label>
            <select
              style={selectStyle}
              value={avatar.bodyShape}
              onChange={(e) => update("bodyShape", e.target.value)}
            >
              {BODY_SHAPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Skin</label>
            <input
              type="color"
              style={colorInput}
              value={avatar.skin}
              onChange={(e) => update("skin", e.target.value)}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Hair Style</label>
            <select
              style={selectStyle}
              value={avatar.hairStyle}
              onChange={(e) => update("hairStyle", e.target.value)}
            >
              {HAIR_STYLES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Hair Colour</label>
            <input
              type="color"
              style={colorInput}
              value={avatar.hair}
              onChange={(e) => update("hair", e.target.value)}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Eyes</label>
            <select
              style={selectStyle}
              value={avatar.eyeStyle}
              onChange={(e) => update("eyeStyle", e.target.value)}
            >
              {EYE_STYLES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Eye Colour</label>
            <input
              type="color"
              style={colorInput}
              value={avatar.eye}
              onChange={(e) => update("eye", e.target.value)}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Mouth</label>
            <select
              style={selectStyle}
              value={avatar.mouthStyle}
              onChange={(e) => update("mouthStyle", e.target.value)}
            >
              {MOUTH_STYLES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Accessory</label>
            <select
              style={selectStyle}
              value={avatar.accessory}
              onChange={(e) => update("accessory", e.target.value)}
            >
              {ACCESSORIES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Outfit</label>
            <select
              style={selectStyle}
              value={avatar.outfit}
              onChange={(e) => update("outfit", e.target.value)}
            >
              {OUTFITS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Outfit Colour</label>
            <input
              type="color"
              style={colorInput}
              value={avatar.outfitColor}
              onChange={(e) => update("outfitColor", e.target.value)}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Background</label>
            <select
              style={selectStyle}
              value={avatar.bg}
              onChange={(e) => update("bg", e.target.value)}
            >
              {BACKGROUNDS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Head Tilt</label>
            <input
              type="range"
              min="-10"
              max="10"
              value={avatar.tilt}
              onChange={(e) => update("tilt", Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <button type="button" style={randomBtn} onClick={randomize}>
          Randomise Avatar
        </button>
      </div>
    </div>
  );
}

/* --- Styles (inline) --- */

const wrapperStyle = {
  display: "flex",
  flexDirection: "row",
  gap: 16,
  alignItems: "stretch",
  width: "100%",
};

const leftColStyle = {
  flex: "0 0 220px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const rightColStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const avatarBoxStyle = {
  width: "100%",
  maxWidth: 260,
  aspectRatio: "1 / 1",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.45)",
  padding: 10,
};

const fieldGroup = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const rowStyle = {
  display: "flex",
  gap: 8,
};

const labelStyle = {
  fontSize: 12,
  opacity: 0.8,
};

const inputStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #666",
  background: "#111",
  color: "white",
  fontSize: 14,
};

const selectStyle = {
  ...inputStyle,
  padding: "6px 8px",
};

const colorInput = {
  width: "100%",
  height: 32,
  borderRadius: 8,
  border: "1px solid #666",
  background: "#111",
  padding: 0,
};

const randomBtn = {
  marginTop: 8,
  padding: "8px 14px",
  borderRadius: 999,
  border: "none",
  background: "#ffcc33",
  color: "#222",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};
