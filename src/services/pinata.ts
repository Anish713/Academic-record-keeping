import axios from "axios";

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_API_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_API_SECRET_KEY;
const PINATA_GATEWAY_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL;

if (!PINATA_API_KEY || !PINATA_API_SECRET_KEY || !PINATA_GATEWAY_URL) {
  throw new Error(
    "Pinata API Key, Secret, or Gateway URL is not set in environment variables."
  );
}

export const pinataService = {
  uploadFile: async (file: File) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await axios.post(url, data, {
        maxBodyLength: Infinity,
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error uploading file to Pinata:", error);
      throw new Error("Failed to upload file to Pinata.");
    }
  },

  getGatewayUrl: (ipfsHash: string) => {
    if (!PINATA_GATEWAY_URL) {
      return "";
    }
    const gateway =
      PINATA_GATEWAY_URL.startsWith("https://") ||
      PINATA_GATEWAY_URL.startsWith("http://")
        ? PINATA_GATEWAY_URL
        : `https://${PINATA_GATEWAY_URL}`;

    return `${gateway}/ipfs/${ipfsHash}`;
  },
};
