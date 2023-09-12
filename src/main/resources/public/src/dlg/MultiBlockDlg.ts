import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { ScrollPos } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Diva } from "../comp/core/Diva";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";

export class MultiBlockDlg extends DialogBase {
    userNamesState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);
    textScrollPos = new ScrollPos();

    constructor() {
        super("Block Multiple Accounts", "appModalContMediumWidth");
        this.validatedStates = [this.userNamesState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Diva([
                new TextContent("Enter Fediverse Usernames (one per line)"),
                new TextArea("User Names", { rows: 15 }, this.userNamesState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Block All", this.block, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    block = async () => {
        await S.rpcUtil.rpc<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: this.userNamesState.getValue()
        });
        PubSub.pub(C.PUBSUB_friendsChanged, this.userNamesState.getValue());
        this.close();
    }
}
