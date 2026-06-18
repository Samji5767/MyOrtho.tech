// Design Tokens for MyOrtho.tech (Apple-style premium guidelines)

export const designTokens = {
  colors: {
    primary: "#14b8a6", // Teal-500
    primaryHover: "#0d9488", // Teal-600
    background: "#090d16", // Deep slate dark mode
    card: "#111827", // Gray-900 card bg
    border: "#1f2937", // Gray-800 border
    textPrimary: "#f3f4f6", // Gray-100
    textSecondary: "#9ca3af", // Gray-400
    
    // Status colors
    success: "#10b981", // Emerald-500
    warning: "#f59e0b", // Amber-500
    danger: "#ef4444", // Red-500
    info: "#3b82f6", // Blue-500
    clinicalHighlight: "#a855f7" // Purple-500 (orthodontics brackets/aligner lines)
  },
  
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    sizes: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      xxl: "1.5rem" // 24px
    },
    weights: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      black: "900"
    }
  },

  spacing: {
    xs: "0.25rem",  // 4px
    sm: "0.5rem",   // 8px
    md: "1rem",     // 16px
    lg: "1.5rem",   // 24px
    xl: "2rem",     // 32px
    xxl: "3rem"     // 48px
  },

  elevation: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    glow: "0 0 15px 2px rgba(20, 184, 166, 0.15)"
  },

  motion: {
    springFast: "cubic-bezier(0.25, 1, 0.5, 1)",
    springNormal: "cubic-bezier(0.4, 0, 0.2, 1)",
    springApple: "cubic-bezier(0.16, 1, 0.3, 1)", // Custom physics-based spring feel
    transitionDuration: "200ms"
  }
};
