import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import { Prism } from "react-syntax-highlighter";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { S } from "../../Singletons";

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
        rehypePlugins: [rehypeRaw, [rehypeSanitize, schema], rehypeKatex],
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
                    // key: "code-div-" + this.getId(),
                    className: "markdownLanguage"
                }, language === "txt" ? "" : language),
                createElement("i", {
                    // key: "code-i-" + this.getId(),
                    className: "fa fa-clipboard fa-lg clickable float-end clipboardIcon codeIcon",
                    onClick: () => S.util.copyToClipboard(children.concat())
                })
            ]),

            createElement(Prism as any, {
                // key: "code-mk-" + this.getId(),
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
