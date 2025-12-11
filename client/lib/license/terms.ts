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

// Royalty Policy LAP address (mainnet)
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

// Konversi ke Story Protocol LicenseTerms (on-chain format)
export function toLicenseTerms(settings: LicenseSettings): LicenseTerms {
  const isCommercial = settings.pilType !== "non_commercial_social_remix";
  const allowDerivatives = settings.pilType !== "commercial_use";

  return {
    transferable: true,
    royaltyPolicy: ROYALTY_POLICY_LAP,
    defaultMintingFee: parseEther(String(settings.licensePrice)),
    expiration: 0n,
    commercialUse: isCommercial,
    commercialAttribution: isCommercial,
    commercializerChecker: zeroAddress,
    commercializerCheckerData: "0x",
    commercialRevShare: settings.revShare * 10 ** 6, // Convert to protocol format
    commercialRevCeiling: 0n,
    derivativesAllowed: allowDerivatives,
    derivativesAttribution: allowDerivatives,
    derivativesApproval: false,
    derivativesReciprocal: allowDerivatives,
    derivativeRevCeiling: 0n,
    currency: WIP_TOKEN_ADDRESS,
    uri: getOffChainUri(settings),
  };
}

function getOffChainUri(settings: LicenseSettings): string {
  const baseUri = "https://github.com/piplabs/pil-document/blob/main/off-chain-terms";
  switch (settings.pilType) {
    case "non_commercial_social_remix":
      return `${baseUri}/NonCommercialSocialRemixing.json`;
    case "commercial_use":
      return `${baseUri}/CommercialUse.json`;
    case "commercial_remix":
      return `${baseUri}/CommercialRemix.json`;
    default:
      return "";
  }
}
