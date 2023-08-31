import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";

const allowlist = {
    img: ["src", "class", "alt", "width", "height", "data-nodeid", "data-attkey"],
    span: ["class"],
    div: ["class"]
};

// eslint-disable-next-line react/display-name
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex, rehypeRaw, rehypeSanitize, { allowlist }]
    });
});

export default ReactMarkdownComp;