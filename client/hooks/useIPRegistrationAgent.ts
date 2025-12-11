import { useCallback, useState } from "react";
import { StoryClient, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";
import { createWalletClient, custom, parseEther } from "viem";
import {
  getLicenseSettingsByGroup,
  requiresSelfieVerification,
  requiresSubmitReview,
  isAiGeneratedGroup,
} from "@/lib/groupLicense";
import { getLicenseSettingsByType, toLicenseTerms } from "@/lib/license/terms";
// ... import IPFS utils tetap sama

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
      licenseType?: string
    ) => {
      try {
        // Validasi grup
        if (requiresSelfieVerification(group)) {
          return { success: false, reason: "selfie_required" } as const;
        }
        if (requiresSubmitReview(group)) {
          return { success: false, reason: "submit_review" } as const;
        }

        // Dapatkan license settings
        let licenseSettings = licenseType
          ? getLicenseSettingsByType(licenseType, aiTrainingManual, mintingFee, revShare)
          : getLicenseSettingsByGroup(group, aiTrainingManual, mintingFee, revShare);

        if (!licenseSettings) {
          throw new Error("Cannot register: licenseSettings null");
        }

        // ... compress & upload image (tetap sama)

        setRegisterState((p) => ({ ...p, status: "minting", progress: 75 }));

        const provider = ethereumProvider || (globalThis as any).ethereum;
        if (!provider) throw new Error("No wallet provider available.");

        await switchToStoryNetwork(provider);

        const walletClient = createWalletClient({ transport: custom(provider) });
        const [addr] = await walletClient.getAddresses();

        const story = StoryClient.newClient({
          account: addr,
          transport: custom(provider),
          chainId: "mainnet",
        });

        // Konversi ke LicenseTerms on-chain
        const licenseTerms = toLicenseTerms(licenseSettings);

        const result = await story.ipAsset.registerIpAsset({
          nft: {
            type: "mint",
            spgNftContract: import.meta.env.VITE_PUBLIC_SPG_COLLECTION_USERS as `0x${string}`,
          },
          licenseTermsData: [{ terms: licenseTerms }],
          ipMetadata: {
            ipMetadataURI,
            ipMetadataHash: ipMetadataHash as `0x${string}`,
            nftMetadataURI: ipMetadataURI,
            nftMetadataHash: ipMetadataHash as `0x${string}`,
          },
        });

        setRegisterState({
          status: "success",
          progress: 100,
          error: null,
          ipId: result?.ipId,
          txHash: result?.txHash,
        });

        return { success: true, ipId: result?.ipId, txHash: result?.txHash };
      } catch (error: any) {
        // ... error handling tetap sama
      }
    },
    []
  );

  return { registerState, executeRegister, resetRegister };
}

async function switchToStoryNetwork(provider: any) {
  const chainIdHex = await provider.request({ method: "eth_chainId" });
  if (chainIdHex?.toLowerCase() !== "0x5ea") {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x5ea" }],
    });
  }
}
