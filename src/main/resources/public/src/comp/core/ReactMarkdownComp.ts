import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { S } from "../../Singletons";
import { Prism } from "react-syntax-highlighter";

// Good styles are: a11yDark, nightOwl, oneLight
import { nightOwl as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";

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

const ReactMarkdownComp = forwardRef((props: any, ref) => {
    props = props || {};
    props.components = {
        code: codeFunc,
        a: anchorFunc
    }

    return createElement(Markdown as any, {
        ...props,
        ref,
        // WARNING: The order of these plugins is significant!!! DO NOT ALTER
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeRaw, rehypeSanitize, rehypeKatex],
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
                    onClick: () => {
                        S.util.copyToClipboard(children.concat());
                        // todo-1: move flashMessage into copyToClipboard
                        S.util.flashMessage("Copied to Clipboard", "Clipboard", true);
                    }
                })
            ]),

            // createElement("div", null, //<---- not needed right? Leaving here for now just in case.
            // Note: We used to have SyntaxHighlighterComp here, but switched to raw Prism. Once this is fully tested
            // we can remove the SyntaxHighlighterComp.ts file.
            createElement(Prism as any, {
                // key: "code-mk-" + this.getId(),
                ...props,
                style: highlightStyle,
                className: "codeDivBody",
                language,
                PreTag: "div"
            }, childrenStr.replace(/\n$/, ""))
            // )
        ])
    ) : (
        createElement("code", { ...props, className }, children)
    );
}

export default ReactMarkdownComp;
