import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// ======================================================
// DO NOT DELETE (KEEP EXAMPLE), this code works, but the default schema is already perfect for our needs
// so we're not tweaking the schema at all. If we ever need to, this is how we would do it.
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

const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(Markdown as any, {
        ...props,
        ref,
        // WARNING: The order of these plugins is significant!!! DO NOT ALTER
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeRaw, rehypeSanitize, rehypeKatex],
    });
});

export default ReactMarkdownComp;
