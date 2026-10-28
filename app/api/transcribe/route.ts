import { NextRequest, NextResponse } from "next/server";
import { reportIntegrationFailure } from "../../../lib/integrationDiagnostics";
import { isFileTooLarge, readLimitedFormData } from "../../../lib/requestLimits";
import { verifyFirebaseRequest } from "../../../lib/serverAuth";
import { parseTranscriptionResult } from "../../../lib/transcriptionContracts";

/**
 * POST /api/transcribe
 * Transcribe audio using OpenAI Whisper API
 * 
 * Request body: FormData with audio blob
 * Response: { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyFirebaseRequest(request))) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limited = await readLimitedFormData(request, 26 * 1024 * 1024);
    if (!limited.ok) {
      return NextResponse.json(
        { error: limited.status === 413 ? "Audio file is too large." : "Choose an audio file to transcribe." },
        { status: limited.status }
      );
    }
    const formData = limited.value;
    const audioValue = formData.get("audio");

    if (!audioValue || typeof audioValue === "string" || audioValue.size === 0) {
      return NextResponse.json(
        { error: "Choose an audio file to transcribe." },
        { status: 400 }
      );
    }

    const audioFile = audioValue;
    if (isFileTooLarge(audioFile, 25 * 1024 * 1024)) {
      return NextResponse.json({ error: "Audio file is too large." }, { status: 413 });
    }

    if (!audioFile.type.startsWith("audio/") && !audioFile.type.startsWith("video/")) {
      return NextResponse.json({ error: "Unsupported audio format." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Transcription service is not configured." },
        { status: 503 }
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
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!whisperResponse.ok) {
      reportIntegrationFailure("openai", "request", whisperResponse.status);
      return NextResponse.json({ error: "Transcription failed. Try again." }, { status: 502 });
    }

    const parsed = parseTranscriptionResult(await whisperResponse.json().catch(() => null));
    if (!parsed) {
      reportIntegrationFailure("openai", "parse-response", whisperResponse.status);
      return NextResponse.json({ error: "Transcription service returned an invalid response." }, { status: 502 });
    }

    return NextResponse.json({ text: parsed.text });
  } catch {
    reportIntegrationFailure("openai", "request");
    return NextResponse.json(
      { error: "Transcription failed. Check your connection and try again." },
      { status: 502 }
    );
  }
}
