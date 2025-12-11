import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader } from "lucide-react";
import { SearchResultsGrid, ExpandedAssetModal } from "@/components/ip/search";
import { CategoryBrowser } from "./CategoryBrowser";
import { FeaturedCatalog } from "./FeaturedCatalog";
import type { PopularItem, SearchResult } from "@/components/ip/remix/types";
import { determineLicenseType } from "@/lib/license/license-types";

interface PopularIPGridProps {
  onBack: () => void;
  onRemixSelected?: (
    asset: SearchResult,
    remixType: "paid" | "free",
  ) => Promise<void>;
  onAssetExpanded?: (asset: SearchResult) => void;
}

const DUMMY_DATA: Record<"ip" | "image" | "video" | "music", PopularItem[]> = {
  ip: [
    {
      id: "ippy-bg",
      title: "Ippy Background",
      owner: "Radut",
      preview:
        "https://cdn.builder.io/api/v1/image/assets%2F8b47a9dc49544656b302208a3bdb367f%2Fd8e8f3b606f0478d8702eb646bd205fa?format=webp&width=800",
    },
  ],
  image: [
    {
      id: "i1",
      title: "Landscape Photography",
      owner: "0x123456789abcdef123456789abcdef1234567890",
      preview:
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop",
    },
    {
      id: "i2",
      title: "Urban Exploration",
      owner: "0xfedcba9876543210fedcba9876543210fedcba98",
      preview:
        "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&h=200&fit=crop",
    },
    {
      id: "i3",
      title: "Nature's Beauty",
      owner: "0xabcd1234abcd1234abcd1234abcd1234abcd1234",
      preview:
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop",
    },
    {
      id: "i4",
      title: "Street Art",
      owner: "0x4567890123456789abcdef0123456789abcdef01",
      preview:
        "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=300&h=200&fit=crop",
    },
    {
      id: "i5",
      title: "Macro Photography",
      owner: "0x89abcdef89abcdef89abcdef89abcdef89abcdef",
      preview:
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=300&h=200&fit=crop",
    },
    {
      id: "i6",
      title: "Golden Hour",
      owner: "0xdef123def123def123def123def123def123def1",
      preview:
        "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=300&h=200&fit=crop",
    },
  ],
  video: [
    {
      id: "v1",
      title: "Motion Graphics Demo",
      owner: "0x111111111111111111111111111111111111111111",
      preview:
        "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300&h=200&fit=crop",
    },
    {
      id: "v2",
      title: "Cinematic Footage",
      owner: "0x222222222222222222222222222222222222222222",
      preview:
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=200&fit=crop",
    },
    {
      id: "v3",
      title: "4K Drone Video",
      owner: "0x333333333333333333333333333333333333333333",
      preview:
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&h=200&fit=crop",
    },
    {
      id: "v4",
      title: "Animation Reel",
      owner: "0x444444444444444444444444444444444444444444",
      preview:
        "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=300&h=200&fit=crop",
    },
    {
      id: "v5",
      title: "Music Video",
      owner: "0x555555555555555555555555555555555555555555",
      preview:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop",
    },
    {
      id: "v6",
      title: "Documentary Style",
      owner: "0x666666666666666666666666666666666666666666",
      preview:
        "https://images.unsplash.com/photo-1606986628025-35d57e735ae0?w=300&h=200&fit=crop",
    },
  ],
  music: [
    {
      id: "m1",
      title: "Ambient Soundscape",
      owner: "0x777777777777777777777777777777777777777777",
      preview:
        "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=200&fit=crop",
    },
    {
      id: "m2",
      title: "Electronic Beat",
      owner: "0x888888888888888888888888888888888888888888",
      preview:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=200&fit=crop",
    },
    {
      id: "m3",
      title: "Jazz Fusion",
      owner: "0x999999999999999999999999999999999999999999",
      preview:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop",
    },
    {
      id: "m4",
      title: "Classical Composition",
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      preview:
        "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=200&fit=crop",
    },
    {
      id: "m5",
      title: "Hip Hop Track",
      owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      preview:
        "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=200&fit=crop",
    },
    {
      id: "m6",
      title: "Pop Melody",
      owner: "0xcccccccccccccccccccccccccccccccccccccccccc",
      preview:
        "https://images.unsplash.com/photo-1513320291840-2e0a9bf2a9ae?w=300&h=200&fit=crop",
    },
  ],
};

export const PopularIPGrid = ({
  onRemixSelected,
  onAssetExpanded,
}: PopularIPGridProps) => {
  const [activeCategory, setActiveCategory] = useState<
    "ip" | "image" | "video" | "music"
  >("ip");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastQueryType, setLastQueryType] = useState<
    "keyword" | "owner" | null
  >(null);
  const [lastResolvedAddress, setLastResolvedAddress] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [ownerDomains, setOwnerDomains] = useState<
    Record<string, { domain: string | null; loading: boolean }>
  >({});
  const [expandedAsset, setExpandedAsset] = useState<SearchResult | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const domainFetchControllerRef = useRef<AbortController | null>(null);

  const ITEMS_PER_PAGE = 20;

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isIpName = (query: string): boolean => {
    const ipNameRegex = /([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.ip)$/i;
    return ipNameRegex.test(query);
  };

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setCurrentOffset(0);
    setHasMore(false);

    try {
      // Check if input is .ip name
      if (isIpName(searchInput)) {
        console.log(
          "[PopularIPGrid] Detected .ip name, resolving:",
          searchInput,
        );

        // First resolve the .ip name to address
        const resolveResponse = await fetch("/api/resolve-ip-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ipName: searchInput }),
        });

        if (!resolveResponse.ok) {
          const resolveData = await resolveResponse.json();
          console.error("Failed to resolve .ip name:", resolveData);
          setIsSearching(false);
          return;
        }

        const resolveData = await resolveResponse.json();
        const resolvedAddress = resolveData.address;

        setLastResolvedAddress(resolvedAddress);
        setLastQueryType("owner");

        // Search by owner - fetch with pagination
        const searchResponse = await fetch("/api/search-by-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress: resolvedAddress }),
        });

        if (!searchResponse.ok) {
          throw new Error("Search by owner failed");
        }

        const searchData = await searchResponse.json();
        const results = searchData.results || [];

        setSearchResults(results.slice(0, ITEMS_PER_PAGE));
        setCurrentOffset(ITEMS_PER_PAGE);
        setHasMore(results.length > ITEMS_PER_PAGE);
      } else {
        // Regular keyword search - fetch with pagination
        const response = await fetch("/api/search-ip-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchInput,
            pagination: {
              limit: ITEMS_PER_PAGE,
              offset: 0,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        const results = data.results || [];

        setSearchResults(results);
        setCurrentOffset(ITEMS_PER_PAGE);
        setHasMore(
          data.pagination?.hasMore || results.length >= ITEMS_PER_PAGE,
        );
        setLastQueryType("keyword");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  }, [searchInput]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);

    try {
      if (lastQueryType === "owner") {
        // For owner search, fetch more results
        const searchResponse = await fetch("/api/search-by-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress: lastResolvedAddress }),
        });

        if (!searchResponse.ok) {
          throw new Error("Search by owner failed");
        }

        const searchData = await searchResponse.json();
        const allResults = searchData.results || [];
        const newResults = allResults.slice(
          currentOffset,
          currentOffset + ITEMS_PER_PAGE,
        );

        setSearchResults((prev) => [...prev, ...newResults]);
        setCurrentOffset(currentOffset + ITEMS_PER_PAGE);
        setHasMore(currentOffset + ITEMS_PER_PAGE < allResults.length);
      } else {
        // For keyword search, fetch next page
        const response = await fetch("/api/search-ip-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchInput,
            pagination: {
              limit: ITEMS_PER_PAGE,
              offset: currentOffset,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        const newResults = data.results || [];

        setSearchResults((prev) => [...prev, ...newResults]);
        setCurrentOffset(currentOffset + ITEMS_PER_PAGE);
        setHasMore(data.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset, searchInput, lastQueryType, lastResolvedAddress]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);

      // Clear search results when input is cleared
      if (!value.trim()) {
        setSearchResults([]);
        setHasSearched(false);
      }
    },
    [],
  );

  // Get unique owner addresses to fetch domains for
  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    searchResults.forEach((asset) => {
      if (asset.ownerAddress) {
        owners.add(asset.ownerAddress.toLowerCase());
      }
    });
    return Array.from(owners);
  }, [searchResults]);

  // Fetch domains for all owners when results change
  useEffect(() => {
    if (uniqueOwners.length === 0) {
      return;
    }

    // Cancel previous domain fetch if still in progress
    if (domainFetchControllerRef.current) {
      domainFetchControllerRef.current.abort();
    }
    domainFetchControllerRef.current = new AbortController();

    // Mark all owners as loading
    const loadingState: Record<
      string,
      { domain: string | null; loading: boolean }
    > = {};
    uniqueOwners.forEach((owner) => {
      loadingState[owner] = { domain: null, loading: true };
    });
    setOwnerDomains(loadingState);

    // Fetch domains for all owners in parallel
    Promise.all(
      uniqueOwners.map((owner) => {
        return fetch("/api/resolve-owner-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress: owner }),
          signal: domainFetchControllerRef.current?.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            return {
              address: owner,
              domain: data.ok ? data.domain : null,
            };
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error("Error fetching domain:", err);
            }
            return {
              address: owner,
              domain: null,
            };
          });
      }),
    )
      .then((results) => {
        const newDomains: Record<
          string,
          { domain: string | null; loading: boolean }
        > = {};
        results.forEach(({ address, domain }) => {
          newDomains[address] = { domain, loading: false };
        });
        setOwnerDomains(newDomains);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching domains:", err);
        }
      });

    return () => {
      if (domainFetchControllerRef.current) {
        domainFetchControllerRef.current.abort();
      }
    };
  }, [uniqueOwners]);

  const truncateAddressDisplay = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const allowsDerivatives = (asset: SearchResult): boolean => {
    if (!asset.licenses || asset.licenses.length === 0) {
      return false;
    }
    return asset.licenses.some(
      (license: any) =>
        license.terms?.derivativesAllowed === true ||
        license.derivativesAllowed === true,
    );
  };

  // Get remix types based on licenses (paid/free)
  type RemixTypeInfo = { type: "paid" | "free"; hasAttribution: boolean };
  const getRemixTypes = (asset: SearchResult): RemixTypeInfo[] => {
    if (!asset.licenses || asset.licenses.length === 0) {
      return [];
    }

    const remixTypesMap = new Map<
      "paid" | "free",
      { hasAttribution: boolean }
    >();

    for (const license of asset.licenses) {
      const terms = license.terms || license;
      const derivativesAllowed =
        terms?.derivativesAllowed === true ||
        license.derivativesAllowed === true;

      if (!derivativesAllowed) continue;

      const commercialUse = terms?.commercialUse === true;
      const remixType: "paid" | "free" = commercialUse ? "paid" : "free";

      // Check if this license has derivativesAttribution
      const derivativesAttribution =
        terms?.derivativesAttribution === true ||
        license.derivativesAttribution === true;

      // Update map - set hasAttribution to true if any license of this type requires attribution
      if (!remixTypesMap.has(remixType)) {
        remixTypesMap.set(remixType, {
          hasAttribution: derivativesAttribution,
        });
      } else {
        const existing = remixTypesMap.get(remixType)!;
        existing.hasAttribution =
          existing.hasAttribution || derivativesAttribution;
      }
    }

    return Array.from(remixTypesMap.entries()).map(([type, info]) => ({
      type,
      hasAttribution: info.hasAttribution,
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Browse & Remix</h2>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center justify-between">
        <CategoryBrowser
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        <div className="relative flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="px-4 py-2 pr-10 rounded-lg bg-slate-800 text-white placeholder:text-slate-400 border border-slate-700 focus:border-[#FF4DA6] focus:outline-none transition-colors flex-1"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 rounded-lg bg-[#FF4DA6] text-white font-semibold hover:bg-[#FF4DA6]/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </div>

      {hasSearched ? (
        <div className="w-full flex-1 overflow-y-auto">
          {searchResults.length > 0 ? (
            <>
              <SearchResultsGrid
                searchResults={searchResults}
                ownerDomains={ownerDomains}
                hoveredIndex={hoveredIndex}
                setHoveredIndex={setHoveredIndex}
                getRemixTypes={getRemixTypes}
                allowsDerivatives={allowsDerivatives}
                truncateAddressDisplay={truncateAddressDisplay}
                isLoadingOwnerAssets={false}
                onAssetClick={(asset) => {
                  setExpandedAsset(asset);
                  onAssetExpanded?.(asset);
                }}
                onOwnerClick={() => {}}
              />

              {hasMore && (
                <div className="flex justify-center pt-8 pb-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="text-sm text-[#FF4DA6] hover:text-[#FF4DA6]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Load more</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-slate-500 mb-3" />
              <p className="text-slate-300 text-sm">No results found</p>
              <p className="text-slate-500 text-xs mt-1">
                Try searching with different keywords
              </p>
            </div>
          )}
        </div>
      ) : activeCategory === "ip" ? (
        <FeaturedCatalog />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
          {DUMMY_DATA[activeCategory].map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="group cursor-pointer rounded-lg overflow-hidden bg-slate-800 hover:bg-slate-700 transition-colors duration-200"
            >
              <div className="relative overflow-hidden h-24">
                <img
                  src={item.preview}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-2">
                <h3 className="font-semibold text-white mb-1 line-clamp-2 text-xs">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {truncateAddress(item.owner)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Expanded Asset Details Modal */}
      <AnimatePresence>
        {expandedAsset && (
          <ExpandedAssetModal
            asset={expandedAsset}
            isOpen={true}
            onClose={() => setExpandedAsset(null)}
            onShowDetails={() => {
              setShowDetailsModal(true);
            }}
            onRemixSelected={async (remixType) => {
              if (onRemixSelected) {
                try {
                  await onRemixSelected(expandedAsset, remixType);
                } catch (error) {
                  console.error("Error handling remix selection:", error);
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && expandedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
              onClick={() => setShowDetailsModal(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-lg bg-slate-950/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/50 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/30 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-100">
                  IP Asset Details
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-[#FF4DA6]/20 hover:text-[#FF4DA6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4DA6]/30"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
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

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  {expandedAsset.ipId && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        IP ID
                      </label>
                      <p className="text-sm text-slate-200 font-mono mt-2 break-all bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                        {expandedAsset.ipId}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800/30">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Asset Information
                    </label>
                    <div className="mt-4 space-y-3">
                      {expandedAsset.title && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            Title
                          </div>
                          <p className="text-sm text-slate-200">
                            {expandedAsset.title}
                          </p>
                        </div>
                      )}

                      {expandedAsset.ownerAddress && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            Owner Address
                          </div>
                          <p className="text-sm text-slate-200 font-mono break-all">
                            {expandedAsset.ownerAddress}
                          </p>
                        </div>
                      )}

                      {expandedAsset.mediaType && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            Media Type
                          </div>
                          <p className="text-sm text-slate-200">
                            {expandedAsset.mediaType
                              ?.replace("video/", "")
                              .replace("audio/", "")
                              .replace("image/", "")
                              .toUpperCase() || "Unknown"}
                          </p>
                        </div>
                      )}

                      {expandedAsset.score !== undefined && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            Match Score
                          </div>
                          <p className="text-sm text-slate-200">
                            {(expandedAsset.score * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {expandedAsset.licenses &&
                    expandedAsset.licenses.length > 0 && (
                      <div className="pt-4 border-t border-slate-800/30">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          Licenses
                        </label>
                        <div className="mt-4 space-y-3">
                          {expandedAsset.licenses.map(
                            (license: any, index: number) => (
                              <div
                                key={index}
                                className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4 space-y-3"
                              >
                                {license.templateName && (
                                  <div>
                                    <div className="text-xs text-slate-400 mb-1">
                                      Template Name
                                    </div>
                                    <p className="text-sm text-slate-200 font-semibold">
                                      {license.templateName}
                                    </p>
                                  </div>
                                )}

                                {(() => {
                                  const licenseType =
                                    determineLicenseType(license);
                                  return licenseType ? (
                                    <div>
                                      <div className="text-xs text-slate-400 mb-1">
                                        License Type
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-sm text-slate-200 font-semibold flex items-center gap-2">
                                          <span>{licenseType.icon}</span>
                                          {licenseType.name}
                                        </p>
                                        <p className="text-xs text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-700/30">
                                          {licenseType.description}
                                        </p>
                                      </div>
                                    </div>
                                  ) : null;
                                })()}

                                {license.licenseTermsId && (
                                  <div>
                                    <div className="text-xs text-slate-400 mb-1">
                                      License Terms ID
                                    </div>
                                    <p className="text-xs text-slate-300 font-mono break-all">
                                      {license.licenseTermsId}
                                    </p>
                                  </div>
                                )}

                                {license.terms && (
                                  <div className="space-y-2 pt-2 border-t border-slate-700/30">
                                    <div className="text-xs font-semibold text-slate-300 mb-2">
                                      Terms:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {license.terms.commercialUse !==
                                        undefined && (
                                        <div>
                                          <span className="text-slate-400">
                                            Commercial Use:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {license.terms.commercialUse
                                              ? "✓ Allowed"
                                              : "✗ Not Allowed"}
                                          </p>
                                        </div>
                                      )}

                                      {license.terms.derivativesAllowed !==
                                        undefined && (
                                        <div>
                                          <span className="text-slate-400">
                                            Derivatives:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {license.terms.derivativesAllowed
                                              ? "✓ Allowed"
                                              : "�� Not Allowed"}
                                          </p>
                                        </div>
                                      )}

                                      {license.terms.transferable !==
                                        undefined && (
                                        <div>
                                          <span className="text-slate-400">
                                            Transferable:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {license.terms.transferable
                                              ? "✓ Yes"
                                              : "✗ No"}
                                          </p>
                                        </div>
                                      )}

                                      {license.terms.commercialAttribution !==
                                        undefined && (
                                        <div>
                                          <span className="text-slate-400">
                                            Attribution Required:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {license.terms.commercialAttribution
                                              ? "✓ Yes"
                                              : "✗ No"}
                                          </p>
                                        </div>
                                      )}

                                      {license.terms.commercialRevShare !==
                                        undefined && (
                                        <div>
                                          <span className="text-slate-400">
                                            Rev Share:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {(
                                              Number(
                                                license.terms
                                                  .commercialRevShare,
                                              ) / 1000000
                                            ).toFixed(2)}
                                            %
                                          </p>
                                        </div>
                                      )}

                                      {(() => {
                                        const feeValue =
                                          license.licensingConfig?.mintingFee ||
                                          license.terms?.defaultMintingFee;
                                        return feeValue !== undefined &&
                                          feeValue !== null ? (
                                          <div>
                                            <span className="text-slate-400">
                                              Minting Fee:
                                            </span>
                                            <p className="text-slate-200 font-semibold">
                                              {(() => {
                                                const fee =
                                                  Number(feeValue) / 1e18;
                                                return fee > 0
                                                  ? fee.toFixed(6) + " tokens"
                                                  : "Free";
                                              })()}
                                            </p>
                                          </div>
                                        ) : null;
                                      })()}

                                      {license.terms.currency && (
                                        <div>
                                          <span className="text-slate-400">
                                            Currency:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {license.terms.currency}
                                          </p>
                                        </div>
                                      )}

                                      {license.terms.expiration && (
                                        <div>
                                          <span className="text-slate-400">
                                            Expiration:
                                          </span>
                                          <p className="text-slate-200 font-semibold">
                                            {(() => {
                                              const exp = new Date(
                                                license.terms.expiration,
                                              );
                                              return !isNaN(exp.getTime())
                                                ? exp.toLocaleDateString()
                                                : license.terms.expiration;
                                            })()}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {license.createdAt && (
                                  <div className="pt-2 border-t border-slate-700/30">
                                    <div className="text-xs text-slate-500">
                                      Created:{" "}
                                      {new Date(
                                        license.createdAt,
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
