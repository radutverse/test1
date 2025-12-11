import { LicenseSettings, DEFAULT_LICENSE_SETTINGS, getLicenseSettingsByType } from "@/lib/license/terms";
import { determineLicenseTypeByGroup } from "@/lib/license/license-types";

export const GROUPS = {
  SELFIE_REQUIRED: [5, 10],
  SUBMIT_REVIEW: [2, 3, 7, 8, 13, 15],
  DIRECT_REGISTER_FIXED_AI: [1, 4, 6, 12],
  DIRECT_REGISTER_MANUAL_AI: [9, 11, 14],
};

/**
 * Intelligently determine license settings based on classification group.
 * Uses smart mapping to select the best license type for each group.
 */
export function getLicenseSettingsByGroup(
  group: number,
  aiTrainingManual?: boolean,
  mintingFee?: number,
  revShare?: number,
): LicenseSettings | null {
  // Groups that can directly register
  if (GROUPS.DIRECT_REGISTER_FIXED_AI.includes(group) || GROUPS.DIRECT_REGISTER_MANUAL_AI.includes(group)) {
    // Determine the best license type for this group
    const licenseType = determineLicenseTypeByGroup(group);

    // Get license settings based on the determined type
    return getLicenseSettingsByType(
      licenseType,
      GROUPS.DIRECT_REGISTER_MANUAL_AI.includes(group) ? (aiTrainingManual ?? true) : false,
      mintingFee,
      revShare,
    );
  }

  // Groups requiring selfie verification or review cannot register yet
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
  // Based on determineGroup mapping in server/routes/upload.ts
  return [1, 2, 3, 4, 5, 6, 12, 13].includes(group);
}
