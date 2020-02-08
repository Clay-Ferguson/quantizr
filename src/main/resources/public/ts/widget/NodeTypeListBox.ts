import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ListBox } from "./ListBox";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeTypeListBox extends ListBox {
    selType: string = "u";
    
    //todo-0: make these list items polymorph loaded from 'S.plugin' call
    constructor(defaultSel: string, allowFileSysCreate : boolean) {
        super(null, [
            new ListBoxRow("Text/Markdown", () => { this.selType = "u"; }, true),

            /* Note: the isAdminUser is a temporary hack, and there will be a better way to do this eventually (i.e. types themselves
               probably will specify what roles of users they are available on or something like that) */
            new ListBoxRow("RSS Feed", () => { this.selType = "sn:rssfeed"; }, false),
            
            //Experimental types currently disabled, by commenting out.
            //S.meta64.allowBashScripting ? new ListBoxRow("Bash Script", () => { this.selType = "bash"; }, false) : null,
            //new ListBoxRow("Password", () => { this.selType = "sn:passwordType"; }, false),
            //!S.meta64.isAdminUser ? null : new ListBoxRow("FileSystem Folder", () => { this.selType = "fs:folder"; }, false),
            //!S.meta64.isAdminUser ? null : new ListBoxRow("Lucene Index Folder", () => { this.selType = "luceneIndex"; }, false),

            //todo-1: need a limit on each account stopping people from using too much MongoDB disk space.
            //       (so for now I'm removing IPFS as an option, for all but admin users)
            !S.meta64.isAdminUser ? null : new ListBoxRow("IPFS Node", () => { this.selType = "ipfs:node"; }, false),
            
            //!meta64.isAdminUser ? null : new ListBoxRow("System Folder", () => { this.selType = "meta64:systemfolder"; }, false)
        ]);
    }
}
