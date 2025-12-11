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
 * Only Commercial Remix is supported
 */
export function determineLicenseType(license: any): LicenseTypeInfo | null {
  if (!license) {
    return null;
  }

  // All valid licenses are treated as Commercial Remix
  if (license.terms || license.templateName) {
    return LICENSE_TYPES["commercial-remix"];
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
