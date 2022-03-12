import { useSelector } from "react-redux";
import { AppState } from "../../AppState";
import { Anchor } from "../../comp/core/Anchor";
import { Div } from "../../comp/core/Div";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

export class NodeCompRowFooter extends Div {

    constructor(private node: J.NodeInfo, private isFeed: boolean, private allowShowThread: boolean) {
        super(null, {
            className: "row-footer float-end"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let children = [];

        /* When rendering local Quanta nodes, on the browser, we have no need to show a LINK to the parent node, or a link
         to the actual node because all that's internal. */
        if (this.node.owner.indexOf("@") !== -1) {
            let inReplyTo = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_INREPLYTO, this.node);
            if (inReplyTo) {
                if (this.allowShowThread) {
                    children.push(new Anchor(null, "Show Thread", {
                        className: "footerLink",
                        onClick: () => {
                            S.srch.showThread(this.node.id, state);
                            // ===============
                            // DO NOT DELETE
                            // keep this for future reference, it does work, but we don't currently need it since showThread is more what the user will want.
                            // ===============
                            // let res: J.GetActPubObjectResponse = await S.util.ajax<J.GetActPubObjectRequest, J.GetActPubObjectResponse>("loadActPubObject", {
                            //     url: inReplyTo
                            // });

                            // if (res.nodeId) {
                            //     setTimeout(() => {
                            //         S.view.jumpToId(res.nodeId);
                            //     }, 100);
                            // }
                            // else {
                            //     // here, print message here asking user if they want to see 'inReplyTo' in a separate tab.
                            // }
                        }
                    }));
                }

                // if this is not our own host then show the Remote Parent link
                if (inReplyTo.indexOf(location.protocol + "//" + location.hostname) === -1) {
                    children.push(new Anchor(inReplyTo, "Remote Parent", {
                        className: "footerLink",
                        target: "_blank"
                    }));
                }
            }

            let objUrl = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_URL, this.node);
            if (objUrl) {
                if (objUrl.indexOf(location.protocol + "//" + location.hostname) === -1) {
                    children.push(new Anchor(objUrl, "Remote Link", {
                        className: "footerLink",
                        target: "_blank"
                    }));
                }
            }
        }
        this.setChildren(children);
    }
}
