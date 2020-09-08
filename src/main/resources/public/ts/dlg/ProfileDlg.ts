import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { Textarea } from "../widget/Textarea";
import { TextField } from "../widget/TextField";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ProfileDlg extends DialogBase {

    userNameTextField: TextField;
    bioTextarea: Textarea;

    constructor(state: AppState) {
        super("Profile: " + state.userName, null, false, state);
    }

    renderDlg(): CompIntf[] {
        //let state = this.getState();
        let profileImg: CompIntf = this.makeProfileImg();

        let children = [
            new Form(null, [
                new Div(null, {
                    className: "row"
                }, [
                    new Div(null, {
                        className: "col-6"
                    }, [
                        new Div(null, null, [
                            // I'm disabling ability to change user name because of a bug (duplicate name risk)
                            // this.userNameTextField = new TextField("User Name", state.defaultUserName, false, null, {
                            //     getValue: () => {
                            //         return this.getState().defaultUserName;
                            //     },
                            //     setValue: (val: any) => {
                            //         this.mergeState({ defaultUserName: val });
                            //     }
                            // }),
                            this.bioTextarea = new Textarea("Bio", {
                                rows: 15
                            }, {
                                getValue: () => {
                                    return this.getState().defaultBio;
                                },
                                setValue: (val: any) => {
                                    this.mergeState({ defaultBio: val });
                                }
                            })
                        ])
                    ]),

                    new Div(null, {
                        className: "col-6"
                    }, [
                        new Div(null, null, [
                            new Label("Profile Picture")
                        ]),
                        profileImg
                    ])
                ]),

                new Div(null, {
                    className: "row"
                }, [
                    new Div(null, {
                        className: "col-12"
                    }, [
                        new ButtonBar([
                            new Button("Save", this.save, null, "btn-primary"),
                            new Button("Cancel", () => {
                                this.close();
                            })
                        ], null, "marginTop")
                    ])
                ])
            ])
        ];

        return children;
    }

    renderButtons(): CompIntf {
        return null;
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
            }, (res: J.GetUserProfileResponse): void => {
                if (res) {
                    this.mergeState({
                        defaultUserName: res.userName,
                        defaultBio: res.userBio,
                        avatarVer: res.avatarVer,
                        userNodeId: res.userNodeId
                    });
                }
                resolve();
            });
        });
    }

    save = (): void => {
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null, //this.userNameTextField.getValue(),
            userBio: this.bioTextarea.getValue()
        }, this.saveResponse);
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        if (S.util.checkSuccess("Saving Profile", res)) {
            let state: AppState = store.getState();

            // DO NOT DELETE: this will come back eventually
            //let userName = this.userNameTextField.getValue();
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
        let src: string = S.render.getAvatarImgUrl(this.appState.homeNodeId, avatarVer);

        let onClick = (evt) => {
            let dlg = new UploadFromFileDropzoneDlg(state.userNodeId, null, false, null, false, this.appState, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
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
            //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            let img: Img = new Img("profile-img", {
                className: "profileImage",
                title: "Click to upload new Profile Image",
                src,
                onClick
            });
            return img;
        }
        else {
            return new Div("Click to upload Profile Image", {
                className: "profileImageHolder",
                onClick
            });
        }
    }
}
