import { dispatch, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UploadFromFileDropzoneDlg } from "../dlg/UploadFromFileDropzoneDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { Label } from "../widget/Label";
import { Li } from "../widget/Li";
import { Span } from "../widget/Span";
import { TextArea } from "../widget/TextArea";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UserProfileView extends AppTab {
    bioState: ValidatedState<any> = new ValidatedState<any>();

    constructor() {
        super({
            id: "userProfileTab"
        });
    }

    getTabButton(state: AppState): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: state.userProfile ? "inline" : "none" }
        }, [
            new Anchor("#userProfileTab", "Profile", {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === "userProfileTab" ? " active" : ""),
                onClick: () => {
                    S.meta64.selectTab("userProfileTab");
                }
            })
        ]);
    }

    preRender(): void {
        const state: AppState = store.getState();

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        if (!state.userProfile) {
            this.setChildren([new Span("Loading...")]);
            return;
        }

        let profileImg: CompIntf = this.makeProfileImg(state);
        let profileHeaderImg: CompIntf = state.userProfile.userName.indexOf("@") === -1 ? this.makeProfileHeaderImg() : null;

        let children = [
            new Div(null, null, [
                new Heading(3, "Profile: " + state.userProfile.userName),
                profileHeaderImg ? new Div(null, null, [
                    new Div(null, null, [
                        !state.userProfile.readOnly ? new Div(null, null, [
                            new Label("Header Image")
                        ]) : null,
                        profileHeaderImg
                    ])
                ]) : null,

                new Div(null, {
                    className: "row marginTop marginBottom"
                }, [
                    new Div(null, { className: "col-4" }, [
                        new Div(null, null, [
                            !state.userProfile.readOnly ? new Div(null, null, [
                                new Label("Avatar Image")
                            ]) : null,
                            profileImg
                        ])
                    ]),

                    new Div(null, { className: "col-8" }, [
                        new Div(null, { className: "marginTop" }, [
                            state.userProfile.readOnly
                                ? new Html(S.util.markdown(state.userProfile.userBio) || "This user hasn't entered a bio yet")
                                : new TextArea("Bio", {
                                    rows: 8
                                },
                                    this.bioState)
                        ])
                    ])
                ]),

                new Div(null, null, [
                    new ButtonBar([
                        state.userProfile.readOnly ? null : new Button("Save", this.save, null, "btn-primary"),
                        new Button("Close", this.close, null),
                        state.userProfile.readOnly && state.userProfile.userName !== state.userName ? new Button("Add as Friend", this.addFriend) : null,
                        state.userProfile.actorUrl ? new Button("Go to User Page", () => {
                            window.open(state.userProfile.actorUrl, "_blank");
                        }) : null
                    ], null, "marginTop")
                ])
            ])
        ];

        this.setChildren(children);
    }

    // Opens the tab, querying the info from the server to update
    open = (readOnly: boolean, userId: string): any => {
        this.reload(readOnly, userId);
    }

    reload(readOnly: boolean, userId: string): Promise<void> {
        const state: AppState = store.getState();

        return new Promise<void>((resolve, reject) => {
            S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                userId
            }, (res: J.GetUserProfileResponse): void => {
                console.log("UserProfile Response: " + S.util.prettyPrint(res));
                if (res) {
                    this.bioState.setValue(res.userBio);
                    dispatch({
                        type: "Action_InitUserProfile",
                        state,
                        update: (s: AppState): void => {
                            // select this tab
                            s.activeTab = "userProfileTab";

                            s.userProfile = {
                                userId: res.userNodeId,
                                userName: res.userName,
                                avatarVer: res.avatarVer,
                                headerImageVer: res.headerImageVer,
                                userNodeId: res.userNodeId,
                                apIconUrl: res.apIconUrl,
                                actorUrl: res.actorUrl,
                                userBio: res.userBio,
                                readOnly
                            };
                        }
                    });
                }
                resolve();
            });
        });
    }

    save = (): void => {
        const state: AppState = store.getState();
        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userBio: this.bioState.getValue()
        }, this.saveResponse);
    }

    close = (): void => {
        const state: AppState = store.getState();
        dispatch({
            type: "Action_InitUserProfile",
            state,
            update: (s: AppState): void => {
                s.activeTab = "mainTab";
                s.userProfile = null;
            }
        });
    }

    addFriend = (): void => {
        const state: AppState = store.getState();

        S.util.ajax<J.AddFriendRequest, J.AddFriendResponse>("addFriend", {
            userName: state.userProfile.userName
        }, (res: J.AddFriendResponse) => {
            S.util.showMessage(res.message, "New Friend");
        });
    }

    saveResponse = (res: J.SaveUserPreferencesResponse): void => {
        const state: AppState = store.getState();

        if (S.util.checkSuccess("Saving Profile", res)) {
            // let state: AppState = store.getState();
            // todo-1: to make this work we'd need to have a version of 'refresh' that doesn't set the tab back to main tab,
            // so for now let's just do nothing.
            // S.meta64.refresh(state);
            // this.close();
            S.util.flashMessage("Saved Successfully", "Profile", true);
        }
    }

    makeProfileImg(state: AppState): CompIntf {
        let src: string = null;

        // if ActivityPub icon exists, we know that's the one to use.
        if (state.userProfile.apIconUrl) {
            src = state.userProfile.apIconUrl;
        }
        else {
            let avatarVer = state.userProfile.avatarVer;
            src = S.render.getAvatarImgUrl(state.userProfile.userId || state.homeNodeId, avatarVer);
        }

        let onClick = (evt) => {
            if (state.userProfile.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "", false, null, false, false, state, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        dispatch({
                            type: "Action_InitUserProfile",
                            state,
                            update: (s: AppState): void => {
                                s.userProfile.avatarVer = res.avatarVer;
                                s.userProfile.userNodeId = res.userNodeId;
                            }
                        });
                    }
                });
            });
            dlg.open();
        };

        if (src) {
            let att: any = {
                className: state.userProfile.readOnly ? "readOnlyProfileImage" : "profileImage",
                src,
                onClick
            };
            if (!state.userProfile.readOnly) {
                att.title = "Click to upload new Profile Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (state.userProfile.readOnly) {
                return null;
            }
            return new Div("Click to upload Profile Image", {
                className: "profileImageHolder",
                onClick
            });
        }
    }

    makeProfileHeaderImg(): CompIntf {
        const state: AppState = store.getState();
        let headerImageVer = state.userProfile.headerImageVer;
        let src: string = S.render.getProfileHeaderImgUrl(state.userProfile.userId || state.homeNodeId, headerImageVer);

        let onClick = (evt) => {
            if (state.userProfile.readOnly) return;

            let dlg = new UploadFromFileDropzoneDlg(state.userProfile.userNodeId, "Header", false, null, false, false, state, () => {

                S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
                    userId: state.userProfile.userId
                }, (res: J.GetUserProfileResponse): void => {
                    if (res) {
                        dispatch({
                            type: "Action_InitUserProfile",
                            state,
                            update: (s: AppState): void => {
                                s.userProfile.headerImageVer = res.headerImageVer;
                                s.userProfile.userNodeId = res.userNodeId;
                            }
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
                att.title = "Click to upload new Header Image";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img", att);
        }
        else {
            if (state.userProfile.readOnly) {
                return null;
            }
            return new Div("Click to upload Profile Image", {
                className: "profileHeaderImageHolder",
                onClick
            });
        }
    }
}
