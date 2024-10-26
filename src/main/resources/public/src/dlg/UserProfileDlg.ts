import { dispatch, getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeType } from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { Img } from "../comp/core/Img";
import { Label } from "../comp/core/Label";
import { Markdown } from "../comp/core/Markdown";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { TextField } from "../comp/core/TextField";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";
import { UserAdminPanel } from "./UserAdminPanel";

export interface LS { // Local State
    userProfile?: J.UserProfile;
}

export class UserProfileDlg extends DialogBase {
    readOnly: boolean;
    bioState: Validator = new Validator();
    displayNameState: Validator = new Validator();
    textScrollPos = new ScrollPos();

    /* If no userNodeId is specified this dialog defaults to the current logged in user, or else
    will be some other user, and this dialog should be readOnly */
    constructor(private userNodeId: string) {
        super("User Profile", "appModalCont");
        const ast = getAs();
        userNodeId = userNodeId || ast.userProfile.userNodeId;
        this.readOnly = !ast.userProfile || ast.userProfile.userNodeId !== userNodeId;
        this.mergeState<LS>({ userProfile: null });
    }

    override getTitleText(): string {
        return this.getUserName();
    }

    getUserName(): string {
        const state: any = this.getState<LS>();
        if (!state.userProfile) return "";
        let userName = state.userProfile.userName;

        if (userName.indexOf("@") === -1) {
            userName = userName + "@" + window.location.hostname;
        }
        return userName;
    }

    renderDlg(): Comp[] {
        const state = this.getState<LS>();
        const ast = getAs();
        if (!state.userProfile) {
            return [new Label("Loading...")];
        }

        const profileHeaderImg = this.makeProfileHeaderImg();
        const profileImg = this.makeProfileImg(!!profileHeaderImg);

        const children = [
            new Div(null, null, [
                profileHeaderImg ? new Div(null, null, [
                    new Div(null, null, [
                        profileHeaderImg
                    ])
                ]) : null,

                new FlexRowLayout([
                    profileImg,
                    new Div(null, { className: "userDisplayName" }, [
                        new Div(null, { className: "ml-3" }, [
                            this.readOnly
                                ? new Heading(4, state.userProfile.displayName || "")
                                : new TextField({ label: "Display Name", inputClass: "displayNameTextField", val: this.displayNameState })
                        ]),
                        new Div(null, { className: "tw-float-right" }, [
                            state.userProfile.blocked ? new Span("You Blocked", {
                                className: "blockingText",
                                onClick: this._unblockUser,
                                title: "Click to Unblock user"
                            }) : null,
                            state.userProfile.following ? new Span("You Follow", {
                                className: "followingText",
                                onClick: this._deleteFriend,
                                title: "Click to Unfollow user"
                            }) : null,
                        ])
                    ])
                ], "avatarAndNamePanel"),

                this.readOnly
                    ? new Markdown(state.userProfile.userBio || "", { className: "bioPanel" })
                    : new TextArea("About Me", {
                        rows: 5
                    }, this.bioState, null, false, 3, this.textScrollPos),

                getAs().isAdminUser ? new UserAdminPanel(this) : null,

                new ButtonBar([
                    (getAs().isAnonUser || this.readOnly) ? null : new Button("Save", this._save, null, "-primary"),

                    // only local users might have set their 'home' node (named a node 'home')
                    state.userProfile.homeNodeId ? new Button("Home", () => this.openUserNodeByName(state, "home")) : null, //

                    // but all users we know of will have a posts node simply from having their posts imported
                    new Button("Posts", async () => {
                        if (this.currentlyEditingWarning()) return;
                        this.openUserNodeByType(state, J.NodeType.POSTS);
                    }), //

                    !ast.isAnonUser && this.readOnly && state.userProfile.userName !== getAs().userName
                        ? new Button("Message", this._sendMessage, { title: "Compose a new message to " + state.userProfile.userName }) : null,

                    !ast.isAnonUser && this.readOnly && state.userProfile.userName !== getAs().userName
                        ? new Button("Interactions", this._previousMessages, { title: "Show interactions between you and " + state.userProfile.userName }) : null,

                    !ast.isAnonUser && !state.userProfile.following && this.readOnly && state.userProfile.userName !== getAs().userName
                        ? new Button("Follow", this._addFriend) : null,

                    !ast.isAnonUser && !state.userProfile.blocked && this.readOnly && state.userProfile.userName !== getAs().userName
                        ? new Button("Block", this._blockUser) : null,

                    (getAs().isAnonUser || this.readOnly) ? null : new Button("Settings", () => {
                        this.close();
                        S.nav._showUserSettings();
                    }),
                    !this.readOnly ? new Button("Logout", S.user.logout) : null,

                    new Button(this.readOnly ? "Close" : "Cancel", this._close)
                ], "mt-3")
            ])
        ];

        return children;
    }

    _deleteFriend = async () => {
        if (!this.userNodeId) return;
        await S.rpcUtil.rpc<J.DeleteFriendRequest, J.DeleteFriendResponse>("deleteFriend", {
            userNodeId: this.userNodeId
        });
        PubSub.pub(C.PUBSUB_friendsChanged, this.userNodeId);
        this.reload();
    }

    _unblockUser = async () => {
        if (!this.userNodeId) return;
        await S.rpcUtil.rpc<J.DeleteFriendRequest, J.DeleteFriendResponse>("unblockUser", {
            userNodeId: this.userNodeId
        });
        PubSub.pub(C.PUBSUB_friendsChanged, this.userNodeId);
        this.reload();
    }

    openUserNodeByType(state: LS, type: string) {
        this.close();
        setTimeout(() => S.nav.openContentNode("~" + state.userProfile.userName + "~" + type, false), 100);
    }

    /**
     * NOTE: There's two different URL formats here because there's two different ways to access a
     * named node (which are: via url, or via a parameter on the url)
     */
    openUserNodeByName(state: LS, nodeName: string) {
        this.close();
        setTimeout(() => S.nav.openContentNode(":" + state.userProfile.userName + ":" + nodeName, false), 100);
    }

    async reload() {
        const res = await S.rpcUtil.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: this.userNodeId
        });

        if (res?.userProfile) {
            if (res?.userProfile) {
                this.userNodeId = res.userProfile.userNodeId;
                this.bioState.setValue(res.userProfile.userBio);
                this.displayNameState.setValue(res.userProfile.displayName);
                this.mergeState<LS>({
                    userProfile: res.userProfile
                });
            }
        }
    }

    _save = async () => {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userTags: ast.userProfile.userTags,
            blockedWords: ast.userProfile.blockedWords,
            userBio: this.bioState.getValue(),
            displayName: this.displayNameState.getValue(),
            recentTypes: ast.userProfile.recentTypes
        });

        if (res?.code == C.RESPONSE_CODE_OK) {
            this.close();
            dispatch("SaveUserPerferences", s => {
                s.displayName = this.displayNameState.getValue();
            });
        }
    }

    _addFriend = async () => {
        const state: any = this.getState<LS>();
        const res = await S.rpcUtil.rpc<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: state.userProfile.userName,
            tags: null
        });

        PubSub.pub(C.PUBSUB_friendsChanged, state.userProfile.userName);

        if (res.code == C.RESPONSE_CODE_OK) {
            state.userProfile.following = true;
            state.userProfile.blocked = false;
            this.mergeState<LS>({
                userProfile: state.userProfile
            });
        }
    }

    currentlyEditingWarning(): boolean {
        const ast = getAs();
        if (ast.editNode) {
            S.util.showMessage("You must first finish editing the node.", "Warning");
            return true;
        }
        return false;
    }

    _sendMessage = () => {
        if (this.currentlyEditingWarning()) return;
        this.close();
        setTimeout(() => {
            S.edit.addNode(null, NodeType.COMMENT, null, this.userNodeId);
        }, 10);
    }

    _previousMessages = async () => {
        if (this.currentlyEditingWarning()) return;

        this.close();
        setTimeout(() => {
            const state: any = this.getState<LS>();
            S.nav.messagesFromMeToUser(state.userProfile.userName, state.userProfile.displayName);
        }, 10);
    }

    _blockUser = async () => {
        const state: any = this.getState<LS>();
        const res = await S.rpcUtil.rpc<J.BlockUserRequest, J.BlockUserResponse>("blockUser", {
            userName: state.userProfile.userName
        });
        PubSub.pub(C.PUBSUB_friendsChanged, this.userNodeId);

        if (res.code == C.RESPONSE_CODE_OK) {
            state.userProfile.blocked = true;
            state.userProfile.following = false;
            this.mergeState<LS>({
                userProfile: state.userProfile
            });
        }
    }

    override close() {
        super.close();
        if (!this.readOnly) {
            S.user.queryUserProfile(this.userNodeId);
        }
    }

    makeProfileImg(_hasHeaderImg: boolean): Comp {
        const state: LS = this.getState<LS>();
        const avatarVer = state.userProfile.avatarVer;
        const src: string = S.render.getAvatarImgUrl(state.userProfile.userNodeId, avatarVer);

        const onClick = async () => {
            if (this.readOnly) return;

            const dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, J.Constant.ATTACHMENT_PRIMARY, null, false, false, async () => {
                const res = await S.rpcUtil.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userNodeId
                });

                if (res?.userProfile) {
                    state.userProfile.avatarVer = res.userProfile.avatarVer;
                    state.userProfile.userNodeId = res.userProfile.userNodeId;
                    this.mergeState<LS>({
                        userProfile: state.userProfile
                    });
                }
            }, false);
            dlg.open();
        };

        if (src) {
            const att: any = {
                className: "userProfileDlgAvatar",
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload Avatar Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width,
            // node.hight) but we don't need it for anything currently
            return new Img(att);
        }
        else {
            if (this.readOnly) {
                return new Div("No avatar image", {
                    className: "userProfileDlgAvatarNone"
                });

            }
            return new Div("Click to upload Avatar Image", {
                className: "userProfileDlgAvatarNone",
                onClick
            });
        }
    }

    makeProfileHeaderImg(): Comp {
        let src: string = null;
        const state: any = this.getState<LS>();

        if (state.userProfile.apImageUrl) {
            src = state.userProfile.apImageUrl;
        }
        else {
            const headerImageVer = state.userProfile.headerImageVer;
            src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId, headerImageVer);
        }

        const onClick = () => {
            if (this.readOnly) return;
            const dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, J.Constant.ATTACHMENT_HEADER, null, false, false,
                async () => {
                    const res = await S.rpcUtil.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                        userId: state.userProfile.userNodeId
                    });

                    if (res?.userProfile) {
                        state.userProfile.headerImageVer = res.userProfile.headerImageVer;
                        state.userProfile.userNodeId = res.userProfile.userNodeId;
                        this.mergeState<LS>({
                            userProfile: state.userProfile
                        });
                    }
                }, false);
            dlg.open();
        };

        if (src) {
            const att: any = {
                className: "userProfileDlgHeader",
                src,
                onClick
            };
            if (!this.readOnly) {
                att.title = "Click to upload Header Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width,
            // node.hight) but we don't need it for anything currently
            return new Img(att);
        }
        else {
            return this.readOnly ? null : new Div("Click to upload Header Image", {
                className: "userProfileDlgHeaderNone",
                onClick
            });
        }
    }

    override async preLoad(): Promise<void> {
        if (!this.readOnly) {
            await S.rpcUtil.rpc<J.GetUserAccountInfoRequest, J.GetUserAccountInfoResponse>("getUserAccountInfo");
        }
        await this.reload();
    }
}
