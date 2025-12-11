import { useCallback, useState } from "react";
import { StoryClient } from "@story-protocol/core-sdk";
import { createWalletClient, custom } from "viem";
import {
  getLicenseSettingsByGroup,
  requiresSelfieVerification,
  requiresSubmitReview,
  isAiGeneratedGroup,
  canDirectRegister,
} from "@/lib/groupLicense";
import { getLicenseSettingsByType, toLicenseTerms } from "@/lib/license/terms";
import {
  uploadFile,
  uploadJSON,
  extractCid,
  toIpfsUri,
  toHttps,
} from "@/lib/utils/ipfs";
import { sha256HexOfFile, sha256HexOfJson } from "@/lib/utils/crypto";
import { compressAndEnsureSize } from "@/lib/utils/image";

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
      licenseType?: string,
    ) => {
      try {
        // Validasi
        if (requiresSelfieVerification(group)) {
          setRegisterState({
            status: "idle",
            progress: 0,
            error: "Selfie verification required.",
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
        if (!canDirectRegister(group)) {
          throw new Error("Group cannot register directly");
        }

        // Dapatkan license settings
        const licenseSettings = licenseType
          ? getLicenseSettingsByType(
              licenseType,
              aiTrainingManual,
              mintingFee,
              revShare,
            )
          : getLicenseSettingsByGroup(
              group,
              aiTrainingManual,
              mintingFee,
              revShare,
            );

        if (!licenseSettings)
          throw new Error("Cannot determine license settings");

        // Compress image
        setRegisterState({ status: "compressing", progress: 10, error: null });
        const compressedBlob = await compressAndEnsureSize(file, 1024 * 1024);
        const compressedFile = new File([compressedBlob], file.name, {
          type: "image/jpeg",
        });

        // Upload image
        setRegisterState((p) => ({
          ...p,
          status: "uploading-image",
          progress: 25,
        }));
        const fileUpload = await uploadFile(compressedFile);
        const imageCid = extractCid(fileUpload.cid || fileUpload.url);
        const imageGateway = fileUpload.https || toHttps(imageCid);
        const imageHash = await sha256HexOfFile(compressedFile);

        // Create metadata
        setRegisterState((p) => ({
          ...p,
          status: "creating-metadata",
          progress: 50,
        }));
        const provider = ethereumProvider || (globalThis as any).ethereum;
        if (!provider) throw new Error("No wallet provider available.");

        const walletClient = createWalletClient({
          transport: custom(provider),
        });
        const [creatorAddr] = await walletClient.getAddresses();
        if (!creatorAddr) throw new Error("Could not get wallet address.");

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
        };

        // Upload metadata
        setRegisterState((p) => ({
          ...p,
          status: "uploading-metadata",
          progress: 60,
        }));
        const ipMetaUpload = await uploadJSON(ipMetadata);
        const ipMetaCid = extractCid(ipMetaUpload.cid || ipMetaUpload.url);
        const ipMetadataURI = toIpfsUri(ipMetaCid);
        const ipMetadataHash = await sha256HexOfJson(ipMetadata);

        // Create & upload separate NFT metadata
        const nftMetadata = {
          name: intent?.title || file.name,
          description: `${intent?.prompt || ""} This NFT represents ownership of the IP Asset.`,
          image: imageGateway,
          animation_url: imageGateway,
          attributes: [
            {
              trait_type: "Status",
              value: isAiGeneratedGroup(group)
                ? "AI Generated"
                : "Human Generated",
            },
          ],
        };
        const nftMetaUpload = await uploadJSON(nftMetadata);
        const nftMetaCid = extractCid(nftMetaUpload.cid || nftMetaUpload.url);
        const nftMetadataURI = toIpfsUri(nftMetaCid);
        const nftMetadataHash = await sha256HexOfJson(nftMetadata);

        // Mint & Register
        setRegisterState((p) => ({ ...p, status: "minting", progress: 75 }));
        await switchToStoryNetwork(provider);

        const story = StoryClient.newClient({
          account: creatorAddr,
          transport: custom(provider),
          chainId: "mainnet",
        });

        // Konversi ke on-chain LicenseTerms
        const licenseTerms = toLicenseTerms(licenseSettings);

        const result = await story.ipAsset.registerIpAsset({
          nft: {
            type: "mint",
            spgNftContract: import.meta.env
              .VITE_PUBLIC_SPG_COLLECTION_USERS as `0x${string}`,
          },
          licenseTermsData: [{ terms: licenseTerms }],
          ipMetadata: {
            ipMetadataURI,
            ipMetadataHash: ipMetadataHash as `0x${string}`,
            nftMetadataURI,
            nftMetadataHash: nftMetadataHash as `0x${string}`,
          },
        });

        setRegisterState({
          status: "success",
          progress: 100,
          error: null,
          ipId: result?.ipId,
          txHash: result?.txHash,
        });

        return {
          success: true,
          ipId: result?.ipId,
          txHash: result?.txHash,
          imageUrl: imageGateway,
        };
      } catch (error: any) {
        const msg = formatError(error);
        setRegisterState({ status: "error", progress: 0, error: msg });
        return { success: false, error: msg };
      }
    },
    [],
  );

  const resetRegister = useCallback(() => {
    setRegisterState({ status: "idle", progress: 0, error: null });
  }, []);

  return { registerState, executeRegister, resetRegister };
}

// Helper functions
async function switchToStoryNetwork(provider: any) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId?.toLowerCase() !== "0x5ea") {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x5ea" }],
    });
  }
}

function formatError(error: any): string {
  const msg = error?.message || String(error);
  if (msg.includes("rejected")) return "Transaction rejected by user.";
  if (msg.includes("insufficient funds")) return "Insufficient funds for gas.";
  if (msg.includes("CallerNotAuthorizedToMint"))
    return "Wallet not authorized to mint.";
  return msg;
}
