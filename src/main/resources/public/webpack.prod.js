const webpack = require("webpack");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const TerserPlugin = require("terser-webpack-plugin");

// todo-2 need a way to export this out of common.
function formatDate(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    var strTime = hours + ":" + (minutes < 10 ? "0" + minutes : minutes) + ampm;
    return (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + " " + strTime;
}

module.exports = merge(common, {
    mode: "production",
    // devtool: "source-map", // #sourceMap
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new webpack.DefinePlugin({
            // this was a test: Didn't work. I tried it in the index.html and it was not translated.
            // Ended up accomplishing this using my 'cachebuster' option on HtmlWebpackPlugin instead.
            // WARNING: The 'stringify' here looks redundant but it's actually requird here by DefinePlugin
            BUILDTIME: JSON.stringify(formatDate(new Date())),
            PROFILE: JSON.stringify("prod")
        })
    ]
});
