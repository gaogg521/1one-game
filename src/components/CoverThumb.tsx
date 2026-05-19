"use client";

import { useState, type ReactNode } from "react";

type CoverThumbProps = {
  coverPath: string | null | undefined;
  alt: string;
  className?: string;
  placeholder?: ReactNode;
};

/** 广场/工作室封面：原生 img + onError，避免 next/image 与静态 404 导致整页导航失败。 */
export function CoverThumb({ coverPath, alt, className, placeholder }: CoverThumbProps) {
  const [broken, setBroken] = useState(false);
  const src = coverPath?.trim();

  if (!src || broken) {
    return (
      <div className={className} role="img" aria-label={alt}>
        {placeholder}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
