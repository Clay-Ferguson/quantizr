import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// ======================================================
// DO NOT DELETE (KEEP EXAMPLE), this code works, but the default schema is already perfect.
// import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
// const schema = JSON.parse(JSON.stringify(defaultSchema));
// // schema.attributes.img = ["src", "alt", "title", "width", "height", "class", "data-nodeid", "data-attkey"];
// // schema.attributes["img"].push("class");
// NOTE: I never got the sanitizer to leave classnames alone.
// schema.attributes["*"].push("class");
// schema.attributes["*"].push("className");
// schema.attributes["*"].push("data-nodeid");
// schema.attributes["*"].push("data-attkey");

// custom filter CAN be done here;
// schema.tagNames = schema.tagNames.filter((tagName) => {!["body", "html", "script"].includes(tagName));
// ======================================================

// eslint-disable-next-line
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, {
        ...props,
        ref,
        remarkPlugins: [remarkMath, remarkGfm],

        // NOTE: The order of these plugins is significant. Each id doing a modification of the chain, and can
        // affect what comes downstream. For example of your sanitizer filters out any tags Katex needs, that
        // would obviously break rehypeKatex if it"s the last thing in the array here.

        // ======================================================
        // DO NOT DELETE (see note above, this is how we would pass "schema to rehypeSanitize" if needed)
        // rehypePlugins: [rehypeRaw, [rehypeSanitize, { schema }], rehypeKatex],
        // ======================================================

        rehypePlugins: [rehypeRaw, rehypeSanitize, rehypeKatex],
    });
});

export default ReactMarkdownComp;