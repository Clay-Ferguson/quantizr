import { getAs } from "../AppContext";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { EditNodeDlg } from "../dlg/EditNodeDlg";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { Comp } from "./base/Comp";
import { FlexRowLayout } from "./core/FlexRowLayout";
import { Icon } from "./core/Icon";
import { Span } from "./core/Span";
import { HistoryPanel } from "./HistoryPanel";
import { TabPanelButtons } from "./TabPanelButtons";

export class RightNavPanel extends Comp {
    private static scrollPos: number = 0;
    static historyExpanded: boolean = false;
    public static inst: RightNavPanel = null;

    constructor() {
        super({
            id: C.ID_RHS,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "3"
        });
        RightNavPanel.inst = this;
    }

    static calcWidthCols(): number {
        let panelCols = getAs().userPrefs.mainPanelCols || 6;
        if (panelCols < 4) panelCols = 4;
        if (panelCols > 8) panelCols = 8;
        let cols = 4;

        if (panelCols >= 6) {
            cols--;
        }
        if (panelCols >= 8) {
            cols--;
        }
        return cols;
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (!ast.showRhs) {
            this.attribs.className = "appColumn";
        }
        else {
            this.attribs.className = Tailwind.getColClass(RightNavPanel.calcWidthCols()) + " appColumn";
        }

        const avatarImg = this.makeRHSAvatarDiv();
        let displayName = ast.displayName ? ast.displayName : (!ast.isAnonUser ? ast.userName : null);

        if (displayName && ast.node) {
            // If user had nothing left after insertion after ":tags:" replacement in their display name, then display their userName
            displayName = displayName || ast.node.owner;
        }

        const clipboardPasteButton = !ast.isAnonUser ? new Icon({
            className: "fa fa-clipboard fa-lg mr-3 cursor-pointer",
            onClick: () => {
                PubSub.pub(C.PUBSUB_closeNavPanel);
                S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES, "Saved in Notes Folder");
            },
            title: "Save clipboard"
        }) : null;

        const addNoteButton = !ast.isAnonUser ? new Icon({
            className: "fa fa-sticky-note stickyNote fa-lg mr-3 cursor-pointer",
            onClick: async () => {
                PubSub.pub(C.PUBSUB_closeNavPanel);
                let content = null;
                if (S.util.ctrlKeyCheck()) {
                    content = await (navigator as any)?.clipboard?.readText();

                    if (!content) {
                        const blob = await S.util.readClipboardFile();
                        if (blob) {
                            EditNodeDlg.pendingUploadFile = blob;
                        }
                    }
                }
                S.edit.addNode("~" + J.NodeType.NOTES, null, content, null);
            },
            title: "Create new Private Note\n(Hold down CTRL key to attach from clipboard)"
        }) : null;

        if (addNoteButton) {
            S.domUtil.setDropHandler(addNoteButton.attribs, (evt: DragEvent) => {
                for (const item of evt.dataTransfer.items) {
                    // console.log("DROP(c) kind=" + item.kind + " type=" + item.type);

                    if (item.kind === "file") {
                        EditNodeDlg.pendingUploadFile = item.getAsFile();
                        S.edit.addNode("~" + J.NodeType.NOTES, null, null, null);
                        return;
                    }
                }
            });
        }

        const textToSpeech = !ast.isAnonUser && S.tts.ttsSupported() ? new Icon({
            className: "fa fa-volume-high fa-lg mr-3 cursor-pointer",
            onClick: S.tts._speakClipboard,
            title: "Text-to-Speech: Speak clipboard content"
        }) : null;

        if (textToSpeech) {
            S.domUtil.setDropHandler(textToSpeech.attribs, (evt: DragEvent) => {
                for (const item of evt.dataTransfer.items) {
                    // console.log("DROP(c) kind=" + item.kind + " type=" + item.type);
                    if (item.kind === "string") {
                        item.getAsString(s => S.tts.speakText(s, true));
                        return;
                    }
                }
            });
        }

        const loginSignupDiv = ast.isAnonUser ? new Div(null, { className: "float-right" }, [
            new Span("Login", {
                className: "signupLinkText ui-login",
                onClick: () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    S.user.userLogin();
                }
            }),

            new Span("Signup", {
                className: "signupLinkText float-right ui-signup",
                onClick: () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    S.user.userSignup();
                }
            })
        ]) : null;

        let scrollDiv = null;
        const creditDiv = ast.showGptCredit ? S.render.buildCreditDiv() : null;

        const rightNavDiv = new Div(null, { className: "float-left w-full" }, [
            new FlexRowLayout([
                avatarImg,
                new Div(null, null, [
                    new Div(null, {
                        className: "mb-3 cursor-pointer",
                        onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            new UserProfileDlg(null).open();
                        }
                    }, [
                        !ast.isAnonUser ? new Icon({
                            className: "fa fa-gear fa-lg mr-3",
                        }) : null,
                        !ast.isAnonUser ? new Span(displayName, {
                            className: "mr-3",
                        }) : null,
                    ]),
                    loginSignupDiv,
                ]),
                new Div(null, { className: "flexFloatRight" }, [
                    textToSpeech,
                    clipboardPasteButton,
                    addNoteButton
                ]),
            ], "fullWidth"),
            // new Div(null, { className: "mb-3" }, [
            //     new ButtonBar([
            //         clipboardPasteButton,
            //         addNoteButton,
            //         displayName && !state.isAnonUser ? new Button("fa-database", null, {
            //             title: "Go to your Account Root Node",
            //             onClick: e => S.nav.navHome(state)
            //         }) : null
            //     ])
            // ]),
            !ast.isAnonUser ? new TabPanelButtons(true, "rhsMenu") : null,

            ast.nodeHistory?.length > 0 && !ast.isAnonUser ? new HistoryPanel() : null
        ]);

        this.children = [
            scrollDiv = new Div(null, { className: ast.showRhs ? "rightNavPanel customScrollbar" : "rightNavPanelPopup" }, [
                creditDiv,
                rightNavDiv
            ])
        ];

        scrollDiv.getScrollPos = (): number => {
            return RightNavPanel.scrollPos;
        }

        scrollDiv.setScrollPos = (pos: number): void => {
            RightNavPanel.scrollPos = pos;
        }
        return true;
    }

    makeRHSAvatarDiv(): Comp {
        const ast = getAs();
        if (!ast.userProfile) return null;
        const src: string = S.render.getAvatarImgUrl(ast.userProfile.userNodeId, ast.userProfile.avatarVer);

        if (src) {
            const attr: any = {
                className: "profileImageRHS",
                src
            };

            if (!ast.isAnonUser) {
                attr.onClick = () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    new UserProfileDlg(null).open();
                };
                attr.title = "Click to edit your Profile Info";
            }

            // Note: we DO have the image width/height set on the node object (node.width,
            // node.hight) but we don't need it for anything currently
            return new Img(attr);
        }
        else {
            return null;
        }
    }
}
