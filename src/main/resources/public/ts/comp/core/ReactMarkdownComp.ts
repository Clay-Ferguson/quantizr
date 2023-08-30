import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// eslint-disable-next-line react/display-name
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex]
    });
});

export default ReactMarkdownComp;