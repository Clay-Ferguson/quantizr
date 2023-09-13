import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";

// This was part of an experiment. Keeping it only as an FYI
// const MySanitizeFunction = (node) => {
//     console.log("Sanitize: " + S.util.prettyPrint(node));
//     if (node.tagName === "img") {
//         // Allow only certain classes on img tags
//         //   if (node.properties.class && !node.properties.class.match(/^(custom-class|other-class)$/)) {
//         //     delete node.properties.class;
//         //   }
//     }
// };

// eslint-disable-next-line
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath, remarkGfm],
        rehypePlugins: [rehypeKatex, rehypeRaw],
        rehypeTransform: [rehypeSanitize /*, MySanitizeFunction*/]
    });
});

export default ReactMarkdownComp;