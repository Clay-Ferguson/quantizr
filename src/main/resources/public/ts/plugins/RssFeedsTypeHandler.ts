import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssFeedsTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.RSS_FEEDS, "RSS Feeds", "fa-rss", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new Heading(4, "RSS Feed Subscriptions", {
                className: "marginAll"
            }),
            new ButtonBar([
                new Button("Add RSS Feed", () => S.edit.createNode(node, J.NodeType.RSS_FEED, state), {
                    title: "Add a new RSS Feed Subscription"
                })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" })

            // todo-1: add help for this...
            // new CollapsibleHelpPanel("Help", S.meta64.config.help.type.friendsList.render,
            //     (state: boolean) => {
            //         RssFeedsTypeHandler.helpExpanded = state;
            //     }, RssFeedsTypeHandler.helpExpanded)
        ]);
    }
}
