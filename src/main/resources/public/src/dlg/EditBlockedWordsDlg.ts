import { dispatch, getAs } from "../AppContext";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValHolder } from "../ValHolder";

export class EditBlockedWordsDlg extends DialogBase {
    wordsState: ValHolder = new ValHolder();
    textScrollPos = new ScrollPos();

    constructor() {
        super("Blocked Words", "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div("Content containing these will be filtered from your feed."),
                new TextArea("Blocked Words", { rows: 15 }, this.wordsState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Save", this.save, null, "-primary"),
                    new Button("Close", this._close, null, "float-right")
                ], "mt-3")
            ])
        ];
    }

    reload = async () => {
        const res = await S.rpcUtil.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: getAs().userProfile.userNodeId
        });

        if (res?.userProfile) {
            this.wordsState.setValue(res.userProfile.blockedWords);
        }
    }

    save = () => {
        const ast = getAs();
        ast.userProfile.blockedWords = this.wordsState.getValue();

        dispatch("SetUserProfile", s => {
            s.userProfile = ast.userProfile;
        });

        S.rpcUtil.rpc<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userTags: ast.userProfile.userTags,
            blockedWords: ast.userProfile.blockedWords,
            userBio: ast.userProfile.userBio,
            displayName: ast.userProfile.displayName,
            recentTypes: ast.userProfile.recentTypes
        });
        this.close();
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
