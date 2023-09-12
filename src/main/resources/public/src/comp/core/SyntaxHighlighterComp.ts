import { createElement, forwardRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

// eslint-disable-next-line react/display-name
const SyntaxHighlighterComp = forwardRef((props: any, ref) => {
    return createElement(SyntaxHighlighter as any, { ...props, ref });
});

export default SyntaxHighlighterComp;