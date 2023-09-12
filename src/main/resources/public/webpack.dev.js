const webpack = require("webpack");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common.config, {
    mode: "development",
    devtool: "source-map",
    plugins: [
        new webpack.DefinePlugin({
            // WARNING: The 'stringify' here looks redundant but it's actually requird here by DefinePlugin
            BUILDTIME: JSON.stringify(common.formatDate(new Date())),
            PROFILE: JSON.stringify("dev")
        })
    ]
});
