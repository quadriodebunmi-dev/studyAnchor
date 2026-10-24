import test from "node:test";
import assert from "node:assert/strict";
import { clampState, drawAvatar, MAX_ZOOM } from "./avatarCrop.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`);

test("a square photo at zoom 1 can't be dragged at all", () => {
  const s = clampState(1000, 1000, { zoom: 1, ox: 0.4, oy: -0.4, rot: 0 });
  assert.deepEqual([s.ox, s.oy], [0, 0]);
});

test("a 2:1 landscape photo can slide sideways by half the frame, not up/down", () => {
  const s = clampState(2000, 1000, { zoom: 1, ox: 5, oy: 5, rot: 0 });
  near(s.ox, 0.5); near(s.oy, 0);
});

test("rotating a quarter turn swaps which direction is free", () => {
  const s = clampState(2000, 1000, { zoom: 1, ox: 5, oy: 5, rot: 1 });
  near(s.ox, 0); near(s.oy, 0.5);
});

test("zooming in allows more dragging; zoom is limited to the range", () => {
  const s = clampState(1000, 1000, { zoom: 2, ox: 9, oy: -9, rot: 0 });
  near(s.ox, 0.5); near(s.oy, -0.5);
  assert.equal(clampState(1000, 1000, { zoom: 99, ox: 0, oy: 0, rot: 0 }).zoom, MAX_ZOOM);
  assert.equal(clampState(1000, 1000, { zoom: 0.1, ox: 0, oy: 0, rot: 0 }).zoom, 1);
});

test("the exported crop is the same picture at any size (offsets are fractions)", () => {
  const calls = [];
  const rec = (name) => (...a) => calls.push([name, ...a]);
  const ctx = { save: rec("save"), restore: rec("restore"), fillRect: rec("fillRect"), translate: rec("translate"), rotate: rec("rotate"), scale: rec("scale"), drawImage: rec("drawImage"), set fillStyle(v) {} };
  const bmp = { width: 2000, height: 1000 };
  const state = { zoom: 1.5, ox: 0.1, oy: 0, rot: 0 };

  drawAvatar(ctx, bmp, 280, state);
  const small = { t: calls.find((c) => c[0] === "translate"), s: calls.find((c) => c[0] === "scale") };
  calls.length = 0;
  drawAvatar(ctx, bmp, 512, state);
  const big = { t: calls.find((c) => c[0] === "translate"), s: calls.find((c) => c[0] === "scale") };

  // translation and scale grow in proportion to the output size
  near(big.t[1] / 512, small.t[1] / 280); near(big.t[2] / 512, small.t[2] / 280);
  near(big.s[1] / 512, small.s[1] / 280);
  // short side (1000px) fitted to the frame, then zoomed 1.5x
  near(big.s[1], (512 / 1000) * 1.5);
});
