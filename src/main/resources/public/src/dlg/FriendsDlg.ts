import { getAs, promiseDispatch } from "../AppContext";
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
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Selection } from "../comp/core/Selection";
import { TextField } from "../comp/core/TextField";
import { VerticalLayout } from "../comp/core/VerticalLayout";
import { MessageDlg } from "./MessageDlg";
import { MultiFollowDlg } from "./MultiFollowDlg";

export interface LS { // Local State
    nodeId?: string;
    selections?: Set<string>;
    loading?: boolean;
    friends?: J.FriendInfo[];
    selectAll?: boolean;
}

export class FriendsDlg extends DialogBase {
    userNameState: Validator = new Validator("");
    searchTextState: Validator = new Validator();
    friendsTagSearch: string;
    searchTextField: TextField;

    static inst: FriendsDlg = null;
    static searchDirty = false;
    static dirtyCounter = 0;
    static interval = setInterval(() => {
        if (!FriendsDlg.inst) return;
        if (FriendsDlg.searchDirty) {
            FriendsDlg.dirtyCounter++;
            if (FriendsDlg.dirtyCounter >= 2) {
                FriendsDlg.searchDirty = false;
                setTimeout(FriendsDlg.inst._userSearch, 10);
            }
        }
    }, 500);

    constructor(title: string, private nodeId: string, private displayOnly: boolean) {
        super(title);
        FriendsDlg.inst = this;
        this.mergeState<LS>({
            selections: new Set<string>(),
            loading: true
        });

        this.searchTextState.v.onStateChange = (_val: any) => {
            FriendsDlg.searchDirty = true;
            FriendsDlg.dirtyCounter = 0;
        };
    }

    override getTitleText = (): string => {
        const state: LS = this.getState();
        const count = state.friends?.length > 0 ? state.friends?.length : 0;
        return `${this.title} (${count})`;
    }

    override async preLoad() {
        this.mergeState<LS>({
            selections: new Set<string>(),
            loading: true
        });

        const res = await S.rpcUtil.rpc<J.GetPeopleRequest, J.GetPeopleResponse>("getPeople", {
            nodeId: this.nodeId,
            type: "friends"
        });

        await promiseDispatch("SetFriendHashTags", s => { s.friendHashTags = res.friendHashTags; });

        let friends: J.FriendInfo[] = [];
        if (res.nodeOwner) {
            friends.push(res.nodeOwner);
        }
        if (res.people) {
            friends = friends.concat(res.people);
        }

        this.mergeState<LS>({
            nodeId: this.nodeId,
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
            if (!this.nodeId) {
                message = "Once you follow some people they will show up in this list.";
            }
            else {
                message = "Only the Node Owner is associated with this node."
            }
        }

        let friendsTagDropDown: Selection = null;

        if (ast.friendHashTags?.length > 0) {
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
                    this._userSearch();
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

        const ret = [
            new Div(null, null, [
                !message ? new FlexRowLayout([
                    (this.searchTextField = new TextField({
                        labelClass: "txtFieldLabelShort",
                        val: this.searchTextState,
                        placeholder: "Search for...",
                        enter: this._userSearch,
                        outterClass: "friendSearchField"
                    })),

                    friendsTagDropDown
                ], "flexRowAlignBottom marginBottom") : null,
                message ? new Div(message)
                    : new FriendsTable(filteredFriends, !this.nodeId && !this.displayOnly, this),
                !this.displayOnly && state.friends?.length > 1 ? new Checkbox("Select All", { className: "selectAllPersonsCheckBox" }, {
                    setValue: (checked: boolean) => {
                        const state: LS = this.getState();
                        state.selectAll = checked;
                        this.setSelectAllPersons(state, checked);
                        this.mergeState(state);
                    },
                    getValue: (): boolean => state.selectAll
                }, "tw-float-right") : null,
                state.friends?.length > 1 ? new Clearfix() : null,
                !this.displayOnly && !this.nodeId ? new TextField({ label: "User Names (comma separated)", val: this.userNameState }) : null,
                new ButtonBar([
                    !this.displayOnly && !this.nodeId ? new Button("Ok", this._save, null, "-primary") : null,
                    !this.displayOnly ? new Button("Import", this._import) : null,
                    state.friends?.length > 0 ? new Button("Export", this._export) : null,
                    new Button(!this.nodeId && !this.displayOnly ? "Cancel" : "Close", this._cancel, null, "tw-float-right")
                ], "mt-3"),
                new Clearfix() // required in case only ButtonBar children are tw-float-right, which would break layout
            ])
        ];
        return ret;
    }

    _export = () => {
        const hostAndPort: string = S.util.getHostAndPort();
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but
        eventually the plan is to have the export return the actual md5 of the export for use here
        */

        // disp=inline (is the other)
        const downloadLink = hostAndPort + "/f/export-friends?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        new MessageDlg(
            "Use the download link below to get the text file.",
            "Export Follows",
            null,
            new VerticalLayout([
                new Anchor(downloadLink, "Download Follows List", { target: "_blank" }),
            ]), false, 0, null
        ).open();
    }


    _import = async () => {
        const dlg = new MultiFollowDlg();
        await dlg.open();
        this.preLoad();
    }

    setSelectAllPersons(state: LS, selectAll: boolean) {
        state.selections = new Set<string>()

        // note: if !selectAll we set empty selections, and this is correct.
        if (selectAll && state.friends) {
            let searchText = this.searchTextState.getValue();
            let tagSearch = this.friendsTagSearch;

            searchText = searchText?.toLowerCase();
            tagSearch = tagSearch?.toLowerCase();

            state.friends.forEach(friend => {
                if (!friend) return;
                if ((!searchText || this.friendMatchesString(friend, searchText)) &&
                    (!tagSearch || this.friendMatchesString(friend, tagSearch))) {
                    state.selections.add(friend.userName);
                }
            });
        }
    }

    _userSearch = () => {
        this.mergeState<LS>({});
        // warning: keep the fat arrow function here.
        setTimeout(() => this.searchTextField.focus(), 50);
    }

    _cancel = () => {
        this.mergeState<LS>({
            selections: new Set<string>()
        });
        this.close();
    }

    friendMatchesString(friend: J.FriendInfo, text: string) {
        const ret = (friend.displayName && friend.displayName.toLowerCase().indexOf(text) !== -1) || //
            (friend.userName && friend.userName.toLowerCase().indexOf(text) !== -1) || //
            (friend.tags && friend.tags.toLowerCase().indexOf(text) !== -1);
        return ret;
    }

    _save = () => {
        const usersText = this.userNameState.getValue();
        if (usersText) {
            const users: string[] = usersText.split(",");
            const state = this.getState<LS>();
            for (const user of users) {
                state.selections.add(user);
            }
            this.mergeState<LS>(state);
        }
        this.close();
    }
}

PubSub.sub(C.PUBSUB_friendsChanged, (_payload: string) => {
    if (FriendsDlg.inst) {
        FriendsDlg.inst.preLoad();
    }
});

