import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Html } from "../widget/Html";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ActPubItemTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.ACT_PUB_ITEM, "APItem", "fa-comment", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    // getCustomProperties(): string[] {
    //     return [J.NodeProp.USER];
    // }

    // allowPropertyEdit(propName: string, state: AppState): boolean {
    //     // USER_NODE_ID is generated and maintained by the server, and we can ignore it in the editor.
    //     return propName === J.NodeProp.USER;
    // }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        let content: string = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_CONTENT, node);
        let url: string = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_URL, node);
        let inReplyTo: string = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_INREPLYTO, node);

        return new Div(null, {
            className: "marginLeft"
        }, [
            new Div(null, null, [
                new Html(content, {
                    className: "marginAll"
                })
            ]),
            new HorizontalLayout([
                url ? new Anchor(url, "Link", {
                    className: "marginAll"
                }) : null,
                inReplyTo ? new Anchor(inReplyTo, "Replied to", {
                    className: "marginAll"
                }) : null])
        ]);
    }
}
