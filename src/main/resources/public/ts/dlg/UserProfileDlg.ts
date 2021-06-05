import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { Anchor } from "../widget/Anchor";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { TextArea } from "../widget/TextArea";
import { TextField } from "../widget/TextField";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UserProfileDlg extends DialogBase {
    readOnly: boolean;
    bioState: ValidatedState<any> = new ValidatedState<any>();
    displayNameState: ValidatedState<any> = new ValidatedState<any>();

    /* If no userNodeId is specified this dialog defaults to the current logged in user, or else will be
    some other user, and this dialog should be readOnly */
    constructor(private userNodeId: string, state: AppState) {
        super("User Profile", "app-modal-content", false, state);
        if (userNodeId == null) {
            userNodeId = state.userProfile.userNodeId;
        }
        this.readOnly = state.userProfile == null || state.userProfile.userNodeId !== userNodeId;
        this.mergeState({ userProfile: null });
    }

    getTitleText(): string {
        const state: any = this.getState();
        if (!state.userProfile) return "";
        return this.readOnly ? "Profile" : "Edit Profile";
    }

    renderDlg(): CompIntf[] {
        const state: any = this.getState();
        if (!state.userProfile) {
            return [new Label("Loading...")];
        }

        let profileHeaderImg: CompIntf = this.makeProfileHeaderImg();
        let profileImg: CompIntf = this.makeProfileImg(!!profileHeaderImg);
        let url = window.location.origin + "/u/" + state.userProfile.userName + "/home";
        let localUser = S.util.isLocalUserName(state.userProfile.userName);

        let children = [
            new Div(null, null, [
                profileHeaderImg ? new Div(null, null, [
                    new Div(null, null, [
                        profileHeaderImg
                    ])
                ]) : null,

                profileImg,

                new Div(null, { className: "marginBottom" }, [
                    this.readOnly
                        ? new Heading(4, state.userProfile.displayName || "")
                        : new TextField("Display Name", false, null, "displayNameTextField", false, this.displayNameState),

                    new Heading(5, "@" + state.userProfile.userName),

                    this.readOnly
                        ? new Html(S.util.markdown(state.userProfile.userBio) || "")
                        : new TextArea("About Me", {
                            rows: 5
                        },
                            this.bioState)
                ]),

                this.readOnly ? null : new Anchor(null, "Logout", { className: "float-right logoutLink", onClick: S.nav.logout }),

                new ButtonBar([
                    this.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                    this.readOnly ? null : new Button("Manage Account", () => S.edit.openManageAccountDlg(state)), //

                    localUser && state.userProfile.homeNodeId ? new Button("Home Node", () => this.openUserHomePage(state, "home")) : null, //
                    localUser ? new Button("Posts", () => this.openUserHomePage(state, "posts")) : null, //

                    this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Add as Friend", this.addFriend) : null,
                    this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Block User", this.blockUser) : null,
                    state.userProfile.actorUrl ? new Button("Go to User Page", () => {
                        window.open(state.userProfile.actorUrl, "_blank");
                    }) : null,
                    new Button("Close", this.close, null)
                ], null, "marginTop")
            ])
        ];

        return children;
    }

    /**
     * NOTE: There's two different URL formats here because there's two different ways to access
     * a named node (which are: via url, or via a parameter on the url)
     */
    openUserHomePage = (state: any, nodeName: string) => {
        /* If this is not our account we open in separate browser tab */
        if (this.readOnly) {
            /* This is the ID-based url (leave this here as FYI), but we use the more user-friendly one
             instead which ends with '/home'.

             let url = window.location.origin + "/app?id=" + state.userProfile.homeNodeId;
             */
            let url = window.location.origin + "/u/" + state.userProfile.userName + "/" + nodeName;
            window.open(url, "_blank");
        }
        /* Else this is our node so we close the dialog and then navitage to the home node */
        else {
            this.close();
            setTimeout(() => S.nav.openContentNode(":" + this.appState.userName + ":" + nodeName), 250);
        }
    }

    reload(userNodeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                userId: userNodeId
            }, (res: J.GetUserProfileResponse): void => {
                // console.log("UserProfile Response: " + S.util.prettyPrint(res));
                if (res) {
                    this.bioState.setValue(res.userProfile.userBio);
                    this.displayNameState.setValue(res.userProfile.displayName);
                    this.mergeState({
                        userProfile: res.userProfile
                    });
                }
                resolve();
            });
        });
    }

    save = (): void => {
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userBio: this.bioState.getValue(),
            displayName: this.displayNameState.getValue()
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

    blockUser = (): void => {
        const state: any = this.getState();
        S.util.ajax<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: state.userProfile.userName
        }, (res: J.AddFriendResponse) => {
            S.util.showMessage(res.message, "Block User");
        });
    }

    superClose = this.close;
    close = () => {
        this.superClose();
        if (!this.readOnly) {
            S.user.queryUserProfile(this.userNodeId);
        }
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        this.close();
        dispatch("Action_SaveUserPerferences", (s: AppState): AppState => {
            s.displayName = this.displayNameState.getValue();
            return s;
        });
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
            if (this.readOnly) return;

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
                className: hasHeaderImg ? (this.readOnly ? "readOnlyProfileImage" : "profileImage")
                    : (this.readOnly ? "readOnlyProfileImageNoHeader" : "profileImageNoHeader"),
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload Avatar Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (this.readOnly) {
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
        let src: string = null;
        const state: any = this.getState();

        if (state.userProfile.apImageUrl) {
            src = state.userProfile.apImageUrl;
        }
        else {
            let headerImageVer = state.userProfile.headerImageVer;
            src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || this.appState.homeNodeId, headerImageVer);
        }

        let onClick = (evt) => {
            if (this.readOnly) return;

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
                className: this.readOnly ? "readOnlyProfileHeaderImage" : "profileHeaderImage",
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload Header Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (this.readOnly) {
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
                    await this.reload(this.userNodeId);
                    resolve();
                });
        });
    }
}
