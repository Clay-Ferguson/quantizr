import { useSelector } from "react-redux";
import { dispatch, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { IconButton } from "../widget/IconButton";
import { Span } from "../widget/Span";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class FeedView extends AppTab {

    static enabled: boolean = true;
    static searchTextState: ValidatedState<any> = new ValidatedState<any>();

    /* Controle wether the view automatically refreshes before letting the user choose what options (checkboxes) they want.
    I'm disabling because I don't like this. If I'm wanting to find just "To me" for example then I have to wait for it
    to first query stuff I don't care about first. So I'd just rather click the "Refresh" button myself each time. */
    static automaticInitialRefresh: boolean = false;

    static page: number = 0;
    static refreshCounter: number = 0;
    static helpExpanded: boolean = false;

    constructor(data: TabDataIntf) {
        super(data);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        if (!FeedView.enabled && !state.isAdminUser) {
            this.setChildren([new Div("temporarily unavailable.")]);
            return;
        }

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
            new Span(null, {
                className: ((state.feedDirty || state.feedWaitingForUserRefresh) ? "feedDirtyButton" : "feedNotDirtyButton")
            }, [
                new Button("Refresh" + (state.feedDirty ? " (New Posts)" : ""), () => {
                    FeedView.refresh();
                })
            ])
        ], null, "float-right marginBottom marginTop");

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
        else if (FeedView.refreshCounter === 0) {
            // if user has never done a refresh at all yet, do the first one for them automatically.
            if (FeedView.automaticInitialRefresh && state.activeTab === C.TAB_FEED) {
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
            let childCount = state.feedResults.length;
            state.feedResults.forEach((node: J.NodeInfo) => {
                // console.log("FEED: node id=" + node.id + " content: " + node.content);
                S.srch.initSearchNode(node);
                children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "feed", true, false, true, true, true, true, state));
                i++;
                rowCount++;
            });

            if (rowCount > 0 && !state.feedEndReached) {
                children.push(new ButtonBar([
                    new IconButton("fa-angle-right", "More", {
                        onClick: (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, ++FeedView.page, FeedView.searchTextState.getValue());
                        },
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
        FeedView.refreshCounter++;
        dispatch("Action_SetFeedFilterType", (s: AppState): AppState => {
            s.feedLoading = true;
            return s;
        });

        S.srch.feed("~" + J.NodeType.FRIEND_LIST, null, FeedView.page, FeedView.searchTextState.getValue());
    }

    makeFilterButtonsBar = (state: AppState): Span => {
        return new Span(null, { className: "checkboxBar" }, [
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
}
