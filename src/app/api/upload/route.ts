import { NextRequest, NextResponse } from "next/server";
import { pinataService } from "@/services/pinata";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file found" },
        { status: 400 }
      );
    }

    const pinataResponse = await pinataService.uploadFile(file);

    return NextResponse.json({
      success: true,
      ipfsHash: pinataResponse.IpfsHash,
    });
  } catch (error) {
    console.error("Error in upload API:", error);
    return NextResponse.json(
      { success: false, message: "Upload failed" },
      { status: 500 }
    );
  }
}
