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
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { TextArea } from "../widget/TextArea";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UserProfileDlg extends DialogBase {
    bioState: ValidatedState<any> = new ValidatedState<any>();

    /* If no userNodeId is specified this dialog defaults to the current logged in user, or else will be
    some other user, and this dialog should be readOnly */
    constructor(private readOnly: boolean, private userNodeId: string, state: AppState) {
        super("User Profile", "app-modal-content", false, state);
        this.mergeState({ userProfile: null, readOnly: false });
    }

    getTitleText(): string {
        const state: any = this.getState();
        if (!state.userProfile) return "";
        return (state.readOnly ? "Profile: " : "Edit Profile: ") + state.userProfile.userName;
    }

    renderDlg(): CompIntf[] {
        const state: any = this.getState();
        if (!state.userProfile) {
            return [new Label("Loading...")];
        }

        let profileHeaderImg: CompIntf = this.makeProfileHeaderImg();
        let profileImg: CompIntf = this.makeProfileImg(!!profileHeaderImg);

        let children = [
            new Div(null, null, [
                profileHeaderImg ? new Div(null, null, [
                    new Div(null, null, [
                        !state.readOnly ? new Div(null, null, [
                            new Label("Header & Avatar Images")
                        ]) : null,
                        profileHeaderImg
                    ])
                ]) : null,

                profileImg,

                new Div(null, { className: "marginBottom " + (profileHeaderImg ? "profileBioPanel" : "profileBioPanelNoHeader") }, [
                    state.readOnly
                        ? new Html(S.util.markdown(state.userProfile.userBio) || "")
                        : new TextArea("Bio", {
                            rows: 8
                        },
                            this.bioState)
                ]),

                new ButtonBar([
                    state.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                    new Button("Close", this.close, null),
                    state.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Add as Friend", this.addFriend) : null,
                    state.userProfile.actorUrl ? new Button("Go to User Page", () => {
                        window.open(state.userProfile.actorUrl, "_blank");
                    }) : null
                ], null, "marginTop")
            ])
        ];

        return children;
    }

    reload(readOnly: boolean, userNodeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                userId: userNodeId
            }, (res: J.GetUserProfileResponse): void => {
                // console.log("UserProfile Response: " + S.util.prettyPrint(res));
                if (res) {
                    this.bioState.setValue(res.userProfile.userBio);
                    this.mergeState({
                        userProfile: res.userProfile,
                        readOnly
                    });
                }
                resolve();
            });
        });
    }

    save = (): void => {
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userBio: this.bioState.getValue()
        }, this.saveResponse);
    }

    addFriend = (): void => {
        const state: any = this.getState();

        S.util.ajax<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: state.userProfile.userName
        }, (res: J.AddFriendResponse) => {
            S.util.showMessage(res.message, "New Friend");
        });
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        this.close();
    }

    makeProfileImg(hasHeaderImg: boolean): CompIntf {
        let src: string = null;
        let state: any = this.getState();

        // if ActivityPub icon exists, we know that's the one to use.
        if (state.userProfile.apIconUrl) {
            src = state.userProfile.apIconUrl;
        }
        else {
            let avatarVer = state.userProfile.avatarVer;
            src = S.render.getAvatarImgUrl(state.userProfile.userNodeId || this.appState.homeNodeId, avatarVer);
        }

        let onClick = (evt) => {
            if (state.userProfile.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "", false, null, false, false, this.appState, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userNodeId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        state.userProfile.avatarVer = res.userProfile.avatarVer;
                        state.userProfile.userNodeId = res.userProfile.userNodeId;
                        this.mergeState({
                            userProfile: state.userProfile
                        });
                    }
                });
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: hasHeaderImg ? (state.userProfile.readOnly ? "readOnlyProfileImage" : "profileImage")
                    : (state.userProfile.readOnly ? "readOnlyProfileImageNoHeader" : "profileImageNoHeader"),
                src,
                onClick
            };
            if (!state.userProfile.readOnly) {
                att.title = "Click to upload Avatar Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (state.userProfile.readOnly) {
                return new Div(null, {
                    className: hasHeaderImg ? "readOnlyProfileImage" : "readOnlyProfileImageNoHeader"
                });
            }
            return new Div("Click to upload Avatar Image", {
                className: hasHeaderImg ? "profileImageHolder" : "profileImageHolderNoHeader",
                onClick
            });
        }
    }

    makeProfileHeaderImg(): CompIntf {
        const state: any = this.getState();

        if (state.userProfile.userName.indexOf("@") !== -1) {
            return null;
        }

        let headerImageVer = state.userProfile.headerImageVer;
        let src: string = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || this.appState.homeNodeId, headerImageVer);

        let onClick = (evt) => {
            if (state.userProfile.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "Header", false, null, false, false, this.appState, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userNodeId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        state.userProfile.headerImageVer = res.userProfile.headerImageVer;
                        state.userProfile.userNodeId = res.userProfile.userNodeId;
                        this.mergeState({
                            userProfile: state.userProfile
                        });
                    }
                });
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: state.userProfile.readOnly ? "readOnlyProfileHeaderImage" : "profileHeaderImage",
                src,
                onClick
            };
            if (!state.userProfile.readOnly) {
                att.title = "Click to upload Header Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (state.userProfile.readOnly) {
                return null;
            }
            return new Div("Click to upload Header Image", {
                className: "profileHeaderImageHolder",
                onClick
            });
        }
    }

    preLoad(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserAccountInfoRequest, J.GetUserAccountInfoResponse>("getUserAccountInfo", null,
                async (res: J.GetUserAccountInfoResponse) => {
                    await this.reload(this.readOnly, this.userNodeId);
                    resolve();
                });
        });
    }
}
