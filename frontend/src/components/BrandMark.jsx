import React from "react";

/**
 * The Study Anchor logo (graduation cap, open book, anchor). Same icon as the
 * installed app tile, so the home screen and the in-app header match.
 */
export default function BrandMark({ className = "h-9 w-9" }) {
  return (
    <img
      className={`${className} shrink-0 rounded-lg object-contain`}
      src="https://study-anchor.com/icons/icon-64.png"
      alt="Study Anchor logo"
    />
  );
}
