import { getAs, promiseDispatch } from "../AppContext";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { IconButton } from "../comp/core/IconButton";
import { Selection } from "../comp/core/Selection";
import { TextField } from "../comp/core/TextField";
import { FriendsTable } from "../comp/FriendsTable";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";

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

    constructor(title: string, private nodeId: string, private displayOnly: boolean) {
        super(title);

        this.mergeState<LS>({
            selections: new Set<string>(),
            loading: true
        });
    }

    preLoad = async () => {
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

    renderDlg(): CompIntf[] {
        const state: LS = this.getState();
        const ast = getAs();
        let message = null;
        if (state.loading) {
            message = "Loading...";
        }
        else if (!state.friends || state.friends.length === 0) {
            if (!this.nodeId) {
                message = "Once you add some friends you can pick from a list here.";
            }
            else {
                message = "Only the Node Owner is associated with this node."
            }
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
                    : new FriendsTable(filteredFriends, !this.nodeId && !this.displayOnly, this),
                !this.displayOnly && state.friends?.length > 1 ? new Checkbox("Select All", { className: "selectAllPersonsCheckBox" }, {
                    setValue: (checked: boolean) => {
                        const state: LS = this.getState();
                        state.selectAll = checked;
                        this.setSelectAllPersons(state, checked);
                        this.mergeState(state);
                    },
                    getValue: (): boolean => state.selectAll
                }, "float-end") : null,
                state.friends?.length > 1 ? new Clearfix() : null,
                !this.displayOnly && !this.nodeId ? new TextField({ label: "User Names (comma separated)", val: this.userNameState }) : null,
                new ButtonBar([
                    !this.displayOnly && !this.nodeId ? new Button("Ok", this.save, null, "btn-primary") : null,
                    new Button(!this.nodeId ? "Cancel" : "Close", this.cancel, null, "btn-secondary float-end")
                ], "marginTop"),
                new Clearfix() // required in case only ButtonBar children are float-end, which would break layout
            ])
        ];
    }

    setSelectAllPersons = (state: LS, selectAll: boolean) => {
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

    userSearch = () => {
        this.mergeState<LS>({});
        // warning: keep the fat arrow function here.
        setTimeout(() => this.searchTextField.focus(), 50);
    }

    cancel = () => {
        this.mergeState<LS>({
            selections: new Set<string>()
        });
        this.close();
    }

    friendMatchesString = (friend: J.FriendInfo, text: string) => {
        const ret = (friend.displayName && friend.displayName.toLowerCase().indexOf(text) !== -1) || //
            (friend.userName && friend.userName.toLowerCase().indexOf(text) !== -1) || //
            (friend.tags && friend.tags.toLowerCase().indexOf(text) !== -1);
        return ret;
    }

    save = () => {
        const usersText = this.userNameState.getValue();
        if (usersText) {
            const users: string[] = usersText.split(",");
            const state = this.getState();
            for (const user of users) {
                state.selections.add(user);
            }
            this.mergeState<LS>(state);
        }
        this.close();
    }
}
