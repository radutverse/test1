import {
  useState,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import CompactResultCard from "@/components/ip/imagine/results/CompactResultCard";
import ResultUpscaleModal from "@/components/ip/imagine/results/ResultUpscaleModal";
import IpImagineInput from "@/components/ip/imagine/Input";
import ChatHeaderActions from "@/components/ip/assistant/ChatHeaderActions";
import SidebarExtras from "@/components/ip/assistant/SidebarExtras";
import { ConnectWalletView } from "@/components/portfolio";
import { CreationContext, Creation } from "@/context/CreationContext";
import * as openaiService from "@/services/openaiService";
import { generateDemoImage } from "@/lib/utils/generate-demo-image";

const IpImagineCreationResult = () => {
  const navigate = useNavigate();
  const context = useContext(CreationContext);
  const { authenticated, ready, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  // Get primary wallet address using same pattern as MyPortfolio
  const primaryWalletAddress = useMemo(() => {
    if (wallets && wallets.length > 0) {
      const walletWithAddress = wallets.find((w) => w.address);
      if (walletWithAddress?.address) {
        return walletWithAddress.address;
      }
    }
    return user?.wallet?.address ?? null;
  }, [wallets, user?.wallet?.address]);

  // Handle wallet connection
  const handleWalletConnect = useCallback(() => {
    if (!ready) return;
    if (!authenticated) {
      void login({ loginMethods: ["wallet"] });
    }
  }, [ready, authenticated, login]);

  // Handle wallet disconnection
  const handleWalletDisconnect = useCallback(async () => {
    await logout();
  }, [logout]);

  if (!context) {
    return (
      <DashboardLayout title="IP Imagine" onLogoClick={() => navigate("/")}>
        <div className="chat-box px-3 sm:px-4 md:px-12 pt-4 pb-24 flex-1 overflow-y-auto bg-transparent scroll-smooth">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-[400px]"
          >
            <p className="text-slate-400 mb-4">
              No creation data found. Please generate an image first.
            </p>
            <Button
              onClick={() => navigate("/ip-imagine")}
              className="bg-[#FF4DA6] hover:bg-[#FF4DA6]/80 text-white"
            >
              Back to IP Imagine
            </Button>
          </motion.div>
          <div />
        </div>
      </DashboardLayout>
    );
  }

  const {
    setIsLoading,
    setLoadingMessage,
    setError,
    setResultUrl,
    setResultType,
    resultUrl,
    resultType,
    isLoading,
    loadingMessage,
    error,
    fetchError,
    originalPrompt,
    updateCreationWithOriginalUrl,
    creations,
  } = context;

  const [showUpscaler, setShowUpscaler] = useState(false);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [upscalingCreationId, setUpscalingCreationId] = useState<string | null>(
    null,
  );
  const [input, setInput] = useState(originalPrompt);
  const [waiting, setWaiting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [previewImages, setPreviewImages] = useState({
    remixImage: null,
    additionalImage: null,
  });
  const [expandedCreationId, setExpandedCreationId] = useState<string | null>(
    null,
  );
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Update wallet identifier in creation context when authentication changes
  useEffect(() => {
    if (!context?.setUserIdentifier) return;

    let walletAddress: string | null = null;
    if (authenticated && wallets && wallets.length > 0) {
      const walletWithAddress = wallets.find((wallet) => wallet.address);
      walletAddress = walletWithAddress?.address || null;
    }

    context.setUserIdentifier(walletAddress);
  }, [authenticated, wallets, context]);

  // Refresh wallet creations when authentication changes
  useEffect(() => {
    if (
      authenticated &&
      primaryWalletAddress &&
      context?.refreshWalletCreations
    ) {
      context.refreshWalletCreations(primaryWalletAddress);
    }
  }, [authenticated, primaryWalletAddress, context]);

  // Note: Creations are no longer cleared on disconnect to allow reconnect to same wallet
  // Clearing only happens when switching to a different wallet (handled in CreationContext)
  // Clear local UI states on disconnect
  useEffect(() => {
    if (!authenticated) {
      console.log("[IpImagineCreationResult] Wallet disconnected");
      // Clear all local UI states related to results
      setUpscaledUrl(null);
      setUpscalingCreationId(null);
      setExpandedCreationId(null);
      setShowUpscaler(false);
    }
  }, [authenticated]);

  const handleDownload = () => {
    if (!displayUrl) return;
    const link = document.createElement("a");
    link.href = displayUrl;
    link.download = `ip-imagine-${Date.now()}${displayType === "video" ? ".mp4" : ".png"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!displayUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "IP Imagine Creation",
          text: "Check out my AI-generated creation from IP Imagine!",
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleUpscale = async () => {
    if (!resultUrl || !resultUrl.startsWith("data:image")) {
      setError("Upscaling is only available for a generated image.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setLoadingMessage("Upscaling image...");

      let upscaledImageUrl: string;

      const [header, base64Data] = resultUrl.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] || "image/png";

      upscaledImageUrl = await openaiService.upscaleImage({
        imageBytes: base64Data,
        mimeType,
      });

      setResultUrl(upscaledImageUrl);
      setUpscaledUrl(upscaledImageUrl);
      setResultType("image");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An unknown error occurred during upscaling.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }

    setShowUpscaler(false);
  };

  const displayUrl = resultUrl;
  const displayType = resultType;

  const handleImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentLoading(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.ctrlKey) {
      // Submit logic
    }
  };

  const handleSubmit = async () => {
    navigate("/ip-imagine");
  };

  const handleCardExpand = (creationId: string) => {
    setExpandedCreationId(creationId);
    const creation = context.creations.find((c) => c.id === creationId);
    if (creation) {
      setInput(creation.prompt);
    }
  };

  const headerActions = (
    <ChatHeaderActions
      walletButtonText={
        authenticated && primaryWalletAddress ? "Disconnect" : "Connect"
      }
      walletButtonDisabled={false}
      onWalletClick={
        authenticated && primaryWalletAddress
          ? handleWalletDisconnect
          : handleWalletConnect
      }
      isWalletConnected={authenticated}
      connectedAddressLabel={
        authenticated && primaryWalletAddress
          ? primaryWalletAddress.substring(0, 6) +
            "..." +
            primaryWalletAddress.substring(primaryWalletAddress.length - 4)
          : undefined
      }
    />
  );

  const sidebarExtras = (opts: { closeSidebar: () => void }) => (
    <SidebarExtras
      messages={[]}
      sessions={[]}
      onNewChat={() => {
        opts.closeSidebar();
      }}
      onLoadSession={(_id: string) => {}}
      onDeleteSession={(_id: string) => {}}
      closeSidebar={opts.closeSidebar}
      onOpenWhitelistMonitor={() => {}}
    />
  );

  return (
    <DashboardLayout
      title="IP Imagine"
      avatarSrc={null}
      actions={headerActions}
      sidebarExtras={sidebarExtras}
      onLogoClick={() => navigate("/")}
    >
      <div className="chat-box px-3 sm:px-4 md:px-12 pt-4 pb-24 flex-1 overflow-y-auto bg-transparent scroll-smooth">
        {fetchError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-auto mb-6"
          >
            <div className="rounded-2xl bg-orange-900/20 border border-orange-800/50 p-6">
              <div className="flex gap-3 mb-3">
                <svg
                  className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-orange-300">
                    Failed to Load Creations
                  </h3>
                  <p className="text-sm text-orange-200/80 mt-1">
                    {fetchError}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => navigate("/ip-imagine")}
                  className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
                >
                  Back to IP Imagine
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {authenticated &&
          primaryWalletAddress &&
          creations
            .filter((c) => {
              // Only show creations from currently connected wallet
              return (
                c.walletAddress?.toLowerCase() ===
                primaryWalletAddress?.toLowerCase()
              );
            })
            .filter((c) => true).length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Results</h2>
              <button
                onClick={() => navigate("/ip-imagine")}
                className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-200 bg-slate-700 hover:bg-slate-600 hover:shadow-lg hover:shadow-slate-600/30"
              >
                ← Back
              </button>
            </div>
          )}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md mx-auto"
            >
              {(() => {
                const isQuotaError =
                  error.includes("quota") ||
                  error.includes("Quota") ||
                  error.includes("exceeded");
                const isAuthError =
                  error.includes("API key") ||
                  error.includes("not valid") ||
                  error.includes("PERMISSION_DENIED");

                return (
                  <>
                    <div className="rounded-2xl bg-red-900/20 border border-red-800/50 p-6 mb-6">
                      <div className="flex gap-3 mb-4">
                        <svg
                          className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div>
                          <h3 className="text-lg font-semibold text-red-300">
                            {isQuotaError
                              ? "Usage Limit Exceeded"
                              : isAuthError
                                ? "Authentication Error"
                                : "Generation Failed"}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {isQuotaError && (
                      <div className="rounded-2xl bg-amber-900/20 border border-amber-800/50 p-6 mb-6">
                        <div className="flex gap-4">
                          <div className="text-3xl">⏳</div>
                          <div>
                            <p className="text-amber-300 font-semibold mb-2">
                              Generation Limit Reached
                            </p>
                            <p className="text-sm text-amber-200/80 leading-relaxed">
                              You've reached your daily generation limit. Please
                              try again later or contact support for more
                              information.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAuthError && (
                      <div className="rounded-2xl bg-orange-900/20 border border-orange-800/50 p-6 mb-6">
                        <div className="flex gap-4">
                          <div className="text-3xl">⚠️</div>
                          <div>
                            <p className="text-orange-300 font-semibold mb-2">
                              Configuration Error
                            </p>
                            <p className="text-sm text-orange-200/80 leading-relaxed">
                              There's an issue with the generation service.
                              Please refresh the page and try again, or contact
                              support if the problem persists.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isQuotaError && !isAuthError && (
                      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4 mb-6">
                        <p className="text-sm text-slate-300 font-mono break-words">
                          {error}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={() => navigate("/ip-imagine")}
                        className="bg-[#FF4DA6] hover:bg-[#FF4DA6]/80 text-white"
                      >
                        Back to IP Imagine
                      </Button>
                      <Button
                        onClick={() => window.location.reload()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-100"
                        variant="outline"
                      >
                        Refresh Page
                      </Button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          ) : !authenticated ||
            !primaryWalletAddress ||
            (creations
              .filter((c) => {
                return (
                  c.walletAddress?.toLowerCase() ===
                  primaryWalletAddress?.toLowerCase()
                );
              })
              .filter((c) => true).length === 0 &&
              !isLoading) ? (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-[400px]"
            >
              {authenticated && primaryWalletAddress ? (
                <>
                  <p className="text-slate-400 mb-4">
                    No creations found for wallet{" "}
                    {primaryWalletAddress.substring(0, 6)}...
                    {primaryWalletAddress.substring(
                      primaryWalletAddress.length - 4,
                    )}
                  </p>
                  <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                    Generate an image on the IP Imagine page to get started
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 mb-4">
                    No creation data found. Please connect your wallet and
                    create an image.
                  </p>
                </>
              )}
              <Button
                onClick={() => navigate("/ip-imagine")}
                className="bg-[#FF4DA6] hover:bg-[#FF4DA6]/80 text-white"
              >
                Back to IP Imagine
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pb-2"
            >
              <AnimatePresence mode="popLayout">
                {isLoading && (
                  <motion.div
                    key="loading-spinner"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="aspect-square rounded-lg bg-black border-2 border-[#FF4DA6]/50 shadow-lg flex flex-col items-center justify-center p-6 flex-shrink-0"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="mb-4"
                    >
                      <svg
                        className="h-10 w-10 text-[#FF4DA6]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </motion.div>

                    <p className="text-xs font-semibold text-slate-200 text-center leading-tight">
                      {loadingMessage || "Fetching..."}
                    </p>
                  </motion.div>
                )}
                {context.creations
                  .filter((c) => {
                    return (
                      c.walletAddress?.toLowerCase() ===
                      primaryWalletAddress?.toLowerCase()
                    );
                  })
                  .filter((c) => true).length > 0 ? (
                  context.creations
                    .filter((c) => {
                      return (
                        c.walletAddress?.toLowerCase() ===
                        primaryWalletAddress?.toLowerCase()
                      );
                    })
                    .map((creation) => (
                      <motion.div
                        key={creation.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                      >
                        <CompactResultCard
                          imageUrl={
                            upscalingCreationId === creation.id && upscaledUrl
                              ? upscaledUrl
                              : creation.url
                          }
                          type={creation.type}
                          isLoading={false}
                          parentAsset={creation.parentAsset}
                          originalUrl={creation.originalUrl}
                          watermarkedUrl={creation.watermarkedUrl}
                          registeredIpId={creation.registeredIpId}
                          childIpId={creation.childIpId}
                          creationId={creation.id}
                          onUnlockWatermark={(originalUrl) => {
                            updateCreationWithOriginalUrl(
                              creation.id,
                              originalUrl,
                            );
                          }}
                          onDownload={() => {
                            const link = document.createElement("a");
                            // Use original URL if registered (has childIpId), otherwise use watermarked/main URL
                            const downloadUrl =
                              upscalingCreationId === creation.id && upscaledUrl
                                ? upscaledUrl
                                : creation.childIpId && creation.originalUrl
                                  ? creation.originalUrl
                                  : creation.url;
                            link.href = downloadUrl;
                            link.download = `ip-imagine-${creation.id}${creation.type === "video" ? ".mp4" : ".png"}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          onShare={async () => {
                            try {
                              if (navigator.share) {
                                await navigator.share({
                                  title: "IP Imagine Creation",
                                  text: "Check out my AI-generated creation from IP Imagine!",
                                  url: window.location.href,
                                });
                              } else {
                                navigator.clipboard.writeText(
                                  window.location.href,
                                );
                                alert("Link copied to clipboard!");
                              }
                            } catch (error) {
                              console.error("Share error:", error);
                            }
                          }}
                          onUpscale={
                            creation.type === "image"
                              ? () => {
                                  setResultUrl(creation.url);
                                  setResultType(creation.type);
                                  setUpscalingCreationId(creation.id);
                                  setShowUpscaler(true);
                                }
                              : undefined
                          }
                          onCreateAnother={() => {}}
                          onDelete={() => {
                            context.removeCreation(creation.id);
                          }}
                          isExpanded={expandedCreationId === creation.id}
                          setIsExpanded={(expanded) => {
                            if (expanded) {
                              handleCardExpand(creation.id);
                            } else {
                              setExpandedCreationId(null);
                            }
                          }}
                        />
                      </motion.div>
                    ))
                ) : (
                  <div className="text-slate-400">No creations yet</div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {upscaledUrl && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 rounded-xl bg-emerald-900/20 border border-emerald-800/50 p-4 flex items-start gap-3"
          >
            <svg
              className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-emerald-300 font-medium">
                Upscale completed!
              </p>
              <p className="text-xs text-emerald-200 mt-1">
                Image has been enhanced to higher resolution
              </p>
            </div>
          </motion.div>
        )}

        <div />
      </div>

      {expandedCreationId && (
        <IpImagineInput
          input={input}
          setInput={setInput}
          waiting={waiting}
          previewImages={previewImages}
          setPreviewImages={setPreviewImages}
          uploadRef={uploadRef}
          onSubmit={handleSubmit}
          inputRef={inputRef}
          handleKeyDown={handleKeyDown}
          suggestions={suggestions}
          setSuggestions={setSuggestions}
          attachmentLoading={attachmentLoading}
          creations={context.creations}
        />
      )}

      <AnimatePresence>
        {showUpscaler && displayUrl && (
          <ResultUpscaleModal
            imageUrl={displayUrl}
            isLoading={isLoading}
            onClose={() => setShowUpscaler(false)}
            onUpscale={handleUpscale}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default IpImagineCreationResult;
