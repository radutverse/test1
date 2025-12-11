import { formatEther } from "viem";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface License {
  licenseTermsId?: string;
  terms?: {
    derivativesAllowed?: boolean;
    defaultMintingFee?: string | number;
    mintingFee?: string | number;
    [key: string]: any;
  };
  licensingConfig?: {
    mintingFee?: string | number;
    [key: string]: any;
  };
  derivativesAllowed?: boolean;
  [key: string]: any;
}

interface SearchResult {
  ipId?: string;
  title?: string;
  name?: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  ownerAddress?: string;
  isDerivative?: boolean;
  score?: number;
  licenses?: License[];
  [key: string]: any;
}

interface SearchResultsGridProps {
  searchResults: SearchResult[];
  ownerDomains: Record<string, { domain: string | null; loading: boolean }>;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
  getRemixTypes: (
    asset: SearchResult,
  ) => Array<{ type: "paid" | "free"; hasAttribution: boolean }>;
  allowsDerivatives: (asset: SearchResult) => boolean;
  truncateAddressDisplay: (address: string) => string;
  isLoadingOwnerAssets?: boolean;
  onAssetClick?: (asset: SearchResult) => void;
  onOwnerClick?: (ownerAddress: string, ownerDomain?: string | null) => void;
  onRemixSelected?: (
    asset: SearchResult,
    remixType: "paid" | "free",
  ) => Promise<void>;
}

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

export const SearchResultsGrid = ({
  searchResults,
  ownerDomains,
  hoveredIndex,
  setHoveredIndex,
  getRemixTypes,
  allowsDerivatives: _allowsDerivatives,
  truncateAddressDisplay,
  isLoadingOwnerAssets = false,
  onAssetClick,
  onOwnerClick,
  onRemixSelected,
}: SearchResultsGridProps) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full">
      {isLoadingOwnerAssets ? (
        <div className="flex items-center justify-center h-full gap-3">
          <div className="w-4 h-4 rounded-full bg-[#FF4DA6] animate-bounce" />
          <span className="text-slate-400">Loading owner assets...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {searchResults.map((asset, idx) => {
            const remixTypes = getRemixTypes(asset);

            return (
              <div
                key={asset.ipId || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative cursor-pointer rounded-lg overflow-hidden bg-slate-900/30 border border-slate-800/50 transition-all duration-200 hover:border-slate-700/80 aspect-square"
              >
                {/* Image Container */}
                <div
                  className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex items-center justify-center"
                  onClick={() => onAssetClick?.(asset)}
                >
                  {asset.mediaUrl ? (
                    asset.mediaType?.startsWith("video") ? (
                      <div className="w-full h-full relative group/video">
                        <video
                          key={asset.ipId}
                          src={asset.mediaUrl}
                          poster={asset.thumbnailUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          playsInline
                        />
                        {/* Play button overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover/video:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/video:opacity-100">
                          <div className="w-16 h-16 rounded-full bg-[#FF4DA6] flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                            <svg
                              className="w-8 h-8 text-white fill-current ml-1"
                              viewBox="0 0 24 24"
                            >
                              <path d="M3 3v18h18V3H3zm9 14V7l5 5-5 5z" />
                            </svg>
                          </div>
                        </div>
                        {/* Video badge */}
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-white">
                          VIDEO
                        </div>
                      </div>
                    ) : asset.mediaType?.startsWith("audio") ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-purple-900/80 via-purple-800/40 to-slate-900 cursor-pointer hover:scale-102 transition-transform">
                        <svg
                          className="w-14 h-14 text-purple-300 hover:scale-110 transition-transform"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 3v9.28c-.47-.46-1.12-.75-1.84-.75-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                        <span className="text-xs text-purple-200 font-semibold">
                          AUDIO
                        </span>
                      </div>
                    ) : (
                      <img
                        src={asset.mediaUrl}
                        alt={asset.title || asset.name || "IP Asset"}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        onClick={() => onAssetClick?.(asset)}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const parent = img.parentElement;
                          if (parent && parent.querySelector("img") === img) {
                            img.replaceWith(
                              Object.assign(document.createElement("div"), {
                                className:
                                  "w-full h-full flex flex-col items-center justify-center p-4 text-slate-300 bg-gradient-to-br from-slate-800/80 to-slate-900 relative group/fallback",
                                innerHTML: `
                                <div class="absolute inset-0 opacity-5">
                                  <div class="absolute inset-0 bg-gradient-to-br from-[#FF4DA6] to-transparent"></div>
                                </div>
                                <div class="relative z-10 w-full h-full flex flex-col items-center justify-center gap-3">
                                  <svg class="w-10 h-10 text-slate-500 group-hover/fallback:text-[#FF4DA6] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                  </svg>
                                  <div class="text-center space-y-1 flex-1 flex flex-col justify-center">
                                    <p class="text-xs font-semibold text-slate-200">Image failed to load</p>
                                    <p class="text-[0.65rem] text-slate-400">Try viewing full details</p>
                                  </div>
                                </div>
                              `,
                              }),
                            );
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-300 bg-gradient-to-br from-slate-800/80 to-slate-900 relative group/fallback">
                      {/* Background pattern */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#FF4DA6] to-transparent" />
                      </div>

                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-3">
                        {/* Icon */}
                        <svg
                          className="w-10 h-10 text-slate-500 group-hover/fallback:text-[#FF4DA6] transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="m4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>

                        {/* Title for missing image */}
                        <div className="text-center space-y-1 flex-1 flex flex-col justify-center">
                          <h4 className="text-xs font-bold text-slate-200 line-clamp-2">
                            {asset.title || asset.name || "Asset"}
                          </h4>
                          <p className="text-[0.65rem] text-slate-400">
                            No media available
                          </p>
                        </div>

                        {/* Media Type */}
                        {asset.mediaType && (
                          <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 font-semibold">
                            {asset.mediaType
                              .replace("video/", "")
                              .replace("audio/", "")
                              .replace("image/", "")
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {hoveredIndex === idx && (
                    <div className="absolute inset-0 ring-2 ring-[#FF4DA6]/60 rounded-lg pointer-events-none" />
                  )}

                  {/* Remix Button - Top Left */}
                  {remixTypes.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={
                        isMobile || hoveredIndex === idx
                          ? { opacity: 1, scale: 1, y: 0 }
                          : { opacity: 0, scale: 0.8, y: -10 }
                      }
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (remixTypes.length > 0) {
                          await onRemixSelected?.(asset, remixTypes[0].type);
                        }
                      }}
                      type="button"
                      className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg backdrop-blur-sm bg-[#FF4DA6] hover:bg-[#FF4DA6]/90 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-xl"
                    >
                      <span>🔄</span>
                      <span>Remix</span>
                    </motion.button>
                  )}

                  {/* Price Badge - Top Right */}
                  {remixTypes.length > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-sm bg-slate-900/90 border border-[#FF4DA6]/30">
                      <img
                        src="https://cdn.builder.io/api/v1/image/assets%2F2ccefb7d92b64b29890872bc60894d35%2F87d2bf0310994d4a979324a490ed5a6b?format=webp&width=32"
                        alt="IP Token"
                        className="w-3 h-3 flex-shrink-0"
                      />
                      <span className="text-[0.65rem] font-semibold text-[#FF4DA6] whitespace-nowrap">
                        {extractRemixPrice(asset)
                          ? `$${extractRemixPrice(asset)} IP`
                          : "FREE"}
                      </span>
                    </div>
                  )}

                  {/* Title - Bottom Left Corner */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent p-2 sm:p-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-100 line-clamp-2 group-hover:text-[#FF4DA6] transition-colors duration-200">
                      {asset.title || asset.name || "Untitled Asset"}
                    </h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
