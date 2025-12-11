import { useCallback, useState } from "react";
import { sha256HexOfFile, keccakOfJson } from "@/lib/utils/crypto";
import {
  uploadFile,
  uploadJSON,
  extractCid,
  toIpfsUri,
  toHttps,
} from "@/lib/utils/ipfs";
import { calculateFileHash } from "@/lib/utils/hash";
import {
  StoryClient,
  PILFlavor,
  WIP_TOKEN_ADDRESS,
} from "@story-protocol/core-sdk";
import { createWalletClient, custom, parseEther } from "viem";
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
        const [visionResult, hashResult] = await Promise.allSettled([
          (async () => {
            try {
              const formData = new FormData();
              formData.append("image", file);
              const visionResponse = await fetch(
                "/api/vision-image-detection",
                {
                  method: "POST",
                  body: formData,
                },
              );

              if (visionResponse.ok) {
                const visionCheck = await visionResponse.json();
                if (visionCheck.blocked) {
                  return {
                    blocked: true,
                    message:
                      visionCheck.message ||
                      "Image mirip dengan IP yang sudah terdaftar. Tidak dapat registrasi.",
                  };
                }
              }
              return { blocked: false };
            } catch (visionError) {
              console.warn(
                "Vision-based detection failed, continuing:",
                visionError,
              );
              return { blocked: false };
            }
          })(),
          (async () => {
            try {
              const hash = await calculateFileHash(file);
              const hashCheckResponse = await fetch("/api/check-remix-hash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hash }),
              });

              if (hashCheckResponse.ok) {
                const hashCheck = await hashCheckResponse.json();
                if (hashCheck.found) {
                  return {
                    found: true,
                    ipId: hashCheck.ipId,
                    title: hashCheck.title,
                  };
                }
              }
              return { found: false };
            } catch (hashError) {
              console.warn(
                "Hash whitelist check failed, continuing:",
                hashError,
              );
              return { found: false };
            }
          })(),
        ]);

        if (
          visionResult.status === "fulfilled" &&
          visionResult.value?.blocked
        ) {
          setRegisterState({
            status: "error",
            progress: 0,
            error: visionResult.value.message,
          });
          return { success: false, reason: "vision_match_found" } as const;
        }

        if (hashResult.status === "fulfilled" && hashResult.value?.found) {
          setRegisterState({
            status: "idle",
            progress: 0,
            error: null,
          });
          return {
            success: false,
            reason: "hash_found_offer_remix",
            matchedIpId: hashResult.value.ipId,
            matchedTitle: hashResult.value.title,
          } as const;
        }

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

        const [fileUploadResult, creatorAddr, imageHash] = await Promise.all([
          uploadFile(compressedFile),
          (async () => {
            let addr: string | undefined;
            try {
              const providerTmp: any =
                ethereumProvider || (globalThis as any).ethereum;
              if (providerTmp) {
                const walletClientTmp = createWalletClient({
                  transport: custom(providerTmp),
                });
                const addrs = await walletClientTmp.getAddresses();
                if (addrs && addrs[0]) addr = String(addrs[0]);
              }
            } catch {}
            if (!addr) {
              throw new Error(
                "No wallet address available. Please connect your wallet.",
              );
            }
            return addr;
          })(),
          sha256HexOfFile(compressedFile),
        ]);

        const imageCid = extractCid(
          fileUploadResult.cid || fileUploadResult.url,
        );
        const imageGateway = fileUploadResult.https || toHttps(imageCid);

        setRegisterState((p) => ({
          ...p,
          status: "creating-metadata",
          progress: 50,
        }));
        const ipMetadata = {
          name: intent?.title || file.name,
          title: intent?.title || file.name,
          description: intent?.prompt || "",
          image: imageGateway,
          imageHash,
          mediaUrl: imageGateway,
          mediaHash: imageHash,
          mediaType: compressedFile.type || "image/jpeg",
          creators: creatorAddr
            ? [
                {
                  name: creatorAddr,
                  address: creatorAddr,
                  contributionPercent: 100,
                },
              ]
            : [],
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

        const spg = (import.meta as any).env?.VITE_PUBLIC_SPG_COLLECTION_USERS;
        if (!spg)
          throw new Error(
            "SPG collection env not set (VITE_PUBLIC_SPG_COLLECTION_USERS)",
          );
        const rpcUrl = (import.meta as any).env?.VITE_PUBLIC_STORY_RPC;
        if (!rpcUrl) throw new Error("RPC URL not set (VITE_PUBLIC_STORY_RPC)");

        const [ipMetaUpload, storyClientSetup] = await Promise.all([
          uploadJSON(ipMetadata),
          (async () => {
            const provider = ethereumProvider;
            let addr: string | undefined;
            let story: StoryClient;
            if (provider) {
              try {
                const chainIdHex: string = await provider.request({
                  method: "eth_chainId",
                });
                // 0x5ea = 1514 (mainnet), 0x523 = 1315 (aeneid testnet)
                if (chainIdHex?.toLowerCase() !== "0x5ea") {
                  try {
                    await provider.request({
                      method: "wallet_switchEthereumChain",
                      params: [{ chainId: "0x5ea" }],
                    });
                  } catch (e) {
                    try {
                      await provider.request({
                        method: "wallet_addEthereumChain",
                        params: [
                          {
                            chainId: "0x5ea",
                            chainName: "Story",
                            nativeCurrency: {
                              name: "IP",
                              symbol: "IP",
                              decimals: 18,
                            },
                            rpcUrls: rpcUrl
                              ? [rpcUrl]
                              : ["https://mainnet.storyrpc.io"],
                          },
                        ],
                      });
                    } catch {}
                    try {
                      await provider.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: "0x5ea" }],
                      });
                    } catch {}
                  }
                }
              } catch {}

              try {
                const accounts = await provider.request({
                  method: "eth_accounts",
                });

                if (!accounts || accounts.length === 0) {
                  await provider.request({
                    method: "eth_requestAccounts",
                  });
                }
              } catch (accountError: any) {
                throw new Error(
                  `Failed to connect wallet: ${accountError.message}`,
                );
              }

              const walletClient = createWalletClient({
                transport: custom(provider),
              });
              const [a] = await walletClient.getAddresses();
              if (!a) throw new Error("No wallet address available");
              addr = a as string;

              // ✅ PERBAIKAN: chainId harus string "mainnet" atau "aeneid"
              story = StoryClient.newClient({
                account: addr as `0x${string}`,
                transport: custom(provider),
                chainId: "mainnet", // atau "aeneid" untuk testnet
              });
            } else {
              throw new Error(
                "No wallet connected. Please connect your wallet to register IP.",
              );
            }
            return { addr, story };
          })(),
        ]);

        const ipMetaCid = extractCid(ipMetaUpload.cid || ipMetaUpload.url);
        const ipMetadataURI = toIpfsUri(ipMetaCid);
        const ipMetadataHash = keccakOfJson(ipMetadata);

        const addr = storyClientSetup.addr;
        const story = storyClientSetup.story;

        // ✅ PERBAIKAN: licenseTermsData dengan format yang benar
        const licenseTermsData = [
          {
            terms: PILFlavor.commercialRemix({
              commercialRevShare: Number(licenseSettings.revShare) || 0,
              defaultMintingFee: parseEther(
                String(licenseSettings.licensePrice || 0),
              ),
              currency: WIP_TOKEN_ADDRESS,
            }),
            // ✅ TAMBAHAN: licensingConfig (opsional tapi recommended)
            licensingConfig: {
              isSet: false,
              mintingFee: 0n,
              licensingHook: "0x0000000000000000000000000000000000000000" as `0x${string}`,
              hookData: "0x" as `0x${string}`,
              commercialRevShare: 0,
              disabled: false,
              expectMinimumGroupRewardShare: 0,
              expectGroupRewardPool: "0x0000000000000000000000000000000000000000" as `0x${string}`,
            },
          },
        ];

        setRegisterState((p) => ({ ...p, status: "minting", progress: 75 }));

        let result: any;
        try {
          console.log("Starting mint and register transaction...", {
            spgNftContract: spg,
            recipient: addr,
          });

          result = await story.ipAsset.mintAndRegisterIpAssetWithPilTerms({
            spgNftContract: spg as `0x${string}`,
            recipient: addr as `0x${string}`,
            licenseTermsData,
            ipMetadata: {
              ipMetadataURI,
              ipMetadataHash: ipMetadataHash as `0x${string}`,
              nftMetadataURI: ipMetadataURI,
              nftMetadataHash: ipMetadataHash as `0x${string}`,
            },
            allowDuplicates: true,
          });

          console.log("✅ Mint and register transaction submitted", {
            ipId: result?.ipId,
            txHash: result?.txHash || result?.transactionHash,
            result,
          });

          setRegisterState((p) => ({ ...p, progress: 90 }));
        } catch (txError: any) {
          console.error("❌ Mint and register transaction failed:", {
            message: txError?.message,
            code: txError?.code,
            error: txError,
          });

          if (
            txError?.code === 4001 ||
            txError?.message?.includes("User rejected")
          ) {
            throw new Error("Transaction was rejected by the user");
          }
          if (txError?.message?.includes("insufficient funds")) {
            throw new Error("Insufficient funds for gas and transaction");
          }
          if (txError?.message?.includes("network")) {
            throw new Error(
              "Network error. Please check your connection and try again",
            );
          }
          throw txError;
        }

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
        const errorMsg =
          error?.message || error?.data?.message || String(error);

        let userFriendlyMsg = errorMsg;
        if (errorMsg.includes("rejected by the user")) {
          userFriendlyMsg =
            "❌ You rejected the transaction. Please try again if you want to proceed.";
        } else if (errorMsg.includes("insufficient funds")) {
          userFriendlyMsg =
            "❌ Insufficient funds for gas fees. Please add more IP tokens.";
        } else if (errorMsg.includes("network")) {
          userFriendlyMsg =
            "❌ Network connection error. Please check your connection and try again.";
        } else if (errorMsg.includes("CallerNotAuthorizedToMint")) {
          userFriendlyMsg =
            "❌ Your wallet is not authorized to mint on this contract. Please check with the admin.";
        }

        console.error("❌ Registration failed:", {
          message: errorMsg,
          error,
          stack: error?.stack,
        });
        setRegisterState({
          status: "error",
          progress: 0,
          error: userFriendlyMsg,
        });
        return {
          success: false,
          error: userFriendlyMsg,
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
