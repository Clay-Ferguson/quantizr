import { useSelector } from "react-redux";
import { dispatch, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { IconButton } from "../widget/IconButton";
import { Li } from "../widget/Li";
import { Span } from "../widget/Span";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class FeedView extends AppTab {

    static searchTextState: ValidatedState<any> = new ValidatedState<any>();

    // I don't like this OR how much CPU load it takes, so I'm flagging it off for now
    realtimeCheckboxes: boolean = false;

    static page: number = 0;
    static helpExpanded: boolean = false;

    constructor() {
        super({
            id: "feedTab"
        });
    }

    getTabButton(state: AppState): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: "inline" }
        }, [
            new Anchor("#feedTab", "Feed", {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === "feedTab" ? " active" : ""),
                onClick: () => {
                    S.meta64.selectTab("feedTab");
                }
            })
        ]);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: Comp[] = [];

        let refreshFeedButtonBar = new ButtonBar([
            state.isAnonUser ? null : new Button("New Post", () => S.edit.addNode(null, null, state), { title: "Post something awesome on the Fediverse!" }, "btn-primary"),
            state.isAnonUser ? null : new Button("Friends", () => S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST, state), { title: "Manage your list of frenz!" }),
            new Button("Trending", () => {
                S.view.getNodeStats(state, true, true);
            }),
            new Span(null, {
                className: ((state.feedDirty || state.feedWaitingForUserRefresh) ? "feedDirtyButton" : "feedNotDirtyButton")
            }, [
                new Button("Refresh" + (state.feedDirty ? " (New Posts)" : ""), () => {
                    FeedView.refresh();
                })
            ])
        ], null, "float-right marginBottom");

        children.push(this.makeFilterButtonsBar(state));
        children.push(refreshFeedButtonBar);
        children.push(new Div(null, { className: "clearfix" }));

        let helpPanel = new CollapsibleHelpPanel("Help", S.meta64.config.help.fediverse.feed,
            (state: boolean) => {
                FeedView.helpExpanded = state;
            }, FeedView.helpExpanded);

        let searchDiv = new ButtonBar([
            new Span(null, { className: "feedSearchField" }, [new TextField("Search", false, null, null, false, FeedView.searchTextState)]),
            new Button("Clear", () => { this.clearSearch(); }, { className: "feedClearButton" })
        ]);
        children.push(searchDiv);

        if (state.feedLoading) {
            children.push(new Heading(4, "Loading feed..."));
        }
        else if (state.feedWaitingForUserRefresh) {
            children.push(new Div("Make selections, then 'Refresh'"));
        }
        else if (!state.feedResults || state.feedResults.length === 0) {
            children.push(new Div("Nothing to display."));
        }
        else {
            let i = 0;
            let childCount = state.feedResults.length;
            state.feedResults.forEach((node: J.NodeInfo) => {
                // console.log("FEED: node id=" + node.id + " content: " + node.content);
                S.srch.initSearchNode(node);
                children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "feed", true, false, true, true, state));
                i++;
                rowCount++;
            });

            if (rowCount > 0 && !state.feedEndReached) {
                children.push(new ButtonBar([
                    new IconButton("fa-angle-right", "More", {
                        onClick: () => S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, ++FeedView.page, FeedView.searchTextState.getValue()),
                        title: "Next Page"
                    })], "text-center marginTop marginBottom"));
            }
        }

        children.push(helpPanel);
        this.setChildren(children);
    }

    clearSearch = () => {
        if (FeedView.searchTextState.getValue()) {
            FeedView.searchTextState.setValue("");
            FeedView.refresh();
        }
    }

    static refresh = () => {
        FeedView.page = 0;
        dispatch({
            type: "Action_SetFeedFilterType",
            update: (s: AppState): void => {
                s.feedLoading = true;
            }
        });

        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
    }

    makeFilterButtonsBar = (state: AppState): Span => {
        return new Span(null, { className: "checkboxBar" }, [
            state.isAnonUser ? null : new Checkbox("Friends", {
                title: "Include Nodes posted by your friends"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch({
                        type: "Action_SetFeedFilterType",
                        update: (s: AppState): void => {
                            s.feedWaitingForUserRefresh = !this.realtimeCheckboxes;
                            s.feedFilterFriends = checked;
                        }
                    });

                    if (this.realtimeCheckboxes) {
                        FeedView.page = 0;
                        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
                    }
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterFriends;
                }
            }),

            state.isAnonUser ? null : new Checkbox("To Me", {
                title: "Include Nodes shares specifically to you"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch({
                        type: "Action_SetFeedFilterType",
                        update: (s: AppState): void => {
                            s.feedWaitingForUserRefresh = !this.realtimeCheckboxes;
                            s.feedFilterToMe = checked;
                        }
                    });

                    if (this.realtimeCheckboxes) {
                        FeedView.page = 0;
                        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
                    }
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterToMe;
                }
            }),

            state.isAnonUser ? null : new Checkbox("From Me", {
                title: "Include Nodes created by you"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch({
                        type: "Action_SetFeedFilterType",
                        update: (s: AppState): void => {
                            s.feedWaitingForUserRefresh = !this.realtimeCheckboxes;
                            s.feedFilterFromMe = checked;
                        }
                    });

                    if (this.realtimeCheckboxes) {
                        FeedView.page = 0;
                        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
                    }
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterFromMe;
                }
            }),

            state.isAnonUser ? null : new Checkbox("Fediverse", {
                title: "Include Nodes shared to 'Public' (everyone)"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch({
                        type: "Action_SetFeedFilterType",
                        update: (s: AppState): void => {
                            s.feedWaitingForUserRefresh = !this.realtimeCheckboxes;
                            s.feedFilterToPublic = checked;
                        }
                    });

                    if (this.realtimeCheckboxes) {
                        FeedView.page = 0;
                        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
                    }
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterToPublic;
                }
            }),

            new Checkbox("NSFW", {
                title: "Include NSFW Content (Allows material flagged as 'Sensitive')"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch({
                        type: "Action_SetFeedFilterType",
                        update: (s: AppState): void => {
                            s.feedWaitingForUserRefresh = !this.realtimeCheckboxes;
                            s.feedFilterNSFW = checked;
                        }
                    });

                    if (this.realtimeCheckboxes) {
                        FeedView.page = 0;
                        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
                    }
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterNSFW;
                }
            })
        ]);
    }
}
