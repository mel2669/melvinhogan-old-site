import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.melvinhogan.com",
  output: "static",
  build: {
    format: "file",
  },
});
