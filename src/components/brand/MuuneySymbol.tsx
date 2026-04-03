/**
 * MuuneySymbol — Símbolo "fM." oficial da Muuney (PNG-based).
 * Variantes: "green" (padrão), "black" (negativa), "white" (positiva)
 */

import symbolGreen from "@/assets/symbol-green.png";
import symbolWhite from "@/assets/symbol-white.png";
import symbolBlack from "@/assets/symbol-black.png";

interface MuuneySymbolProps {
  variant?: "green" | "black" | "white";
  className?: string;
  size?: number;
}

export const MuuneySymbol = ({ variant = "green", className = "", size = 40 }: MuuneySymbolProps) => {
  const sources = {
    green: symbolGreen,
    black: symbolBlack,
    white: symbolWhite,
  };

  return (
    <img
      src={sources[variant]}
      alt="Muuney"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
};
