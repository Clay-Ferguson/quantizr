import { getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { FriendsTable } from "../comp/FriendsTable";
import { Comp } from "../comp/base/Comp";
import { Anchor } from "../comp/core/Anchor";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { IconButton } from "../comp/core/IconButton";
import { Selection } from "../comp/core/Selection";
import { TextField } from "../comp/core/TextField";
import { VerticalLayout } from "../comp/core/VerticalLayout";
import { MessageDlg } from "./MessageDlg";
import { MultiBlockDlg } from "./MultiBlockDlg";

export interface LS { // Local State
    loading?: boolean;
    friends?: J.FriendInfo[];
}

export class BlockedUsersDlg extends DialogBase {
    static inst: BlockedUsersDlg = null;
    searchTextState: Validator = new Validator();
    friendsTagSearch: string;
    searchTextField: TextField;

    constructor(title: string) {
        super(title);
        BlockedUsersDlg.inst = this;

        this.mergeState<LS>({
            loading: true
        });
    }

    override getTitleText = (): string => {
        const state: LS = this.getState();
        const count = state.friends?.length > 0 ? state.friends?.length : 0;
        return `${this.title} (${count})`;
    }

    override preLoad = async () => {
        const res = await S.rpcUtil.rpc<J.GetPeopleRequest, J.GetPeopleResponse>("getPeople", {
            nodeId: null,
            type: "blocks",
        });

        let friends: J.FriendInfo[] = [];
        if (res.nodeOwner) {
            friends.push(res.nodeOwner);
        }
        if (res.people) {
            friends = friends.concat(res.people);
        }

        this.mergeState<LS>({
            friends,
            loading: false
        });
    }

    renderDlg(): Comp[] {
        const state: LS = this.getState();
        const ast = getAs();
        let message = null;
        if (state.loading) {
            message = "Loading...";
        }
        else if (!state.friends || state.friends.length === 0) {
            message = "You haven't blocked anyone";
        }

        let friendsTagDropDown: Selection = null;

        if (ast.friendHashTags && ast.friendHashTags.length > 0) {
            const items: any[] = [
                { key: "", val: "All Tags" }
            ];

            for (const tag of ast.friendHashTags) {
                items.push({ key: tag, val: tag });
            }

            friendsTagDropDown = new Selection(null, "Filter By Tag",
                items,
                null, "friendsTagPickerOnEditor alignBottom", {
                setValue: (val: string) => {
                    this.friendsTagSearch = val;
                    this.userSearch();
                },
                getValue: (): string => this.friendsTagSearch
            });
        }

        let searchText = this.searchTextState.getValue();
        let tagSearch = this.friendsTagSearch;

        searchText = searchText?.toLowerCase();
        tagSearch = tagSearch?.toLowerCase();

        const filteredFriends = state.friends?.map(friend => {
            if (!friend) return null;

            if ((!searchText || this.friendMatchesString(friend, searchText)) &&
                (!tagSearch || this.friendMatchesString(friend, tagSearch))) {
                return friend;
            }
            else {
                return null;
            }
        });

        return [
            new Div(null, null, [
                !message ? new FlexRowLayout([
                    (this.searchTextField = new TextField({
                        labelClass: "txtFieldLabelShort",
                        label: "Search",
                        val: this.searchTextState,
                        placeholder: "Search for...",
                        enter: this.userSearch,
                        outterClass: "friendSearchField"
                    })),

                    // This div wrapper is to keep the button from stretching wrong
                    new Div(null, { className: "friendSearchButtonDiv" }, [
                        new IconButton("fa-search", null, {
                            onClick: this.userSearch,
                            title: "Search"
                        }, "btn-secondary")
                    ]),

                    friendsTagDropDown
                ], "flexRowAlignBottom marginBottom") : null,
                message ? new Div(message)
                    : new FriendsTable(filteredFriends, false, this),
                state.friends?.length > 1 ? new Clearfix() : null,
                new ButtonBar([
                    new Button("Import", this.import),
                    state.friends?.length > 0 ? new Button("Export", this.export) : null,
                    new Button("Close", this.cancel, null, "btn-secondary float-end")
                ], "marginTop"),
                new Clearfix() // required in case only ButtonBar children are float-end, which would break layout
            ])
        ];
    }

    export = () => {
        const hostAndPort: string = S.util.getHostAndPort();
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but
        eventually the plan is to have the export return the actual md5 of the export for use here
        */

        // disp=inline (is the other)
        const downloadLink = hostAndPort + "/f/export-blocks?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        new MessageDlg(
            "Use the download link below to get the text file.",
            "Export Blocks",
            null,
            new VerticalLayout([
                new Anchor(downloadLink, "Download Blocked List", { target: "_blank" }),
            ]), false, 0, null
        ).open();
    }

    import = async () => {
        const dlg = new MultiBlockDlg();
        await dlg.open();
        this.preLoad();
    }

    userSearch = () => {
        this.mergeState<LS>({});
        // warning: keep the fat arrow function here.
        setTimeout(() => this.searchTextField.focus(), 50);
    }

    cancel = () => {
        this.close();
    }

    friendMatchesString = (friend: J.FriendInfo, text: string) => {
        const ret = (friend.displayName && friend.displayName.toLowerCase().indexOf(text) !== -1) || //
            (friend.userName && friend.userName.toLowerCase().indexOf(text) !== -1) || //
            (friend.tags && friend.tags.toLowerCase().indexOf(text) !== -1);
        return ret;
    }
}

PubSub.sub(C.PUBSUB_friendsChanged, (_payload: string) => {
    if (BlockedUsersDlg.inst) {
        BlockedUsersDlg.inst.preLoad();
    }
});
