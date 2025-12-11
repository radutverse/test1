import multer from "multer";
import axios from "axios";
import FormData from "form-data";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY; // e.g. mysubdomain.mypinata.cloud

async function pinFileToPinata(name: string, buffer: Buffer, mimetype: string) {
  if (!PINATA_JWT) throw new Error("PINATA_JWT not set");
  const form = new FormData();
  form.append("file", buffer, {
    filename: name || "file",
    contentType: mimetype || "application/octet-stream",
  });

  const options = {
    method: "POST" as const,
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...form.getHeaders(),
    },
    data: form,
  };

  try {
    const response = await axios(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      options,
    );
    const cid: string =
      response.data?.IpfsHash || response.data?.Hash || response.data?.cid;
    if (!cid) throw new Error("cid_missing");
    return cid;
  } catch (error) {
    const status = (error as any)?.response?.status;
    throw new Error(`pinata_file_error:${status || "unknown"}`);
  }
}

async function pinJsonToPinata(json: unknown) {
  if (!PINATA_JWT) throw new Error("PINATA_JWT not set");
  const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
  const options = {
    method: "POST" as const,
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    data: {
      pinataOptions: { cidVersion: 0 },
      pinataMetadata: { name: "ip-metadata.json" },
      pinataContent: json,
    },
  };

  try {
    const response = await axios(url, options);
    const cid: string =
      response.data?.IpfsHash || response.data?.Hash || response.data?.cid;
    if (!cid) throw new Error("cid_missing");
    return cid;
  } catch (error) {
    const status = (error as any)?.response?.status;
    throw new Error(`pinata_json_error:${status || "unknown"}`);
  }
}

export const handleIpfsUpload: any = [
  upload.single("file"),
  (async (req: any, res: any) => {
    try {
      const f = (req as any).file as any;
      if (!f) return res.status(400).json({ error: "no_file" });
      const cid = await pinFileToPinata(
        f.originalname || "file",
        f.buffer,
        f.mimetype || "application/octet-stream",
      );
      const https = PINATA_GATEWAY
        ? `https://${PINATA_GATEWAY}/ipfs/${cid}`
        : undefined;
      return res.status(200).json({ cid, url: `ipfs://${cid}`, https });
    } catch (err) {
      console.error("ipfs upload error:", err);
      return res.status(500).json({ error: "ipfs_upload_failed" });
    }
  }) as any,
];

export const handleIpfsUploadJson: any = async (req: any, res: any) => {
  try {
    const data = req.body?.data ?? req.body;
    const cid = await pinJsonToPinata(data);
    const https = PINATA_GATEWAY
      ? `https://${PINATA_GATEWAY}/ipfs/${cid}`
      : undefined;
    return res.status(200).json({ cid, url: `ipfs://${cid}`, https });
  } catch (err) {
    console.error("ipfs json upload error:", err);
    return res.status(500).json({ error: "ipfs_json_upload_failed" });
  }
};
