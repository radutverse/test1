import {
  LicenseSettings,
  DEFAULT_LICENSE_SETTINGS,
  getLicenseSettingsByType,
} from "@/lib/license/terms";

export const GROUPS = {
  SELFIE_REQUIRED: [5, 10],
  SUBMIT_REVIEW: [2, 3, 7, 8, 13, 15],
  DIRECT_REGISTER_FIXED_AI: [1, 4, 6, 12],
  DIRECT_REGISTER_MANUAL_AI: [9, 11, 14],
};

// Mapping grup ke license type
function determineLicenseTypeByGroup(group: number): string {
  if (GROUPS.DIRECT_REGISTER_FIXED_AI.includes(group)) {
    return "commercial-remix";
  }
  if (GROUPS.DIRECT_REGISTER_MANUAL_AI.includes(group)) {
    return "commercial-remix";
  }
  return "non-commercial-social-remixing";
}

export function getLicenseSettingsByGroup(
  group: number,
  aiTrainingManual?: boolean,
  mintingFee?: number,
  revShare?: number
): LicenseSettings | null {
  if (
    GROUPS.DIRECT_REGISTER_FIXED_AI.includes(group) ||
    GROUPS.DIRECT_REGISTER_MANUAL_AI.includes(group)
  ) {
    const licenseType = determineLicenseTypeByGroup(group);
    return getLicenseSettingsByType(
      licenseType,
      GROUPS.DIRECT_REGISTER_MANUAL_AI.includes(group)
        ? (aiTrainingManual ?? true)
        : false,
      mintingFee,
      revShare
    );
  }

  if (
    GROUPS.SELFIE_REQUIRED.includes(group) ||
    GROUPS.SUBMIT_REVIEW.includes(group)
  ) {
    return null;
  }

  return null;
}

export function requiresSelfieVerification(group: number) {
  return GROUPS.SELFIE_REQUIRED.includes(group);
}

export function requiresSubmitReview(group: number) {
  return GROUPS.SUBMIT_REVIEW.includes(group);
}

export function isAiGeneratedGroup(group: number) {
  return [1, 2, 3, 4, 5, 6, 12, 13].includes(group);
}
