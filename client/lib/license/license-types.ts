import { LicenseSettings } from "./terms";

export interface LicenseTypeInfo {
  name: string;
  description: string;
  icon?: string;
  key: string; // Tambahkan key untuk mapping
}

export const LICENSE_TYPES: Record<string, LicenseTypeInfo> = {
  "non-commercial-social-remixing": {
    key: "non-commercial-social-remixing",
    name: "Non-Commercial Social Remixing",
    description: "Let the world build on and play with your creation...",
    icon: "🎨",
  },
  "commercial-use": {
    key: "commercial-use",
    name: "Commercial Use",
    description: "Retain control over reuse of your work...",
    icon: "💼",
  },
  "commercial-remix": {
    key: "commercial-remix",
    name: "Commercial Remix",
    description: "Let the world build on and play with your creation… and earn money together!",
    icon: "🔄",
  },
};

// Mapping PIL type ke license type key
export function pilTypeToLicenseKey(pilType: LicenseSettings["pilType"]): string {
  const mapping: Record<string, string> = {
    non_commercial_social_remix: "non-commercial-social-remixing",
    commercial_use: "commercial-use",
    commercial_remix: "commercial-remix",
  };
  return mapping[pilType] || "non-commercial-social-remixing";
}

export function determineLicenseType(license: any): LicenseTypeInfo | null {
  if (!license) return null;

  // Template name matching
  if (license.templateName) {
    const templateLower = license.templateName.toLowerCase();
    if (templateLower.includes("commercial remix")) {
      return LICENSE_TYPES["commercial-remix"];
    }
    if (templateLower.includes("commercial use") && !templateLower.includes("remix")) {
      return LICENSE_TYPES["commercial-use"];
    }
    if (templateLower.includes("non-commercial") || templateLower.includes("social remix")) {
      return LICENSE_TYPES["non-commercial-social-remixing"];
    }
  }

  // Terms-based detection
  if (!license.terms) return null;

  const { commercialUse, derivativesAllowed, commercialRevShare, defaultMintingFee } = license.terms;

  if (derivativesAllowed && commercialUse && (defaultMintingFee > 0 || commercialRevShare > 0)) {
    return LICENSE_TYPES["commercial-remix"];
  }
  if (commercialUse && defaultMintingFee > 0 && !derivativesAllowed) {
    return LICENSE_TYPES["commercial-use"];
  }
  if (derivativesAllowed && !commercialUse) {
    return LICENSE_TYPES["non-commercial-social-remixing"];
  }

  return null;
}

export function determineLicenseTypeByGroup(group: number): string {
  // Grup yang aman untuk commercial remix
  const commercialRemixGroups = [1, 12, 16];
  // Grup untuk commercial use
  const commercialUseGroups = [4, 8, 9];

  if (commercialRemixGroups.includes(group)) return "commercial-remix";
  if (commercialUseGroups.includes(group)) return "commercial-use";
  return "non-commercial-social-remixing";
}

export function getLicenseSummaryLabel(license: any): string {
  return determineLicenseType(license)?.name || license.templateName || "Unknown License";
}
