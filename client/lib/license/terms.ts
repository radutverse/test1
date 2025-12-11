import { LicenseTerms, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";
import { zeroAddress, parseEther } from "viem";

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

// Story Protocol Mainnet addresses
export const ROYALTY_POLICY_LAP = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E";

export function getLicenseSettingsByType(
  licenseType: string,
  aiTrainingManual?: boolean,
  mintingFee?: number,
  revShare?: number
): LicenseSettings {
  switch (licenseType) {
    case "non-commercial-social-remixing":
      return {
        pilType: "non_commercial_social_remix",
        aiLearning: false,
        licensePrice: 0,
        revShare: 0,
      };
    case "commercial-use":
      return {
        pilType: "commercial_use",
        aiLearning: false,
        licensePrice: mintingFee ?? 1,
        revShare: 0,
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

// Konversi ke Story Protocol LicenseTerms (on-chain)
export function toLicenseTerms(settings: LicenseSettings): LicenseTerms {
  const isCommercial = settings.pilType !== "non_commercial_social_remix";
  const allowDerivatives = settings.pilType !== "commercial_use";

  return {
    transferable: true,
    royaltyPolicy: isCommercial ? ROYALTY_POLICY_LAP : zeroAddress,
    defaultMintingFee: parseEther(String(settings.licensePrice)),
    expiration: 0n,
    commercialUse: isCommercial,
    commercialAttribution: isCommercial,
    commercializerChecker: zeroAddress,
    commercializerCheckerData: "0x",
    commercialRevShare: settings.revShare * 10 ** 6,
    commercialRevCeiling: 0n,
    derivativesAllowed: allowDerivatives,
    derivativesAttribution: allowDerivatives,
    derivativesApproval: false,
    derivativesReciprocal: allowDerivatives,
    derivativeRevCeiling: 0n,
    currency: WIP_TOKEN_ADDRESS,
    uri: "",
  };
}

// Legacy function untuk backward compatibility
export function createLicenseTerms(settings: LicenseSettings) {
  return {
    pilType: settings.pilType,
    terms: toLicenseTerms(settings),
  } as const;
}
