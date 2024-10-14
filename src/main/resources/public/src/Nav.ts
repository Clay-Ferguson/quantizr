import { dispatch, getAs, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import { Button } from "./comp/core/Button";
import { ButtonBar } from "./comp/core/ButtonBar";
import { Heading } from "./comp/core/Heading";
import { VerticalLayout } from "./comp/core/VerticalLayout";
import { FullScreenGraphViewer } from "./comp/FullScreenGraphViewer";
import { Constants as C } from "./Constants";
import { AskForEmail } from "./dlg/AskForEmailDlg";
import { AskForPhoneNumber } from "./dlg/AskForPhoneNumber";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { FullScreenType } from "./Interfaces";
import * as J from "./JavaIntf";
import { Attachment } from "./JavaIntf";
import { S } from "./Singletons";
import { AudioPlayerView } from "./tabs/AudioPlayerView";
import { AISettingsTab } from "./tabs/data/AISettingsTab";
import { AudioPlayerTab } from "./tabs/data/AudioPlayerTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { MainTab } from "./tabs/data/MainTab";
import { SettingsTab } from "./tabs/data/SettingsTab";

export class Nav {
    parentVisibleToUser(): boolean {
        const ast = getAs();
        if (!ast.node) return false;

        // If any non-admin user viewing home node we know parent won't be visible to them.
        if (!ast.isAdminUser && ast.node.path === "/r/public/home") return false

        if (ast.isAnonUser) {
            return true;
        } else {
            return ast.node.id !== ast.userProfile?.userNodeId;
        }
    }

    upLevelResponse(res: J.RenderNodeResponse, id: string, scrollToTop: boolean) {
        if (!res || !res.node) {
            S.util.showPageMessage("The node above is not accessible.");
        } else {
            S.render.renderPage(res, scrollToTop, id, true, true);
        }
    }

    _navToPrev = () => {
        this.navToSibling(-1);
    }

    _navToNext = () => {
        this.navToSibling(1);
    }

    async navToSibling(siblingOffset: number): Promise<string> {
        const ast = getAs();
        if (!ast.node) return null;

        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: ast.node.id,
            upLevel: false,
            siblingOffset,
            forceRenderParent: false,
            offset: 0,
            goToLastPage: false,
            singleNode: false,
            jumpToRss: false
        });

        S.nodeUtil.processInboundNode(res.node);
        this.upLevelResponse(res, null, true);
    }

    _navUpLevelClick = async (evt: Event = null, id: string = null) => {
        // for state management, especially for scrolling, we need to run the node click on the node
        // before upLeveling from it.
        await this._clickTreeNode(evt, id);
        this.navUpLevel(false);
    }

    async navUpLevel(processingDelete: boolean) {
        const ast = getAs();
        if (!ast.node) return null;

        if (!this.parentVisibleToUser()) {
            S.util.showMessage("The parent of this node isn't shared to you.", "Warning");
            // Already at root. Can't go up.
            return;
        }

        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: ast.node.id,
            upLevel: true,
            siblingOffset: 0,
            forceRenderParent: false,
            offset: 0,
            goToLastPage: false,
            singleNode: false,
            jumpToRss: false
        });
        S.nodeUtil.processInboundNode(res.node);

        if (processingDelete) {
            S.quanta.refresh();
        }
        else {
            this.upLevelResponse(res, ast.node.id, false);
        }
    }

    /* NOTE: Elements that have this as an onClick method must have the nodeId
    on an attribute of the element */
    _clickTreeNode = async (evt: Event, id: string, ast?: AppState) => {
        // since we resolve inside the timeout async/wait pattern is not used here.
        return new Promise<void>((resolve, _reject) => {
            id = S.util.allowIdFromEvent(evt, id);
            ast = ast || getAs();

            /* First check if this node is already highlighted and if so just return */
            const hltNode = S.nodeUtil.getHighlightedNode();
            if (hltNode?.id === id) {
                resolve();
                return;
            }

            /*
             * sets which node is selected on this page (i.e. parent node of this page being the 'key')
             */
            const node = MainTab.inst?.findNode(id, ast);
            if (node) {
                dispatch("HighlightNode", s => {
                    S.nodeUtil.highlightNode(node, false, s);
                });
            }
            else {
                console.error("Node not found: " + id);
            }
            S.domUtil.focusId(C.TAB_MAIN);
            resolve();
        });
    }

    async openContentNode(nodePathOrId: string, jumpToRss: boolean) {
        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: nodePathOrId,
            upLevel: false,
            siblingOffset: 0,
            forceRenderParent: false,
            offset: 0,
            goToLastPage: false,
            singleNode: false,
            jumpToRss
        });
        S.nodeUtil.processInboundNode(res.node);

        // if jumpToRss that means we don't want to display the node, but jump straight to the RSS
        // Tab and display the actual RSS feed that this node defines.
        if (jumpToRss && res?.rssNode) {
            dispatch("LoadingFeed", s => {
                s.rssNode = res.node;
                s.activeTab = C.TAB_RSS;
                S.domUtil.focusId(C.TAB_RSS);
                S.tabUtil.tabScroll(C.TAB_RSS, 0);
            });
            return;
        }
        this.navPageNodeResponse(res);
    }

    _toggleNodeInlineChildren = async (evt: Event) => {
        const id = S.util.allowIdFromEvent(evt, null);
        const ast = getAs();
        const node = MainTab.inst?.findNode(id, ast);

        if (node) {
            const isMine = S.props.isMine(node);

            // if we are the owner of the node we set the actual property on the node
            if (isMine) {
                const isInlineChildren = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, node);
                if (isInlineChildren) {
                    S.props.setPropVal(J.NodeProp.INLINE_CHILDREN, node, "[null]");
                }
                else {
                    S.props.setPropVal(J.NodeProp.INLINE_CHILDREN, node, "1");
                }
                await S.edit.saveNode(node, true);
            }
            else {
                await S.edit.toggleUserExpansion(node);
            }
        }
    }

    _openNodeById = (evt: Event) => {
        const id = S.util.allowIdFromEvent(evt, null);
        const ast = getAs();
        const node = MainTab.inst?.findNode(id, ast);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            if (C.DEBUG_SCROLLING) {
                console.log("openNodeById");
            }
            S.nodeUtil.highlightNode(node, false, ast);
            S.view.refreshTree({
                nodeId: node.id,
                zeroOffset: true,
                highlightId: null,
                scrollToTop: true,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                jumpToRss: false
            });
        }
    }

    setNodeSel(selected: boolean, id: string, ust: AppState) {
        if (!id) return;
        if (selected) {
            ust.selectedNodes.add(id);
        } else {
            ust.selectedNodes.delete(id);
        }
    }

    navPageNodeResponse(res: J.RenderNodeResponse) {
        S.render.renderPage(res, true, null, true, true);
        S.tabUtil.selectTab(C.TAB_MAIN);
    }

    _geoLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((location) => {
                // todo-2: make this string a configurable property template
                const googleUrl = "https://www.google.com/maps/search/?api=1&query=" + location.coords.latitude + "," + location.coords.longitude;

                new MessageDlg("Your current location...", "GEO Location", null,
                    new VerticalLayout([
                        new Heading(3, "Lat/Lon: " + location.coords.latitude + "," + location.coords.longitude),
                        new Heading(5, "Accuracy: " + (location.coords.accuracy * 0.000621371).toFixed(1) + " miles"),
                        new ButtonBar([
                            new Button("Google Map", () => {
                                window.open(googleUrl, "_blank");
                            }),
                            new Button("Copy Link", () => {
                                S.util.copyToClipboard(googleUrl);
                            }),
                            new Button("Send via Email", async () => {
                                const dlg = new AskForEmail();
                                await dlg.open();
                                const email = AskForEmail.emailState.getValue();
                                if (email) {
                                    const body = `<p>My current location: <a href="${googleUrl}">Google Map Link (LAT/LON)</a></p>`;
                                    S.util.sendEmail(email, "My current location", body, true);
                                }
                            }),
                            new Button("Send via SMS", async () => {
                                const dlg = new AskForPhoneNumber();
                                await dlg.open();
                                const phone = AskForPhoneNumber.phoneState.getValue();
                                if (phone) {
                                    const body = `My current location: ${googleUrl}`;
                                    S.util.sendTextMessage(phone, body);
                                }
                            })
                        ])
                    ]), false, 0, null
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message", null, null, false, 0, null).open();
        }
    }

    showAudioPlayerTab(audioNodeId: string, mediaUrl: string, startTime: number = 0, title: string = null, subTitle: string = null) {
        AudioPlayerTab.tabShown = true;
        AudioPlayerView.sourceUrl = mediaUrl;
        AudioPlayerView.startTimePendingOverride = startTime;
        AudioPlayerView.customTitle = title;
        AudioPlayerView.customSubTitle = subTitle;
        AudioPlayerView.audioNodeId = audioNodeId;
        S.tabUtil.selectTab(C.TAB_AUDIO_PLAYER);
    }

    _showUserSettings = () => {
        SettingsTab.tabShown = true;
        S.tabUtil.selectTab(C.TAB_SETTINGS);
    }

    _showAISettings = () => {
        AISettingsTab.tabShown = true;
        S.tabUtil.selectTab(C.TAB_AI_SETTINGS);
        S.histUtil.pushHistory(null, AISettingsTab.URL_PARAM);
    }

    _showMainMenu = () => {
        S.quanta.mainMenu = new MainMenuDlg();
        S.quanta.mainMenu.open();
    }

    _navToMyAccntRoot = async () => {
        const ast = getAs();
        S.view.scrollActiveToTop();

        if (ast.isAnonUser) {
            S.util._loadAnonPageHome();
        } else {

            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: ast.userProfile?.userNodeId,
                upLevel: false,
                siblingOffset: 0,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                singleNode: false,
                jumpToRss: false
            });
            S.nodeUtil.processInboundNode(res.node);
            this.navPageNodeResponse(res);
        }
    }

    runSearchByNodeId(id: string) {
        const node = S.nodeUtil.findNode(id);
        if (!node) return;
        setTimeout(() => {
            new SearchContentDlg(node).open();
        }, 10);
    }

    openDocumentView(evt: Event, id: string) {
        id = S.util.allowIdFromEvent(evt, id);
        S.srch.showDocument(id, true);
    }

    runTimelineByNodeId(id: string) {
        setTimeout(() => {
            S.srch.timeline(id, "mtm", null, "by Modify Time", 0, true);
        }, 100);
    }

    _closeFullScreenViewer = () => {
        dispatch("CloseFullScreenViewer", s => {
            if (s.savedActiveTab == C.TAB_GRAPH) {
                s.savedActiveTab = null;
            }
            s.activeTab = s.savedActiveTab || C.TAB_MAIN;
            s.fullScreenConfig = { type: FullScreenType.NONE };
            s.graphData = null;
            FullScreenGraphViewer.reset();
        });
    }

    _minimizeFullScreenViewer = () => {
        dispatch("MinimizeFullScreenViewer", s => {
            if (s.savedActiveTab == C.TAB_GRAPH) {
                s.savedActiveTab = null;
            }
            s.activeTab = s.savedActiveTab || C.TAB_MAIN;
            s.fullScreenConfig = { type: FullScreenType.NONE };
        });
    }

    _prevFullScreenImgViewer = () => {
        const ast = getAs();
        const node = S.nodeUtil.findNode(ast.fullScreenConfig.nodeId);
        if (node && node.attachments) {
            const list: Attachment[] = S.props.getOrderedAtts(node);
            let selAtt: Attachment = list[0];
            let lastAtt: Attachment = null;
            list.forEach(att => {
                if (att.ordinal === ast.fullScreenConfig.ordinal) {
                    selAtt = lastAtt;
                }
                lastAtt = att;
            });

            dispatch("PrevFullScreenImgViewer", s => {
                s.fullScreenConfig.ordinal = selAtt.ordinal || 0;
            });
        }
    }

    _nextFullScreenImgViewer = () => {
        const ast = getAs();
        const node = S.nodeUtil.findNode(ast.fullScreenConfig.nodeId);
        if (node && node.attachments) {
            const list: Attachment[] = S.props.getOrderedAtts(node);
            let selAtt: Attachment = list[list.length - 1];
            let takeNext = false;
            list.forEach(att => {
                if (takeNext) {
                    selAtt = att;
                    takeNext = false;
                }
                if (att.ordinal === ast.fullScreenConfig.ordinal) {
                    takeNext = true;
                }
            });

            dispatch("PrevFullScreenImgViewer", s => {
                s.fullScreenConfig.ordinal = selAtt.ordinal || 0;
            });
        }
    }

    async messages(props: any) {
        if (!FeedTab.inst) {
            return;
        }

        // we need to go ahead and bump the refresh counter to avoid it doing a double query.
        FeedTab.inst.props.refreshCounter++;

        await promiseDispatch("SelectTab", s => {
            S.tabUtil.tabChanging(s.activeTab, C.TAB_FEED);
            s.activeTab = C.TAB_FEED;

            // merge props parameter into the feed data props.
            FeedTab.inst.props = { ...FeedTab.inst.props, ...props };
        });

        setTimeout(() => {
            S.srch._refreshFeed();
        }, 10);
    }

    _showMyNewMessages = () => {
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_NEW
        });
    }

    _messagesToFromMe = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_TOFROMME
        });
    }

    _messagesToMe = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_TOME
        });
    }

    messagesFromMeToUser(user: string, displayName: string) {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            // WARNING: When setting feedFilterToUser, the other filter options should be false!! They're mutually exclusive in that way.
            feedFilterToUser: user,
            feedFilterToDisplayName: displayName,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMMETOUSER
        });
    }

    _messagesFromMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMME
        });
    }

    _messagesFromFriends = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }

        this.messages({
            feedFilterFriends: true,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            results: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMFRIENDS
        });
    }

    _publicPosts = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        await this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            results: null,
            applyAdminBlocks: true,
            name: J.Constant.FEED_PUB
        });
    }

    changeMenuExpansion(ast: AppState, op: string, menuName: string) {
        switch (op) {
            case "toggle":
                if (ast.expandedMenus.has(menuName)) {
                    ast.expandedMenus.delete(menuName);
                }
                else {
                    ast.expandedMenus.add(menuName);
                }
                break;
            case "expand":
                ast.expandedMenus.add(menuName);
                break;
            case "collapse":
                ast.expandedMenus.delete(menuName);
                break;
            default: break
        }
    }

    _jumpToNode = (evt: Event) => {
        const nodeId = S.domUtil.getNodeIdFromDom(evt);
        if (nodeId) {
            S.view.jumpToId(nodeId);
        }
    }

    _ttsClick = (evt: Event) => {
        if (getAs().speechSpeaking) {
            S.speech.stopSpeaking();
        }
        else {
            const domId = S.domUtil.getPropFromDom(evt, C.DOM_ID_ATTR);
            // find the markdown body element and get the text content from it
            const elm = document.querySelector(`#${domId} .mkBody`);
            const content = elm ? elm.textContent : null;

            if (content) {
                S.speech.speakText(content, false);
            }
        }
    }

    _clickToOpenUserProfile = (evt: Event) => {
        evt.stopPropagation();
        evt.preventDefault();
        // Note: It's correct that in some places we don't use USER_ID_ATTR, but instead use the
        // null value for the userId. This is because we want to open the profile of the active user
        const userId = S.domUtil.getPropFromDom(evt, C.USER_ID_ATTR);
        new UserProfileDlg(userId).open();
    }

    _clickSearchNode = (evt: Event) => {
        const nodeId = S.domUtil.getNodeIdFromDom(evt);
        if (!nodeId) return;
        S.srch.clickSearchNode(nodeId);
    }

    _copyNodeNameToClipboard = (evt: Event) => {
        const node = S.util.getNodeFromEvent(evt);
        if (!node) return;
        const byNameUrl = window.location.origin + S.nodeUtil.getPathPartForNamedNode(node);
        S.util.copyToClipboard(byNameUrl);
    }

    _jumpToTargetIdClick = (evt: Event) => {
        const node = S.util.getNodeFromEvent(evt);
        if (!node) return;

        const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, node);
        if (!targetId) return;

        S.view.jumpToId(targetId);
    }
}