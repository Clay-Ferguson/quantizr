import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Div } from "./Div";
import { Span } from "./Span";

interface LS { // Local State
    expanded?: boolean;
}

export class CollapsiblePanel extends Comp {

    // todo-1: Need to switch this to the 'config' param pattern (like TextField?), there's one example already, look for cfg arg to find it.
    constructor(private collapsedButtonText: string,
        private expandedButtonText: string,
        attribs: Object = {},
        initialChildren: Comp[] = null,
        private textLink: boolean = false,
        private stateCallback: Function = null,
        expanded: boolean = false,
        private extraToggleButtonClass = "",
        private extraDivStyleExpanded: string = "",
        private extraDivStyleCollapsed: string = "",
        private elementName: string = "div") {
        super(attribs);
        this.setChildren(initialChildren);
        this.collapsedButtonText = collapsedButtonText || "More ";
        this.expandedButtonText = expandedButtonText || "Less ";
        this.mergeState<LS>({ expanded });
    }

    setExpanded(expanded: boolean) {
        this.mergeState<LS>({ expanded });
    }

    compRender = (): ReactNode => {
        let state = this.getState<LS>();
        let style = this.textLink ? "collapse-panel-link" : "btn btn-info ";
        let collapseClass = state.expanded ? "expand" : "collapse";

        /* If the component is expanded we render the button INSIDE the main area,
        which is the area that would be HIDDEN when the component is NOT expanded. */
        if (state.expanded) {
            return this.tag(this.elementName, {
                key: this.getId("panel_"),
                className: this.extraDivStyleExpanded,
                ref: this.attribs.ref
            }, [
                // This div and it's children holds the actual collapsible content.
                new Div(null, {
                    className: collapseClass,
                    id: this.getId(),
                    key: this.getId("content_")
                }, [
                    // This span is the expande/collapse button itself
                    new Span(this.expandedButtonText, {
                        className: style + " " + this.extraToggleButtonClass + (state.expanded ? " icon-up" : " icon-down"),
                        // Warning: This can't be camel case!
                        "data-bs-toggle": collapseClass,
                        id: this.getId("btn_"),
                        key: this.getId("btn_"),
                        onClick: this.onToggle
                    }),
                    ...this.getChildren()
                ])
            ]);
        }
        else {
            return this.tag(this.elementName, {
                key: this.getId("panel_"),
                className: this.extraDivStyleCollapsed,
                ref: this.attribs.ref
            }, [
                // This span is the expande/collapse button itself
                new Span(this.collapsedButtonText, {
                    className: style + " " + this.extraToggleButtonClass + (state.expanded ? " icon-up" : " icon-down"),
                    // Warning: This can't be camel case!
                    "data-bs-toggle": collapseClass,
                    id: this.getId("btn_"),
                    key: this.getId("btn_"),
                    onClick: this.onToggle
                }),

                // This div and it's children holds the actual collapsible content.
                new Div(null, {
                    className: collapseClass,
                    id: this.getId(),
                    key: this.getId("content_")
                },
                    this.getChildren())
            ]);
        }
    }

    onToggle = () => {
        let expanded = !this.getState<LS>().expanded;
        this.setExpanded(expanded);
        if (this.stateCallback) {
            this.stateCallback(expanded);
        }
    }
}
