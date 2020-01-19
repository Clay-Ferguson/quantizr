import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";
import * as I from "../Interfaces";
import { EditPrivsTableRow } from "./EditPrivsTableRow";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPrivsTable extends Comp {

    constructor(nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super({});
        this.setState(nodePrivsInfo);
        //let width = window.innerWidth * 0.6;
        //let height = window.innerHeight * 0.4;
        //(<any>this.attribs).style = `width:${width}px;height:${height}px;overflow:scroll;border:4px solid lightGray;`;
        this.setClass("list-group");
    }

    compRender = (): ReactNode => {
        this.removeAllChildren();

        let nodePrivsInfo: I.NodePrivilegesInfo = this.getState();
        //console.log("compRender[" + this.jsClassName + "] STATE: " + S.util.prettyPrint(nodePrivsInfo));

        if (nodePrivsInfo.aclEntries) {
            nodePrivsInfo.aclEntries.forEach((aclEntry) => {
                this.addChild(new EditPrivsTableRow(aclEntry, this.removePrivilege));
            });
        }
        return this.tagRender('div', null, this.attribs);
    }
}
