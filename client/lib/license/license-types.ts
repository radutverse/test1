export interface LicenseTypeInfo {
  name: string;
  description: string;
  icon?: string;
}

export const LICENSE_TYPES: Record<string, LicenseTypeInfo> = {
  "non-commercial-social-remixing": {
    name: "Non-Commercial Social Remixing",
    description:
      "Let the world build on and play with your creation. This license allows for endless free remixing while tracking all uses of your work while giving you full credit. Similar to: TikTok plus attribution.",
    icon: "🎨",
  },
  "commercial-use": {
    name: "Commercial Use",
    description:
      "Retain control over reuse of your work, while allowing anyone to appropriately use the work in exchange for the economic terms you set. Similar to Shutterstock with creator-set rules.",
    icon: "💼",
  },
  "commercial-remix": {
    name: "Commercial Remix",
    description:
      "Let the world build on and play with your creation… and earn money together from it! This license allows for endless free remixing while tracking all uses of your work while giving you full credit, with each derivative paying a percentage of revenue to its 'parent' IP.",
    icon: "🔄",
  },
};

/**
 * Determine license type based on license terms
 * Maps license.terms properties to the appropriate license type
 */
export function determineLicenseType(license: any): LicenseTypeInfo | null {
  if (!license) {
    return null;
  }

  // Try template name matching first as it's more reliable
  if (license.templateName) {
    const templateLower = license.templateName.toLowerCase();

    if (
      templateLower.includes("commercial remix") ||
      templateLower.includes("commercial remixing")
    ) {
      return LICENSE_TYPES["commercial-remix"];
    }
    if (
      templateLower.includes("commercial use") &&
      !templateLower.includes("remix")
    ) {
      return LICENSE_TYPES["commercial-use"];
    }
    if (
      templateLower.includes("non-commercial") ||
      templateLower.includes("social remix")
    ) {
      return LICENSE_TYPES["non-commercial-social-remixing"];
    }
  }

  // Fallback to terms-based detection
  if (!license.terms) {
    return null;
  }

  const terms = license.terms;
  const commercialUse = terms.commercialUse ?? false;
  const derivativesAllowed = terms.derivativesAllowed ?? false;
  const commercialRevShare = Number(terms.commercialRevShare ?? 0);
  const defaultMintingFee = Number(terms.defaultMintingFee ?? 0);

  // Commercial Remix: Derivatives allowed + Commercial use + (Fee OR RevShare)
  if (derivativesAllowed && commercialUse && (defaultMintingFee > 0 || commercialRevShare > 0)) {
    return LICENSE_TYPES["commercial-remix"];
  }

  // Commercial Use: Commercial allowed + Fee, but no derivatives
  if (commercialUse && defaultMintingFee > 0 && !derivativesAllowed) {
    return LICENSE_TYPES["commercial-use"];
  }

  // Non-Commercial Social Remixing: Derivatives allowed, no commercial, free
  if (derivativesAllowed && !commercialUse && defaultMintingFee === 0) {
    return LICENSE_TYPES["non-commercial-social-remixing"];
  }

  return null;
}

/**
 * Intelligently determine the best license type based on image classification group
 * Maps classification groups to the most appropriate license type
 */
export function determineLicenseTypeByGroup(group: number): string {
  switch (group) {
    // AI-Generated Images without faces/brands - Safe for commercial remix
    case 1: // AI Image, No Faces or Brands
      return "commercial-remix";

    // AI-Generated Images with brands/characters - Cannot register but would use NCSR if could
    case 2: // AI Image with Brand/Character
      return "non-commercial-social-remixing";

    // Famous person full face - Cannot register but would use NCSR if could
    case 3: // Famous Person Full Face
      return "non-commercial-social-remixing";

    // Famous person partial face - Commercial Use (controlled)
    case 4: // Famous Person Partial Face
      return "commercial-use";

    // Regular person full face - Requires review but would use NCSR if approved
    case 5: // Regular Person Full Face
      return "non-commercial-social-remixing";

    // Regular person partial face - NCSR (less identifiable, safer)
    case 6: // Regular Person Partial Face
      return "non-commercial-social-remixing";

    // Photo with brand/character - Cannot register but would use NCSR if could
    case 7: // Photo with Brand/Character
      return "non-commercial-social-remixing";

    // Famous person in photo full face - Cannot register
    case 8: // Famous Person Full Face (Photo)
      return "commercial-use";

    // Famous person in photo partial face - Requires review
    case 9: // Famous Person Partial Face (Photo)
      return "commercial-use";

    // Regular person in photo full face - Requires review
    case 10: // Regular Person Full Face (Photo)
      return "non-commercial-social-remixing";

    // Regular person in photo partial face - NCSR
    case 11: // Regular Person Partial Face (Photo)
      return "non-commercial-social-remixing";

    // AI Animation without brand - Safe for commercial remix
    case 12: // AI Animation, No Brand/Character
      return "commercial-remix";

    // AI Animation with brand - Cannot register
    case 13: // AI Animation with Brand/Character
      return "non-commercial-social-remixing";

    // Non-AI Animation - NCSR
    case 14: // Non-AI Animation
      return "non-commercial-social-remixing";

    // Restricted content - Cannot register
    case 15: // Cannot Register (restricted content)
      return "non-commercial-social-remixing";

    // Photo without faces/brands - Safe for commercial remix
    case 16: // Photo, No Faces or Brands
      return "commercial-remix";

    default:
      return "non-commercial-social-remixing";
  }
}

/**
 * Get a summary label for a license based on its terms
 * Useful for compact display (badges, chips, etc)
 */
export function getLicenseSummaryLabel(license: any): string {
  const licenseType = determineLicenseType(license);
  if (licenseType) {
    return licenseType.name;
  }

  // Fallback to template name if available
  if (license.templateName) {
    return license.templateName;
  }

  return "Unknown License";
}
