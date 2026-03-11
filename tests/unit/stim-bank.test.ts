import { describe, expect, it } from "vitest";

import { StimBank } from "../../src/core/StimBank";

describe("StimBank voice helpers", () => {
  it("registers speech stimuli from text stimuli with psyflow-like convert_to_voice", () => {
    const bank = new StimBank({
      instruction_text: {
        type: "textbox",
        text: "Press space to begin."
      }
    });

    bank.convert_to_voice("instruction_text", {
      voice: "en-US-AvaMultilingualNeural",
      rate: 1
    });

    expect(bank.resolve("instruction_text_voice")).toEqual({
      type: "speech",
      text: "Press space to begin.",
      voice: "en-US-AvaMultilingualNeural",
      lang: "en-US",
      rate: 1,
      pitch: undefined,
      volume: undefined
    });
  });

  it("registers asset-backed sound stimuli when voice files are provided", () => {
    const bank = new StimBank({
      instruction_text: {
        type: "textbox",
        text: "Press space to begin."
      }
    });

    bank.convert_to_voice("instruction_text", {
      voice: "en-US-AvaMultilingualNeural",
      assetFiles: {
        instruction_text: "https://example.com/instruction_text_voice.mp3"
      },
      fallbackToSpeech: false
    });

    expect(bank.resolve("instruction_text_voice")).toEqual({
      type: "sound",
      file: "https://example.com/instruction_text_voice.mp3",
      volume: undefined
    });
  });
});
