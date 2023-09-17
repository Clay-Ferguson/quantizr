import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import circularDependency from "vite-plugin-circular-dependency";

// This will show up as an error, in VSCode which is fine because VSCode is seeing the
// non-Node version of the tsconfig which is fine and can't really be fixed.
import path from "path";

console.log("vite.config.ts: ENV=" + process.env.DOCKER_ENV);

declare const __dirname;

export default defineConfig({
    define: {
        BUILDTIME: JSON.stringify(new Date().toLocaleString())
    },
    build: {
        chunkSizeWarningLimit: 3000,
        minify: process.env.DOCKER_ENV === "dev" ? false : true,
        sourcemap: process.env.DOCKER_ENV === "dev" ? true : false
    },
    plugins: [
        circularDependency({
            exclude: "/node_modules/"
        }),
        react()
    ],
    resolve: {
        alias: {
            "~bootstrap": path.resolve(__dirname, "node_modules/bootstrap"),
        }
    },

    base: "/dist"
});
