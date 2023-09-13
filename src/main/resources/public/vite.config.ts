import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const path = require("path");

export default defineConfig({
    define: {
        BUILDTIME: JSON.stringify(new Date().toLocaleString())
    },
    build: {
        chunkSizeWarningLimit: 100,
        minify: true,
        // sourcemap: true
    },
    plugins: [react()],
    resolve: {
        alias: {
            "~bootstrap": path.resolve(__dirname, "node_modules/bootstrap"),
        }
    },

    base: "/dist"
});
