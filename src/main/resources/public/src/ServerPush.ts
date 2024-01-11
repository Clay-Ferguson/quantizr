import { dispatch, getAs } from "./AppContext";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { TabIntf } from "./intf/TabIntf";
import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { TimelineTab } from "./tabs/data/TimelineTab";

// reference: https://www.baeldung.com/spring-server-sent-events
// See also: AppController.java#serverPush

export class ServerPush {
    eventSource: EventSource;

    close = (): any => {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    init = (authToken: string): any => {
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
            // if server push is failing try to recover in 5 seconds by creating new instance, we wait 5 secs
            // just because my paranoia tells me to fear endless loops
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
            const obj: J.FeedPushInfo = JSON.parse(e.data);
            const nodeInfo = obj.nodeInfo;

            if (nodeInfo) {
                dispatch("RenderTimelineResults", _s => {
                    const data = TimelineTab.inst;
                    if (!data) return;

                    if (data.props.results) {
                        // remove this nodeInfo if it's already in the results.
                        data.props.results = data.props.results.filter((ni: NodeInfo) => ni.id !== nodeInfo.id);

                        // now add to the top of the list.
                        data.props.results.unshift(nodeInfo);
                    }
                });
            }
        });

        this.eventSource.addEventListener("feedPush", (e: any) => {
            const data: J.FeedPushInfo = JSON.parse(e.data);
            this.feedPushItem(data.nodeInfo);
        }, false);

        this.eventSource.addEventListener("ipsmPush", (e: any) => {
            const data: J.IPSMPushInfo = JSON.parse(e.data);
            this.ipsmPushItem(data.payload);
        }, false);

        // This is where we receive signing requests pushed from the server to be signed by the browser and pushed back up.
        this.eventSource.addEventListener("sigPush", async (e: any) => {
            const data: J.NodeSigPushInfo = JSON.parse(e.data);
            await S.crypto.generateAndSendSigs(data);
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
    }

    forceFeedItem = (nodeInfo: NodeInfo) => {
        if (!nodeInfo) return;
        FeedTab.inst.props.feedResults = FeedTab.inst.props.feedResults || [];

        const itemFoundIdx = FeedTab.inst.props.feedResults.findIndex(item => item.id === nodeInfo.id);
        const updatesExistingItem = itemFoundIdx !== -1;

        if (S.props.isEncrypted(nodeInfo)) {
            nodeInfo.content = "[Encrypted]";
        }

        // if updates existing item we refresh it even if autoRefresh is off
        if (updatesExistingItem) {
            FeedTab.inst.props.feedResults[itemFoundIdx] = nodeInfo;
        }
        else {
            FeedTab.inst.props.feedResults.unshift(nodeInfo);
        }
    }

    ipsmPushItem = (_payload: string) => {
        // IPSM currently disabled
        // const feedData: TabIntf = S.tabUtil.getTabDataById(state, C.TAB_IPSM);
        // if (!feedData) return;

        // dispatch("RenderIPSMFeedResults", s => {
        //     feedData.props.events = feedData.props.events || [];

        //     // add to head of array (rev-chron view)
        //     feedData.props.events.unshift(payload);
        // });
    }

    feedPushItem = (nodeInfo: NodeInfo) => {
        if (!nodeInfo || !TimelineTab.inst) return;

        if (S.props.isEncrypted(nodeInfo)) {
            nodeInfo.content = "[Encrypted]";
        }

        /* todo-1: Currently we know based on path that we will be getting items we should update for the timeline,
        but since we can't know whether (based on filtering) wether this node would show up in the FeedTab, we
        don't update the FeedTab live here. See also: userPrefs.autoRefreshFeed */
        if (getAs().userPrefs.autoRefreshFeed) {
            dispatch("RenderLiveUpdate", _s => {
                S.render.fadeInId = nodeInfo.id;
                this.pushToLiveTab(nodeInfo, TimelineTab.inst);
                // this.pushToLiveTab(nodeInfo, FeedTab.inst)
                if (!S.props.isMine(nodeInfo)) {
                    setTimeout(() => {
                        S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                    }, 1000);
                }
            });
        }
    }

    pushToLiveTab = (node: NodeInfo, inst: TabIntf) => {
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
