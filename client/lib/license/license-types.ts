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
