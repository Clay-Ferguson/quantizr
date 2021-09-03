import { useSelector } from "react-redux";
import { dispatch, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Clearfix } from "../widget/Clearfix";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { HelpButton } from "../widget/HelpButton";
import { Icon } from "../widget/Icon";
import { IconButton } from "../widget/IconButton";
import { Span } from "../widget/Span";
import { Spinner } from "../widget/Spinner";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div,
but inherits capability of Comp classl

Preparing to support multiple instances of this (feed + chat), we need to remove all 'static' props. (todo-0)
*/
export class FeedView extends AppTab {

    static page: number = 0;
    static refreshCounter: number = 0;
    static autoRefresh: boolean = true;

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    preRender(): void {
        // console.log("preRender: FeedView");
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = this.getClass(state);

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: Comp[] = [];
        let content = state.feedFilterRootNode ? S.util.getShortContent(state.feedFilterRootNode) : null;
        let showBookmarkIcon: boolean = false;

        // set showBookmarkIcon visible if we don't already have it bookmarked
        if (state.feedFilterRootNode) {
            showBookmarkIcon = !state.bookmarks.find((bookmark: J.Bookmark): boolean => {
                return bookmark.id === state.feedFilterRootNode.id;
            });
        }

        children.push(new Div(null, null, [
            new Div(null, { className: "marginTop" }, [
                this.renderHeading(state),
                new Span(null, { className: "float-right" }, [
                    showBookmarkIcon ? new Icon({
                        className: "fa fa-bookmark fa-lg clickable marginRight",
                        title: "Bookmark Chat Room",
                        onClick: () => S.edit.addBookmark(state.feedFilterRootNode, state)
                    }) : null,
                    state.feedFilterRootNode ? new IconButton("fa-arrow-left", "Back", {
                        onClick: () => S.view.jumpToId(state.feedFilterRootNode.id),
                        title: "Back to Node"
                    }) : null
                ]),
                new Clearfix()
            ]),
            content ? new TextContent(content, "resultsContentHeading alert alert-secondary") : null
        ]));

        let newItems = null;
        if ((state.feedDirty || state.feedWaitingForUserRefresh) && !state.feedLoading) {
            newItems = new Icon({
                className: "fa fa-lightbulb-o fa-lg feedDirtyIcon marginRight",
                title: "New content available. Refresh!"
            });
        }

        children.push(new ButtonBar([
            newItems,
            new IconButton("fa-refresh", null, {
                onClick: () => FeedView.refresh(),
                title: "Refresh"
            }),
            // NOTE: state.feedFilterRootNode?.id will be null here, for full fediverse (not a node chat/node feed) scenario.
            state.isAnonUser ? null : new Button("Post", () => S.edit.addNode(state.feedFilterRootNode?.id, null, null, state), {
                title: state.feedFilterRootNode?.id ? "Post to this Chat Room" : "Post something to the Fediverse!"
            }, "btn-primary")
        ], null, "float-right"));

        let searchButtonBar = null;
        // if this is mobile don't even show search field unless it's currently in use (like from a trending click)
        if (!state.mobileMode || this.data.props.searchTextState.getValue()) {
            searchButtonBar = new ButtonBar([
                new Span(null, { className: "feedSearchField" }, [new TextField("Search", false, null, null, false, this.data.props.searchTextState)]),
                new Button("Clear", () => { this.clearSearch(); }, { className: "feedClearButton" })
            ], "marginTop");
        }

        children.push(new CollapsiblePanel("Options", "Options", null, [
            this.makeFilterButtonsBar(state),
            searchButtonBar
        ], false,
            (state: boolean) => {
                this.data.props.filterExpanded = state;
            }, this.data.props.filterExpanded, "", "", "span"));

        children.push(new HelpButton(() => S.quanta?.config?.help?.fediverse?.feed));
        children.push(new Checkbox("Auto-refresh", { className: "marginLeft" }, {
            setValue: (checked: boolean): void => {
                FeedView.autoRefresh = checked;
            },
            getValue: (): boolean => {
                return FeedView.autoRefresh;
            }
        }));

        children.push(new Clearfix());

        let childCount = state.feedResults ? state.feedResults.length : 0;

        if (state.feedLoading && childCount === 0) {
            children.push(new Div(null, null, [
                new Heading(4, "Loading Feed..."),
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]));
        }
        else if (FeedView.refreshCounter === 0) {
            // if user has never done a refresh at all yet, do the first one for them automatically.
            if (state.activeTab === C.TAB_FEED) {
                setTimeout(FeedView.refresh, 100);
            }
            else {
                children.push(new Heading(4, "Refresh when ready."));
            }
        }
        else if (state.feedWaitingForUserRefresh) {
            children.push(new Heading(4, "Refresh when ready."));
        }
        else if (!state.feedResults || state.feedResults.length === 0) {
            children.push(new Div("Nothing to display."));
            children.push(new TextContent("Tip: Select 'Public' checkbox, to see the entire Fediverse (all public posts)."));
        }
        else {
            let i = 0;
            state.feedResults.forEach((node: J.NodeInfo) => {
                // console.log("FEED: node id=" + node.id + " content: " + node.content);
                S.srch.initSearchNode(node);
                children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "feed", true, false, true, true, true, true, state));
                i++;
                rowCount++;
            });

            if (rowCount > 0 && !state.feedEndReached) {
                let moreButton = new IconButton("fa-angle-right", "More", {
                    onClick: (event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        S.srch.feed(++FeedView.page, this.data.props.searchTextState.getValue(), true, false);
                    },
                    title: "Next Page"
                });

                if (C.FEED_INFINITE_SCROLL) {
                    // When the 'more' button scrolls into view go ahead and load more records.
                    moreButton.whenElm((elm: HTMLElement) => {
                        let observer = new IntersectionObserver(entries => {
                            entries.forEach((entry: any) => {
                                if (entry.isIntersecting) {
                                    // observer.disconnect();
                                    S.srch.feed(++FeedView.page, this.data.props.searchTextState.getValue(), true, true);
                                }
                            });
                        });
                        observer.observe(elm);
                    });
                }
                children.push(new ButtonBar([moreButton], "text-center marginTop marginBottom"));
            }
        }
        this.setChildren([new Div(null, { className: "feedView" }, children)]);
    }

    /* overridable (don't use arrow function) */
    renderHeading(state: AppState): CompIntf {
        return new Heading(4, state.feedFilterRootNode ? "Chat Room" : "Fediverse Feed", { className: "resultsTitle" });
    }

    clearSearch = () => {
        if (this.data.props.searchTextState.getValue()) {
            this.data.props.searchTextState.setValue("");
            FeedView.refresh();
        }
    }

    static refresh = () => {
        FeedView.page = 0;
        FeedView.refreshCounter++;
        dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
            s.feedLoading = true;
            return s;
        });

        let feedData: TabDataIntf = S.quanta.getTabDataById(C.TAB_FEED);
        S.srch.feed(FeedView.page, feedData.props.searchTextState.getValue(), false, false);
    }

    makeFilterButtonsBar = (state: AppState): Div => {
        return new Div(null, { className: "checkboxBar" }, [
            state.isAnonUser ? null : new Checkbox("Friends", {
                title: "Include nodes posted by your friends"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterFriends = checked;
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterFriends;
                }
            }),

            state.isAnonUser ? null : new Checkbox("To Me", {
                title: "Include nodes shares specifically to you (by name)"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterToMe = checked;
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterToMe;
                }
            }),

            state.isAnonUser ? null : new Checkbox("From Me", {
                title: "Include nodes created by you"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterFromMe = checked;
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterFromMe;
                }
            }),

            new Checkbox("Public", {
                title: "Include nodes shared to 'public' (everyone)"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterToPublic = checked;
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterToPublic;
                }
            }),

            new Checkbox("Local", {
                title: "Include only nodes from accounts on this server."
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterLocalServer = checked;

                        /* to help keep users probably get what they want, set 'public' also to true as the default
                         any time someone clicks 'Local' because that's the likely use case */
                        if (checked) {
                            s.feedFilterToPublic = true;
                        }
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterLocalServer;
                }
            }),

            new Checkbox("NSFW", {
                title: "Include NSFW Content (Allows material flagged as 'Sensitive')"
            }, {
                setValue: (checked: boolean): void => {
                    dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
                        s.feedWaitingForUserRefresh = true;
                        s.feedFilterNSFW = checked;
                        return s;
                    });
                },
                getValue: (): boolean => {
                    return store.getState().feedFilterNSFW;
                }
            })
        ]);
    }

    /* If we have the Auto-Refresh checkbox checked by the user, and we just detected new changes comming in then we do a request
    from the server for a refresh */
    static feedDirtyNow = (state: AppState): void => {
        // put in a delay timer since we call this from other state processing functions.
        setTimeout(() => {
            if (FeedView.autoRefresh && !state.feedLoading && !state.feedWaitingForUserRefresh) {
                FeedView.refresh();
            }
        }, 500);
    }
}
