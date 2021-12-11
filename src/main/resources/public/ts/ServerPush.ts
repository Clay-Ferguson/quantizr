import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { TabDataIntf } from "./intf/TabDataIntf";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

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

    init = (): any => {
        console.log("ServerPush.init");
        this.eventSource = new EventSource(S.util.getRpcPath() + "serverPush");

        // DO NOT DELETE.
        // eventSource.onmessage = e => {
        // };

        this.eventSource.onopen = (e: any) => {
            // onsole.log("ServerPush.onopen" + e);
        };

        this.eventSource.onerror = (e: any) => {
            // console.log("ServerPush.onerror:" + e);
        };

        this.eventSource.addEventListener("sessionTimeout", (e: any) => {
            // console.log("event: sessionTimeout.");
            S.quanta.authToken = null;
            S.quanta.userName = null;
            if (S.quanta.loggingOut) return;

            // this might work ok, but for now, let's just force a page repload
            let state = store.getState();
            // S.nav.login(state);
            // window.location.href = window.location.origin + "/app";

            new MessageDlg("Session ended.", "Quanta",
                () => {
                    // todo-1: need to look for places we should do this instead of the location.href in order to preserve url
                    history.go(0);
                }, null, false, 0, "app-modal-content-tiny-width", state
            ).open();

            // ========== BEGIN: ==========
            // todo-1
            // If client knows what the timeout time is, it can theoretically run this code
            // every .9 of that intervial, and check the current time against the last known ajax call time, and then
            // prompt the user to continue with the session
            // let waitSeconds = 30;
            // let userAlive = false;
            // new ConfirmDlg("Keep session open?", null, //
            //     // User will have waitSeconds seconds to click yes.
            //     () => {
            //         userAlive = true;
            //         S.util.ajax<any, any>("ping", {});
            //     },
            //     // User says no reload page immeidately
            //     () => {
            //         window.location.href = window.location.origin;
            //     }, null, null, state
            // ).open();
            // // wait for waitSeconds more seconds for user to confirm.
            // setTimeout(() => {
            //     if (!userAlive) {
            //         window.location.href = window.location.origin;
            //     }
            // }, waitSeconds * 1000);
            // // history.go(0);
            // ========== END ==========
        });

        this.eventSource.addEventListener("nodeEdited", (e: any) => {
            const obj: J.FeedPushInfo = JSON.parse(e.data);
            const nodeInfo: J.NodeInfo = obj.nodeInfo;

            if (nodeInfo) {
                dispatch("Action_RenderTimelineResults", (s: AppState): AppState => {
                    let data = s.tabData.find(d => d.id === C.TAB_TIMELINE);
                    if (!data) return;

                    if (data.rsInfo.results) {
                        // remove this nodeInfo if it's already in the results.
                        data.rsInfo.results = data.rsInfo.results.filter((ni: J.NodeInfo) => ni.id !== nodeInfo.id);

                        // now add to the top of the list.
                        data.rsInfo.results.unshift(nodeInfo);
                    }
                    return s;
                });
            }
        });

        this.eventSource.addEventListener("feedPush", (e: any) => {
            let state = store.getState();
            const data: J.FeedPushInfo = JSON.parse(e.data);
            this.feedPushItem(data.nodeInfo, state);
        }, false);

        this.eventSource.addEventListener("ipsmPush", (e: any) => {
            let state = store.getState();
            const data: J.IPSMPushInfo = JSON.parse(e.data);
            // console.log("IPSM: " + data.payload);
            this.ipsmPushItem(data.payload, state);
        }, false);

        this.eventSource.addEventListener("newInboxNode", (e: any) => {
            const obj: J.NotificationMessage = JSON.parse(e.data);
            // console.log("Incomming Push (NotificationMessage): " + S.util.prettyPrint(obj));
            // new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        }, false);
    }

    forceFeedItem = (nodeInfo: J.NodeInfo, feedData: TabDataIntf, state: AppState): void => {
        if (!nodeInfo) return;
        feedData.props.feedResults = feedData.props.feedResults || [];

        let itemFoundIdx = feedData.props.feedResults.findIndex(item => item.id === nodeInfo.id);
        let updatesExistingItem = itemFoundIdx !== -1;

        if (nodeInfo.content && nodeInfo.content.startsWith(J.Constant.ENC_TAG)) {
            nodeInfo.content = "[Encrypted]";
        }

        /* if the reciept of this server push makes us have new knowledge that one of our nodes
           that didn't have children before now has children then update the state to have 'hasChildren'
           on this node so the 'open' button will appear */
        // S.util.refreshOpenButtonOnNode(nodeInfo, state);

        // if updates existing item we refresh it even if autoRefresh is off
        if (updatesExistingItem) {
            // console.log("force*** update existing item!");
            feedData.props.feedResults[itemFoundIdx] = nodeInfo;
        }
        else {
            // console.log("force*** push new item");
            feedData.props.feedResults.unshift(nodeInfo);
            // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
            // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
            // s.feedResults = S.quanta.removeRedundantFeedItems(s.feedResults);
        }
    }

    ipsmPushItem = (payload: string, state: AppState) => {
        let feedData: TabDataIntf = S.tabUtil.getTabDataById(null, C.TAB_IPSM);
        if (!feedData) return;

        dispatch("Action_RenderIPSMFeedResults", (s: AppState): AppState => {
            feedData.props.events = feedData.props.events || [];

            // add to head of array (rev-chron view)
            feedData.props.events.unshift(payload);
            return s;
        });
    }

    feedPushItem = (nodeInfo: J.NodeInfo, state: AppState): void => {
        if (!nodeInfo) return;

        console.log("feedPushItem: " + nodeInfo.content);

        let feedData: TabDataIntf = S.tabUtil.getTabDataById(null, C.TAB_FEED);
        if (!feedData) return;

        let isMine = S.props.isMine(nodeInfo, state);

        if (nodeInfo.content && nodeInfo.content.startsWith(J.Constant.ENC_TAG)) {
            nodeInfo.content = "[Encrypted]";
        }

        // Ignore changes comming in during edit if we're editing on feed tab (inline)
        // which will be fine because in this case when we are done editing we always
        // process all the accumulated feedDirtyList items.
        if (state.activeTab === C.TAB_FEED && state.editNode) {
            // console.log("editing, so adding to feedDirty");
            if (!feedData.props.feedDirtyList) {
                feedData.props.feedDirtyList = [];
            }
            feedData.props.feedDirtyList.push(nodeInfo);
            return;
        }

        dispatch("Action_RenderFeedResults", (s: AppState): AppState => {
            feedData.props.feedResults = feedData.props.feedResults || [];

            let itemFoundIdx = feedData.props.feedResults.findIndex(item => item.id === nodeInfo.id);
            let updatesExistingItem = itemFoundIdx !== -1;

            /* if the reciept of this server push makes us have new knowledge that one of our nodes
               that didn't have children before now has children then update the state to have 'hasChildren'
               on this node so the 'open' button will appear */
            // S.util.refreshOpenButtonOnNode(nodeInfo, s);

            // if updates existing item we refresh it even if autoRefresh is off
            if (updatesExistingItem) {
                // console.log("update existing item!");
                S.render.fadeInId = nodeInfo.id;
                feedData.props.feedResults[itemFoundIdx] = nodeInfo;
            }
            // else if autoRefresh is on we can add this node to the display, or if autoRefresh is off
            // we still want to display it if we owned it. Otherwise we tried to do a post and it didn't show up
            // and that will seem odd to the user.
            else if (feedData.props.autoRefresh || nodeInfo.owner === s.userName) {
                // console.log("adding in new item.");

                // NOTE: It would be also possible to call delayedRefreshFeed() here instead, but for now
                // I think we can just display any messages we get pushed in, and not try to query the server
                // again just for performance reasons.
                // S.srch.delayedRefreshFeed(s);

                // this is a slight hack to cause the new rows to animate their background, but it's ok, and I plan to leave it like this
                S.render.fadeInId = nodeInfo.id;
                feedData.props.feedResults.unshift(nodeInfo);

                if (!isMine) {
                    S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                }

                // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
                // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
                // s.feedResults = S.quanta.removeRedundantFeedItems(s.feedResults);
            }
            // or finally if autoRefresh is off we just set feedDirty, and it's up to the user to click refresh
            // button themselves.
            else {
                // console.log("Setting feed dirty.");
                if (!isMine) {
                    S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                }

                /* note: we could que up the incomming nodeInfo, and then avoid a call to the server but for now we just
                keep it simple and only set a dirty flag */
                feedData.props.feedDirty = true;
            }
            return s;
        });
    }
}
