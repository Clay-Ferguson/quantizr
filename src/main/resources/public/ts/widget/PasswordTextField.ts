import { TextField } from "./TextField";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PasswordTextField extends TextField {

    constructor(label: string=null, attribs: Object=null, noBrowserSave: boolean = false) {
        super(label, attribs);

        S.util.mergeProps(this.attribs, {
            type: "password",
            className: "form-control textfield"
        });
    }
}
