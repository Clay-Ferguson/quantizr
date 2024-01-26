import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import { Prism } from "react-syntax-highlighter";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { S } from "../../Singletons";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// Good styles are: a11yDark, nightOwl, oneLight
import { nightOwl as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";

// NOTE: This schema alteration appears to have no effect, probably because we need to be using "unify()" like the
// example code on the rehype-sanitize page shows. So this means for now we can't use img, span, or div in markdown 
// The only thing broken because of this is the sizing option on embedded images using {{tag}} markdown embedding.
const schema = JSON.parse(JSON.stringify(defaultSchema));
schema.attributes.img = ["src", "alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];
schema.attributes.span = ["alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];
schema.attributes.div = ["alt", "title", "width", "height", "class", "className", "style", "data-nid", "data-attkey"];

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
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeKatex, [rehypeSanitize, schema]],
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
