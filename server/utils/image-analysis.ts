import OpenAI from "openai";
import { type ImageAnalysisFlags } from "../../shared/image-analysis.js";

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set.");
}

const openai = new OpenAI({ apiKey: API_KEY });

const analysisSchema = {
  name: "ImageAnalysisSchema",
  strict: true,
  schema: {
    type: "object",
    properties: {
      primary_category: {
        type: "string",
        description:
          "The single most important classification. Choose one: 'Photograph', 'AI-Generated Image', 'Animation/CGI', or 'Uncertain' if impossible to tell.",
      },
      ai_generation_analysis: {
        type: "object",
        description:
          "Deeply analyze if the image is AI-generated, providing likelihood, evidence, and a confidence score.",
        properties: {
          likelihood: {
            type: "string",
            description:
              "Estimated likelihood: High, Medium, Low, or Unlikely.",
          },
          evidence: {
            type: "array",
            items: { type: "string" },
            description: "List of visual cues supporting the assessment.",
          },
          confidence_score: {
            type: "number",
            description: "Confidence score from 0.0 to 1.0.",
          },
        },
        required: ["likelihood", "evidence", "confidence_score"],
        additionalProperties: false,
      },
      content_analysis: {
        type: "object",
        description: "Analyze for sensitive or restricted content.",
        properties: {
          contains_explicit_content: { type: "boolean" },
          contains_violence: { type: "boolean" },
          contains_sensitive_subject: { type: "boolean" },
          description: { type: "string" },
        },
        required: [
          "contains_explicit_content",
          "contains_violence",
          "contains_sensitive_subject",
          "description",
        ],
        additionalProperties: false,
      },
      composition_analysis: {
        type: "object",
        description:
          "Analyze the artistic and technical composition of the image.",
        properties: {
          style: { type: "string" },
          perspective: { type: "string" },
          dominant_colors: { type: "array", items: { type: "string" } },
        },
        required: ["style", "perspective", "dominant_colors"],
        additionalProperties: false,
      },
      object_detection: {
        type: "object",
        description: "Identify key objects and text.",
        properties: {
          main_objects: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["main_objects"],
        additionalProperties: false,
      },
      text_detection: {
        type: "object",
        properties: {
          detected_text: { type: "string" },
        },
        required: ["detected_text"],
        additionalProperties: false,
      },
      has_human_face: { type: "boolean" },
      is_full_face_visible: { type: "boolean" },
      is_famous_person: { type: "boolean" },
      has_known_brand_or_character: { type: "boolean" },
      title: { type: "string" },
      description: { type: "string" },
    },
    required: [
      "primary_category",
      "ai_generation_analysis",
      "content_analysis",
      "composition_analysis",
      "object_detection",
      "text_detection",
      "has_human_face",
      "is_full_face_visible",
      "is_famous_person",
      "has_known_brand_or_character",
      "title",
      "description",
    ],
    additionalProperties: false,
  },
};

export async function analyzeImageWithOpenAI(
  base64Image: string,
  mimeType: string,
): Promise<ImageAnalysisFlags> {
  try {
    const prompt = `You are an expert forensic image analyst for Intellectual Property (IP) registration.

Your **first and most critical task** is to determine the image's origin and set the 'primary_category' based on AI likelihood:
- If AI likelihood is 'High' or 'Medium' → primary_category = 'AI-Generated Image'
- If AI likelihood is 'Low' or 'Unlikely' → primary_category = 'Photograph'
- If the image appears to be animation, CGI render, cartoon, etc. → primary_category = 'Animation/CGI'
- If truly uncertain → primary_category = 'Uncertain'

Then perform a deep, full-spectrum analysis:
1. **AI Forensics** — detect artifacts, hyperrealism, texture inconsistencies. Be precise with likelihood (High/Medium/Low/Unlikely).
2. **Sensitive Content Detection** — violence, explicit content, self-harm.
3. **IP Risk Assessment** — recognizable faces, famous people, brands, characters.
4. Follow the JSON schema EXACTLY with no extra fields.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: analysisSchema,
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const jsonOutput = response.choices[0].message.content;

    if (!jsonOutput) {
      throw new Error("OpenAI returned empty response.");
    }

    const parsedJson = JSON.parse(jsonOutput);
    return parsedJson as ImageAnalysisFlags;
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw new Error(
      "Failed to analyze image using OpenAI. Check logs for full details.",
    );
  }
}
