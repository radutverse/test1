import React, { useState } from "react";
import { type ClassificationResult } from "@shared/image-analysis";
import {
  ChevronDown,
  Brain,
  Shield,
  Palette,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { ANSWER_DETAILS } from "@/lib/ip-assistant/answer-details";

interface ResultDisplayProps {
  result: ClassificationResult | null;
  isLoading: boolean;
  error: string | null;
  imageUrl?: string;
  onReset?: () => void;
  onRegister?: (ctxKey: string) => Promise<void>;
  ctxKey?: string;
}

const AnalysisSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/30 focus:outline-none transition-all duration-200 group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="group-hover:scale-110 transition-transform duration-200">
            {icon}
          </span>
          <span className="font-semibold text-gray-200 text-sm group-hover:text-white transition-colors duration-200">
            {title}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-300 group-hover:text-gray-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 bg-gray-800/10 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const AIGenerationAnalysis: React.FC<{
  analysis: ClassificationResult["flags"]["ai_generation_analysis"];
}> = ({ analysis }) => {
  const likelihoodColors: Record<string, string> = {
    High: "bg-red-600/80 text-white",
    Medium: "bg-yellow-600/80 text-gray-900",
    Low: "bg-cyan-500/80 text-white",
    Unlikely: "bg-emerald-500/80 text-white",
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-300">AI Probability</span>
        <span
          className={`px-4 py-1.5 text-xs font-bold rounded-full ${
            likelihoodColors[analysis.likelihood] || "bg-gray-600"
          } transition-all duration-200 hover:scale-105`}
        >
          {analysis.likelihood}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Confidence Level</span>
          <span className="font-mono text-white font-semibold">
            {(analysis.confidence_score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-500 bg-pink-400"
            style={{ width: `${analysis.confidence_score * 100}%` }}
          />
        </div>
      </div>
      {analysis.evidence.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/20">
          <h6 className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wide">
            🔍 Visual Evidence
          </h6>
          <ul className="space-y-2">
            {analysis.evidence.slice(0, 4).map((item, index) => (
              <li
                key={index}
                className="text-xs text-gray-300 flex items-start gap-2.5 p-2"
              >
                <span className="text-yellow-400 mt-0.5 text-sm flex-shrink-0">
                  ✨
                </span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const DetailItem: React.FC<{
  label: string;
  value: string | boolean | string[];
}> = ({ label, value }) => {
  let displayValue: React.ReactNode;

  if (typeof value === "boolean") {
    displayValue = (
      <span
        className={`font-semibold text-xs px-2 py-1 rounded-md ${
          value
            ? "text-green-300 bg-green-600/20"
            : "text-red-300 bg-red-600/20"
        }`}
      >
        {value ? "✓ Yes" : "✗ No"}
      </span>
    );
  } else if (Array.isArray(value)) {
    displayValue = (
      <div className="flex flex-wrap gap-1.5">
        {value.slice(0, 5).map((item, index) => (
          <span
            key={index}
            className="px-2.5 py-1 text-xs bg-gray-700 rounded-full"
          >
            {item}
          </span>
        ))}
      </div>
    );
  } else {
    displayValue = (
      <span className="text-gray-300 text-xs font-medium text-right">
        {value}
      </span>
    );
  }

  return (
    <div className="flex items-start justify-between py-2.5 px-2">
      <span className="text-gray-400 text-xs font-medium">{label}</span>
      <div className="text-right max-w-[55%]">{displayValue}</div>
    </div>
  );
};

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  isLoading,
  error,
  imageUrl,
  onReset,
  onRegister,
  ctxKey,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-800/40 rounded-lg p-8 backdrop-blur-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
          <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-semibold text-gray-200 text-sm">
          🔬 Performing Deep Analysis...
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Classifying content, style, and IP risks
        </p>
      </div>
    );
  }

  if (error && !result) {
    return null;
  }

  if (!result) {
    return null;
  }

  const { flags, classification, license } = result;

  const statusIcons: Record<string, React.ReactNode> = {
    CAN_REGISTER: (
      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-lg font-bold">
        ✓
      </div>
    ),
    CANNOT_REGISTER: (
      <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400 text-lg font-bold">
        ✕
      </div>
    ),
    REQUIRES_REVIEW: (
      <div className="w-7 h-7 rounded-full bg-pink-600/20 border border-pink-500/50 flex items-center justify-center text-pink-400 text-lg font-bold">
        !
      </div>
    ),
  };

  const buttonClasses: Record<string, string> = {
    green:
      "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors duration-200 font-semibold",
    red: "bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors duration-200 font-semibold",
    yellow:
      "bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white transition-colors duration-200 font-semibold",
  };

  const licenseBgClasses: Record<string, string> = {
    green: "bg-emerald-900/20 border border-emerald-700/30",
    red: "bg-red-900/20 border border-red-700/30",
    yellow: "bg-pink-900/20 border border-pink-700/30",
  };

  const licenseTitleClasses: Record<string, string> = {
    green: "text-emerald-300",
    red: "text-red-300",
    yellow: "text-pink-300",
  };

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        {/* Left side: Image */}
        {imageUrl && (
          <div className="lg:w-1/3 flex-shrink-0">
            <div className="bg-gray-900/40 rounded-lg p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-pink-400" />
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                  Uploaded Image
                </h4>
              </div>
              <img
                src={imageUrl}
                alt="Uploaded"
                className="w-full h-auto rounded-md object-cover"
              />

              {/* Final Conclusion below image */}
              <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2">
                {/* Registration Status - Main conclusion */}
                {(() => {
                  const groupStr = String(classification.group);
                  const details = ANSWER_DETAILS[groupStr];
                  const statusMessage =
                    details?.registrationStatus || license.buttonText;
                  const isCanRegister = license.status === "CAN_REGISTER";

                  return (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-400">
                        Final Status
                      </span>
                      <p
                        className={`text-xs font-semibold leading-tight ${
                          statusMessage?.includes("✅")
                            ? "text-emerald-300"
                            : statusMessage?.includes("❌")
                              ? "text-red-300"
                              : "text-yellow-300"
                        }`}
                      >
                        {statusMessage}
                      </p>
                    </div>
                  );
                })()}

                {/* Reason/Notes */}
                {(() => {
                  const groupStr = String(classification.group);
                  const details = ANSWER_DETAILS[groupStr];
                  const notes = details?.notes;

                  return notes ? (
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="text-gray-400">Reason</span>
                      <p className="text-gray-300 leading-tight">{notes}</p>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Right side: Analysis Results */}
        <div
          className={`flex-1 flex flex-col ${imageUrl ? "lg:w-2/3" : "w-full"}`}
        >
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-1 text-white">
              Analysis Result
            </h3>
            {classification.group !== 15 && (
              <p className="text-gray-400 text-xs">
                Group{" "}
                <span className="font-bold text-white">
                  {classification.group}
                </span>{" "}
                • <span className="text-white/80">{classification.type}</span>
              </p>
            )}
          </div>

          <div className="rounded-lg bg-gray-800/30 overflow-hidden text-xs max-h-72 overflow-y-auto">
            <AnalysisSection
              title="AI Generation Analysis"
              icon={<Brain className="w-5 h-5 text-pink-400" />}
              defaultOpen={true}
            >
              <AIGenerationAnalysis analysis={flags.ai_generation_analysis} />
            </AnalysisSection>

            <AnalysisSection
              title="Content & Safety Analysis"
              icon={<Shield className="w-5 h-5 text-pink-400" />}
            >
              <DetailItem
                label="Explicit Content"
                value={flags.content_analysis.contains_explicit_content}
              />
              <DetailItem
                label="Violence"
                value={flags.content_analysis.contains_violence}
              />
              <DetailItem
                label="Sensitive Subject"
                value={flags.content_analysis.contains_sensitive_subject}
              />
              {flags.content_analysis.description && (
                <DetailItem
                  label="Notes"
                  value={flags.content_analysis.description}
                />
              )}
            </AnalysisSection>

            <AnalysisSection
              title="Composition & Style"
              icon={<Palette className="w-5 h-5 text-pink-400" />}
            >
              <DetailItem
                label="Artistic Style"
                value={flags.composition_analysis.style}
              />
              <DetailItem
                label="Perspective"
                value={flags.composition_analysis.perspective}
              />
              <DetailItem
                label="Dominant Colors"
                value={flags.composition_analysis.dominant_colors.map((c) =>
                  c.toUpperCase(),
                )}
              />
            </AnalysisSection>

            <AnalysisSection
              title="Object & Text Detection"
              icon={<Eye className="w-5 h-5 text-pink-400" />}
            >
              <DetailItem
                label="Main Objects"
                value={
                  flags.object_detection.main_objects.join(", ") ||
                  "None detected"
                }
              />
              <DetailItem
                label="Detected Text"
                value={flags.text_detection.detected_text || "None"}
              />
            </AnalysisSection>
          </div>

          <div className="mt-4">
            <button
              onClick={() => {
                if (onRegister && ctxKey && license.status === "CAN_REGISTER") {
                  void onRegister(ctxKey);
                }
              }}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white text-xs transition-all duration-200 ${
                buttonClasses[license.color] || "bg-gray-600"
              }`}
              disabled={license.status !== "CAN_REGISTER" || !onRegister}
            >
              {license.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
