# Story 2.3: Voice Capture with Transcription

## Story Overview

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Story ID**         | 2.3                                             |
| **Epic**             | [Epic 2: Unified Inbox & Capture](epic-2.md)    |
| **Priority**         | P1 - High                                       |
| **Estimated Effort** | Medium (2-3 days)                               |
| **Dependencies**     | Story 2.1 (Manual Text Capture)                 |
| **Blocks**           | None                                            |

## User Story

**As a** user,
**I want** to capture ideas via voice recording with automatic transcription,
**So that** I can capture thoughts hands-free while walking, driving, or doing other activities.

## Detailed Description

This story adds voice capture to the capture modal. Users can:

- **Record voice** using the device microphone
- **See real-time transcription** as they speak (using Web Speech API)
- **Review and edit** the transcription before saving
- **Save both audio and text** for later reference

The voice capture leverages the browser's Web Speech API for transcription, which works offline and has no API costs. Audio is stored in Supabase Storage for playback.

## Acceptance Criteria

### AC1: Voice Recording UI

- [ ] Microphone button visible in capture modal (new tab: Voice)
- [ ] Recording indicator (pulsing red dot) when active
- [ ] Timer showing recording duration
- [ ] Stop button to end recording
- [ ] Cancel option to discard recording

### AC2: Real-time Transcription

- [ ] Web Speech API used for speech-to-text
- [ ] Transcription appears in real-time as user speaks
- [ ] Interim (in-progress) results shown in gray
- [ ] Final results shown in black
- [ ] Transcription auto-scrolls as it grows

### AC3: Review & Edit

- [ ] After stopping, transcription is editable
- [ ] User can make corrections before saving
- [ ] Audio playback available for reference
- [ ] Option to re-record (discard and start over)

### AC4: Audio Storage

- [ ] Audio recorded in WebM format (browser native)
- [ ] Audio uploaded to Supabase Storage
- [ ] Stored in: `inbox/{userId}/voice/{timestamp}.webm`
- [ ] Upload progress indicator shown

### AC5: InboxItem Creation

- [ ] InboxItem created with:
  - `type: "voice"`
  - `content: [transcribed text]`
  - `mediaUrl: [Supabase Storage URL for audio]`
  - `source: "capture"`
  - `status: "pending"`
- [ ] Success feedback same as other captures

### AC6: Browser Compatibility

- [ ] Works on Chrome (desktop and Android)
- [ ] Works on Safari (iOS and macOS)
- [ ] Works on Firefox (desktop)
- [ ] Graceful fallback if Web Speech API unavailable
- [ ] Microphone permission request handled

### AC7: Playback

- [ ] Audio playable from inbox item detail
- [ ] Simple audio player with play/pause
- [ ] Duration and current time displayed

## Technical Implementation Notes

### File: `components/capture/voice-capture.tsx`

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface VoiceCaptureProps {
  onRecordingComplete: (audioBlob: Blob, transcription: string) => void;
  onCancel: () => void;
  isUploading: boolean;
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'playing';

export function VoiceCapture({
  onRecordingComplete,
  onCancel,
  isUploading,
}: VoiceCaptureProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcription, setTranscription] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
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
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition || !navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false);
      setError('Voice capture is not supported in this browser');
    }
  }, []);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
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
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      }
    };

    return recognition;
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      setTranscription('');
      setInterimTranscript('');
      setDuration(0);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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

      setRecordingState('recording');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
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
      setInterimTranscript('');
    }

    setRecordingState('stopped');
  };

  // Toggle audio playback
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (recordingState === 'playing') {
      audioRef.current.pause();
      setRecordingState('stopped');
    } else {
      audioRef.current.play();
      setRecordingState('playing');
    }
  };

  // Reset recording
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setTranscription('');
    setInterimTranscript('');
    setDuration(0);
    setRecordingState('idle');
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        {recordingState === 'idle' && (
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

        {recordingState === 'recording' && (
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

        {recordingState === 'stopped' && (
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={togglePlayback}
              className="h-12 w-12 rounded-full"
            >
              {recordingState === 'playing' ? (
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
            onEnded={() => setRecordingState('stopped')}
          />
        )}
      </div>

      {/* Transcription display/edit */}
      {(transcription || interimTranscript || recordingState === 'recording') && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Transcription</label>
          {recordingState === 'stopped' ? (
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
                {recordingState === 'recording' && (
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
      {recordingState === 'stopped' && transcription && (
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
            'Save Voice Note'
          )}
        </Button>
      )}
    </div>
  );
}
```

### File: `types/speech-recognition.d.ts`

```typescript
// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
```

### File: `components/capture/capture-modal.tsx` (Updated with Voice tab)

```typescript
// Add Voice tab to the existing capture modal

import { VoiceCapture } from './voice-capture';

// Inside the modal component, add to Tabs:
<TabsTrigger value="voice" className="flex-1">
  <Mic className="mr-2 h-4 w-4" />
  Voice
</TabsTrigger>

// Add TabsContent for voice:
<TabsContent value="voice">
  <VoiceCapture
    onRecordingComplete={handleVoiceRecordingComplete}
    onCancel={() => setActiveTab('text')}
    isUploading={isUploading}
  />
</TabsContent>

// Add handler function:
const handleVoiceRecordingComplete = async (audioBlob: Blob, transcription: string) => {
  try {
    setIsUploading(true);

    // Upload audio to Supabase Storage
    const timestamp = Date.now();
    const path = `inbox/${userId}/voice/${timestamp}.webm`;
    const { url } = await uploadAudio(audioBlob, path, setUploadProgress);

    // Create inbox item
    createInboxItem.mutate({
      type: 'voice',
      content: transcription,
      mediaUrl: url,
      source: 'capture',
    });
  } catch (error) {
    toast.error('Failed to upload audio');
  } finally {
    setIsUploading(false);
  }
};
```

### File: `lib/storage.ts` (Add audio upload)

```typescript
export async function uploadAudio(
  blob: Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  onProgress?.(10);

  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, blob, {
      contentType: 'audio/webm',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.(90);

  const {
    data: { publicUrl },
  } = supabase.storage.from('media').getPublicUrl(path);

  onProgress?.(100);

  return {
    url: publicUrl,
    path: data.path,
  };
}
```

### File: `components/inbox/audio-player.tsx`

```typescript
'use client';

import { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex items-center gap-3 rounded-lg bg-gray-100 p-3', className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-10 w-10 rounded-full"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>

      <div className="flex flex-1 items-center gap-2">
        <span className="w-10 text-xs text-gray-500">{formatTime(currentTime)}</span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="w-10 text-xs text-gray-500">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
```

## Files to Create/Modify

| File                                      | Action | Purpose                          |
| ----------------------------------------- | ------ | -------------------------------- |
| `components/capture/voice-capture.tsx`    | Create | Voice recording component        |
| `types/speech-recognition.d.ts`           | Create | TypeScript types for Web Speech  |
| `components/inbox/audio-player.tsx`       | Create | Audio playback component         |
| `components/capture/capture-modal.tsx`    | Modify | Add voice capture tab            |
| `lib/storage.ts`                          | Modify | Add audio upload function        |

## Dependencies to Install

```bash
pnpm dlx shadcn-ui@latest add slider
```

## Environment Variables Required

None additional for this story (uses existing Supabase config).

## Testing Requirements

### Manual Testing

1. **Basic Recording:**
   - Open capture modal, select Voice tab
   - Tap microphone button
   - Allow microphone permission
   - Speak for 10+ seconds
   - Verify red pulsing indicator visible
   - Verify timer incrementing
   - Tap stop button
   - Verify transcription appeared

2. **Transcription Quality:**
   - Speak clearly in English
   - Verify words appear as you speak
   - Verify interim (gray) vs final (black) text
   - After stopping, verify text is editable

3. **Audio Playback:**
   - After recording, tap play button
   - Verify audio plays back correctly
   - Verify pause works
   - Verify re-record discards and restarts

4. **Submission:**
   - Complete recording with transcription
   - Tap "Save Voice Note"
   - Verify upload progress shown
   - Verify success toast
   - Verify inbox item created with type="voice"

5. **Browser Compatibility:**
   - Test on Chrome desktop
   - Test on Safari macOS
   - Test on Safari iOS
   - Test on Chrome Android
   - Verify graceful fallback on unsupported browsers

### Integration Tests

```typescript
describe('Voice capture', () => {
  it('creates inbox item with voice type and mediaUrl', async () => {
    const caller = createCaller({ session: mockSession });

    const result = await caller.inbox.create({
      type: 'voice',
      content: 'This is a voice transcription',
      mediaUrl: 'https://example.com/audio.webm',
      source: 'capture',
    });

    expect(result.type).toBe('voice');
    expect(result.content).toBe('This is a voice transcription');
    expect(result.mediaUrl).toContain('audio.webm');
  });
});
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Recording works with visual feedback
- [ ] Real-time transcription displays as user speaks
- [ ] Transcription is editable after recording
- [ ] Audio stored in Supabase Storage
- [ ] Audio playable from inbox item
- [ ] Works on Chrome, Safari, Firefox
- [ ] Graceful fallback on unsupported browsers
- [ ] Microphone permission handling works
- [ ] Integration tests pass

## Notes & Decisions

- **Web Speech API:** Free, works offline, no API key required
- **WebM format:** Native browser recording format, good compression
- **Editable transcription:** Users can fix mistakes before saving
- **Both audio + text saved:** Audio is fallback if transcription is poor
- **No server-side transcription (MVP):** Can add Whisper API later for better accuracy

## Browser Support Matrix

| Browser        | Recording | Transcription | Notes                        |
| -------------- | --------- | ------------- | ---------------------------- |
| Chrome Desktop | ✅        | ✅            | Full support                 |
| Chrome Android | ✅        | ✅            | Full support                 |
| Safari macOS   | ✅        | ✅            | Full support                 |
| Safari iOS     | ✅        | ✅            | Requires HTTPS               |
| Firefox        | ✅        | ❌            | Recording only, no Web Speech|
| Edge           | ✅        | ✅            | Full support (Chromium-based)|

## Related Documentation

- [Web Speech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [MediaRecorder API MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [PRD](../../prd.md) - FR3 (Voice capture requirements)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Status

Ready for Review

### File List

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/types/speech-recognition.d.ts` | Created | TypeScript types for Web Speech API |
| `apps/web/src/components/capture/voice-capture.tsx` | Created | Voice recording component with real-time transcription |
| `apps/web/src/components/inbox/audio-player.tsx` | Created | Audio playback component with seek slider |
| `apps/web/src/components/ui/slider.tsx` | Created | Shadcn slider component (installed via CLI) |
| `apps/web/src/lib/storage.ts` | Modified | Added uploadAudio function for WebM uploads |
| `apps/web/src/components/capture/capture-modal.tsx` | Modified | Added Voice tab with VoiceCapture integration |

### Change Log

- 2026-01-11: Implemented voice capture feature
  - Created speech-recognition.d.ts with Web Speech API types
  - Created VoiceCapture component with MediaRecorder and Web Speech API
  - Created AudioPlayer component for playback in inbox items
  - Added uploadAudio function to storage.ts
  - Added Voice tab to capture modal (mobile and desktop)
  - Installed @radix-ui/react-slider for audio player seek

### Debug Log References

None

### Completion Notes

- All implementation tasks completed per story requirements
- Lint passes with no errors
- TypeScript type checking passes
- No test framework currently configured in the project (vitest/jest) - integration tests from story are ready to run once test infrastructure is added
- Voice type already supported in inbox router schema
- Browser compatibility handled via feature detection in VoiceCapture component
