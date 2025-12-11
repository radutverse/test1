export interface LicenseTypeInfo {
  name: string;
  description: string;
  icon?: string;
}

export const LICENSE_TYPES: Record<string, LicenseTypeInfo> = {
  "commercial-remix": {
    name: "Commercial Remix",
    description:
      "Let the world build on and play with your creation… and earn money together from it! This license allows for endless free remixing while tracking all uses of your work while giving you full credit, with each derivative paying a percentage of revenue to its 'parent' IP.",
    icon: "🔄",
  },
};

/**
 * Determine license type based on license terms
 * Maps license.terms properties to one of the 4 license types
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
      templateLower.includes("creative commons") ||
      templateLower.includes("cc-by")
    ) {
      return LICENSE_TYPES["creative-commons-attribution"];
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

  // Try multiple field names for minting fee (API inconsistency)
  let mintingFee = 0;
  if (license.licensingConfig?.mintingFee) {
    mintingFee = Number(license.licensingConfig.mintingFee);
  } else if (terms.defaultMintingFee) {
    mintingFee = Number(terms.defaultMintingFee);
  }

  const hasFee = mintingFee > 0;
  const hasRevShare = commercialRevShare > 0;

  // Commercial Remix: Derivatives allowed + (Fee OR RevShare) + Commercial
  if (derivativesAllowed && (hasFee || hasRevShare) && commercialUse) {
    return LICENSE_TYPES["commercial-remix"];
  }

  // Commercial Use: Commercial allowed + Fee, but no derivatives or no revshare
  if (commercialUse && hasFee && !derivativesAllowed) {
    return LICENSE_TYPES["commercial-use"];
  }

  // Creative Commons Attribution: Free, derivatives allowed, commercial allowed
  if (!hasFee && commercialUse && derivativesAllowed && !hasRevShare) {
    return LICENSE_TYPES["creative-commons-attribution"];
  }

  // Non-Commercial Social Remixing: Derivatives allowed, no commercial, free
  if (derivativesAllowed && !commercialUse && !hasFee) {
    return LICENSE_TYPES["non-commercial-social-remixing"];
  }

  return null;
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
