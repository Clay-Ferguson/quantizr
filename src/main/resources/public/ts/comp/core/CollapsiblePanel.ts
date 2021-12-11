import { ReactNode } from "react";
import { Comp } from "../base/Comp";

interface LS {
    expanded?: boolean;
}

export class CollapsiblePanel extends Comp {

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

    compRender(): ReactNode {
        let state = this.getState<LS>();
        let style = this.textLink ? "collapse-panel-link" : "btn btn-info ";
        let collapseClass = state.expanded ? "expand" : "collapse";

        /* If the component is expanded we render the button INSIDE the main area,
        which is the area that would be HIDDEN when the component is NOT expanded. */
        if (state.expanded) {
            return this.e(this.elementName, {
                key: "panel_" + this.getId(),
                className: this.extraDivStyleExpanded
            },
                // This div and it's children holds the actual collapsible content.
                this.e("div", {
                    className: collapseClass,
                    id: this.getId(),
                    key: "content_" + this.getId()
                },
                    // This span is the expande/collapse button itself
                    this.e("span", {
                        className: style + " " + this.extraToggleButtonClass + (state.expanded ? " icon-up" : " icon-down"),
                        // Warning: This can't be camel case!
                        "data-bs-toggle": collapseClass,
                        id: "btn_" + this.getId(),
                        key: "btn_" + this.getId(),
                        onClick: this.onToggle
                    }, state.expanded ? this.expandedButtonText : this.collapsedButtonText),
                    this.buildChildren()
                ));
        }
        else {
            return this.e(this.elementName, {
                key: "panel_" + this.getId(),
                className: this.extraDivStyleCollapsed
            },
                // This span is the expande/collapse button itself
                this.e("span", {
                    className: style + " " + this.extraToggleButtonClass + (state.expanded ? " icon-up" : " icon-down"),
                    // Warning: This can't be camel case!
                    "data-bs-toggle": collapseClass,
                    id: "btn_" + this.getId(),
                    key: "btn_" + this.getId(),
                    onClick: this.onToggle
                }, state.expanded ? this.expandedButtonText : this.collapsedButtonText),

                // This div and it's children holds the actual collapsible content.
                this.e("div", {
                    className: collapseClass,
                    id: this.getId(),
                    key: "content_" + this.getId()
                },
                    this.buildChildren()
                ));
        }
    }

    onToggle = (): void => {
        let expanded = !this.getState<LS>().expanded;
        this.setExpanded(expanded);
        if (this.stateCallback) {
            this.stateCallback(expanded);
        }
    }
}
