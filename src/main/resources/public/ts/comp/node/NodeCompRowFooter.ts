import { Anchor } from "../../comp/core/Anchor";
import { Div } from "../../comp/core/Div";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

export class NodeCompRowFooter extends Div {

    constructor(private node: J.NodeInfo) {
        super(null, {
            className: "row-footer float-end"
        });
    }

    preRender(): void {
        const children = [];

        // We don't render these links if this node is just boosting another one becasue that's not very useful and
        // just clutters the screen.
        if (!this.node.boostedNode) {
            /* When rendering local Quanta nodes, on the browser, we have no need to show a LINK to the parent node, or a link
             to the actual node because all that's internal. */
            if (this.node.owner.indexOf("@") !== -1) {
                const inReplyTo = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_INREPLYTO, this.node);
                if (inReplyTo) {

                    // DO NOT DELETE (yet, but eventually)
                    // Now that there's a thread icon on all nodes this "Show Thread" method is not needed.
                    // if (this.allowShowThread) {
                    //     children.push(new Anchor(null, "Show Thread", {
                    //         className: "footerLink",
                    //         onClick: () => {
                    //             S.srch.showThread(this.node.id, state);
                    //             // ===============
                    //             // DO NOT DELETE
                    //             // keep this for future reference, it does work, but we don't currently need it since showThread is more what the user will want.
                    //             // ===============
                    //             // let res = await S.util.ajax<J.GetActPubObjectRequest, J.GetActPubObjectResponse>("loadActPubObject", {
                    //             //     url: inReplyTo
                    //             // });

                    //             // if (res.nodeId) {
                    //             //     setTimeout(() => {
                    //             //         S.view.jumpToId(res.nodeId);
                    //             //     }, 100);
                    //             // }
                    //             // else {
                    //             //     // here, print message here asking user if they want to see 'inReplyTo' in a separate tab.
                    //             // }
                    //         }
                    //     }));
                    // }

                    // if this is not our own host then show the Remote Parent link
                    if (inReplyTo.indexOf(location.protocol + "//" + location.hostname) === -1) {
                        children.push(new Anchor(inReplyTo, "Parent", {
                            className: "footerLink",
                            target: "_blank",
                            title: "Go to post's parent on it's home Fediverse instance"
                        }));
                    }
                }

                let objUrl = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_URL, this.node);

                // some servers might have sent an ID and not the URL to our server, and so we detect this case
                // and assume if there's an "https://" link specified we can build out link to that.
                if (!objUrl) {
                    const idUrl = S.props.getPropStr(J.NodeProp.ACT_PUB_ID, this.node);
                    if (idUrl?.startsWith("https://")) {
                        objUrl = idUrl;
                    }
                }

                if (objUrl) {
                    // check to see if it's a link to our server, and don't show 'foreign link' link if so.
                    // todo-3: we should make a util.ts method for this.
                    if (objUrl.indexOf(location.protocol + "//" + location.hostname) === -1) {
                        children.push(new Anchor(objUrl, "Link", {
                            className: "footerLink",
                            target: "_blank",
                            title: "Go to post on it's home Fediverse instance"
                        }));
                    }
                }
            }
        }
        this.setChildren(children);
    }
}
