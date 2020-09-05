import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RepoRootTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.REPO_ROOT, "Repository Root", "fa-home", false);
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new HorizontalLayout([
            new Heading(4, "Repository Root", {
                className: "marginAll"
            })
        ]);
    }
}
