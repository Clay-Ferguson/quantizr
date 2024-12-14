import { dispatch, getAs } from "./AppContext";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { TimelineTab } from "./tabs/data/TimelineTab";

// reference: https://www.baeldung.com/spring-server-sent-events
// See also: AppController.java#serverPush

export class ServerPush {
    eventSource: EventSource;

    close(): any {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    init(authToken: string): any {
        // if already initialized do nothing
        if (this.eventSource || !authToken) return;

        console.log("ServerPush.init: " + authToken);
        this.eventSource = new EventSource(S.rpcUtil.getRpcPath() + "serverPush/" + authToken);

        // DO NOT DELETE.
        // eventSource.onmessage = e => {
        // };

        this.eventSource.onopen = (e: any) => {
            console.log("ServerPush.onopen: token=" + authToken + " e=" + S.util.prettyPrint(e));
        };

        this.eventSource.onerror = (e: any) => {
            console.log("ServerPush.onerror: token=" + authToken + " e=" + S.util.prettyPrint(e));
            // if server push is failing try to recover in 5 seconds by creating new instance, we
            // wait 5 secs just because my paranoia tells me to fear endless loops
            this.eventSource = null;
            setTimeout(() => {
                this.init(S.quanta.authToken);
            }, 5000)
        };

        this.eventSource.addEventListener("sessionTimeout", async () => {
            S.quanta.authToken = null;
            S.quanta.userName = null;
            if (S.quanta.loggingOut) return;
            let message = "";
            const editorData = await S.localDB.getVal(C.STORE_EDITOR_DATA);
            if (editorData?.nodeId && editorData?.content) {
                message = "<p><p>Click to resume editing.";
            }

            new MessageDlg("Your session has ended due to inactivity." + message, S.quanta.config.brandingAppName,
                () => {
                    history.go(0);
                }, null, false, 0, "appModalContTinyWidth"
            ).open();
        });

        this.eventSource.addEventListener("nodeEdited", (e: any) => {
            const data: J.FeedPushInfo = JSON.parse(e.data);
            this.nodePushed(data.nodeInfo);
        });

        this.eventSource.addEventListener("feedPush", (e: any) => {
            const data: J.FeedPushInfo = JSON.parse(e.data);
            this.nodePushed(data.nodeInfo);
        }, false);

        this.eventSource.addEventListener("pushPageMessage", (e: any) => {
            const data: J.PushPageMessage = JSON.parse(e.data);
            if (data.subType == "rssProgressText") {
                dispatch("RssProgress", s => {
                    s.rssProgressText = data.payload;
                });
                return;
            }
            if (data.usePopup) {
                S.util.showMessage(data.payload, "Message");
            }
            else {
                S.util.showPageMessage(data.payload);
            }
        }, false);

        this.eventSource.addEventListener("newInboxNode", (_e: any) => {
            // const obj: J.NotificationMessage = JSON.parse(e.data);
            // console.log("Incomming Push (NotificationMessage): " + S.util.prettyPrint(obj));
            // new InboxNotifyDlg("Your Inbox has updates!").open();
        }, false);

        this.eventSource.addEventListener("accountInfo", async (e: any) => {
            dispatch("AccountInfoPushUpdate", s => {
                const data: J.UpdateAccountInfo = JSON.parse(e.data);
                if (s.userProfile) {
                    s.userProfile.balance = data.credit;
                }
            });
        }, false);
    }

    forceFeedItem(nodeInfo: NodeInfo) {
        if (!nodeInfo) return;
        FeedTab.inst.props.results = FeedTab.inst.props.results || [];

        const itemFoundIdx = FeedTab.inst.props.results.findIndex(item => item.id === nodeInfo.id);
        const updatesExistingItem = itemFoundIdx !== -1;

        if (S.props.isEncrypted(nodeInfo)) {
            nodeInfo.content = "[Encrypted]";
        }

        // if updates existing item we refresh it even if autoRefresh is off
        if (updatesExistingItem) {
            FeedTab.inst.props.results[itemFoundIdx] = nodeInfo;
        }
        else {
            FeedTab.inst.props.results.unshift(nodeInfo);
        }
    }

    nodePushed(nodeInfo: NodeInfo) {
        if (!nodeInfo || (!TimelineTab.inst && !FeedTab.inst)) return;

        if (S.props.isEncrypted(nodeInfo)) {
            nodeInfo.content = "[Encrypted]";
        }

        const isMine = S.props.isMine(nodeInfo);
        if (isMine || getAs().userPrefs.autoRefreshFeed) {
            dispatch("RenderLiveUpdate", _s => {
                S.render.fadeInId = nodeInfo.id;

                // if nodeInfo path is under the timeline searchRoot then we update the timeline tab
                if (nodeInfo.path.startsWith(TimelineTab.inst?.props?.searchRoot)) {
                    this.pushToLiveTab(nodeInfo, TimelineTab.inst);
                }

                // we only forcably update FeedTab if the node is mine, because the filtering is
                // complex, and the server sends us all the nodes regardless of filter.
                if (isMine) {
                    this.pushToLiveTab(nodeInfo, FeedTab.inst);
                }

                if (!S.props.isMine(nodeInfo)) {
                    setTimeout(() => {
                        S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                    }, 1000);
                }
            });
        }
    }

    pushToLiveTab(node: NodeInfo, inst: TabBase) {
        if (!inst) return;
        inst.props.results = inst.props.results || [];
        const idx = inst.props.results.findIndex(item => item.id === node.id);
        const updateExisting = idx !== -1;

        // if updates existing item we refresh it even if autoRefresh is off
        if (updateExisting) {
            inst.props.results[idx] = node;
        }
        else {
            inst.props.results.unshift(node);
        }
    }
}
