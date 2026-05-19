"use client";

import PropTypes from "prop-types";
import ProviderIcon from "./ProviderIcon";

export default function IconUrlPreview({ src, fallbackSrc, alt = "Provider icon", fallbackText = "OC" }) {
  const iconSrc = src?.trim() || fallbackSrc;

  return (
    <div className="flex justify-center">
      <div className="flex size-24 items-center justify-center rounded-xl border border-border bg-surface-2">
        <ProviderIcon
          src={iconSrc}
          alt={alt}
          size={72}
          className="max-h-[72px] max-w-[72px] rounded-xl object-contain"
          fallbackText={fallbackText}
        />
      </div>
    </div>
  );
}

IconUrlPreview.propTypes = {
  src: PropTypes.string,
  fallbackSrc: PropTypes.string,
  alt: PropTypes.string,
  fallbackText: PropTypes.string,
};
