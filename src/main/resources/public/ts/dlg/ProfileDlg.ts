import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { TextField } from "../widget/TextField";
import { Textarea } from "../widget/Textarea";
import { Img } from "../widget/Img";
import { store, dispatch } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ProfileDlg extends DialogBase {

    userNameTextField: TextField;
    bioTextarea: Textarea;

    constructor(state: AppState) {
        super("Profile", null, false, state);
    }

    renderDlg(): CompIntf[] {

        let profileImg: Img = this.makeProfileImg();

        let children = [
            new Form(null, [
                profileImg,
                new FormGroup(null, [
                    new Div(null, null, [
                        this.userNameTextField = new TextField("User Name"),
                        this.bioTextarea = new Textarea("Bio", {
                            rows: 5
                        })
                    ]),
                ]),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Cancel", () => {
                        this.close();
                    })
                ])
            ])
        ];

        return children;
    }

    queryServer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.reload();
            resolve();
        });
    }

    /*
     * Gets privileges from server and displays in GUI also. Assumes gui is already at correct page.
     */
    reload = (): void => {
        S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
        }, (res: J.GetUserProfileResponse): void => {
            this.userNameTextField.setValue(res.userName),
            this.bioTextarea.setValue(res.userBio)
        });
    }

    save = (): void => {
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: this.userNameTextField.getValue(),
            userBio: this.bioTextarea.getValue()
        }, this.saveResponse);
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        //todo-0: if you replicate a user name it DOES return 'success=true', along with this message.
        if (res.message) {
            S.util.showMessage(res.message, "Warning");
        }

        if (S.util.checkSuccess("Saving Profile", res)) {
            let state: AppState = store.getState();
            let userName = this.userNameTextField.getValue();
            let userBio = this.bioTextarea.getValue();
        
            dispatch({
                type: "Action_UpdateUserProfile", state,
                update: (s: AppState): void => {
                    s.userName = userName;
                    s.title = "User: " + userName;
                },
            });

            this.close();
        }
    }

    makeProfileImg() {

        let src: string = S.render.getAvatarImgUrl(this.appState.homeNodeId, this.appState.avatarVer);
        if (!src) {
            return null;
        }

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img("profile-img", {
            src,
            className: "profileImage",
            title: "Click to upload new Profile Image",

            // I decided not to let avatars be clickable.
            onClick: (evt) => {

                // dispatch({
                //     type: "Action_ClickImage", state,
                //     update: (s: AppState): void => {
                //         if (s.expandedImages[key]) {
                //             delete s.expandedImages[key];
                //         }
                //         else {
                //             s.expandedImages[key] = "y";
                //         }
                //     },
                // });
            }
        });

        return img;
    }
}
