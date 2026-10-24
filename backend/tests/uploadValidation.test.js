import test from "node:test";
import assert from "node:assert/strict";
import { validateUploadedFile, validateImageFile, PERSONAL_EXTENSIONS, SCHOOL_EXTENSIONS } from "../utils/uploadValidation.js";

const pdf = Buffer.from("%PDF-1.7\n....................");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff");

test("accepts real PDFs and images for personal uploads", () => {
  assert.equal(validateUploadedFile({ originalname: "notes.pdf", buffer: pdf }, PERSONAL_EXTENSIONS).ok, true);
  assert.equal(validateUploadedFile({ originalname: "scan.PNG", buffer: png }, PERSONAL_EXTENSIONS).ok, true);
});

test("rejects disguised files and unsupported types", () => {
  assert.equal(validateUploadedFile({ originalname: "evil.pdf", buffer: exe }, PERSONAL_EXTENSIONS).ok, false);
  assert.equal(validateUploadedFile({ originalname: "photo.png", buffer: pdf }, PERSONAL_EXTENSIONS).ok, false);
  assert.equal(validateUploadedFile({ originalname: "slides.pptx", buffer: Buffer.from("PK\x03\x04aaaaaaaaaaaa") }, PERSONAL_EXTENSIONS).ok, true, "independent learners can upload Office files too");
  assert.equal(validateUploadedFile({ originalname: "notes.docx", buffer: Buffer.from("PK\x03\x04aaaaaaaaaaaa") }, PERSONAL_EXTENSIONS).ok, true);
  assert.equal(validateUploadedFile({ originalname: "notes.docx", buffer: pdf }, PERSONAL_EXTENSIONS).ok, false, "a PDF renamed .docx is rejected");
  assert.equal(validateUploadedFile({ originalname: "slides.pptx", buffer: Buffer.from("PK\x03\x04aaaaaaaaaaaa") }, SCHOOL_EXTENSIONS).ok, true);
  assert.equal(validateUploadedFile({ originalname: "noext", buffer: pdf }, PERSONAL_EXTENSIONS).ok, false);
});

test("image validation for Snap a Question", () => {
  assert.equal(validateImageFile({ buffer: png, size: png.length }, 1000).ok, true);
  assert.equal(validateImageFile({ buffer: png, size: 5000 }, 1000).ok, false, "too large");
  assert.equal(validateImageFile({ buffer: pdf, size: pdf.length }, 1000).ok, false, "a PDF is not a photo");
  assert.equal(validateImageFile({ buffer: Buffer.alloc(0) }, 1000).ok, false);
});

import { validateChatAttachment } from "../utils/uploadValidation.js";

test("chat attachments: photos and sounds are accepted by real bytes, everything else is not", () => {
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20)]);
  const m4a = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypM4A "), Buffer.alloc(20)]);
  const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(20)]);
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(20)]);
  const ogg = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(20)]);
  assert.deepEqual(validateChatAttachment({ buffer: png, size: png.length }, 1000).attachmentKind, "image");
  for (const b of [webm, m4a, mp3, wav, ogg]) assert.equal(validateChatAttachment({ buffer: b, size: b.length }, 1000).attachmentKind, "audio");
  assert.equal(validateChatAttachment({ buffer: pdf, size: pdf.length }, 1000).ok, false, "a PDF is not chat media");
  assert.equal(validateChatAttachment({ buffer: exe, size: exe.length }, 1000).ok, false);
  assert.equal(validateChatAttachment({ buffer: png, size: 5000 }, 1000).ok, false, "too large");
  assert.equal(validateChatAttachment({ buffer: Buffer.alloc(0) }, 1000).ok, false);
});

import { validateAvatarFile } from "../utils/uploadValidation.js";

test("profile picture: only small JPG/PNG/WebP photos", () => {
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(30)]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20)]);
  const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(30)]);
  assert.equal(validateAvatarFile({ buffer: jpg, size: jpg.length }, 1000).ok, true);
  assert.equal(validateAvatarFile({ buffer: png, size: png.length }, 1000).ok, true);
  assert.equal(validateAvatarFile({ buffer: webp, size: webp.length }, 1000).ok, true);
  assert.equal(validateAvatarFile({ buffer: gif, size: gif.length }, 1000).ok, false, "animated GIFs aren't profile pictures");
  assert.equal(validateAvatarFile({ buffer: pdf, size: pdf.length }, 1000).ok, false);
  assert.equal(validateAvatarFile({ buffer: exe, size: exe.length }, 1000).ok, false);
  assert.equal(validateAvatarFile({ buffer: jpg, size: 5000 }, 1000).ok, false, "too large");
  assert.equal(validateAvatarFile({}, 1000).ok, false, "no file");
});
