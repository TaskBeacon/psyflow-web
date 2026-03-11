import type { SoundStimSpec } from "../core/types";

let sharedAudioContext: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioContextCtor =
    window.AudioContext ??
    (
      window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }
  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
}

async function loadBuffer(context: AudioContext, file: string): Promise<AudioBuffer> {
  let pending = bufferCache.get(file);
  if (!pending) {
    pending = fetch(file)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch audio asset: ${file}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)));
    bufferCache.set(file, pending);
  }
  return pending;
}

export async function primePsyflowAudio(): Promise<void> {
  const context = getAudioContext();
  if (!context) {
    return;
  }
  if (context.state === "suspended") {
    await context.resume();
  }
}

function playWithHtmlAudio(specs: SoundStimSpec[]): () => void {
  const audios = specs.map((spec) => {
    const audio = new Audio(spec.file);
    audio.preload = "auto";
    (
      audio as HTMLAudioElement & {
        playsInline?: boolean;
      }
    ).playsInline = true;
    if (typeof spec.volume === "number") {
      audio.volume = Math.max(0, Math.min(1, spec.volume));
    }
    void audio.play().catch(() => {
      // Best-effort fallback when Web Audio is unavailable.
    });
    return audio;
  });
  return () => {
    for (const audio of audios) {
      audio.pause();
      audio.currentTime = 0;
    }
  };
}

export function playSoundStimuli(specs: SoundStimSpec[]): (() => void) | null {
  if (specs.length === 0) {
    return null;
  }
  const context = getAudioContext();
  if (!context) {
    return playWithHtmlAudio(specs);
  }

  let cancelled = false;
  const cleanupTasks: Array<() => void> = [];

  void primePsyflowAudio().then(() => {
    for (const spec of specs) {
      void loadBuffer(context, spec.file)
        .then((buffer) => {
          if (cancelled) {
            return;
          }
          const source = context.createBufferSource();
          source.buffer = buffer;
          const gainNode = context.createGain();
          gainNode.gain.value =
            typeof spec.volume === "number" ? Math.max(0, Math.min(1, spec.volume)) : 1;
          source.connect(gainNode);
          gainNode.connect(context.destination);
          source.start();
          cleanupTasks.push(() => {
            try {
              source.stop();
            } catch {
              // Ignore stop errors after natural playback end.
            }
            source.disconnect();
            gainNode.disconnect();
          });
        })
        .catch(() => {
          // Best-effort audio playback; missing or blocked assets should not crash the trial.
        });
    }
  });

  return () => {
    cancelled = true;
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      task?.();
    }
  };
}
