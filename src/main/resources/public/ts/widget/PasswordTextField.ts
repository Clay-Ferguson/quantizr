import { TextField } from "./TextField";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PasswordTextField extends TextField {

    constructor(public attribs: Object, label: string=null, noBrowserSave: boolean = false) {
        super(attribs, label);

        S.util.mergeProps(this.attribs, {
            type: "password",
            className: "form-control textfield"
        });
    }
}
