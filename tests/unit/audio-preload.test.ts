import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const sound = (file: string) => ({ type: "sound" as const, file });
const buffer = {} as AudioBuffer;
let decode: ReturnType<typeof vi.fn>;
let resume: ReturnType<typeof vi.fn>;
let start: ReturnType<typeof vi.fn>;
let stop: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  decode = vi.fn().mockResolvedValue(buffer);
  resume = vi.fn().mockResolvedValue(undefined);
  start = vi.fn(); stop = vi.fn(); disconnect = vi.fn();
  vi.stubGlobal("AudioContext", class {
    state = "suspended";
    destination = {};
    decodeAudioData = decode;
    resume = resume;
    createBufferSource() { return { buffer: null, connect: vi.fn(), start, stop, disconnect }; }
    createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect }; }
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("public audio preload", () => {
  it("waits for fetch AND decode of every sound without playing or resuming", async () => {
    const fetched = deferred<{ ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }>();
    const decoded = deferred<AudioBuffer>();
    vi.mocked(fetch).mockReturnValueOnce(fetched.promise as Promise<Response>);
    decode.mockReturnValueOnce(decoded.promise);
    const { preloadPsyflowAudio } = await import("../../src/index");
    let finished = false;
    const prepared = preloadPsyflowAudio([sound("slow.wav"), sound("other.wav")]).then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    fetched.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    decoded.resolve(buffer);
    await prepared;
    expect(finished).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it("shares decoded buffers with playback and preserves cancellation cleanup", async () => {
    const { preloadPsyflowAudio, playSoundStimuli } = await import("../../src/jspsych/audio");
    await preloadPsyflowAudio([sound("cached.wav"), sound("cached.wav")]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    const cleanup = playSoundStimuli([sound("cached.wav")]);
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledOnce();
    cleanup?.();
    expect(stop).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("propagates HTTP, network and decoding failures instead of reporting ready", async () => {
    const { preloadPsyflowAudio } = await import("../../src/jspsych/audio");
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    await expect(preloadPsyflowAudio([sound("missing.wav")])).rejects.toThrow("Failed to fetch audio asset");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network unavailable"));
    await expect(preloadPsyflowAudio([sound("network.wav")])).rejects.toThrow("network unavailable");
    decode.mockRejectedValueOnce(new Error("invalid PCM"));
    await expect(preloadPsyflowAudio([sound("broken.wav")])).rejects.toThrow("invalid PCM");
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects unsupported Web Audio for nonempty tasks but permits empty preparation", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { preloadPsyflowAudio } = await import("../../src/jspsych/audio");
    await expect(preloadPsyflowAudio([sound("tone.wav")])).rejects.toThrow("Web Audio is required");
    await expect(preloadPsyflowAudio([])).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
