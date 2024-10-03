import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import circularDependency from "vite-plugin-circular-dependency";

// This will show up as an error, in VSCode which is fine because VSCode is seeing the
// non-Node version of the tsconfig which is fine and can't really be fixed.
import path from "path";

console.log("vite.config.ts: ENV=" + process.env.DOCKER_ENV);

declare const __dirname;

export default defineConfig({
    define: {
        BUILDTIME: JSON.stringify(new Date().toLocaleString())
    },
    mode: process.env.DOCKER_ENV === "dev" ? "development" : "production",
    build: {
        chunkSizeWarningLimit: 3000,
        minify: process.env.DOCKER_ENV === "dev" ? false : true,
        sourcemap: process.env.DOCKER_ENV === "dev" ? true : false,

        // begin font-awesome support
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) => {
                    let extType = assetInfo.name.split('.').at(1);
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
                        extType = 'img';
                    } else if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
                        extType = 'fonts';
                    }
                    return `assets/${extType}/[name]-[hash][extname]`;
                },
            },
        },
        // end font-awesome support
    },
    plugins: [
        // Latest version of this plugin is able to ignore node_modules any longer so it throws a false positive.
        // circularDependency({
        //     exclude: "./src/main/resources/public/node_modules",
        //     outputFilePath: './src/main/resources/public/.circleDep'
        // }),
        react()
    ],
    // NOTE: This entire css section was an attempt (which didn't work) to get rid of deprecation warnings related to even the latest packages of things
    // being problematic thru no fault of my own and with no solution I can do.  I'm just going to ignore them for now.
    // see: https://stackoverflow.com/questions/68147471/how-to-set-sassoptions-in-vite
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `$fa-font-path: "/fonts/fontawesome";`,
                api: 'modern-compiler', // or 'modern'
                quietDeps: true
            },
        },
    },
    base: "/dist"
});
