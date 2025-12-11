import { RequestHandler } from "express";

// Generate a hash-based color from the prompt
function getColorFromPrompt(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Generate a realistic-looking dummy SVG image based on prompt
function generateDemoSvgImage(prompt: string): string {
  // Use the user's custom image as the base
  const customImageUrl = "https://cdn.builder.io/api/v1/image/assets%2F8b47a9dc49544656b302208a3bdb367f%2Fd8e8f3b606f0478d8702eb646bd205fa?format=webp&width=800";

  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <image width="1024" height="1024" href="${customImageUrl}" preserveAspectRatio="xMidYMid slice"/>
    </svg>
  `;

  return svg;
}

// Convert HSL to RGB for contrast calculation
function hslToRgb(hsl: string): { r: number; g: number; b: number } {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return { r: 128, g: 128, b: 128 };

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Get contrast color (black or white)
function getContrastColor(rgb: { r: number; g: number; b: number }): string {
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#ffffff";
}

// Extract hue from HSL string
function getHueFromColor(hsl: string): number {
  const match = hsl.match(/hsl\((\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 🔹 DEMO: TEXT → IMAGE (returns realistic dummy image)
export const demoGenerateImage: RequestHandler = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt text" });

    // Simulate 3-second crafting delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Generate SVG
    const svgString = generateDemoSvgImage(prompt);

    const base64 = Buffer.from(svgString).toString("base64");
    const imageUrl = `data:image/svg+xml;base64,${base64}`;

    console.log("✅ Demo image generated successfully");
    res.json({ url: imageUrl });
  } catch (err: any) {
    console.error("❌ Error generating demo image:", err);
    res.status(500).json({
      error: "Failed to generate demo image",
      details: err.message || String(err),
    });
  }
};

// 🔹 DEMO: IMAGE → EDIT (returns realistic dummy edited image)
export const demoEditImage: RequestHandler = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    const file = (req as any).file;

    if (!file || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt" });
    }

    console.log("📸 Processing demo image edit");

    // Simulate 3-second crafting delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // For demo mode, just generate a new SVG-based image like generate
    // (in real scenario, this would modify the uploaded image)
    const svgString = generateDemoSvgImage(prompt);
    const base64 = Buffer.from(svgString).toString("base64");
    const imageUrl = `data:image/svg+xml;base64,${base64}`;

    console.log("✅ Demo image edited successfully");
    res.json({ url: imageUrl });
  } catch (err: any) {
    console.error("❌ Error editing demo image:", err);
    res.status(500).json({
      error: "Failed to edit demo image",
      details: err.message || err,
    });
  }
};
