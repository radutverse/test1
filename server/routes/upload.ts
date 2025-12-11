import multer from "multer";
import crypto from "crypto";
import { analyzeImageWithOpenAI } from "../utils/image-analysis.js";
import {
  classifyImage,
  getLicenseSettings,
} from "../../shared/image-analysis.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Idempotency cache - in production, use Redis or similar
// Using both Idempotency-Key (request level) and content hash (image level) for consistency
const IDP_STORE = new Map<string, { status: number; body: any; ts: number }>();
const HASH_STORE = new Map<string, { status: number; body: any; ts: number }>();

export const handleUpload: any = [
  upload.single("image"),
  (async (req: any, res: any) => {
    try {
      // Idempotency support: if client supplies Idempotency-Key header, return cached response
      const idempotencyKey = (req.get("Idempotency-Key") ||
        req.get("idempotency-key")) as string | undefined;

      if (idempotencyKey && IDP_STORE.has(idempotencyKey)) {
        const cached = IDP_STORE.get(idempotencyKey)!;
        // If cached item is older than 60s, fallthrough and compute again
        if (Date.now() - cached.ts < 60_000) {
          res.status(cached.status).json({ ok: true, ...cached.body });
          return;
        } else {
          IDP_STORE.delete(idempotencyKey);
        }
      }

      const f = (req as any).file as any;
      if (!f)
        return res
          .status(400)
          .json({ ok: false, error: "no_file", message: "No file uploaded" });

      // Create content hash for consistent caching across requests
      const contentHash = crypto
        .createHash("sha256")
        .update(f.buffer)
        .digest("hex");

      // Check if we've already analyzed this exact image (by content hash)
      if (HASH_STORE.has(contentHash)) {
        const cached = HASH_STORE.get(contentHash)!;
        // Use hash-based cache with longer TTL (24 hours instead of 60s)
        if (Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
          res.status(cached.status).json({ ok: true, ...cached.body });
          return;
        } else {
          HASH_STORE.delete(contentHash);
        }
      }

      const base64 = f.buffer.toString("base64");

      if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not configured on the server");
        return res.status(503).json({
          ok: false,
          error: "openai_api_key_missing",
          message: "OpenAI API key not configured on the server",
        });
      }

      // Analyze image with new OpenAI analysis function
      const analysisFlags = await analyzeImageWithOpenAI(base64, f.mimetype);

      // Classify the image based on analysis flags
      const classification = classifyImage(analysisFlags);

      // Get license settings for the classified group
      const license = getLicenseSettings(classification.group);

      // Build response body
      const body = {
        ok: true,
        group: classification.group,
        type: classification.type,
        classification: classification.classification,
        details: analysisFlags,
        title: analysisFlags.title,
        description: analysisFlags.description,
        license: license,
        display: buildDisplayMessage(classification, license),
      };

      if (idempotencyKey) {
        IDP_STORE.set(idempotencyKey, { status: 200, body, ts: Date.now() });
      }

      // Also cache by content hash for image-level consistency
      HASH_STORE.set(contentHash, { status: 200, body, ts: Date.now() });

      return res.status(200).json(body);
    } catch (err) {
      console.error("upload error:", err);
      const body = {
        ok: false,
        error: "analysis_failed",
        message: String(err?.message || "Analysis failed"),
      };
      if (req.get("Idempotency-Key") || req.get("idempotency-key")) {
        const key = (req.get("Idempotency-Key") ||
          req.get("idempotency-key")) as string;
        IDP_STORE.set(key, { status: 500, body, ts: Date.now() });
      }
      // Don't cache errors by content hash - allow retry on next request
      return res.status(500).json(body);
    }
  }) as any,
];

function buildDisplayMessage(classification: any, license: any): string {
  const { type, classification: classificationDetail } = classification;
  const { title, description } = license;

  return `${type} - ${classificationDetail}. ${title}: ${description}`;
}
