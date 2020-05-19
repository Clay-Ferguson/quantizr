import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Div {

    constructor() {
        super(null, {
            // welp this doesn't work...Not sure why. 
            // onKeyDown: (event: KeyboardEvent) => {
            //     console.log("keydown: event.code=" + event.code);
            // }
        });

        // This is a cool way of letting CTRL+UP, CTRL+DOWN scroll to next node, but I realized listening on 'body' wasn't good
        // because ALL input goes thru, and then when I tried to put it on THIS component only the above onKeyDown isn't working, so
        // for now I'm just putting all this in the back burner.
        // document.body.addEventListener("keydown", (event: KeyboardEvent) => {
        //     console.log("keydown: "+event.code);
        //     let state: AppState = null;
        //     if (event.ctrlKey) {
        //         switch (event.code) {
        //             case "ArrowDown": 
        //                 if (this.keyDebounce()) return;
        //                 this.selectTab("mainTab");
        //                 state = store.getState();
        //                 S.view.scrollRelativeToNode("down", state);
        //                 break;

        //             case "ArrowUp":
        //                 if (this.keyDebounce()) return;
        //                 this.selectTab("mainTab");
        //                 state = store.getState();
        //                 S.view.scrollRelativeToNode("up", state);
        //                 break;

        //             case "ArrowLeft":
        //                 if (this.keyDebounce()) return;
        //                 this.selectTab("mainTab");
        //                 S.nav.navUpLevel();
        //                 break;

        //             case "ArrowRight":
        //                 if (this.keyDebounce()) return;
        //                 this.selectTab("mainTab");
        //                 state = store.getState();
        //                 S.nav.navOpenSelectedNode(state);
        //                 break;

        //             default: break;
        //         }
        //     }
        // });


    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let rootNode = state.node;
        let endReached = state.endReached;

        if (!rootNode) {
            this.children = null;
            return;
        }
        let output: Comp[] = [];

        if (S.nav.mainOffset > 0) {
            let firstButton: Comp = new Button("First Page", () => S.view.firstPage(state),
                {
                    id: "firstPageButton",
                    iconclass: "fa fa-angle-double-left fa-lg"
                });
            let prevButton: Comp = new Button("Prev Page", () => S.view.prevPage(state),
                {
                    id: "prevPageButton",
                    iconclass: "fa fa-angle-left fa-lg"
                });
            output.push(new ButtonBar([firstButton, prevButton], "text-center marginTop"));
        }

        output.push(new Div(null, { className: "clearfix" }));

        //this.lastOwner = rootNode.owner;

        if (rootNode.children) {
            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, rootNode);
            let allowNodeMove: boolean = !orderByProp;
            output.push(S.render.renderChildren(rootNode, 1, allowNodeMove));
        }

        if (!endReached) {
            let nextButton = new Button("Next Page", () => S.view.nextPage(state),
                {
                    id: "nextPageButton",
                    iconclass: "fa fa-angle-right fa-lg"
                });

            //todo-1: last page button disabled pending refactoring
            //let lastButton = this.makeButton("Last Page", "lastPageButton", () => this.lastPage(state));
            output.push(new ButtonBar([nextButton], "text-center marginTop"));
        }

        this.setChildren(output);
    }
}
