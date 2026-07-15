// Renders the 1200x630 social share image (og.png) from an inline SVG.
// Dark premium canvas, the StileAI shield glyph, wordmark, and value-prop line.
// Run: node scripts/build-og.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0e1013"/>
      <stop offset="1" stop-color="#171b21"/>
    </linearGradient>
    <linearGradient id="shieldB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E8CE8"/>
      <stop offset="1" stop-color="#1157AE"/>
    </linearGradient>
    <linearGradient id="shieldG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4DA86"/>
      <stop offset=".5" stop-color="#E0B33A"/>
      <stop offset="1" stop-color="#B9862A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#1953f0" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#1953f0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="930" cy="150" rx="520" ry="380" fill="url(#glow)"/>

  <!-- shield glyph, scaled up from the 32-unit brand path -->
  <g transform="translate(96,150) scale(4.6)">
    <path d="M7 6C7 5.25 7.5 5 8.25 5L23.75 5C24.5 5 25 5.25 25 6C25 10 25.5 13 25 16C24.5 21 20.75 24.5 16 27.25C11.25 24.5 7.5 21 7 16C6.5 13 7 10 7 6Z"
      fill="url(#shieldB)" stroke="url(#shieldG)" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M11.5 15.8 L14.7 19 L20.5 12.2" fill="none" stroke="#F4DA86" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <text x="252" y="250" font-family="Inter, Arial, sans-serif" font-size="76" font-weight="800" letter-spacing="-3" fill="#ffffff">StileAI</text>

  <text x="96" y="410" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="-1.6" fill="#ffffff">The policy checkpoint between</text>
  <text x="96" y="474" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="-1.6" fill="#ffffff">your team and the AI they use.</text>

  <text x="96" y="548" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="500" fill="#9197a1">Block secrets, customer data, and source code before they reach any AI tool.</text>

  <rect x="96" y="580" width="1008" height="2" fill="#2a2f37"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log("wrote", OUT);
