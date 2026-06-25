window.config = window.config || {
  title: "Portal",
  theme: {
    light: {
      palette: {
        primary: { main: "#0043ce" },
        secondary: { main: "#1D49B8" },
        background: { default: "#ffffff", paper: "#ffffff" },
        text: {
          primary: "#544f5a",
          secondary: "#89868D"
        }
      },
      shape: {
        borderRadius: 0
      },
      spacing: 10
    },
    dark: {
      palette: {
        primary: { main: "#82aaff", light: "#dbe7ff" },
        secondary: { main: "#70e0c8" },
        background: { default: "#111318", paper: "#191c22" },
        text: {
          primary: "#f3f5f7",
          secondary: "#aeb5c0"
        },
        error: { main: "#ff6b6b" },
        warning: { main: "#f6bd60" },
        info: { main: "#64d2ff" },
        success: { main: "#63d471" }
      },
      shape: {
        borderRadius: 0
      },
      spacing: 10
    }
  }
}
