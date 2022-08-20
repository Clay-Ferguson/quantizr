import { ReactNode } from "react";
import { getAppState } from "../../AppContext";
import { MessageDlg } from "../../dlg/MessageDlg";
import { Comp } from "../base/Comp";
import { Italic } from "./Italic";
import { Markdown } from "./Markdown";

export class HelpButton extends Comp {

    constructor(private getHelpText: () => string, attribs: Object = null, moreClasses: string = "btn-secondary") {
        super(attribs);
        this.attribs.className = this.attribs.className || "";
        this.attribs.className += " btn " + moreClasses;
        this.attribs.className += getAppState().mobileMode ? " mobileButton" : "";
        this.attribs.type = "button";
        this.attribs.onClick = () => this.openHelpDialog();
    }

    openHelpDialog = () => {
        const helpText = this.getHelpText();
        if (helpText) {
            // By convention the first line of text is taken as the title for the help
            const idx = helpText.indexOf("\n");
            if (idx !== -1) {
                const title = helpText.substring(0, idx);
                const content = helpText.substring(idx);
                // content = content.replace("\n\n", "[nl]");
                // content = content.replace("\n", " ");
                // content = content.replace("[nl]", "\n\n");
                new MessageDlg(null, title, null, new Markdown(content), false, 0, null).open();
            }
        }
    }

    compRender = (): ReactNode => {
        return this.tag("button", null, [
            new Italic({
                className: "fa fa-question-circle"
            })]);
    }
}
