import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";

export class MultiBlockDlg extends DialogBase {
    userNamesState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);
    textScrollPos = new ScrollPos();

    constructor() {
        super("Block Multiple Accounts", "appModalContMediumWidth");
        this.validatedStates = [this.userNamesState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent("Enter Fediverse Usernames (one per line)"),
                new TextArea("User Names", { rows: 15 }, this.userNamesState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Block All", this._block, null, "-primary"),
                    new Button("Close", this._close, null, "float-right")
                ], "mt-3")
            ])
        ];
    }

    _block = async () => {
        await S.rpcUtil.rpc<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: this.userNamesState.getValue()
        });
        PubSub.pub(C.PUBSUB_friendsChanged, this.userNamesState.getValue());
        this.close();
    }
}
