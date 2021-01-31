import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { TextArea } from "../widget/TextArea";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ProfileDlg extends DialogBase {
    // userNameTextField: TextField;
    bioState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState, private readOnly: boolean, private userId: string, private userName: string) {
        super("User Profile: " + (userName || state.userName), null, false, state);
    }

    renderDlg(): CompIntf[] {
        let profileImg: CompIntf = this.makeProfileImg();
        let profileHeaderImg: CompIntf = this.makeProfileHeaderImg();

        let children = [
            new Form(null, [
                new Div(null, {
                    className: "row"
                }, [
                    new Div(null, {
                        className: "col-12"
                    }, [
                        new Div(null, null, [
                            new Label("Profile Header Image")
                        ]),
                        profileHeaderImg
                    ])
                ]),

                new Div(null, {
                    className: "row"
                }, [
                    new Div(null, {
                        className: "col-4"
                    }, [
                        new Div(null, null, [
                            new Label("Avatar Image")
                        ]),
                        profileImg
                    ]),
                    new Div(null, {
                        className: "col-8"
                    }, [
                        new Div(null, { className: "marginTop" }, [
                            this.readOnly
                                ? new Html(S.util.markdown(this.bioState.getValue()) || "This user hasn't entered a bio yet")
                                : new TextArea("Bio", {
                                    rows: 8
                                }, this.bioState)
                        ])
                    ])
                ]),

                new Div(null, {
                    className: "row"
                }, [
                    new Div(null, {
                        className: "col-12 marginTop"
                    }, [
                        new ButtonBar([
                            this.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                            (this.readOnly && this.userName.indexOf("@") === -1 && this.userName !== this.appState.userName) ? new Button("Add as Friend", this.addFriend) : null,
                            new Button(this.readOnly ? "Close" : "Cancel", this.close)
                        ], null, "marginTop")
                    ])
                ])
            ])
        ];

        return children;
    }

    /* Base class override used to get data before rendering the dialog */
    preLoad(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.reload();
            resolve();
        });
    }

    reload(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                userId: this.userId
            }, (res: J.GetUserProfileResponse): void => {
                if (res) {
                    this.mergeState({
                        defaultUserName: res.userName,
                        avatarVer: res.avatarVer,
                        headerImageVer: res.headerImageVer,
                        userNodeId: res.userNodeId
                    });
                    this.bioState.setValue(res.userBio);
                }
                resolve();
            });
        });
    }

    save = (): void => {
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null, // this.userNameTextField.getValue(),
            userBio: this.bioState.getValue()
        }, this.saveResponse);
    }

    addFriend = (): void => {
        S.util.ajax<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: this.userName
        }, (res: J.AddFriendResponse) => {
            S.util.showMessage(res.message, "New Friend");
        });
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        if (S.util.checkSuccess("Saving Profile", res)) {
            let state: AppState = store.getState();

            // DO NOT DELETE: this will come back eventually
            // let userName = this.userNameTextField.getValue();
            // dispatch({
            //     type: "Action_UpdateUserProfile", state,
            //     update: (s: AppState): void => {
            //         s.userName = userName;
            //         s.title = "User: " + userName;
            //     },
            // });

            S.meta64.refresh(state);
            this.close();
        }
    }

    makeProfileImg(): CompIntf {
        let state = this.getState();
        let avatarVer = this.getState().avatarVer;
        let src: string = S.render.getAvatarImgUrl(this.userId || this.appState.homeNodeId, avatarVer);

        let onClick = (evt) => {
            if (this.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userNodeId, "", false, null, false, false, this.appState, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: this.userId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        this.mergeState({
                            // NOTE: It's correct here to get only avatar info back from server on this query, and ignore
                            // the other info, that may be currently being edited.
                            // defaultUserName: res.userName,
                            // defaultBio: res.userBio,
                            avatarVer: res.avatarVer,
                            userNodeId: res.userNodeId
                        });
                    }
                });
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: this.readOnly ? "readOnlyProfileImage" : "profileImage",
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload new Profile Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            return new Div("Click to upload Profile Image", {
                className: "profileImageHolder",
                onClick
            });
        }
    }

    makeProfileHeaderImg(): CompIntf {
        let state = this.getState();
        let headerImageVer = this.getState().headerImageVer;
        let src: string = S.render.getProfileHeaderImgUrl(this.userId || this.appState.homeNodeId, headerImageVer);

        let onClick = (evt) => {
            if (this.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userNodeId, "Header", false, null, false, false, this.appState, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: this.userId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        this.mergeState({
                            // NOTE: It's correct here to get only image info back from server on this query, and ignore
                            // the other info, that may be currently being edited.
                            avatarVer: res.avatarVer,
                            headerImageVer: res.headerImageVer,
                            userNodeId: res.userNodeId
                        });
                    }
                });
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: this.readOnly ? "readOnlyProfileHeaderImage" : "profileHeaderImage",
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload new Header Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            return new Div("Click to upload Profile Image", {
                className: "profileHeaderImageHolder",
                onClick
            });
        }
    }
}
