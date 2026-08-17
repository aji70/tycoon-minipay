import React from "react";

export type LogoTypes = {
  className: string;
  image: string;
  href: string;
  /** Intrinsic width/height for next/image (defaults tuned for navbar PNG). */
  width?: number;
  height?: number;
  sizes?: string;
  imageClassName?: string;
};