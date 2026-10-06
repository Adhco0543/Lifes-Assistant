import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "../../../lib/serverAuth";

/**
 * POST /api/transcribe
 * Transcribe audio using OpenAI Whisper API
 * 
 * Request body: FormData with audio blob
 * Response: { text: string, confidence: number, duration: number }
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyFirebaseRequest(request))) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file is too large." }, { status: 413 });
    }

    if (audioFile.type && !audioFile.type.startsWith("audio/") && !audioFile.type.startsWith("video/")) {
      return NextResponse.json({ error: "Unsupported audio format." }, { status: 400 });
    }

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY not configured");
      return NextResponse.json(
        { error: "Transcription service not configured" },
        { status: 500 }
      );
    }

    // Prepare request to Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "en");

    // Call OpenAI Whisper API
    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperFormData,
      }
    );

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json();
      console.error("Whisper API error:", error);
      return NextResponse.json(
        { error: "Transcription failed", details: error },
        { status: whisperResponse.status }
      );
    }

    const result = await whisperResponse.json();

    // Estimate confidence based on text length and content
    const confidence = estimateConfidence(result.text);

    return NextResponse.json({
      text: result.text,
      confidence,
      duration: audioFile.size / (16000 * 2 / 8), // Rough estimate
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Estimate transcription confidence (0-100)
 * Higher confidence for longer, more coherent text
 */
function estimateConfidence(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Base confidence on length
  let confidence = Math.min(100, Math.max(30, (text.length / 50) * 100));
  
  // Boost for proper capitalization
  if (text[0] === text[0].toUpperCase()) confidence += 5;
  
  // Boost for punctuation
  if (text.includes(".") || text.includes("?") || text.includes("!")) {
    confidence += 10;
  }
  
  // Reduce for all caps (usually a sign of poor recognition)
  if (text === text.toUpperCase() && text.length > 5) {
    confidence -= 15;
  }
  
  return Math.min(100, confidence);
}
