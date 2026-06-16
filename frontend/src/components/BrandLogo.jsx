import React from 'react';
import blueLogo from '../assets/logos/BLUE LOGO.png';
import whiteLogo from '../assets/logos/VELA LOGO WHITE.png';
import blackTaglineLogo from '../assets/logos/VELA LOGO WITH TAGLINE BLACK.png';
import whiteTaglineLogo from '../assets/logos/WHITE WITH TAGLINE.png';
import blueTaglineLogo from '../assets/logos/WITH TAGLINE BLUE .png';

const VARIANT_MAP = {
  blue: blueLogo,
  white: whiteLogo,
  blackTagline: blackTaglineLogo,
  whiteTagline: whiteTaglineLogo,
  blueTagline: blueTaglineLogo,
};

const CROP_MAP = {
  blue: { left: 208, top: 60, width: 664, height: 317, sourceWidth: 1080, sourceHeight: 437 },
  white: { left: 208, top: 71, width: 664, height: 293, sourceWidth: 1080, sourceHeight: 436 },
  blackTagline: { left: 208, top: 60, width: 664, height: 318, sourceWidth: 1080, sourceHeight: 437 },
  whiteTagline: { left: 208, top: 60, width: 664, height: 318, sourceWidth: 1080, sourceHeight: 437 },
  blueTagline: { left: 208, top: 60, width: 664, height: 317, sourceWidth: 1080, sourceHeight: 437 },
};

export default function BrandLogo({
  variant = 'blue',
  alt = 'Vela CRM',
  width = 160,
  className = '',
  style = {},
}) {
  const src = VARIANT_MAP[variant] || VARIANT_MAP.blue;
  const crop = CROP_MAP[variant] || CROP_MAP.blue;

  return (
    <span
      className={className}
      style={{
        display: 'block',
        width,
        maxWidth: '100%',
        aspectRatio: `${crop.width} / ${crop.height}`,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          left: `${-(crop.left / crop.width) * 100}%`,
          top: `${-(crop.top / crop.height) * 100}%`,
          width: `${(crop.sourceWidth / crop.width) * 100}%`,
          height: `${(crop.sourceHeight / crop.height) * 100}%`,
          maxWidth: 'none',
        }}
      />
    </span>
  );
}
