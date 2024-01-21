import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import { Prism } from "react-syntax-highlighter";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { S } from "../../Singletons";

// NOTE: I've spent a lot of time trying to get the Latex and the Sanitizer to coexist, but it's not working.
// so I'm leaving the sanitizer in place, and removing Latex for now.
// IMPORTANT: If you enable Latex support be sure to search all 'ts' files for 'Latex' because there's another place you need to see.
// import rehypeKatex from "rehype-katex"; part of latelx support
// import remarkMath from "remark-math"; // part of Latex support

// Good styles are: a11yDark, nightOwl, oneLight
import { nightOwl as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";

// ======================================================
// DO NOT DELETE (KEEP EXAMPLE), this code works, but the default schema is already perfect for our needs
// so we're not tweaking the schema at all. If we ever need to, this is how we would do it.
// We need this becasue we do have code that injects images (the positional insertion option in the editor dialog),
// and we do set both the class name and style in that code so we need to allow those attributes in this custom way
// because by default rehypeSanitize will remove them.
const schema = JSON.parse(JSON.stringify(defaultSchema));
schema.attributes.img = ["src", "alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];
schema.attributes.span = ["alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];
schema.attributes.div = ["alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];
// schema.attributes["img"].push("class");
// NOTE: I never got the sanitizer to leave classnames alone.
// schema.attributes["*"].push("class");
// schema.attributes["*"].push("className");
// schema.attributes["*"].push("data-nid");
// schema.attributes["*"].push("data-attkey");
// custom filter CAN be done here;
// schema.tagNames = schema.tagNames.filter((tagName) => {!["body", "html", "script"].includes(tagName));
// ======================================================

// Another failed attempt at getting LaTex to work with sanitize. Never worked
// Define a function to filter out JavaScript from URIs.
// function filterURI(value) {
//     // This regex ensures that the URI does not start with "javascript:", "data:", "vbscript:", or "file:".
//     // Adjust the regex as needed for your specific use case.
//     return /^(?!javascript:|data:|vbscript:|file:).+/i.test(value) ? value : null;
// }
// Create a schema that allows all elements and attributes by default.
// const schema = {
//     // Allow all elements by not specifying the 'tagNames' property.
//     // Allow all attributes for all elements, except for event handlers and certain attributes that need to be filtered.
//     attributes: {
//         '*': [
//             // Use a wildcard to allow all attributes by default.
//             /^((?!on).)*$/i, // This regex allows any attribute name that doesn't start with 'on'.
//             // Filter `href` and `src` attributes to prevent JavaScript URLs.
//             ['href', filterURI],
//             ['src', filterURI],
//             // If you want to allow specific attributes with 'on' prefix that are not event handlers,
//             // you can list them explicitly after the wildcard regex.
//             // For example, to allow 'onion' attribute:
//             // 'onion',
//         ],
//     },
//     // Allow all protocols by not specifying the 'protocols' property.
// };

const ReactMarkdownComp = forwardRef((props: any, ref) => {
    props = props || {};

    // Note: mkBody doesn't have any styling, and is only used to identify the markdown body for DOM lookup
    if (props.className) props.className += " mkBody";
    else props.className = "mkBody";
    props.components = {
        code: codeFunc,
        a: anchorFunc
    }

    return createElement(Markdown as any, {
        ...props,
        ref,
        // WARNING: The order of these plugins is significant!!! DO NOT ALTER
        remarkPlugins: [remarkGfm /*, remarkMath */],
        rehypePlugins: [rehypeRaw, [rehypeSanitize, schema] /*, rehypeKatex*/],
    });
});

const anchorFunc = (props: any) => {
    return createElement("a", { href: props.href, target: "blank" }, props.children);
}

const codeFunc = ({ node, inline, className, children, ...props }) => {
    const childrenStr = String(children);

    // After upgrading to latest version 'inline' is undefined so we set it ourselves.
    inline = !childrenStr.includes("\n");
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "txt";
    return !inline ? (
        createElement("div", { className: "smallMarginBottom" }, [
            createElement("div", { className: "codeDivHeader" }, [
                createElement("span", {
                    className: "markdownLanguage"
                }, language === "txt" ? "" : language),
                createElement("i", {
                    className: "fa fa-clipboard fa-lg clickable float-end clipboardIcon codeIcon",
                    onClick: () => S.util.copyToClipboard(children.concat())
                })
            ]),

            createElement(Prism as any, {
                ...props,
                style: highlightStyle,
                className: "codeDivBody",
                language,
                PreTag: "div"
            }, childrenStr.replace(/\n$/, ""))
        ])
    ) : (
        createElement("code", { ...props, className }, children)
    );
}

export default ReactMarkdownComp;
