import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";

// ======================================================
// DO NOT DELETE (KEEP EXAMPLE), this code works, but the default schema is already perfect.
// import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
// const schema = JSON.parse(JSON.stringify(defaultSchema));
// console.log("schema.tagNames: " + JSON.stringify(schema.tagNames));
// custom filter CAN be done here;
// schema.tagNames = schema.tagNames.filter((tagName) => {!['body', 'html', 'script'].includes(tagName));
// ======================================================

// eslint-disable-next-line
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath, remarkGfm],

        // NOTE: The order of these plugins is significant. Each id doing a modification of the chain, and can
        // affect what comes downstream. For example of your sanitizer filters out any tags Katex needs, that
        // would obviously break rehypeKatex if it's the last thing in the array here.

        // ======================================================
        // DO NOT DELETE (see note above, this is how we would pass 'schema to rehypeSanitize' if needed)
        // rehypePlugins: [rehypeRaw, [rehypeSanitize, { schema: schema }], rehypeKatex],
        // ======================================================

        rehypePlugins: [rehypeRaw, rehypeSanitize, rehypeKatex],
    });
});

export default ReactMarkdownComp;