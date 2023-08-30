import { createElement, forwardRef } from "react";
import ReactMarkdown from "react-markdown";

// eslint-disable-next-line react/display-name
const ReactMarkdownComp = forwardRef((props, ref) => {
    return createElement(ReactMarkdown as any, { ...props, ref });
});

export default ReactMarkdownComp;