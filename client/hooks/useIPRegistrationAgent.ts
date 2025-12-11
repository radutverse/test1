import { useCallback, useState } from "react";
import { sha256HexOfFile, keccakOfJson } from "@/lib/utils/crypto";
import {
  uploadFile,
  uploadJSON,
  extractCid,
  toIpfsUri,
  toHttps,
} from "@/lib/utils/ipfs";
import {
  StoryClient,
  PILFlavor,
  WIP_TOKEN_ADDRESS,
} from "@story-protocol/core-sdk";
import { createWalletClient, custom, parseEther, http } from "viem";
import {
  getLicenseSettingsByGroup,
  requiresSelfieVerification,
  requiresSubmitReview,
  isAiGeneratedGroup,
} from "@/lib/groupLicense";

export type RegisterState = {
  status:
    | "idle"
    | "compressing"
    | "uploading-image"
    | "creating-metadata"
    | "uploading-metadata"
    | "minting"
    | "success"
    | "error";
  progress: number;
  error: any;
  ipId?: string;
  txHash?: string;
};

async function compressImage(file: File): Promise<File> {
  // Simple browser-side downscale to JPEG
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    const fr = new FileReader();
    fr.onload = () => {
      img.onload = () => {
        const maxW = 1024;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        const url = canvas.toDataURL("image/jpeg", 0.9);
        resolve(url);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = fr.result as string;
    };
    fr.onerror = () => reject(new Error("File read failed"));
    fr.readAsDataURL(file);
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

export function useIPRegistrationAgent() {
  const [registerState, setRegisterState] = useState<RegisterState>({
    status: "idle",
    progress: 0,
    error: null,
  });

  const executeRegister = useCallback(
    async (
      group: number,
      file: File,
      mintingFee?: number,
      revShare?: number,
      aiTrainingManual?: boolean,
      intent?: { title?: string; prompt?: string },
      ethereumProvider?: any,
    ) => {
      try {
        // ============================================
        // TIER 1: HASH/VISION DETECTION (BLOCKING)
        // ============================================
        // Check if image is a remix or similar to existing IPs
        // If blocked here, stop immediately - do NOT proceed to Tier 2

        // Vision-based image detection (most powerful)
        try {
          const formData = new FormData();
          formData.append("image", file);
          const visionResponse = await fetch("/api/vision-image-detection", {
            method: "POST",
            body: formData,
          });

          if (visionResponse.ok) {
            const visionCheck = await visionResponse.json();
            if (visionCheck.blocked) {
              setRegisterState({
                status: "error",
                progress: 0,
                error:
                  visionCheck.message ||
                  "Image mirip dengan IP yang sudah terdaftar. Tidak dapat registrasi.",
              });
              return { success: false, reason: "vision_match_found" } as const;
            }
          }
        } catch (visionError) {
          console.warn(
            "Vision-based detection failed, continuing:",
            visionError,
          );
          // Don't block registration if vision check fails
        }

        // ✅ TIER 1 DETECTION COMPLETE
        // Vision checks passed - image is allowed to proceed
        // Now continue to Tier 2: Brand/Character detection

        const licenseSettings = getLicenseSettingsByGroup(
          group,
          aiTrainingManual,
          mintingFee,
          revShare,
        );
        if (requiresSelfieVerification(group)) {
          setRegisterState({
            status: "idle",
            progress: 0,
            error: "Selfie verification required before registration.",
          });
          return { success: false, reason: "selfie_required" } as const;
        }
        if (requiresSubmitReview(group)) {
          setRegisterState({
            status: "idle",
            progress: 0,
            error: "Submit review required.",
          });
          return { success: false, reason: "submit_review" } as const;
        }
        if (!licenseSettings)
          throw new Error("Cannot register: licenseSettings null");

        setRegisterState({ status: "compressing", progress: 10, error: null });
        const compressedFile = await compressImage(file);

        setRegisterState((p) => ({
          ...p,
          status: "uploading-image",
          progress: 25,
        }));
        const fileUpload = await uploadFile(compressedFile);
        const imageCid = extractCid(fileUpload.cid || fileUpload.url);
        const imageGateway = fileUpload.https || toHttps(imageCid);
        const imageHash = await sha256HexOfFile(compressedFile);

        setRegisterState((p) => ({
          ...p,
          status: "creating-metadata",
          progress: 50,
        }));

        // Get creator address from wallet
        let creatorAddr: string | undefined;
        const provider = ethereumProvider || (globalThis as any).ethereum;

        if (!provider) {
          throw new Error(
            "No wallet provider available. Please connect your wallet.",
          );
        }

        try {
          const walletClientTmp = createWalletClient({
            transport: custom(provider),
          });
          const addrs = await walletClientTmp.getAddresses();
          if (addrs && addrs[0]) {
            creatorAddr = String(addrs[0]);
          }
        } catch (walletError) {
          throw new Error(
            "Failed to get wallet address. Please ensure your wallet is connected.",
          );
        }

        if (!creatorAddr) {
          throw new Error(
            "Could not determine wallet address. Please connect your wallet.",
          );
        }

        const ipMetadata = {
          name: intent?.title || file.name,
          title: intent?.title || file.name,
          description: intent?.prompt || "",
          image: imageGateway,
          imageHash,
          mediaUrl: imageGateway,
          mediaHash: imageHash,
          mediaType: compressedFile.type || "image/jpeg",
          creators: [
            {
              name: creatorAddr,
              address: creatorAddr,
              contributionPercent: 100,
            },
          ],
          attributes: [
            {
              trait_type: "Status",
              value: isAiGeneratedGroup(group)
                ? "AI Generated"
                : "Human Generated",
            },
          ],
          aiMetadata: intent?.prompt
            ? { prompt: intent.prompt, generator: "user", model: "rule-based" }
            : undefined,
          license: licenseSettings,
        };

        setRegisterState((p) => ({
          ...p,
          status: "uploading-metadata",
          progress: 60,
        }));
        const ipMetaUpload = await uploadJSON(ipMetadata);
        const ipMetaCid = extractCid(ipMetaUpload.cid || ipMetaUpload.url);
        const ipMetadataURI = toIpfsUri(ipMetaCid);
        const ipMetadataHash = keccakOfJson(ipMetadata);

        setRegisterState((p) => ({ ...p, status: "minting", progress: 75 }));

        // Use the same SPG collection as before (previously used by guest)
        const spg = (import.meta as any).env?.VITE_PUBLIC_SPG_COLLECTION_USERS;
        if (!spg) {
          throw new Error(
            "SPG collection env not set (VITE_PUBLIC_SPG_COLLECTION_USERS)",
          );
        }

        const rpcUrl = (import.meta as any).env?.VITE_PUBLIC_STORY_RPC;
        if (!rpcUrl) {
          throw new Error("RPC URL not set (VITE_PUBLIC_STORY_RPC)");
        }

        // Build license terms for Story SDK
        const licenseTermsData = [
          {
            terms: PILFlavor.commercialRemix({
              commercialRevShare: Number(licenseSettings.revShare) || 0,
              defaultMintingFee: parseEther(
                String(licenseSettings.licensePrice || 0),
              ),
              currency: WIP_TOKEN_ADDRESS,
            }),
          },
        ];

        // Ensure wallet is on correct chain (Story Mainnet)
        try {
          const chainIdHex: string = await provider.request({
            method: "eth_chainId",
          });
          if (chainIdHex?.toLowerCase() !== "0x5ea") {
            // 0x5ea = 1514 (Story Mainnet)
            try {
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x5ea" }],
              });
            } catch (switchError) {
              // Chain not added, try to add it
              try {
                await provider.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: "0x5ea",
                      chainName: "Story Network",
                      nativeCurrency: {
                        name: "IP",
                        symbol: "IP",
                        decimals: 18,
                      },
                      rpcUrls: [rpcUrl],
                      blockExplorerUrls: ["https://explorer.story.foundation"],
                    },
                  ],
                });
                // Try switching again after adding
                await provider.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: "0x5ea" }],
                });
              } catch (addError) {
                console.warn(
                  "Could not add/switch to Story Network:",
                  addError,
                );
              }
            }
          }
        } catch (chainError) {
          console.warn("Chain check/switch failed:", chainError);
        }

        // Initialize Story Client with wallet
        const walletClient = createWalletClient({
          transport: custom(provider),
        });
        const [addr] = await walletClient.getAddresses();

        if (!addr) {
          throw new Error("No wallet address available after setup");
        }

        const story = StoryClient.newClient({
          account: addr as any,
          transport: custom(provider),
          chainId: "odyssey", // Story Protocol Mainnet
        });

        const result: any =
          await story.ipAsset.mintAndRegisterIpAssetWithPilTerms({
            spgNftContract: spg as `0x${string}`,
            recipient: addr as `0x${string}`,
            licenseTermsData,
            ipMetadata: {
              ipMetadataURI,
              ipMetadataHash: ipMetadataHash as any,
              nftMetadataURI: ipMetadataURI,
              nftMetadataHash: ipMetadataHash as any,
            },
            allowDuplicates: true,
          });

        setRegisterState({
          status: "success",
          progress: 100,
          error: null,
          ipId: result?.ipId,
          txHash: result?.txHash || result?.transactionHash,
        });

        return {
          success: true,
          ipId: result?.ipId,
          txHash: result?.txHash || result?.transactionHash,
          imageUrl: imageGateway,
          ipMetadataUrl: toHttps(ipMetaCid),
        } as const;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);

        // Provide user-friendly error messages
        let userFriendlyError = errorMessage;
        if (
          errorMessage.includes("User rejected") ||
          errorMessage.includes("rejected")
        ) {
          userFriendlyError =
            "Transaction was rejected. Please try again if you want to proceed.";
        } else if (errorMessage.includes("insufficient funds")) {
          userFriendlyError =
            "Insufficient funds for gas fees. Please add more IP tokens to your wallet.";
        } else if (errorMessage.includes("wallet")) {
          userFriendlyError =
            "Wallet connection issue. Please ensure your wallet is connected and unlocked.";
        } else if (errorMessage.includes("CallerNotAuthorizedToMint")) {
          userFriendlyError =
            "Your wallet is not authorized to mint on this contract. Please contact admin to whitelist your address.";
        }

        setRegisterState({
          status: "error",
          progress: 0,
          error: userFriendlyError,
        });

        return {
          success: false,
          error: userFriendlyError,
        } as const;
      }
    },
    [],
  );

  const resetRegister = useCallback(() => {
    setRegisterState({ status: "idle", progress: 0, error: null });
  }, []);

  return { registerState, executeRegister, resetRegister } as const;
}
