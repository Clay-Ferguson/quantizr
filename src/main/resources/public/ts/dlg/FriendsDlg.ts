import { getAppState, promiseDispatch } from "../AppContext";
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
import { FriendsDlgState as LS } from "./FriendsDlgState";

export class FriendsDlg extends DialogBase {
    userNameState: Validator = new Validator("");
    searchTextState: Validator = new Validator();
    friendsTagSearch: string;
    searchTextField: TextField;

    constructor(title: string, private nodeId: string) {
        super(title);

        this.mergeState<LS>({
            selections: new Set<string>(),
            loading: true
        });

        (async () => {
            const res = await S.rpcUtil.rpc<J.GetPeopleRequest, J.GetPeopleResponse>("getPeople", {
                nodeId
            });

            await promiseDispatch("SetFriendHashTags", s => {
                s.friendHashTags = res.friendHashTags;
                return s;
            });

            let friends: J.FriendInfo[] = [];
            if (res.nodeOwner) {
                friends.push(res.nodeOwner);
            }
            if (res.people) {
                friends = friends.concat(res.people);
            }

            this.mergeState<LS>({
                nodeId,
                friends,
                loading: false
            });
        })();
    }

    renderDlg(): CompIntf[] {
        const state: LS = this.getState();
        const ast = getAppState();
        let message = null;
        if (state.loading) {
            message = "Loading...";
        }
        else if (!state.friends || state.friends.length === 0) {
            if (!this.nodeId) {
                message = "Once you add some friends you can pick from a list here, but for now you can use the button below to find people by name.";
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

        return [
            new Div(null, null, [
                new FlexRowLayout([

                    !message ? (this.searchTextField = new TextField({
                        labelClass: "txtFieldLabelShort",
                        label: "Search",
                        val: this.searchTextState,
                        placeholder: "Search for...",
                        enter: this.userSearch,
                        outterClass: "friendSearchField"
                    })) : null,

                    // This div wrapper is to keep the button from stretching wrong
                    new Div(null, { className: "friendSearchButtonDiv" }, [
                        new IconButton("fa-search", null, {
                            onClick: this.userSearch,
                            title: "Search"
                        }, "btn-secondary")
                    ]),

                    !message ? friendsTagDropDown : null
                ], "flexRowAlignBottom marginBottom"),
                message ? new Div(message)
                    : new FriendsTable(state.friends, this.searchTextState.getValue(), this.friendsTagSearch, !this.nodeId, this),
                state.friends?.length > 1 ? new Checkbox("Select All", { className: "selectAllPersonsCheckBox" }, {
                    setValue: (checked: boolean) => {
                        const state: LS = this.getState();
                        state.selectAll = checked;
                        this.setSelectAllPersons(state, checked);
                        this.mergeState(state);
                    },
                    getValue: (): boolean => state.selectAll
                }, "float-end") : null,
                state.friends?.length > 1 ? new Clearfix() : null,
                !this.nodeId ? new TextField({ label: "User Names (comma separated)", val: this.userNameState }) : null,
                new ButtonBar([
                    !this.nodeId ? new Button("Ok", this.save, null, "btn-primary") : null,
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
            state.friends.forEach(friend => {
                state.selections.add(friend.userName);
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
