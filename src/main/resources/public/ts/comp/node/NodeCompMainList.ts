import { store, useAppState } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Comp } from "../../comp/base/Comp";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Div {
    constructor(private tabData: TabIntf<any>) {
        super(null, { key: "nodeCompMaiList" });
    }

    preRender(): void {
        let state = useAppState();

        let children: Comp[] = [];
        if (state.node && state.node.children) {
            this.addPaginationButtons(children, state.endReached, "", state, true);

            let orderByProp = S.props.getPropStr(J.NodeProp.ORDER_BY, state.node);

            let isMineOrImAdmin = state.isAdminUser || S.props.isMine(state.node, state);
            let allowNodeMove: boolean = !orderByProp && isMineOrImAdmin;
            children.push(S.render.renderChildren(state.node, this.tabData, 1, allowNodeMove, state));

            this.addPaginationButtons(children, state.endReached, "marginTop marginBottom", state, false);
        }

        // children.push(new HelpButton(state.config?.help?.gettingStarted));
        this.setChildren(children);
    }

    addPaginationButtons = (children: Comp[], endReached: boolean, moreClasses: string, state: AppState, pageTop: boolean) => {
        let firstButton: Comp;
        let prevButton: Comp;
        let nextButton: Comp;
        let prevNodeButton: Comp;
        let nextNodeButton: Comp;
        let firstChild: J.NodeInfo = S.edit.getFirstChildNode(state);

        if (firstChild && firstChild.logicalOrdinal > 1) {
            firstButton = new IconButton("fa-angle-double-left", null, {
                onClick: () => S.view.firstPage(state),
                title: "First Page"
            });
        }

        if (firstChild && firstChild.logicalOrdinal > 0) {
            prevButton = new IconButton("fa-angle-left", null, {
                onClick: () => S.view.prevPage(state),
                title: "Previous Page"
            });
        }

        if (!endReached) {
            nextButton = new IconButton("fa-angle-right", "More", {
                onClick: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    S.view.nextPage(state);
                },
                title: "Next Page"
            });

            let buttonCreateTime: number = new Date().getTime();

            if (C.TREE_INFINITE_SCROLL && !pageTop) {
                // If nextButton is the one at the bottom of the page we watch it so we can dynamically load in
                // new content when it scrolls info view. What's happening here is that once
                // the nextButton scrolls into view, we load in more nodes!
                nextButton.onMount((elm: HTMLElement) => {
                    let observer = new IntersectionObserver(entries => {
                        /* We have to STILL check these conditions because this observer can be getting called any time
                         and these conditions will always apply about control if we want to grow page or not. */

                        let state = store.getState();

                        // Make sure this button has existed for 3 seconds at least before allowing it to trigger a growPage, becasue
                        // if it renders as visible without the user scrolling to it that would be bad by triggering a grow
                        // in an awkward way.
                        if (!state.editNode) {
                            entries.forEach((entry: any) => {
                                if (entry.isIntersecting) {
                                    // if this button comes into visibility within 2 seconds of it being created
                                    // that means it was rendered visible without user scrolling so in this case
                                    // we want to disallow the auto loading
                                    let curTime: number = new Date().getTime();
                                    if (curTime - buttonCreateTime < 3000) {
                                        observer.disconnect();
                                        return;
                                    }

                                    S.view.growPage(state);
                                }
                            });
                        }
                    });
                    observer.observe(elm);
                });
            }
        }
        else {
            if (!pageTop && !S.nav.displayingRepositoryRoot(state)) {
                prevNodeButton = new IconButton("fa-chevron-circle-left", "Previous Node", {
                    onClick: S.nav.navToPrev,
                    title: "Previous Node"
                });

                nextNodeButton = new IconButton("fa-chevron-circle-right", "Next Node", {
                    onClick: S.nav.navToNext,
                    title: "Next Node"
                });
            }
        }

        if (firstButton || prevButton || nextButton) {
            children.push(new ButtonBar([firstButton, prevButton, nextButton], "marginBottom text-center " + moreClasses));
        }

        if (prevNodeButton || nextNodeButton) {
            children.push(new ButtonBar([prevNodeButton, nextNodeButton], "marginBottom text-center " + moreClasses));
        }
    }
}
