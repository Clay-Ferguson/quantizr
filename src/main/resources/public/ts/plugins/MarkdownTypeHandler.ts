import { store } from "../AppRedux";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class MarkdownTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.NONE, "Markdown", "fa-align-left", true);
    }

    /* don't show this icon unless we are in edit mode, because since most everything is markdown 
    type it would be too verbose. */
    getIconClass(): string {
        let appState = store.getState();
        return appState.userPreferences.editMode ? super.getIconClass() : null;
    }
}
