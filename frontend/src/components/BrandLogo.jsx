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

export default function BrandLogo({
  variant = 'blue',
  alt = 'Vela CRM',
  width = 160,
  className = '',
  style = {},
}) {
  const src = VARIANT_MAP[variant] || VARIANT_MAP.blue;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        display: 'block',
        width,
        maxWidth: '100%',
        height: 'auto',
        ...style,
      }}
    />
  );
}
