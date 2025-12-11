export type LicenseSettings = {
  pilType: "non_commercial_social_remix" | "commercial_use" | "commercial_remix";
  aiLearning: boolean;
  licensePrice: number;
  revShare: number;
};

export const DEFAULT_LICENSE_SETTINGS: LicenseSettings = {
  pilType: "commercial_remix",
  aiLearning: false,
  licensePrice: 0,
  revShare: 0,
};

/**
 * Get default license settings based on license type
 */
export function getLicenseSettingsByType(
  licenseType: string,
  aiTrainingManual?: boolean,
  mintingFee?: number,
  revShare?: number,
): LicenseSettings {
  switch (licenseType) {
    case "non-commercial-social-remixing":
      return {
        pilType: "non_commercial_social_remix",
        aiLearning: false,
        licensePrice: 0, // Always free
        revShare: 0, // No revenue share
      };

    case "commercial-use":
      return {
        pilType: "commercial_use",
        aiLearning: false,
        licensePrice: mintingFee ?? 1, // Requires minting fee
        revShare: 0, // No revenue share
      };

    case "commercial-remix":
      return {
        pilType: "commercial_remix",
        aiLearning: aiTrainingManual ?? true,
        licensePrice: mintingFee ?? 0,
        revShare: revShare ?? 0,
      };

    default:
      return DEFAULT_LICENSE_SETTINGS;
  }
}

// Shape compatible with Story Protocol terms generator expectations
export function createLicenseTerms(settings: LicenseSettings) {
  return {
    pilType: settings.pilType,
    terms: {
      aiTrainingAllowed: !!settings.aiLearning,
      licensePrice: Number(settings.licensePrice) || 0,
      revSharePercent: Number(settings.revShare) || 0,
    },
  } as const;
}
