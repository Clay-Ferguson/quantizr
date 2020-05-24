import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import * as I from "../Interfaces";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { Div } from "./Div";
import { ListBox } from "./ListBox";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPrivsTable extends ListBox {

    constructor(nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
        this.mergeState(nodePrivsInfo);

        //let width = window.innerWidth * 0.6;
        //let height = window.innerHeight * 0.4;
        //(<any>this.attribs).style = `width:${width}px;height:${height}px;overflow:scroll;border:4px solid lightGray;`;
    }

    preRender(): void {
        this.children = [];

        let nodePrivsInfo: I.NodePrivilegesInfo = this.getState();
        //console.log("compRender[" + this.jsClassName + "] STATE: " + S.util.prettyPrint(nodePrivsInfo));

        if (nodePrivsInfo.aclEntries) {
            nodePrivsInfo.aclEntries.forEach(function(aclEntry) {
                this.addChild(new EditPrivsTableRow(aclEntry, this.removePrivilege));
            }, this);
        }
    }
}
