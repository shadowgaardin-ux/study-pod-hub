import { describe, expect, it } from "vitest";

import { classifyFile, validateChatFile } from "./chat";

describe("hub chat attachments", () => {
  it("never treats a PDF as audio", () => {
    expect(classifyFile("lecture.pdf", "application/pdf")).toBe("file");
  });
  it("treats PowerPoint as a document even with an odd mime type", () => {
    expect(classifyFile("slides.pptx", "audio/mpeg")).toBe("file");
  });
  it("treats Word as a document", () => {
    expect(classifyFile("essay.docx", "")).toBe("file");
  });
  it("recognises images and audio", () => {
    expect(classifyFile("board.jpg", "image/jpeg")).toBe("image");
    expect(classifyFile("clip.m4a", "")).toBe("audio");
  });
  it("rejects files over 25MB", () => {
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: 25 * 1024 * 1024 + 1 })).toMatch(/25MB/);
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
  });
  it("rejects unsupported types", () => {
    expect(validateChatFile({ name: "virus.exe", type: "application/x-msdownload", size: 10 })).not.toBeNull();
  });
});
