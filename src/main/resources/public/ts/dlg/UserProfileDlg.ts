import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Anchor } from "../comp/core/Anchor";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { Html } from "../comp/core/Html";
import { Img } from "../comp/core/Img";
import { Label } from "../comp/core/Label";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

interface LS { // Local State
    userProfile: J.UserProfile;
}

export class UserProfileDlg extends DialogBase {
    readOnly: boolean;
    bioState: ValidatedState<any> = new ValidatedState<any>();
    displayNameState: ValidatedState<any> = new ValidatedState<any>();

    /* If no userNodeId is specified this dialog defaults to the current logged in user, or else will be
    some other user, and this dialog should be readOnly */
    constructor(private userNodeId: string, state: AppState) {
        super("User Profile", "app-modal-content", false, state);
        if (!userNodeId) {
            userNodeId = state.userProfile.userNodeId;
        }
        this.readOnly = !state.userProfile || state.userProfile.userNodeId !== userNodeId;
        this.mergeState<LS>({ userProfile: null });
    }

    getTitleText(): string {
        const state: any = this.getState<LS>();
        if (!state.userProfile) return "";
        let userName = state.userProfile.userName;
        if (userName.indexOf("@") === -1) {
            userName = userName + "@" + window.location.hostname;
        }
        return userName;
    }

    renderDlg(): CompIntf[] {
        const state: any = this.getState<LS>();
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

                new HorizontalLayout([
                    profileImg,
                    new Div(null, { className: "userDisplayName" }, [
                        new Div(null, null, [
                        this.readOnly
                            ? new Heading(4, state.userProfile.displayName || "")
                            : new TextField({ label: "Display Name", inputClass: "displayNameTextField", val: this.displayNameState })
                        ]),
                        new Div(null, { className: "float-end" }, [
                            state.userProfile.blocked ? new Span("You Blocked", {
                                className: "blockingText",
                                onClick: this.unblockUser,
                                title: "Click to Unblock user"
                            }) : null,
                            state.userProfile.following ? new Span("You Follow", {
                                className: "followingText",
                                onClick: this.deleteFriend,
                                title: "Click to Unfollow user"
                            }) : null,

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
                        ])
                    ])
                ], "avatarAndNamePanel"),

                this.readOnly
                    ? new Html(S.util.markdown(state.userProfile.userBio) || "")
                    : new TextArea("About Me", {
                        rows: 5
                    },
                        this.bioState),

                this.readOnly ? null : new Anchor(null, "Logout", { className: "float-end logoutLink", onClick: S.nav.logout }),

                new ButtonBar([
                    this.appState.isAnonUser || this.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                    this.appState.isAnonUser || this.readOnly ? null : new Button("Manage Account", () => S.edit.openManageAccountDlg(state)), //

                    // only local users might have set their 'home' node (named a node 'home')
                    localUser && state.userProfile.homeNodeId ? new Button("Home", () => this.openUserHomePage(state, "home")) : null, //

                    // but all users we know of will have a posts node simply from having their posts imported
                    new Button("Posts", () => this.openUserHomePage(state, "posts")), //

                    !this.appState.isAnonUser && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Message", this.sendMessage) : null,
                    !this.appState.isAnonUser && !state.userProfile.following && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Follow", this.addFriend) : null,
                    !this.appState.isAnonUser && !state.userProfile.blocked && this.readOnly && state.userProfile.userName !== this.appState.userName ? new Button("Block", this.blockUser) : null,
                    state.userProfile.actorUrl ? new Button("User Page", () => {
                        window.open(state.userProfile.actorUrl, "_blank");
                    }) : null,
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];

        return children;
    }

    deleteFriend = async () => {
        let res: J.DeleteFriendResponse = await S.util.ajax<J.DeleteFriendRequest, J.DeleteFriendResponse>("deleteFriend", {
            userNodeId: this.userNodeId
        });
        this.reload(this.userNodeId);
    }

    unblockUser = async () => {
        let res: J.DeleteFriendResponse = await S.util.ajax<J.DeleteFriendRequest, J.DeleteFriendResponse>("unblockUser", {
            userNodeId: this.userNodeId
        });
        this.reload(this.userNodeId);
    }

    /**
     * NOTE: There's two different URL formats here because there's two different ways to access
     * a named node (which are: via url, or via a parameter on the url)
     */
    openUserHomePage = (state: any, nodeName: string) => {
        // let url = window.location.origin + "/u/" + state.userProfile.userName + "/" + nodeName;
        // window.open(url, "_blank");
        this.close();
        setTimeout(() => S.nav.openContentNode(":" + state.userProfile.userName + ":" + nodeName), 250);
    }

    reload = async (userNodeId: string) => {
        let res: J.GetUserProfileResponse = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: userNodeId
        });

        // console.log("UserProfile Response: " + S.util.prettyPrint(res));
        if (res?.userProfile) {
            this.bioState.setValue(res.userProfile.userBio);
            this.displayNameState.setValue(res.userProfile.displayName);
            this.mergeState<LS>({
                userProfile: res.userProfile
            });
        }
    }

    save = async () => {
        let res: J.SaveUserProfileResponse = await S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userBio: this.bioState.getValue(),
            displayName: this.displayNameState.getValue()
        });
        this.saveResponse(res);
    }

    addFriend = async () => {
        const state: any = this.getState<LS>();
        let res: J.AddFriendResponse = await S.util.ajax<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: state.userProfile.userName
        });

        if (res.success) {
            state.userProfile.following = true;
            state.userProfile.blocked = false;
            this.mergeState<LS>({
                userProfile: state.userProfile
            });
        }
    }

    sendMessage = (): void => {
        this.close();
        setTimeout(() => {
            S.edit.addNode(null, null, this.userNodeId, null, this.appState);
        }, 10);
    }

    blockUser = async () => {
        const state: any = this.getState<LS>();
        let res: J.BlockUserResponse = await S.util.ajax<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: state.userProfile.userName
        });

        if (res.success) {
            state.userProfile.blocked = true;
            state.userProfile.following = false;
            this.mergeState<LS>({
                userProfile: state.userProfile
            });
        }
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
        let state: any = this.getState<LS>();

        // if ActivityPub icon exists, we know that's the one to use.
        if (state.userProfile.apIconUrl) {
            src = state.userProfile.apIconUrl;
        }
        else {
            let avatarVer = state.userProfile.avatarVer;
            src = S.render.getAvatarImgUrl(state.userProfile.userNodeId || this.appState.homeNodeId, avatarVer);
        }

        let onClick = async (evt) => {
            if (this.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "", false, null, false, false, this.appState, async () => {

                let res: J.GetUserProfileResponse = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userNodeId
                });

                if (res?.userProfile) {
                    state.userProfile.avatarVer = res.userProfile.avatarVer;
                    state.userProfile.userNodeId = res.userProfile.userNodeId;
                    this.mergeState<LS>({
                        userProfile: state.userProfile
                    });
                }
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: "userProfileDlgAvatar",
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
                return new Div("No avatar image", {
                    className: "userProfileDlgAvatar"
                });

            }
            return new Div("Click to upload Avatar Image", {
                className: "userProfileDlgAvatar",
                onClick
            });
        }
    }

    makeProfileHeaderImg(): CompIntf {
        let src: string = null;
        const state: any = this.getState<LS>();

        if (state.userProfile.apImageUrl) {
            src = state.userProfile.apImageUrl;
        }
        else {
            let headerImageVer = state.userProfile.headerImageVer;
            src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || this.appState.homeNodeId, headerImageVer);
        }

        let onClick = (evt) => {
            if (this.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "Header", false, null, false, false, this.appState, async () => {

                let res: J.GetUserProfileResponse = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userNodeId
                });

                if (res?.userProfile) {
                    state.userProfile.headerImageVer = res.userProfile.headerImageVer;
                    state.userProfile.userNodeId = res.userProfile.userNodeId;
                    this.mergeState<LS>({
                        userProfile: state.userProfile
                    });
                }
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: "userProfileDlgHeader",
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
                return new Div("No header image", {
                    className: "userProfileDlgHeader"
                });
            }
            return new Div("Click to upload Header Image", {
                className: "userProfileDlgHeader",
                onClick
            });
        }
    }

    async preLoad(): Promise<void> {
        await S.util.ajax<J.GetUserAccountInfoRequest, J.GetUserAccountInfoResponse>("getUserAccountInfo");
        await this.reload(this.userNodeId);
    }
}
