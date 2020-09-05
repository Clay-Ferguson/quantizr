import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

// let S: Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

export class NotesNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.NOTES, "Notes", "fa-sticky-note", false);
    }
}
