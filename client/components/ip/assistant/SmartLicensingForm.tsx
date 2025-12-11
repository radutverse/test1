import React, { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  determineLicenseTypeByGroup,
  LICENSE_TYPES,
  determineLicenseType,
} from "@/lib/license/license-types";

interface SmartLicensingFormProps {
  group: number;
  title: string;
  description: string;
  imageUrl?: string;
  onRegister: (config: {
    licenseType: string;
    mintingFee: number;
    revShare: number;
    aiTraining: boolean;
  }) => void;
  isLoading?: boolean;
}

/**
 * Get human-friendly explanation for why a license type is recommended
 */
function getLicenseRecommendationReason(
  group: number,
  licenseType: string,
): string {
  switch (licenseType) {
    case "commercial-remix":
      if (group === 1)
        return "Clean AI-generated image with no faces or brands - safe for maximum monetization";
      if (group === 12)
        return "AI animation without brand/character - can leverage full commercial potential";
      if (group === 16)
        return "Clean photograph without faces or brands - ideal for commercial use and derivatives";
      return "This content is suitable for commercial remixing with revenue sharing";

    case "commercial-use":
      if (group === 4)
        return "Famous person with partial face visibility - requires controlled commercial access";
      if (group === 8)
        return "Famous person in photograph - controlled commercial use without derivatives";
      if (group === 9)
        return "Famous person partial visibility - limits commercial remixing for privacy protection";
      return "Commercial use allowed but derivatives are restricted";

    case "non-commercial-social-remixing":
      if (group === 2)
        return "AI image with brand/character - free remixing to respect IP rights";
      if (group === 3)
        return "AI image of famous person - free remixing to respect publicity rights";
      if (group === 5)
        return "Regular person full face - requires manual review but suitable for social remixing";
      if (group === 6)
        return "Regular person partial face - protects individual privacy while allowing remixes";
      if (group === 7)
        return "Photo with brand/character - free remixing to respect IP and brand rights";
      if (group === 10)
        return "Regular person in photograph - requires consent but allows free remixing";
      if (group === 11)
        return "Regular person partial face - balances privacy with remix potential";
      if (group === 14)
        return "Non-AI animation - free remixing appropriate for traditional content";
      if (group === 15)
        return "Content with restrictions - free social remixing is most appropriate";
      return "This content is best suited for free, non-commercial remixing";

    default:
      return "Intelligently selected based on your content classification";
  }
}

export const SmartLicensingForm: React.FC<SmartLicensingFormProps> = ({
  group,
  title,
  description,
  imageUrl,
  onRegister,
  isLoading = false,
}) => {
  // Determine the recommended license type
  const recommendedLicenseType = useMemo(
    () => determineLicenseTypeByGroup(group),
    [group],
  );

  const recommendedLicenseInfo = LICENSE_TYPES[recommendedLicenseType];
  const recommendationReason = useMemo(
    () => getLicenseRecommendationReason(group, recommendedLicenseType),
    [group, recommendedLicenseType],
  );

  // State for license selection and form inputs
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>(
    recommendedLicenseType,
  );
  const [mintingFee, setMintingFee] = useState<string>("");
  const [revShare, setRevShare] = useState<string>("");
  const [aiTraining, setAiTraining] = useState(true);
  const [showLicenseOptions, setShowLicenseOptions] = useState(false);

  const selectedLicenseInfo = LICENSE_TYPES[selectedLicenseType];

  // Get all available license types
  const availableLicenses = Object.entries(LICENSE_TYPES).map(
    ([key, value]) => ({
      key,
      ...value,
    }),
  );

  const handleRegister = () => {
    onRegister({
      licenseType: selectedLicenseType,
      mintingFee: mintingFee ? Number(mintingFee) : 0,
      revShare: revShare ? Number(revShare) : 0,
      aiTraining,
    });
  };

  return (
    <div className="bg-gradient-to-b from-slate-900/80 to-slate-950/60 rounded-2xl border border-slate-700/40 p-6 backdrop-blur-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
          🎯 Smart Licensing
        </h3>
        <p className="text-lg font-bold text-white">{title}</p>
        {description && (
          <p className="text-sm text-slate-300 mt-2">{description}</p>
        )}
      </div>

      {/* License Selection Section */}
      <div className="mb-6 p-4 bg-slate-800/30 border border-slate-700/40 rounded-lg">
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-3">
            License Type
          </label>

          {/* Dropdown for License Selection */}
          <div className="relative">
            <button
              onClick={() => setShowLicenseOptions(!showLicenseOptions)}
              className="w-full flex items-center justify-between p-3 bg-slate-900/60 border border-slate-600/40 rounded-lg hover:border-slate-500/60 hover:bg-slate-900/80 transition-all focus:outline-none focus:ring-2 focus:ring-pink-500/50"
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span>{selectedLicenseInfo?.icon}</span>
                  <span className="font-semibold text-white">
                    {selectedLicenseInfo?.name}
                  </span>
                  {selectedLicenseType === recommendedLicenseType && (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      Recommended
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown
                size={18}
                className={`text-slate-400 transition-transform ${
                  showLicenseOptions ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* License Options Dropdown */}
            {showLicenseOptions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-xl z-50 overflow-hidden backdrop-blur-sm">
                {availableLicenses.map((license) => (
                  <button
                    key={license.key}
                    onClick={() => {
                      setSelectedLicenseType(license.key);
                      setShowLicenseOptions(false);
                    }}
                    className={`w-full px-4 py-3 text-left transition-all border-b border-slate-700/20 last:border-b-0 ${
                      selectedLicenseType === license.key
                        ? "bg-pink-500/20 border-l-2 border-l-pink-500"
                        : "hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{license.icon}</span>
                      <span className="font-semibold text-white text-sm">
                        {license.name}
                      </span>
                      {license.key === recommendedLicenseType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 ml-6">
                      {license.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recommendation Reason */}
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-200">
              <span className="font-semibold">Why this license?</span>{" "}
              {recommendationReason}
            </p>
          </div>
        </div>
      </div>

      {/* License Description */}
      {selectedLicenseInfo && (
        <div className="mb-6 p-4 bg-slate-800/20 border border-slate-700/30 rounded-lg">
          <p className="text-sm text-slate-300 leading-relaxed">
            {selectedLicenseInfo.description}
          </p>
        </div>
      )}

      {/* Form Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Minting Fee */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Minting Fee (IP tokens)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={mintingFee}
            onChange={(e) => setMintingFee(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
          />
          <p className="text-xs text-slate-500 mt-1">Leave empty for free</p>
        </div>

        {/* Revenue Share */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Revenue Share (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={revShare}
            onChange={(e) => setRevShare(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/40 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
          />
          <p className="text-xs text-slate-500 mt-1">% of derivative revenue</p>
        </div>
      </div>

      {/* AI Training Checkbox */}
      <div className="mb-6">
        <label className="flex items-center gap-3 p-3 bg-slate-800/20 border border-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-800/30 transition-all">
          <input
            type="checkbox"
            checked={aiTraining}
            onChange={(e) => setAiTraining(e.target.checked)}
            className="w-5 h-5 rounded border-slate-600 bg-slate-900/60 cursor-pointer accent-pink-500"
          />
          <span className="text-sm font-semibold text-slate-200">
            Allow AI Training
          </span>
        </label>
      </div>

      {/* Register Button */}
      <button
        onClick={handleRegister}
        disabled={isLoading}
        className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-pink-500/25"
      >
        {isLoading ? "Registering..." : "Register IP"}
      </button>
    </div>
  );
};
