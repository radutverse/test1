import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import { useRemixTypes } from "./hooks";
import { AssetLifecycleInfographic } from "./AssetLifecycleInfographic";
import type { SearchResult } from "./types";

function extractMintingFee(license: any): string {
  if (!license) return "0";

  let mintingFee = 0;

  // Try multiple field names for minting fee
  if (license.licensingConfig?.mintingFee) {
    mintingFee = Number(license.licensingConfig.mintingFee);
  } else if (license.terms?.defaultMintingFee) {
    mintingFee = Number(license.terms.defaultMintingFee);
  } else if (license.terms?.mintingFee) {
    mintingFee = Number(license.terms.mintingFee);
  }

  // Convert from wei to ether (assuming fee is in wei with 18 decimals)
  if (mintingFee > 0) {
    return formatEther(BigInt(mintingFee));
  }

  return "0";
}

function extractRemixPrice(asset: SearchResult): string | null {
  if (!asset.licenses || asset.licenses.length === 0) return null;

  for (const license of asset.licenses) {
    const mintingFee = extractMintingFee(license);
    if (mintingFee !== "0") {
      return mintingFee;
    }
  }
  return null;
}

interface ExpandedAssetModalProps {
  asset: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onShowDetails?: () => void;
  onRemix?: () => void;
  onRemixMenu?: () => void;
  onRemixSelected?: (remixType: "paid" | "free") => Promise<void>;
}

export const ExpandedAssetModal = ({
  asset,
  onClose,
  onShowDetails,
  onRemixMenu,
  onRemixSelected,
}: ExpandedAssetModalProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const getRemixTypes = useRemixTypes();

  // Debug logging
  React.useEffect(() => {
    console.log("📋 ExpandedAssetModal rendered with asset:", {
      ipId: asset?.ipId,
      title: asset?.title,
      hasMediaUrl: !!asset?.mediaUrl,
      hasThumbnailUrl: !!asset?.thumbnailUrl,
      hasRemixSelected: !!onRemixSelected,
    });
  }, [asset, onRemixSelected]);

  // Early return when asset is null (but not when isOpen is false - let AnimatePresence handle the exit animation)
  if (!asset) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-4xl bg-gradient-to-b from-slate-950/98 to-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-800/60 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-slate-950/60 to-slate-900/40 backdrop-blur-xl border-b border-slate-800/40 px-6 py-5 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-50 line-clamp-2 tracking-tight">
              {asset.title || asset.name || "Untitled Asset"}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const container = mediaContainerRef.current;
                if (!container) return;

                if (!isFullscreen) {
                  if (container.requestFullscreen) {
                    container.requestFullscreen().catch((err) => {
                      console.warn(
                        "[ExpandedAssetModal] Fullscreen request failed:",
                        err,
                      );
                    });
                  } else if ((container as any).webkitRequestFullscreen) {
                    (container as any).webkitRequestFullscreen();
                  } else if ((container as any).mozRequestFullScreen) {
                    (container as any).mozRequestFullScreen();
                  } else if ((container as any).msRequestFullscreen) {
                    (container as any).msRequestFullscreen();
                  }
                  setIsFullscreen(true);
                } else {
                  if (document.fullscreenElement) {
                    if (document.exitFullscreen) {
                      document.exitFullscreen().catch((err) => {
                        console.warn(
                          "[ExpandedAssetModal] Fullscreen exit failed:",
                          err,
                        );
                      });
                    } else if ((document as any).webkitExitFullscreen) {
                      (document as any).webkitExitFullscreen();
                    } else if ((document as any).mozCancelFullScreen) {
                      (document as any).mozCancelFullScreen();
                    } else if ((document as any).msExitFullscreen) {
                      (document as any).msExitFullscreen();
                    }
                  }
                  setIsFullscreen(false);
                }
              }}
              className="flex-shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-[#FF4DA6]/20 hover:text-[#FF4DA6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4DA6]/30"
              aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            >
              {isFullscreen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 6h12v12H6z M3 3h8v8H3z M13 13h8v8h-8z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4m-4 0l5 5m11-5v4m0-4h-4m4 0l-5 5M4 20v-4m0 4h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-[#FF4DA6]/20 hover:text-[#FF4DA6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4DA6]/30"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div
          ref={mediaContainerRef}
          className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950/50 min-h-0 overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="w-full max-w-full aspect-video flex items-center justify-center bg-black/40 rounded-lg"
          >
            {asset.mediaType?.startsWith("video") ? (
              <div className="w-full h-full flex items-center justify-center">
                <video
                  src={asset.mediaUrl}
                  poster={asset.thumbnailUrl}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              </div>
            ) : asset.mediaType?.startsWith("audio") ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6 py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="flex-shrink-0"
                >
                  <svg
                    className="w-24 h-24 text-[#FF4DA6]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3v9.28c-.47-.46-1.12-.75-1.84-.75-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </motion.div>
                <div className="w-full max-w-md">
                  <audio src={asset.mediaUrl} controls className="w-full" />
                </div>
              </div>
            ) : (
              <img
                src={asset.mediaUrl}
                alt={asset.title || asset.name || "IP Asset"}
                className="w-full h-full object-contain"
              />
            )}
          </motion.div>
        </div>

        {/* Footer with Details and Actions */}
        <div className="border-t border-slate-800/40 bg-gradient-to-t from-slate-950/60 to-slate-900/30 backdrop-blur-xl px-6 py-6 sm:py-8 space-y-6 flex-shrink-0">
          {asset.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-slate-300 leading-relaxed font-light"
            >
              {asset.description}
            </motion.p>
          )}

          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-2.5">
            <motion.span
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-xs px-4 py-2.5 rounded-full font-semibold whitespace-nowrap backdrop-blur-sm border transition-all ${
                asset.isDerivative
                  ? "bg-blue-500/25 text-blue-200 border-blue-500/40 hover:bg-blue-500/35"
                  : "bg-emerald-500/25 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/35"
              }`}
            >
              {asset.isDerivative ? "🔄 Remix" : "✨ Original"}
            </motion.span>

            {asset.score !== undefined && (
              <motion.span
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xs px-4 py-2.5 rounded-full bg-[#FF4DA6]/25 text-[#FF4DA6] border border-[#FF4DA6]/40 font-semibold whitespace-nowrap backdrop-blur-sm hover:bg-[#FF4DA6]/35 transition-all"
              >
                {(asset.score * 100).toFixed(0)}% Match
              </motion.span>
            )}

            {asset.mediaType && (
              <motion.span
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xs px-4 py-2.5 rounded-full bg-slate-800/50 text-slate-300 border border-slate-700/60 font-semibold whitespace-nowrap backdrop-blur-sm hover:bg-slate-800/70 transition-all"
              >
                {asset.mediaType
                  ?.replace("video/", "")
                  .replace("audio/", "")
                  .replace("image/", "")
                  .toUpperCase() || "Media"}
              </motion.span>
            )}

            {asset.ownerAddress && (
              <motion.span
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-xs px-4 py-2.5 rounded-full bg-slate-800/50 text-slate-300 border border-slate-700/60 font-mono whitespace-nowrap backdrop-blur-sm hover:bg-slate-800/70 transition-all"
              >
                {asset.ownerAddress.slice(0, 8)}...
                {asset.ownerAddress.slice(-6)}
              </motion.span>
            )}
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            className="flex justify-center pt-2"
          >
            <button
              type="button"
              onClick={() => setShowLifecycle(true)}
              className="text-sm px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-500/40 to-purple-600/40 text-purple-100 border border-purple-500/50 font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/50 hover:from-purple-500/60 hover:to-purple-600/60 hover:border-purple-500/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 active:scale-95"
            >
              🔄 View Lifecycle
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Asset Lifecycle Infographic Modal */}
      <AssetLifecycleInfographic
        asset={asset}
        isOpen={showLifecycle}
        onClose={() => setShowLifecycle(false)}
      />
    </motion.div>
  );
};
