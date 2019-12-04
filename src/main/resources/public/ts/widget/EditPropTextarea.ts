console.log("EditPropTextarea.ts");

import { Textarea } from "./Textarea";
import * as I from "../Interfaces";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPropTextarea extends Textarea {
    constructor(public propEntry: I.PropEntry, public attribs: Object) {
        super(attribs);
        propEntry.id = this.getId();
    }
}
