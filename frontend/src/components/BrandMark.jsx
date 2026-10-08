import React from "react";

/**
 * The Study Anchor mark: an open book with a peach bookmark ribbon.
 * Matches the installed app icon exactly, so the home-screen tile and the
 * in-app header read as the same product.
 */
export default function BrandMark({ className = "h-9 w-9", rounded = true }) {
  return (
    <>
    <img className= "h-9 w-9" src="https://lenspdf.netlify.app/icons/icon-16.png" alt="logo" />
    </>
  );
}
