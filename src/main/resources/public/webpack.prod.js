const webpack = require("webpack");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = merge(common.config, {
    mode: "production",
    // devtool: "source-map", // #sourceMap
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()]
    },
    plugins: [
        new webpack.DefinePlugin({
            // WARNING: The 'stringify' here looks redundant but it's actually requird here by DefinePlugin
            BUILDTIME: JSON.stringify(common.formatDate(new Date())),
            PROFILE: JSON.stringify("prod")
        })
    ]
});
