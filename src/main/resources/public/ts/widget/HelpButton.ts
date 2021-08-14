import { ReactNode } from "react";
import { store } from "../AppRedux";
import { Markdown } from "../comps/Markdown";
import { Constants as C } from "../Constants";
import { MessageDlg } from "../dlg/MessageDlg";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class HelpButton extends Comp {

    constructor(private getHelpText: () => string, _attribs: Object = null, moreClasses: string = "btn-secondary") {
        super(_attribs);
        if (!this.attribs.className) {
            this.attribs.className = "";
        }

        this.attribs.className += " btn " + moreClasses;
        this.attribs.type = "button";
        this.attribs.onClick = () => { this.openHelpDialog(); };
    }

    openHelpDialog = (): void => {
        let helpText = this.getHelpText();
        if (helpText) {
            // By convention the first line of text is taken as the title for the help
            let idx = helpText.indexOf("\n");
            if (idx !== -1) {
                let title = helpText.substring(0, idx);
                let content = helpText.substring(idx);
                // content = content.replace("\n\n", "[nl]");
                // content = content.replace("\n", " ");
                // content = content.replace("[nl]", "\n\n");
                new MessageDlg(null, title, null, new Markdown(content), false, 0, store.getState()).open();
            }
        }
    }

    compRender(): ReactNode {
        let icon: any;

        icon = this.e("i", {
            key: "s_" + this.getId(),
            className: "fa fa-question-circle"
        });

        return this.e("button", this.attribs, [icon]);
    }
}
