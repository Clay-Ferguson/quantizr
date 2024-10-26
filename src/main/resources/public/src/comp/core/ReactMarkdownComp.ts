import { createElement, forwardRef } from "react";
import Markdown from "react-markdown";
import { Prism } from "react-syntax-highlighter";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { S } from "../../Singletons";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// Good styles are: a11yDark, nightOwl, oneLight
import { nightOwl as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";
import { dispatch, getAs } from "../../AppContext";

const ReactMarkdownComp = forwardRef((props: any, ref) => {
    props = props || {};

    // Note: mkBody doesn't have any styling, and is only used to identify the markdown body for DOM lookup
    if (props.className) props.className += " mkBody";
    else props.className = "mkBody";
    props.components = {
        code: (arg: any) => _codeFunc(arg, props.nodeId),
        a: _anchorFunc
    }

    return createElement(Markdown as any, {
        ...props,
        ref,
        // WARNING: The order of these plugins is VERY significant!!! DO NOT ALTER
        remarkPlugins: [remarkMath, remarkGfm],
        rehypePlugins: [rehypeSanitize, rehypeKatex],
    });
});

const _anchorFunc = (props: any) => {
    return createElement("a", { href: props.href, target: "blank" }, props.children);
}

const _codeFunc = (arg: any, nodeId: string) => {
    const { node, className, children, ...props } = arg;
    const childrenStr = String(children);

    // count number of newlines in childrenStr
    const newLineCount = (childrenStr.match(/\n/g) || []).length;
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "txt";
    const ast = getAs();
    const expanded = ast.expandedCodeBlocks.has(nodeId);
    const expClass = expanded ? "codeBlockExpanded" : "codeBlockCollapsed";

    return newLineCount > 0 ? (
        createElement("div", { className: "mb-3" }, [
            createElement("div", { className: "codeDivHeader" }, [
                createElement("span", {
                    className: "markdownLanguage"
                }, language === "txt" ? "" : language),
                createElement("span", { className: "float-right" }, [
                    newLineCount > 5 ? createElement("span", {
                        className: "cursor-pointer mr-6",
                        onClick: () => {
                            dispatch("toggleCodeBlock", s => {
                                if (s.expandedCodeBlocks.has(nodeId)) {
                                    s.expandedCodeBlocks.delete(nodeId);
                                } else {
                                    s.expandedCodeBlocks.add(nodeId);
                                }
                            });
                        }
                    }, "Expand/Collapse") : null,
                    createElement("i", {
                        className: "fa fa-clipboard fa-lg cursor-pointer clipboardIcon codeIcon",
                        onClick: () => S.util.copyToClipboard(children.concat())
                    })
                ])
            ]),
            createElement(Prism as any, {
                ...props,
                style: highlightStyle,
                className: "codeDivBody " + expClass,
                language,
                PreTag: "div"
            }, childrenStr.replace(/\n$/, ""))
        ])
    ) : (
        createElement("code", { ...props, className }, children)
    );
}

export default ReactMarkdownComp;
