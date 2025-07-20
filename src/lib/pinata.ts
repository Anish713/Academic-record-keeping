const PINATA_GATEWAY_URL = process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL;

if (!PINATA_GATEWAY_URL) {
  throw new Error(
    "Pinata Gateway URL is not set in environment variables. Make sure NEXT_PUBLIC_PINATA_GATEWAY_URL is set."
  );
}

export const getGatewayUrl = (ipfsHash: string) => {
  if (!PINATA_GATEWAY_URL) {
    return "";
  }
  const gateway =
    PINATA_GATEWAY_URL.startsWith("https://") ||
    PINATA_GATEWAY_URL.startsWith("http://")
      ? PINATA_GATEWAY_URL
      : `https://${PINATA_GATEWAY_URL}`;

  return `${gateway}/ipfs/${ipfsHash}`;
};
