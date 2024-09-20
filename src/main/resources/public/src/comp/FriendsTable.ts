import { FriendInfo } from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { FriendsTableRow } from "./FriendsTableRow";
import { ListBox } from "./ListBox";
import { Div } from "./core/Div";

export class FriendsTable extends ListBox {
    static scrollPos: number = 0;

    constructor(public friends: FriendInfo[], private selectableRows: boolean, private dlg: Comp) {
        super();
        const maxHeight: number = window.innerHeight > 300 ? (window.innerHeight * 0.5) : 300;
        this.attribs.className = "scrollY scrollBorder personsList customScrollbar";
        this.attribs.style = { maxHeight: maxHeight + "px" };
    }

    override preRender(): boolean | null {
        if (this.friends) {
            const friendsComps = this.friends.map(friend => {
                if (!friend) return null;
                return new FriendsTableRow(friend, this.selectableRows, this.dlg);
            });

            if (friendsComps?.length > 0) {
                this.children = friendsComps;
            }
            else {
                this.children = [new Div("No matching users.")];
            }
        }
        return true;
    }

    override getScrollPos(): number {
        return FriendsTable.scrollPos;
    }

    override setScrollPos(pos: number): void {
        FriendsTable.scrollPos = pos;
    }
}
