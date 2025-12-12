import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ChatHeaderActions from "@/components/ip/assistant/ChatHeaderActions";
import SidebarExtras from "@/components/ip/assistant/SidebarExtras";
import IpImagineInput from "@/components/ip/imagine/Input";
import { IpImagineTour } from "@/components/ip/imagine/IpImagineTour";
import {
  AddRemixImageModal,
  type PreviewImagesState,
} from "@/components/ip/remix";
import { CatalogBrowser } from "@/components/ip/imagine/dashboard/CatalogBrowser";
import useGeminiGenerator from "@/hooks/useGeminiGenerator";
import { useIpImagineTour } from "@/hooks/useIpImagineTour";
import { truncateAddress } from "@/lib/ip-assistant/utils";
import { getImageVisionDescription } from "@/lib/utils/vision-api";
import { compressAndEnsureSize } from "@/lib/utils/image";
import { CreationContext } from "@/context/CreationContext";

const IpImagine = () => {
  const context = useContext(CreationContext);
  const creations = context?.creations || [];
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const {
    tourStep,
    targetElementRect,
    startTour,
    nextStep,
    skipTour,
    completeTour,
  } = useIpImagineTour();

  const { generate, isLoading, resultUrl, setResultUrl, setResultType } =
    useGeminiGenerator();

  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [sessions, setSessions] = useState<unknown[]>([]);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImagesState>({
    remixImage: null,
    additionalImage: null,
  });
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [showAddRemixImageModal, setShowAddRemixImageModal] = useState(false);
  const [remixAnalysisOpen, setRemixAnalysisOpen] = useState(false);
  const [remixAnalysisData, setRemixAnalysisData] = useState<any>(null);
  const [remixOwnerDomain, setRemixOwnerDomain] = useState<{
    domain: string | null;
    loading: boolean;
  }>({ domain: null, loading: false });
  const [creationMode, setCreationMode] = useState<"image" | "video">("image");
  const [remixLoading, setRemixLoading] = useState(false);
  const [currentRemixType, setCurrentRemixType] = useState<
    "paid" | "free" | null
  >(null);
  const [currentParentAsset, setCurrentParentAsset] = useState<any>(null);
  const [expandedAsset, setExpandedAsset] = useState<any>(null);

  const uploadRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Get primary wallet address
  const primaryWalletAddress = useMemo(() => {
    if (wallets && wallets.length > 0) {
      const walletWithAddress = wallets.find((wallet) => wallet.address);
      if (walletWithAddress?.address) {
        return walletWithAddress.address;
      }
    }
    return user?.wallet?.address ?? null;
  }, [wallets, user?.wallet?.address]);

  // Wallet connection handlers
  const handleWalletButtonClick = useCallback(() => {
    if (!ready) return;
    if (authenticated) {
      logout();
    } else {
      void login({ loginMethods: ["wallet"] });
    }
  }, [ready, authenticated, login, logout]);

  // Load wallet creations when wallet connects
  useEffect(() => {
    if (authenticated && primaryWalletAddress) {
      if (context?.refreshWalletCreations) {
        context.refreshWalletCreations(primaryWalletAddress);
      }
    }
  }, [authenticated, primaryWalletAddress, context]);

  // Clear remix state when wallet disconnects to prevent inconsistent state
  useEffect(() => {
    if (!authenticated || !primaryWalletAddress) {
      // Wallet disconnected - clear remix state
      if (currentRemixType || currentParentAsset) {
        console.log("[IpImagine] Wallet disconnected - clearing remix state");
        setCurrentRemixType(null);
        setCurrentParentAsset(null);
        // Clear preview images to prevent orphaned remix data
        setPreviewImages({ remixImage: null, additionalImage: null });
      }
    }
  }, [authenticated, primaryWalletAddress]);

  const walletButtonText = authenticated
    ? "Disconnect"
    : ready
      ? "Connect Wallet"
      : "Loading Wallet";

  const walletButtonDisabled = !ready && !authenticated;

  const connectedAddressLabel =
    authenticated && primaryWalletAddress
      ? truncateAddress(primaryWalletAddress)
      : null;

  // Auto-start tour if coming from welcome screen
  useEffect(() => {
    const shouldStartTour = sessionStorage.getItem("start-ip-imagine-tour");
    if (shouldStartTour === "true") {
      sessionStorage.removeItem("start-ip-imagine-tour");
      startTour();
    }
  }, [startTour]);

  // Track new results for stacking effect
  useEffect(() => {
    if (resultUrl) {
      setResultUrls((prev) => {
        if (!prev.includes(resultUrl)) {
          return [resultUrl, ...prev].slice(0, 5);
        }
        return prev;
      });
    }
  }, [resultUrl]);

  useEffect(() => {
    let mounted = true;
    const fetchDomain = async (ownerAddress: string) => {
      try {
        setRemixOwnerDomain({ domain: null, loading: true });
        const res = await fetch("/api/resolve-owner-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress }),
        });
        if (!mounted) return;
        if (!res.ok) {
          setRemixOwnerDomain({ domain: null, loading: false });
          return;
        }
        const data = await res.json();
        setRemixOwnerDomain({ domain: data.domain || null, loading: false });
      } catch (err) {
        if (!mounted) return;
        console.warn("Failed to resolve owner domain:", err);
        setRemixOwnerDomain({ domain: null, loading: false });
      }
    };

    if (remixAnalysisOpen && remixAnalysisData?.whitelist?.metadata) {
      const md = remixAnalysisData.whitelist.metadata;
      const owner = md.ownerAddress || md.owner || null;
      if (owner) fetchDomain(owner);
    } else {
      setRemixOwnerDomain({ domain: null, loading: false });
    }

    return () => {
      mounted = false;
    };
  }, [remixAnalysisOpen, remixAnalysisData]);

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

  const handleImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = event.target?.files?.[0];
        if (!file) return;
        if (event.currentTarget) event.currentTarget.value = "";

        // Handle video files
        if (creationMode === "video" && file.type.startsWith("video/")) {
          const fileSizeInMB = file.size / (1024 * 1024);
          if (fileSizeInMB > 100) {
            setStatusText(
              `⚠️ Video file is too large (${fileSizeInMB.toFixed(1)}MB). Max 100MB allowed.`,
            );
            return;
          }

          const url = URL.createObjectURL(file);
          setPreviewImages((prev) => ({
            ...prev,
            remixImage: { blob: file, name: file.name || "video.mp4", url },
            additionalImage: null,
          }));
          setStatusText(`✓ Video loaded: ${file.name}`);
          return;
        }

        // Handle image files
        if (!file.type.startsWith("image/")) {
          setStatusText(
            `⚠️ File must be an image${creationMode === "video" ? " or video" : ""}.`,
          );
          return;
        }

        let blob: Blob;
        try {
          blob = await compressAndEnsureSize(file, 250 * 1024);
        } catch (err) {
          console.warn("Compression failed, using original file", err);
          blob = file;
        }

        const url = URL.createObjectURL(blob);

        setPreviewImages((prev) => ({
          ...prev,
          remixImage: { blob, name: file.name || "image.jpg", url },
          additionalImage: null,
        }));
        setStatusText(`✓ Image loaded: ${file.name}`);
      } catch (error) {
        console.error("handleImage error", error);
      }
    },
    [compressAndEnsureSize, setPreviewImages, creationMode],
  );

  const handleRemixSelected = async (
    asset: any,
    remixType: "paid" | "free",
  ) => {
    console.log("🎯 handleRemixSelected called with:", {
      remixType,
      asset: {
        ipId: asset?.ipId,
        title: asset?.title,
        mediaUrl: asset?.mediaUrl ? "✓" : "✗",
        thumbnailUrl: asset?.thumbnailUrl ? "✓" : "✗",
      },
    });
    setRemixLoading(true);
    try {
      // Validation: Warn if wallet not fully connected for paid remix
      if (remixType === "paid" && (!authenticated || !primaryWalletAddress)) {
        setRemixLoading(false);
        setStatusText("⚠️ Please connect your wallet to use paid remix.");
        return;
      }

      if (!asset) {
        throw new Error("Asset data is missing");
      }

      const imageUrl = asset.mediaUrl || asset.thumbnailUrl;
      console.log("📸 Image URL selected:", {
        imageUrl: imageUrl ? imageUrl.substring(0, 100) : "undefined",
        fromMediaUrl: !!asset.mediaUrl,
        fromThumbnailUrl: !!asset.thumbnailUrl,
      });

      if (!imageUrl) {
        throw new Error(
          `No image URL available for this asset. mediaUrl: ${asset.mediaUrl}, thumbnailUrl: ${asset.thumbnailUrl}`,
        );
      }

      const response = await fetch(imageUrl, {
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch image: ${response.statusText} (${response.status})`,
        );
      }

      let blob = await response.blob();

      // Ensure blob has correct MIME type from Content-Type header
      const contentType = response.headers.get("content-type");
      if (contentType && !blob.type) {
        blob = blob.slice(0, blob.size, contentType);
      }

      const url = URL.createObjectURL(blob);
      const fileName = asset.title || asset.name || "remix-image";

      // Set all state synchronously to avoid race conditions
      setCurrentRemixType(remixType);
      setCurrentParentAsset(asset);
      setPreviewImages({
        remixImage: {
          blob,
          name: fileName,
          url,
        },
        additionalImage: null,
      });

      console.log(
        "📌 Set currentRemixType to:",
        remixType,
        "Blob type:",
        blob.type,
        "File name:",
        fileName,
      );

      setStatusText(
        `✓ ${remixType === "paid" ? "Paid" : "Free"} remix loaded: ${fileName}`,
      );

      // Scroll input into view
      setTimeout(() => {
        inputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 300);
    } catch (error: any) {
      console.error("❌ Error loading remix image:", {
        message: error?.message,
        stack: error?.stack,
      });
      setStatusText(
        `❌ Failed to load remix: ${error?.message || "Unknown error"}`,
      );
    } finally {
      setRemixLoading(false);
    }
  };

  // Note: Watermark is now applied in useGeminiGenerator hook during generation
  // This ensures watermark is applied before image is stored in creation history

  const headerActions = (
    <ChatHeaderActions
      walletButtonText={walletButtonText}
      walletButtonDisabled={walletButtonDisabled}
      onWalletClick={handleWalletButtonClick}
      connectedAddressLabel={connectedAddressLabel}
      isWalletConnected={authenticated}
    />
  );

  const sidebarExtras = (opts: { closeSidebar: () => void }) => (
    <SidebarExtras
      messages={[]}
      sessions={[]}
      onNewChat={() => {
        opts.closeSidebar();
      }}
      onLoadSession={(id: string) => {}}
      onDeleteSession={(id: string) => {}}
      closeSidebar={opts.closeSidebar}
      onOpenWhitelistMonitor={() => {}}
    />
  );

  const navigate = useNavigate();

  return (
    <DashboardLayout
      title="IP Imagine"
      avatarSrc={null}
      actions={headerActions}
      sidebarExtras={sidebarExtras}
      onLogoClick={() => navigate("/")}
    >
      <div className="relative w-full h-full overflow-hidden">
        <video
          autoPlay
          muted
          loop
          className="absolute inset-0 w-full h-full object-cover"
          src="https://cdn.builder.io/o/assets%2F2d031ad4ed8b46218a271cc55fdf3f5f%2F84477b6c6c134698a664cfde4f6a245a?alt=media&token=25dbdbfa-44dc-4217-bfdb-4bf384885d59&apiKey=2d031ad4ed8b46218a271cc55fdf3f5f"
        />
        <div className="relative w-full h-full flex flex-col">
          <div className="chat-box px-3 sm:px-4 md:px-12 pt-4 pb-48 overflow-y-auto bg-transparent scroll-smooth flex-1">
            <AnimatePresence initial={false} mode="popLayout">
              <CatalogBrowser
                key="catalog-browser"
                onRemixSelected={handleRemixSelected}
                onAssetExpanded={setExpandedAsset}
              />
            </AnimatePresence>

            <div />
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
            <IpImagineInput
              input={input}
              setInput={setInput}
              waiting={waiting || isLoading}
              previewImages={previewImages}
              setPreviewImages={setPreviewImages}
              uploadRef={uploadRef}
              resultUrl={resultUrl}
              resultUrls={resultUrls}
              creations={creations}
              onSubmit={async () => {
                if (
                  !input.trim() &&
                  !previewImages.remixImage &&
                  !previewImages.additionalImage
                )
                  return;

                if (creationMode === "video") {
                  setStatusText("🎬 Video generation is coming soon!");
                  return;
                }

                // Validation: Prevent paid remix without proper state
                if (currentRemixType === "paid") {
                  if (!currentParentAsset) {
                    setStatusText(
                      "Paid remix requires parent asset data. Please select a paid remix again.",
                    );
                    setWaiting(false);
                    return;
                  }
                  if (!authenticated || !primaryWalletAddress) {
                    setStatusText(
                      "Paid remix requires wallet connection. Please connect your wallet.",
                    );
                    setWaiting(false);
                    return;
                  }
                }

                setWaiting(true);
                setStatusText("⏳ Starting generation...");

                try {
                  const imageToSend =
                    previewImages.remixImage || previewImages.additionalImage;
                  let imageData:
                    | { imageBytes: string; mimeType: string }
                    | undefined;

                  if (imageToSend) {
                    const blob = imageToSend.blob;
                    const arrayBuffer = await blob.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);

                    // Convert Uint8Array to base64 safely without stack overflow issues
                    let binaryString = "";
                    const chunkSize = 8192;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                      const chunk = bytes.subarray(
                        i,
                        Math.min(i + chunkSize, bytes.length),
                      );
                      binaryString += String.fromCharCode.apply(
                        null,
                        Array.from(chunk),
                      );
                    }

                    imageData = {
                      imageBytes: btoa(binaryString),
                      mimeType: blob.type || "image/jpeg",
                    };
                  }

                  await generate(creationMode, {
                    prompt: input,
                    image: imageData,
                    remixType: currentRemixType,
                    parentAsset: currentParentAsset,
                  });

                  setInput("");
                  setPreviewImages({ remixImage: null, additionalImage: null });
                  setCurrentRemixType(null);
                  setCurrentParentAsset(null);
                } catch (error) {
                  console.error("Generation error:", error);
                  setStatusText("❌ Generation failed. Please try again.");
                } finally {
                  setWaiting(false);
                }
              }}
              inputRef={inputRef}
              handleKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // trigger submit
                  (
                    document.querySelector(
                      "[data-chat-input]",
                    ) as HTMLTextAreaElement
                  )?.blur();
                }
              }}
              suggestions={[]}
              setSuggestions={() => {}}
              attachmentLoading={attachmentLoading}
              onRemixRegisterWarning={() => {
                setWaiting(false);
                setStatusText(
                  "⚠ Remix images cannot be registered. Please remove the image to register.",
                );
              }}
              onAddRemixImage={() => setShowAddRemixImageModal(true)}
              creationMode={creationMode}
              setCreationMode={setCreationMode}
            />
          </div>
        </div>
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept={creationMode === "video" ? "video/*,image/*" : "image/*"}
        className="hidden"
        onChange={handleImage}
      />

      <AnimatePresence>
        {remixAnalysisOpen && remixAnalysisData ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setRemixAnalysisOpen(false)}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.div
              className="relative z-10 w-full max-w-xl rounded-2xl bg-slate-900/90 border border-[#FF4DA6]/20 p-6 shadow-xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.24 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#FF4DA6]">
                    Remix analysis
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-100">
                    {remixAnalysisData.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRemixAnalysisOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-[#FF4DA6]/20 hover:text-[#FF4DA6] focus:outline-none"
                  aria-label="Close analysis modal"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <img
                    src={remixAnalysisData.url}
                    alt="preview"
                    className="w-full rounded-md object-cover"
                  />
                </div>

                <div className="md:col-span-2">
                  {remixAnalysisData.whitelist &&
                  remixAnalysisData.whitelist.metadata ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-slate-400">Title:</div>
                        <div className="text-sm font-semibold text-slate-100">
                          {remixAnalysisData.whitelist.metadata.title || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-400">IP ID:</div>
                        <div className="text-sm font-mono text-slate-200">
                          {remixAnalysisData.whitelist.metadata.ipId ||
                            remixAnalysisData.whitelist.metadata.ownerAddress ||
                            "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-400">Domain:</div>
                        <div className="text-sm text-slate-200">
                          {remixOwnerDomain.loading ? (
                            <span className="text-xs text-slate-400">
                              Resolving domain…
                            </span>
                          ) : remixOwnerDomain.domain ? (
                            remixOwnerDomain.domain
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              No domain registered
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-300">
                      No metadata available
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImages({
                          remixImage: {
                            blob: remixAnalysisData.blob,
                            name: remixAnalysisData.name,
                            url: remixAnalysisData.url,
                          },
                          additionalImage: null,
                        });
                        setRemixAnalysisOpen(false);
                        // Navigate user to imagine area (stay on page)
                        setInput("");
                        inputRef.current?.focus?.();

                        setStatusText(
                          `✨ Remix mode activated for "${remixAnalysisData.name}". You can now remix this image!`,
                        );
                      }}
                      className="px-4 py-2 rounded-lg bg-[#FF4DA6] text-white font-semibold hover:bg-[#FF4DA6]/80"
                    >
                      Remix this
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showAddRemixImageModal && (
          <AddRemixImageModal
            isOpen={showAddRemixImageModal}
            onClose={() => setShowAddRemixImageModal(false)}
            onSelectImage={(asset: any) => {
              // set selected image as remix
              const blob = asset.blob || null;
              const url = asset.preview || asset.url || "";
              setPreviewImages({
                remixImage: blob
                  ? { blob, name: asset.name || "selected", url }
                  : null,
                additionalImage: null,
              } as any);
              setShowAddRemixImageModal(false);
            }}
          />
        )}
      </AnimatePresence>

      <IpImagineTour
        tourStep={tourStep}
        targetElementRect={targetElementRect}
        onNext={nextStep}
        onSkip={skipTour}
      />
    </DashboardLayout>
  );
};

export default IpImagine;
