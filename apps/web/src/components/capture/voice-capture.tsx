"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VoiceCaptureProps {
  onRecordingComplete: (audioBlob: Blob, transcription: string) => void;
  onCancel?: () => void;
  isUploading: boolean;
}

type RecordingState = "idle" | "recording" | "stopped" | "playing";

export function VoiceCapture({
  onRecordingComplete,
  isUploading,
}: VoiceCaptureProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcription, setTranscription] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI || !navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false);
      setError("Voice capture is not supported in this browser");
    }
  }, []);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscription((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access.");
      }
    };

    return recognition;
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      setTranscription("");
      setInterimTranscript("");
      setDuration(0);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms

      // Initialize and start speech recognition
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        recognition.start();
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      setRecordingState("recording");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Add any remaining interim transcript
    if (interimTranscript) {
      setTranscription((prev) => prev + interimTranscript);
      setInterimTranscript("");
    }

    setRecordingState("stopped");
  };

  // Toggle audio playback
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (recordingState === "playing") {
      audioRef.current.pause();
      setRecordingState("stopped");
    } else {
      audioRef.current.play();
      setRecordingState("playing");
    }
  };

  // Reset recording
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setTranscription("");
    setInterimTranscript("");
    setDuration(0);
    setRecordingState("idle");
    audioBlobRef.current = null;
  };

  // Submit recording
  const handleSubmit = () => {
    if (!audioBlobRef.current || !transcription.trim()) return;
    onRecordingComplete(audioBlobRef.current, transcription.trim());
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [audioUrl]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
        <p className="text-yellow-800">
          Voice capture is not supported in this browser.
        </p>
        <p className="mt-1 text-sm text-yellow-600">
          Try using Chrome, Safari, or Edge for voice capture.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recording controls */}
      <div className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 p-6">
        {recordingState === "idle" && (
          <>
            <Button
              type="button"
              size="lg"
              onClick={startRecording}
              className="h-16 w-16 rounded-full"
            >
              <Mic className="h-8 w-8" />
            </Button>
            <p className="mt-3 text-sm text-gray-500">Tap to start recording</p>
          </>
        )}

        {recordingState === "recording" && (
          <>
            <div className="relative">
              <Button
                type="button"
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                className="h-16 w-16 rounded-full"
              >
                <Square className="h-6 w-6" />
              </Button>
              {/* Pulsing indicator */}
              <span className="absolute -right-1 -top-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
              </span>
            </div>
            <p className="mt-3 font-mono text-lg">{formatDuration(duration)}</p>
            <p className="text-sm text-gray-500">Recording... Tap to stop</p>
          </>
        )}

        {(recordingState === "stopped" || recordingState === "playing") && (
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={togglePlayback}
              className="h-12 w-12 rounded-full"
            >
              {recordingState === "playing" ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <span className="font-mono">{formatDuration(duration)}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={resetRecording}
              className="h-12 w-12 rounded-full"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Hidden audio element for playback */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setRecordingState("stopped")}
          />
        )}
      </div>

      {/* Transcription display/edit */}
      {(transcription ||
        interimTranscript ||
        recordingState === "recording") && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Transcription</label>
          {recordingState === "stopped" || recordingState === "playing" ? (
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="min-h-[100px]"
              placeholder="Edit transcription..."
            />
          ) : (
            <div className="min-h-[100px] rounded-md border bg-white p-3">
              <p>
                {transcription}
                <span className="text-gray-400">{interimTranscript}</span>
                {recordingState === "recording" && (
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-gray-400" />
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Submit button */}
      {(recordingState === "stopped" || recordingState === "playing") &&
        transcription && (
          <Button
            onClick={handleSubmit}
            disabled={isUploading || !transcription.trim()}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Save Voice Note"
            )}
          </Button>
        )}
    </div>
  );
}
