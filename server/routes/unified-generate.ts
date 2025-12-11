import { RequestHandler } from "express";
import OpenAI from "openai";
import { FormData, Blob } from "formdata-node";
import https from "https";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Fetch image from URL and convert to data URL
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(imageUrl, (response) => {
        let data = Buffer.alloc(0);
        response.on("data", (chunk) => {
          data = Buffer.concat([data, chunk]);
        });
        response.on("end", () => {
          const base64 = data.toString("base64");
          const contentType = response.headers["content-type"] || "image/webp";
          const dataUrl = `data:${contentType};base64,${base64}`;
          resolve(dataUrl);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

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
  const color = getColorFromPrompt(prompt);
  const colorRgb = hslToRgb(color);
  const contrastColor = getContrastColor(colorRgb);

  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:hsl(${getHueFromColor(color) + 30}, 70%, 40%);stop-opacity:0.9" />
        </linearGradient>
        <pattern id="pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="${color}" opacity="0.1"/>
          <circle cx="25" cy="25" r="10" fill="${color}" opacity="0.15"/>
        </pattern>
      </defs>
      <rect width="1024" height="1024" fill="url(#grad1)"/>
      <rect width="1024" height="1024" fill="url(#pattern)"/>
      <circle cx="200" cy="200" r="150" fill="${color}" opacity="0.3"/>
      <circle cx="824" cy="824" r="200" fill="${color}" opacity="0.2"/>
      <rect x="100" y="100" width="824" height="824" rx="20" ry="20" fill="none" stroke="${color}" stroke-width="3" opacity="0.4"/>
      <text x="512" y="480" font-size="48" font-weight="bold" text-anchor="middle" fill="${contrastColor}" opacity="0.7">
        DEMO MODE
      </text>
      <text x="512" y="550" font-size="24" text-anchor="middle" fill="${contrastColor}" opacity="0.6" font-style="italic">
        ${escapeXml(prompt.substring(0, 50))}${prompt.length > 50 ? "..." : ""}
      </text>
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

// Unified TEXT → IMAGE generation (handles both demo and production modes)
export const unifiedGenerateImage: RequestHandler = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    const mode = req.body.mode || "production"; // "demo" or "production"

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt text" });
    }

    let imageUrl: string;

    if (mode === "demo") {
      // Demo mode: return custom image
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulate delay
      try {
        const customImageUrl =
          "https://cdn.builder.io/api/v1/image/assets%2F8b47a9dc49544656b302208a3bdb367f%2Fd8e8f3b606f0478d8702eb646bd205fa?format=webp&width=800";
        imageUrl = await fetchImageAsDataUrl(customImageUrl);
        console.log("✅ Demo image generated successfully");
      } catch (error) {
        console.warn(
          "Failed to fetch custom image, falling back to SVG",
          error,
        );
        const svgString = generateDemoSvgImage(prompt);
        const base64 = Buffer.from(svgString).toString("base64");
        imageUrl = `data:image/svg+xml;base64,${base64}`;
      }
    } else {
      // Production mode: use OpenAI
      const result = await client.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      if (!result.data || !result.data[0]) {
        console.error("❌ Unexpected OpenAI response:", result);
        return res.status(500).json({ error: "No image data received" });
      }

      if (result.data[0].url) {
        imageUrl = result.data[0].url;
      } else if (result.data[0].b64_json) {
        imageUrl = `data:image/png;base64,${result.data[0].b64_json}`;
      } else {
        console.error("❌ Unexpected OpenAI response format:", result.data[0]);
        return res
          .status(500)
          .json({ error: "No URL or base64 found in response" });
      }

      console.log("✅ Image generated successfully");
    }

    res.json({ url: imageUrl });
  } catch (err: any) {
    console.error("❌ Error generating image:", err);
    res.status(500).json({
      error: "Failed to generate image",
      details: err.message || String(err),
    });
  }
};

// Unified IMAGE → EDIT generation (handles both demo and production modes)
export const unifiedEditImage: RequestHandler = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    const file = (req as any).file;
    const mode = req.body.mode || "production"; // "demo" or "production"

    if (!file || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt" });
    }

    let imageUrl: string;

    if (mode === "demo") {
      // Demo mode: return custom image (ignore uploaded image)
      console.log("📸 Processing demo image edit");
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulate delay
      try {
        const customImageUrl =
          "https://cdn.builder.io/api/v1/image/assets%2F8b47a9dc49544656b302208a3bdb367f%2Fd8e8f3b606f0478d8702eb646bd205fa?format=webp&width=800";
        imageUrl = await fetchImageAsDataUrl(customImageUrl);
        console.log("✅ Demo image edited successfully");
      } catch (error) {
        console.warn(
          "Failed to fetch custom image, falling back to SVG",
          error,
        );
        const svgString = generateDemoSvgImage(prompt);
        const base64 = Buffer.from(svgString).toString("base64");
        imageUrl = `data:image/svg+xml;base64,${base64}`;
      }
    } else {
      // Production mode: use OpenAI
      const buffer = file.buffer;
      console.log("📸 Image received, bytes:", buffer.length);

      if (buffer.length > 20 * 1024 * 1024) {
        return res.status(400).json({
          error: "Image too large. Please use a smaller image.",
          currentSize: buffer.length,
          maxSize: 20971520,
        });
      }

      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt);
      form.append(
        "image",
        new Blob([buffer], { type: "image/jpeg" }),
        "image.jpg",
      );

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form as any,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ OpenAI API error:", data);
        return res.status(response.status).json({
          error: "Failed to edit image",
          details: data.error?.message || "Unknown error",
        });
      }

      if (!data.data || !data.data[0]) {
        console.error("❌ Unexpected OpenAI response:", data);
        return res.status(500).json({
          error: "Invalid response from OpenAI",
          details: "Missing image data in response",
        });
      }

      if (data.data[0].url) {
        imageUrl = data.data[0].url;
      } else if (data.data[0].b64_json) {
        imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      } else {
        console.error("❌ Unexpected OpenAI response format:", data.data[0]);
        return res.status(500).json({
          error: "Invalid response from OpenAI",
          details: "Missing both URL and base64 image data",
        });
      }

      console.log("✅ Image edited successfully");
    }

    res.json({ url: imageUrl });
  } catch (err: any) {
    console.error("❌ Error editing image:", err);
    res.status(500).json({
      error: "Failed to edit image",
      details: err.message || err,
    });
  }
};

// Unified TEXT → IMAGE with watermark (handles both demo and production modes)
export const unifiedGenerateImageWithWatermark: RequestHandler = async (
  req,
  res,
) => {
  try {
    const prompt = req.body.prompt?.trim();
    const mode = req.body.mode || "production"; // "demo" or "production"

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt text" });
    }

    let imageUrl: string;

    if (mode === "demo") {
      // Demo mode: return custom image
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulate delay
      try {
        const customImageUrl =
          "https://cdn.builder.io/api/v1/image/assets%2F8b47a9dc49544656b302208a3bdb367f%2Fd8e8f3b606f0478d8702eb646bd205fa?format=webp&width=800";
        imageUrl = await fetchImageAsDataUrl(customImageUrl);
        console.log("✅ Demo image generated successfully");
      } catch (error) {
        console.warn(
          "Failed to fetch custom image, falling back to SVG",
          error,
        );
        const svgString = generateDemoSvgImage(prompt);
        const base64 = Buffer.from(svgString).toString("base64");
        imageUrl = `data:image/svg+xml;base64,${base64}`;
      }
    } else {
      // Production mode: use OpenAI
      const result = await client.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      if (!result.data || !result.data[0]) {
        console.error("❌ Unexpected OpenAI response:", result);
        return res.status(500).json({ error: "No image data received" });
      }

      if (result.data[0].url) {
        console.log("✅ Generated image URL received");
        imageUrl = result.data[0].url;
      } else if (result.data[0].b64_json) {
        console.log("✅ Using base64 image data");
        imageUrl = `data:image/png;base64,${result.data[0].b64_json}`;
      } else {
        console.error("❌ Unexpected OpenAI response format:", result.data[0]);
        return res
          .status(500)
          .json({ error: "No URL or base64 found in response" });
      }

      console.log(
        "✅ Image generated successfully (watermark processing disabled)",
      );
    }

    res.json({ url: imageUrl });
  } catch (err: any) {
    console.error("❌ Error generating image with watermark:", err);
    res.status(500).json({
      error: "Failed to generate image",
      details: err.message || String(err),
    });
  }
};
