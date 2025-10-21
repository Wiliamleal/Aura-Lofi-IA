import React from 'react';

type LogoProps = React.SVGProps<SVGSVGElement>;

export const Logo: React.FC<LogoProps> = (props) => (
  <svg
    {...props}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Aura Lofi Logo"
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#c4b5fd', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#f0abfc', stopOpacity: 1 }} />
      </linearGradient>
      <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#4a044e" floodOpacity="0.3" />
      </filter>
    </defs>
    <g filter="url(#logo-shadow)">
      {/* Headphone Band */}
      <path
        d="M 25 70 A 30 30 0 0 1 75 70"
        transform="rotate(180 50 50)"
        stroke="url(#logoGradient)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left Earpiece */}
      <rect 
        x="15" 
        y="45" 
        width="20" 
        height="30" 
        rx="8" 
        fill="url(#logoGradient)" 
      />
      {/* Right Earpiece */}
       <rect 
        x="65" 
        y="45" 
        width="20" 
        height="30" 
        rx="8" 
        fill="url(#logoGradient)" 
      />
      {/* Aura/Glow element - subtle arc */}
       <path
        d="M 50 15 A 40 40 0 0 1 85 40"
        stroke="white"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  </svg>
);
