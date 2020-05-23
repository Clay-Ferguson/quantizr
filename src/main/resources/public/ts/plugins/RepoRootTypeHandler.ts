import * as J from "../JavaIntf";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { AppState } from "../AppState";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RepoRootTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.REPO_ROOT, "Repository Root", "fa-home");
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }
}


