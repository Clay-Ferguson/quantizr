import { useSelector } from "react-redux";
import { store } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Comp } from "../../comp/base/Comp";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { TabDataIntf } from "../../intf/TabDataIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Div {
    constructor(private tabData: TabDataIntf<any>) {
        super(null, { key: "nodeCompMaiList" });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        let children: Comp[] = [];
        if (state.node && state.node.children) {
            this.addPaginationButtons(children, state.endReached, "", state, true);

            let orderByProp = S.props.getPropStr(J.NodeProp.ORDER_BY, state.node);

            let isMineOrImAdmin = state.isAdminUser || S.props.isMine(state.node, state);
            let allowNodeMove: boolean = !orderByProp && isMineOrImAdmin;
            children.push(S.render.renderChildren(state.node, this.tabData, 1, allowNodeMove, state));

            this.addPaginationButtons(children, state.endReached, "marginTop marginBottom", state, false);
        }

        // children.push(new HelpButton(S.quanta?.config?.help?.gettingStarted));
        this.setChildren(children);
    }

    addPaginationButtons = (children: Comp[], endReached: boolean, moreClasses: string, state: AppState, pageTop: boolean) => {
        let firstButton: Comp;
        let prevButton: Comp;
        let nextButton: Comp;
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
                }
            });

            let buttonCreateTime: number = new Date().getTime();

            if (C.TREE_INFINITE_SCROLL && !pageTop) {
                // If nextButton is the one at the bottom of the page we watch it so we can dynamically load in
                // new content when it scrolls info view. What's happening here is that once
                // the nextButton scrolls into view, we load in more nodes!
                nextButton.whenElm((elm: HTMLElement) => {
                    let observer = new IntersectionObserver(entries => {
                        /* We have to STILL check these conditions becasue this observer can be getting called any time
                         and these conditions will always apply about controll if we want to grow page or not. */

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

                // I decided this is too easily mistaken for paging, but what it does is navigate to next sibling node
                // which is too confusing, so I'm backing this out for now. This same button still *IS* available at
                // the top of the page on the page root node, and seems more intuitive to be only there, but I want to leave
                // this commented (not deleted) for now.
                // nextNodeButton =
                // new IconButton("fa-chevron-circle-right", null, {
                //     onClick: S.nav.navToNext,
                //     title: "Go to Next Node"
                // });
            }
        }

        if (firstButton || prevButton || nextButton || nextNodeButton) {
            children.push(new ButtonBar([firstButton, prevButton, nextButton, nextNodeButton], "text-center " + moreClasses));
            children.push(new Clearfix());
        }
    }
}
