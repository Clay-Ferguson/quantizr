import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

export class MultiFollowDlg extends DialogBase {
    userNamesState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);
    tagState: Validator = new Validator("");
    textScrollPos = new ScrollPos();

    constructor() {
        super("Follow Multiple Accounts", "appModalContMediumWidth");
        this.validatedStates = [this.userNamesState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent("Enter Fediverse Usernames (one per line)"),
                new TextArea("User Names", { rows: 15 }, this.userNamesState, null, false, 3, this.textScrollPos),
                new TextField({ label: "Tags (optional)", val: this.tagState }),
                new ButtonBar([
                    new Button("Follow All", this._follow, null, "-primary"),
                    new Button("Close", this._close, null, "tw-float-right")
                ], "marginTop")
            ])
        ];
    }

    _follow = async () => {
        await S.rpcUtil.rpc<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: this.userNamesState.getValue(),
            tags: this.tagState.getValue()
        });
        this.close();
    }
}
