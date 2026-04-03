/**
 * MuuneyHubLogo — Logotipo oficial "muuney.hub" (PNG-based).
 * Variantes: "green" (padrão), "black" (negativa), "white" (positiva)
 */

import logoHubGreen from "@/assets/logo-hub-green.png";
import logoHubWhite from "@/assets/logo-hub-white.png";
import logoHubBlack from "@/assets/logo-hub-black.png";

interface MuuneyHubLogoProps {
  variant?: "green" | "black" | "white";
  className?: string;
  height?: number;
}

export const MuuneyHubLogo = ({ variant = "green", className = "", height = 40 }: MuuneyHubLogoProps) => {
  const sources = {
    green: logoHubGreen,
    black: logoHubBlack,
    white: logoHubWhite,
  };

  const aspectRatio = 2.865;
  const width = Math.round(height * aspectRatio);

  return (
    <img
      src={sources[variant]}
      alt="muuney.hub"
      width={width}
      height={height}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
};
