import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";

// DO NOT DELETE this mess of commented code (for now), because it might be needed in the future
// because ChatGPT was helping me and I need to see if this for an earlier or later version before
// I remove it.
// const allowedTags = ["img", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"];
// const allowedAttributes = {
//     img: ["src", "alt", "class"],
// };
// const allowlist = {
//     img: ["src", "className", "alt", "width", "height", "data-nodeid", "data-attkey"],
//     span: ["className"],
//     div: ["className"]
// };
// const MySanitizeFunction = (node) => {
//     console.log("Sanitize: " + S.util.prettyPrint(node));
//     if (node.tagName === "img") {
//         // Allow only certain classes on img tags
//         //   if (node.properties.class && !node.properties.class.match(/^(custom-class|other-class)$/)) {
//         //     delete node.properties.class;
//         //   }
//     }
// };

// eslint-disable-next-line react/display-name
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath],
        // rehypePlugins: [rehypeKatex, rehypeRaw, [rehypeSanitize, { allowedTags, allowedAttributes }]]
        rehypePlugins: [rehypeKatex, rehypeRaw],
        rehypeTransform: [rehypeSanitize /*, MySanitizeFunction*/]
    });
});

export default ReactMarkdownComp;