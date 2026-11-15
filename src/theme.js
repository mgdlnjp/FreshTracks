import { useColorScheme } from "react-native";

// Palette orange (50 → 900) et gris chauds teintés « stone ».
export const orange = {
  50: "#FFF7ED",
  100: "#FFEDD5",
  200: "#FED7AA",
  300: "#FDBA74",
  400: "#FB923C",
  500: "#F97316",
  600: "#EA580C",
  700: "#C2410C",
  800: "#9A3412",
  900: "#7C2D12",
};

const stone = {
  50: "#FAFAF9",
  100: "#F5F5F4",
  200: "#E7E5E4",
  300: "#D6D3D1",
  400: "#A8A29E",
  500: "#78716C",
  600: "#57534E",
  700: "#44403C",
  800: "#292524",
  900: "#1C1917",
  950: "#141110",
};

export const lightTheme = {
  dark: false,
  background: stone[50],
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: stone[200],
  text: stone[900],
  textMuted: stone[600],
  textFaint: stone[500],
  accent: orange[500], // remplissages (boutons, slider)
  accentText: orange[700], // texte/icônes orange sur fond clair (contraste ≥ 4.5)
  accentSoft: orange[50],
  accentSoftBorder: orange[100],
  onAccent: stone[900], // ≈ 6.8:1 sur orange-500 (le blanc ne fait que 2.8:1)
  track: stone[200],
  shadow: "rgba(28, 25, 23, 0.10)",
};

export const darkTheme = {
  dark: true,
  background: stone[950],
  surface: stone[900],
  surfaceRaised: stone[800],
  border: stone[800],
  text: stone[50],
  textMuted: stone[400],
  textFaint: stone[500],
  accent: orange[500],
  accentText: orange[400],
  accentSoft: "rgba(249, 115, 22, 0.12)",
  accentSoftBorder: "rgba(249, 115, 22, 0.22)",
  onAccent: stone[950],
  track: stone[700],
  shadow: "rgba(0, 0, 0, 0.5)",
};

// Échelles contraintes (Refactoring UI)
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const font = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, display: 30 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export function useTheme() {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatSize(bytes) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace(".", ",")} Mo`;
}
