import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { AppState } from "../AppState";
import { Comp } from "../widget/base/Comp";
import { NodeCompMarkdown } from "../comps/NodeCompMarkdown";
import { Div } from "../widget/Div";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class InboxNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX, "Inbox", "fa-inbox", false);
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new NodeCompMarkdown(node),
            new ButtonBar([
                new Button("Clear Inbox", () => {
                    S.edit.clearInbox(state)
                })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" })
        ]);
    }
}
