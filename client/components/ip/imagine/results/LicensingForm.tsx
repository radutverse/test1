import { useState, forwardRef, useImperativeHandle } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { StoryClient, WIP_TOKEN_ADDRESS } from "@story-protocol/core-sdk";
import { createWalletClient, custom } from "viem";
import { sha256HexOfJson } from "@/lib/utils/crypto";
import { Address } from "viem";

// --- INTERFACE ---
interface ParentLicense {
  licenseTermsId: string;
  terms?: {
    commercialUse: boolean;
    commercialRevShare: number;
    mintingFee?: string | number;
    [key: string]: any;
  };
}

interface LicenseConfig {
  maxMintingFee: bigint;
  maxRts: number;
  maxRevenueShare: number;
  description: string;
}

interface ParentAsset {
  ipId: Address;
  title?: string;
  licenses?: ParentLicense[];
}

interface LicensingFormProps {
  imageUrl: string;
  imageName?: string;
  type: "image" | "video";
  isLoading?: boolean;
  onClose?: () => void;
  parentAsset?: ParentAsset;
  onRegisterStart?: (state: {
    status: string;
    progress: number;
    error: any;
  }) => void;
  onRegisterComplete?: (result: { ipId?: Address; txHash?: Address }) => void;
  onRegisterError?: (errorMessage: string) => void;
}

// --- KOMPONEN UTAMA ---
const LicensingFormComponent = (
  {
    imageUrl,
    imageName = "generated-image.png",
    type,
    isLoading = false,
    onClose,
    parentAsset,
    onRegisterStart,
    onRegisterComplete,
    onRegisterError,
  }: LicensingFormProps,
  ref: any,
) => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  // State
  const [title, setTitle] = useState("AI Generated Image");
  const [description, setDescription] = useState(
    "Created using AI image generation technology",
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [registeredIpId, setRegisteredIpId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<
    "idle" | "registering-derivative" | "claiming-revenue" | "success"
  >("idle");

  useImperativeHandle(ref, () => ({
    handleRegister,
  }));

  const isPaidRemix =
    parentAsset && parentAsset.licenses && parentAsset.licenses.length > 0;
  const parentLicense: ParentLicense | undefined = isPaidRemix
    ? parentAsset.licenses[0]
    : undefined;

  const isCommercialLicense = parentLicense?.terms?.commercialUse === true;

  const parentRevShareScaled = parentLicense?.terms?.commercialRevShare ?? 0;
  const parentRevSharePercentage = Number(parentRevShareScaled) / 1000000;

  // Get license configuration based on commercial/non-commercial
  const getLicenseConfig = (): LicenseConfig => {
    if (!isCommercialLicense) {
      // Non-Commercial License (e.g., NCSR - Non-Commercial Social Remixing)
      return {
        maxMintingFee: 0n,
        maxRts: 0,
        maxRevenueShare: 0,
        description:
          "Non-Commercial License: No fees or revenue share required",
      };
    }

    // Commercial License
    const mintingFee = parentLicense?.terms?.mintingFee
      ? BigInt(String(parentLicense.terms.mintingFee))
      : 0n;

    return {
      maxMintingFee: mintingFee,
      maxRts: 100_000_000,
      maxRevenueShare: 100,
      description: `Commercial License: Minting Fee ${mintingFee > 0n ? "applies" : "not required"}, ${parentRevSharePercentage.toFixed(2)}% revenue share`,
    };
  };

  const licenseConfig = getLicenseConfig();

  const handleConvertImageToFile = async (): Promise<File> => {
    if (!imageUrl) {
      throw new Error("No image URL available");
    }

    let blob: Blob;

    if (imageUrl.startsWith("data:")) {
      const [header, data] = imageUrl.split(",");
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: mimeType });
    } else if (imageUrl.startsWith("blob:")) {
      const response = await fetch(imageUrl);
      blob = await response.blob();
    } else {
      const response = await fetch(imageUrl);
      blob = await response.blob();
    }

    return new File([blob], imageName, {
      type: blob.type || "image/png",
    });
  };

  const handleRegister = async () => {
    if (!imageUrl) return setRegisterError("No image to register");
    if (!isPaidRemix || !parentAsset)
      return setRegisterError("Parent asset data required for licensing");
    if (!parentLicense)
      return setRegisterError("No commercial license found on parent IP");
    if (!authenticated)
      return setRegisterError("Please connect your wallet to register");

    setIsRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(false);

    let addr: Address | undefined;
    let childIpId: Address | undefined;

    try {
      let ethProvider: any = (window as any).ethereum;
      if (wallets && wallets[0]?.getEthereumProvider) {
        try {
          ethProvider = await wallets[0].getEthereumProvider();
        } catch (err) {
          console.warn("Failed to get ethereum provider:", err);
        }
      }

      if (!ethProvider) {
        throw new Error("Ethereum provider not available.");
      }

      // Chain switching logic...
      try {
        const chainIdHex: string = await ethProvider.request({
          method: "eth_chainId",
        });

        if (chainIdHex?.toLowerCase() !== "0x5ea") {
          try {
            await ethProvider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x5ea" }],
            });
          } catch (switchError: any) {
            try {
              await ethProvider.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x5ea",
                    chainName: "Story",
                    nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
                    rpcUrls: ["https://mainnet.storyrpc.io"],
                  },
                ],
              });
            } catch {}
            try {
              await ethProvider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x5ea" }],
              });
            } catch {}
          }
        }
      } catch (chainError: any) {
        console.warn("Chain switching warning:", chainError?.message);
      }

      try {
        const accounts = await ethProvider.request({ method: "eth_accounts" });
        if (!accounts || accounts.length === 0) {
          await ethProvider.request({ method: "eth_requestAccounts" });
        }
      } catch (accountError: any) {
        throw accountError;
      }

      const walletClient = createWalletClient({
        transport: custom(ethProvider),
      });
      const [a] = await walletClient.getAddresses();
      if (a) addr = a;

      if (!addr) throw new Error("Could not determine wallet address");

      const rpcUrl = (import.meta as any).env?.VITE_PUBLIC_STORY_RPC;
      if (!rpcUrl) throw new Error("RPC URL not set");

      const storyClient = StoryClient.newClient({
        account: addr,
        transport: custom(ethProvider),
        chainId: "mainnet", // atau "aeneid" untuk testnet
      });

      const file = await handleConvertImageToFile();

      // Upload image to IPFS
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image to IPFS");
      const { url: imageUri } = await uploadRes.json();

      const spg = (import.meta as any).env?.VITE_PUBLIC_SPG_COLLECTION_USERS;
      if (!spg) throw new Error("SPG collection not configured");

      const ipMetadataObj = {
        title: title || "AI Generated Image",
        description:
          description || "Created using AI image generation technology",
        ipType: "Image",
        createdAt: new Date().toISOString(),
        mediaUrl: imageUri,
      };

      const nftMetadataObj = {
        title: title || "AI Generated Image",
        description:
          description || "Created using AI image generation technology",
        image: imageUri,
        attributes: [
          { trait_type: "Type", value: "AI Generated Derivative" },
          { trait_type: "Parent IP", value: parentAsset.ipId },
        ],
      };

      const ipMetadataHash = await sha256HexOfJson(ipMetadataObj);
      const nftMetadataHash = await sha256HexOfJson(nftMetadataObj);

      // Upload IP metadata
      const ipMetadataFormData = new FormData();
      ipMetadataFormData.append(
        "file",
        new Blob([JSON.stringify(ipMetadataObj)], { type: "application/json" }),
        "ip-metadata.json",
      );
      const ipMetadataUploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: ipMetadataFormData,
      });
      if (!ipMetadataUploadRes.ok)
        throw new Error("Failed to upload IP metadata");
      const { url: ipMetadataUri } = await ipMetadataUploadRes.json();

      // Upload NFT metadata
      const nftMetadataFormData = new FormData();
      nftMetadataFormData.append(
        "file",
        new Blob([JSON.stringify(nftMetadataObj)], {
          type: "application/json",
        }),
        "nft-metadata.json",
      );
      const nftMetadataUploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: nftMetadataFormData,
      });
      if (!nftMetadataUploadRes.ok)
        throw new Error("Failed to upload NFT metadata");
      const { url: nftMetadataUri } = await nftMetadataUploadRes.json();

      // STEP 1: REGISTER DERIVATIVE IP ASSET
      console.log("📝 Step 1: Registering derivative IP asset...");
      setCurrentStep("registering-derivative");
      onRegisterStart?.({
        status: "Registering derivative IP asset...",
        progress: 50,
        error: null,
      });

      try {
        console.log("📋 License Configuration:", {
          type: isCommercialLicense ? "Commercial" : "Non-Commercial",
          maxMintingFee: licenseConfig.maxMintingFee.toString(),
          maxRts: licenseConfig.maxRts,
          maxRevenueShare: licenseConfig.maxRevenueShare,
          description: licenseConfig.description,
        });

        const derivativeResponse =
          await storyClient.ipAsset.registerDerivativeIpAsset({
            nft: { type: "mint", spgNftContract: spg as Address },
            derivData: {
              parentIpIds: [parentAsset.ipId],
              licenseTermsIds: [BigInt(parentLicense.licenseTermsId)],
              maxMintingFee: licenseConfig.maxMintingFee,
              maxRts: licenseConfig.maxRts,
              maxRevenueShare: licenseConfig.maxRevenueShare,
            },
            ipMetadata: {
              ipMetadataURI: ipMetadataUri,
              ipMetadataHash: ipMetadataHash as `0x${string}`,
              nftMetadataURI: nftMetadataUri,
              nftMetadataHash: nftMetadataHash as `0x${string}`,
            },
            // HAPUS licenseDocument - tidak didukung SDK
          });

        childIpId = derivativeResponse.ipId as Address;
        console.log("✅ Derivative IP asset registered:", childIpId);
      } catch (registerError: any) {
        const errorMsg = registerError?.message || String(registerError);
        console.error("❌ Register derivative error:", errorMsg);

        if (
          registerError?.code === 4001 ||
          errorMsg.includes("User rejected")
        ) {
          throw new Error("Transaction was rejected by the user");
        }
        if (errorMsg.includes("insufficient funds")) {
          throw new Error("Insufficient funds for gas and transaction");
        }
        if (errorMsg.includes("CallerNotAuthorizedToMint")) {
          throw new Error(
            "Your wallet is not authorized to mint on this contract",
          );
        }

        throw new Error(`Failed to register derivative IP: ${errorMsg}`);
      }

      // STEP 2: PARENT CLAIMS REVENUE (OPTIONAL)
      console.log("💰 Step 2: Parent claiming revenue...");
      setCurrentStep("claiming-revenue");
      onRegisterStart?.({
        status: "Parent claiming revenue...",
        progress: 85,
        error: null,
      });

      try {
        // claimAllRevenue dengan parameter yang benar
        const revenueResponse = await storyClient.royalty.claimAllRevenue({
          ancestorIpId: parentAsset.ipId,
          claimer: parentAsset.ipId,
          currencyTokens: [WIP_TOKEN_ADDRESS],
          childIpIds: childIpId ? [childIpId] : [],
          // RoyaltyPolicyLAP address dari deployed contracts
          royaltyPolicies: [
            "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E" as Address,
          ],
        });

        console.log(
          "✅ Parent claimed revenue:",
          revenueResponse.claimedTokens,
        );
      } catch (revenueError: any) {
        // Non-critical error - derivative sudah terdaftar
        console.warn(
          "⚠️ Revenue claiming issue (non-critical):",
          revenueError?.message,
        );
      }

      // FINALIZE
      setCurrentStep("success");
      setRegisteredIpId(childIpId || "pending");
      setRegisterSuccess(true);

      const licenseTypeMsg = isCommercialLicense
        ? `Commercial (${parentRevSharePercentage.toFixed(2)}% revenue share)`
        : "Non-Commercial";

      setSuccessMessage(
        `✅ Derivative registered (${licenseTypeMsg}). Child IP: ${childIpId}`,
      );

      onRegisterComplete?.({
        ipId: childIpId as Address,
        txHash: childIpId as Address,
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);

      let userFriendlyMsg = errorMsg;
      if (errorMsg.includes("rejected by the user")) {
        userFriendlyMsg = "❌ You rejected the transaction.";
      } else if (errorMsg.includes("insufficient funds")) {
        userFriendlyMsg = "❌ Insufficient funds for gas fees.";
      }

      setRegisterError(userFriendlyMsg);
      console.error("❌ Full registration error:", error);
      onRegisterError?.(userFriendlyMsg);
      setCurrentStep("idle");
    } finally {
      setIsRegistering(false);
    }
  };

  // ... REST OF THE UI CODE REMAINS THE SAME ...
  return (
    <div className="w-full h-full p-6 space-y-4 flex flex-col">
      {/* UI code tetap sama */}
    </div>
  );
};

const LicensingForm = forwardRef(LicensingFormComponent);
export default LicensingForm;
