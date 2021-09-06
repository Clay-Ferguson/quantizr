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
import { Clearfix } from "../widget/Clearfix";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { Span } from "../widget/Span";
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
        return (this.readOnly ? "Profile: " : "Edit Profile: ") + "@" + state.userProfile.userName;
    }

    renderDlg(): CompIntf[] {
        const state: any = this.getState();
        if (!state.userProfile) {
            return [new Label("Loading...")];
        }

        let profileHeaderImg: CompIntf = this.makeProfileHeaderImg();
        let profileImg: CompIntf = this.makeProfileImg(!!profileHeaderImg);
        let localUser = S.util.isLocalUserName(state.userProfile.userName);

        let children = [
            new Div(null, null, [
                profileHeaderImg ? new Div(null, null, [
                    new Div(null, null, [
                        profileHeaderImg
                    ])
                ]) : null,

                profileImg,
                // todo-1: currently there's no 'unblock' user has to go do that in their blocked users node.
                new Div(null, { className: "marginBottom" }, [
                    new Div(null, { className: "float-right" }, [
                        state.userProfile.blocked ? new Span("BLOCKED", { className: "blockingText" }) : null,

                        // todo-1: add a click handler to this which deletes the friend node (unfollows)
                        state.userProfile.following ? new Span("You Follow", { className: "followingText" }) : null,

                        state.userProfile.followerCount > 0 ? new Span(state.userProfile.followerCount + " followers", {
                            onClick: () => {
                                if (state.userProfile.followerCount) {
                                    this.close();
                                    if (localUser) {
                                        S.srch.showFollowers(0, state.userProfile.userName);
                                    }
                                    else {
                                        window.open(state.userProfile.actorUrl, "_blank");
                                    }
                                }
                            },
                            className: "followCount"
                        }) : null,

                        state.userProfile.followingCount > 0 ? new Span(state.userProfile.followingCount + " following", {
                            onClick: () => {
                                if (state.userProfile.followingCount) {
                                    this.close();
                                    if (localUser) {
                                        S.srch.showFollowing(0, state.userProfile.userName);
                                    }
                                    else {
                                        window.open(state.userProfile.actorUrl, "_blank");
                                    }

                                    // It would be 'inconsistent' to just jump to the FRIEND_LIST? if this user is looking
                                    // at their own user profile dialog? There's also even the Friend Picker dialog too!
                                    // S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST);
                                }
                            },
                            className: "followCount"
                        }) : null
                    ]),
                    new Clearfix(),

                    this.readOnly
                        ? new Heading(4, state.userProfile.displayName || "")
                        : new TextField("Display Name", false, null, "displayNameTextField", false, this.displayNameState),

                    this.readOnly
                        ? new Html(S.util.markdown(state.userProfile.userBio) || "")
                        : new TextArea("About Me", {
                            rows: 5
                        },
                            this.bioState)
                ]),

                this.readOnly ? null : new Anchor(null, "Logout", { className: "float-right logoutLink", onClick: S.nav.logout }),

                new ButtonBar([
                    this.appState.isAnonUser || this.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                    this.appState.isAnonUser || this.readOnly ? null : new Button("Manage Account", () => S.edit.openManageAccountDlg(state)), //

                    localUser && state.userProfile.homeNodeId ? new Button("Home Node", () => this.openUserHomePage(state, "home")) : null, //
                    localUser ? new Button("Posts", () => this.openUserHomePage(state, "posts")) : null, //

                    !this.appState.isAnonUser && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Message", this.sendMessage) : null,
                    !this.appState.isAnonUser && !state.userProfile.following && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Follow", this.addFriend) : null,
                    !this.appState.isAnonUser && !state.userProfile.blocked && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Block User", this.blockUser) : null,
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

    reload = (userNodeId: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                userId: userNodeId
            }, (res: J.GetUserProfileResponse): void => {
                // console.log("UserProfile Response: " + S.util.prettyPrint(res));
                if (res && res.userProfile) {
                    this.bioState.setValue(res.userProfile.userBio);
                    this.displayNameState.setValue(res.userProfile.displayName);
                    this.mergeState({
                        userProfile: res.userProfile
                    });
                }
                resolve();
            }, () => resolve());
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

    sendMessage = (): void => {
        this.close();
        setTimeout(() => {
            S.edit.addNode(null, null, this.userNodeId, null, this.appState);
        }, 10);
    }

    blockUser = (): void => {
        const state: any = this.getState();
        S.util.ajax<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: state.userProfile.userName
        }, (res: J.AddFriendResponse) => {
            S.util.showMessage("Blocked User: " + state.userProfile.userName);
        });
    }

    close(): void {
        super.close();
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
                    if (res && res.userProfile) {
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
                    if (res && res.userProfile) {
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
                    // what is going on here?, we're not using 'res' at all? What does this call do just update
                    // something on the server to prepare the 'reload' all. This looks inefficient (todo-1)
                    await this.reload(this.userNodeId);
                    resolve();
                }, () => resolve());
        });
    }
}
