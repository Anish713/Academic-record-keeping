import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import FormData from "form-data";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET_KEY = process.env.PINATA_API_SECRET_KEY;

if (!PINATA_API_KEY || !PINATA_API_SECRET_KEY) {
  throw new Error(
    "Pinata API Key or Secret is not set in environment variables."
  );
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10 MB limit
      return NextResponse.json(
        { error: "File size exceeds 10MB limit." },
        { status: 413 }
      );
    }

    const formData = new FormData();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    formData.append("file", buffer, file.name);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET_KEY,
        },
      }
    );

    return NextResponse.json({ IpfsHash: response.data.IpfsHash });
  } catch (error) {
    console.error("Error uploading file to Pinata:", error);
    return NextResponse.json(
      { error: "Failed to upload file to Pinata." },
      { status: 500 }
    );
  }
}
