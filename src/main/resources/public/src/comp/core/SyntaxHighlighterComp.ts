import { createElement, forwardRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

// todo-1: Note: This class is no longer used. We switched to raw Prism. Once this is fully tested
// we can remove this file.
// eslint-disable-next-line
const SyntaxHighlighterComp = forwardRef((props: any, ref) => {
    return createElement(SyntaxHighlighter as any, { ...props, ref });
});

export default SyntaxHighlighterComp;