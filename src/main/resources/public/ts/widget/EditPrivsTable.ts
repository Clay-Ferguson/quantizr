import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import * as I from "../Interfaces";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPrivsTable extends ListBox {

    constructor(public nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);

        //let width = window.innerWidth * 0.6;
        //let height = window.innerHeight * 0.4;
        //(<any>this.attribs).style = `width:${width}px;height:${height}px;overflow:scroll;border:4px solid lightGray;`;
    }

    preRender(): void {
        let children = [];

        if (this.nodePrivsInfo && this.nodePrivsInfo.aclEntries) {
            this.nodePrivsInfo.aclEntries.forEach(function(aclEntry) {
                children.push(new EditPrivsTableRow(aclEntry, this.removePrivilege));
            }, this);
        }
        this.setChildren(children);
    }
}
