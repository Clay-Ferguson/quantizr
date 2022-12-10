import { getAppState } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { HelpButton } from "../comp/core/HelpButton";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { IconButton } from "../comp/core/IconButton";
import { Selection } from "../comp/core/Selection";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { LS as SelectTagsDlgLS, SelectTagsDlg } from "./SelectTagsDlg";

interface LS { // Local State
    searchRoot?: string;
    sortField?: string;
    requirePriority?: boolean;
    caseSensitive?: boolean;
    fuzzy?: boolean;
    recursive?: boolean;
    sortDir?: string;
}

export class SearchContentDlg extends DialogBase {
    static defaultSearchText: string = "";
    static dlgState: any = {
        fuzzy: false,
        caseSensitive: false,
        requirePriority: false,
        recursive: true,
        sortField: "0",
        sortDir: ""
    };

    searchTextField: TextField;
    searchTextState: Validator = new Validator();

    constructor() {
        super("Search");
        this.onMount(() => { this.searchTextField?.focus(); });
        this.mergeState<LS>(SearchContentDlg.dlgState);
        this.searchTextState.setValue(SearchContentDlg.defaultSearchText);
    }

    renderDlg(): CompIntf[] {
        let requirePriorityCheckbox = null;
        if (this.getState<LS>().sortField === J.NodeProp.PRIORITY_FULL) {
            requirePriorityCheckbox = new Checkbox("Require Priority", null, {
                setValue: (checked: boolean) => {
                    SearchContentDlg.dlgState.requirePriority = checked;
                    this.mergeState<LS>({ requirePriority: checked });
                },
                getValue: (): boolean => this.getState<LS>().requirePriority
            });
        }

        return [
            new Div(null, null, [
                new Div(null, { className: "row align-items-end" }, [
                    this.searchTextField = new TextField({ enter: this.search, val: this.searchTextState, outterClass: "col-10" }),
                    !getAppState().isAnonUser ? this.createSearchFieldIconButtons() : null
                ]),
                new HorizontalLayout([
                    // Allow fuzzy search for admin only. It's cpu intensive.
                    new Checkbox("Regex", null, {
                        setValue: (checked: boolean) => {
                            SearchContentDlg.dlgState.fuzzy = checked;
                            this.mergeState<LS>({ fuzzy: checked });
                        },
                        getValue: (): boolean => this.getState<LS>().fuzzy
                    }),
                    new Checkbox("Case Sensitive", null, {
                        setValue: (checked: boolean) => {
                            SearchContentDlg.dlgState.caseSensitive = checked;
                            this.mergeState<LS>({ caseSensitive: checked });
                        },
                        getValue: (): boolean => this.getState<LS>().caseSensitive
                    }),
                    new Checkbox("Recursive", null, {
                        setValue: (checked: boolean) => {
                            SearchContentDlg.dlgState.recursive = checked;
                            this.mergeState<LS>({ recursive: checked });
                        },
                        getValue: (): boolean => this.getState<LS>().recursive
                    })
                ], "displayTable marginBottom"),
                new HorizontalLayout([
                    new Div(null, null, [
                        new Selection(null, "Sort by", [
                            { key: "0", val: "Relevance" },
                            { key: "ctm", val: "Create Time" },
                            { key: "mtm", val: "Modify Time" },
                            { key: "contentLength", val: "Text Length" },
                            { key: J.NodeProp.PRIORITY_FULL, val: "Priority" }
                        ], "m-2", "searchDlgOrderBy", {
                            setValue: (val: string) => {
                                let sortDir = val === "0" ? "" : "DESC";
                                if (val === J.NodeProp.PRIORITY_FULL) {
                                    sortDir = "asc";
                                }
                                SearchContentDlg.dlgState.sortField = val;
                                SearchContentDlg.dlgState.sortDir = sortDir;

                                this.mergeState<LS>({
                                    sortField: val,
                                    sortDir
                                });
                            },
                            getValue: (): string => this.getState<LS>().sortField
                        }),
                        requirePriorityCheckbox
                    ]),
                    new Selection(null, "Search in...", [
                        { key: "curNode", val: "Current Node" },
                        { key: "allNodes", val: "My Account" }
                    ], "m-2", "searchDlgSearchRoot", {
                        setValue: (val: string) => {
                            SearchContentDlg.dlgState.searchRoot = val;

                            this.mergeState<LS>({
                                searchRoot: val
                            });
                        },
                        getValue: (): string => this.getState<LS>().searchRoot
                    })
                ], "displayTable marginBottom"),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Graph", this.graph),
                    new HelpButton(() => getAppState().config.help?.search?.dialog),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    createSearchFieldIconButtons = (): Comp => {
        return new ButtonBar([
            new IconButton("fa-tag fa-lg", "", {
                onClick: async () => {
                    const dlg = new SelectTagsDlg("search", this.searchTextState.getValue());
                    await dlg.open();
                    this.addTagsToSearchField(dlg);
                },
                title: "Select Hashtags to Search"
            }, "btn-primary", "off")
        ], "col-2");
    }

    addTagsToSearchField = (dlg: SelectTagsDlg) => {
        let val = this.searchTextState.getValue();
        val = val.trim();
        const tags: string[] = val.split(" ");

        dlg.getState<SelectTagsDlgLS>().selectedTags.forEach(tag => {
            const quoteTag = "\"" + tag + "\"";
            if (val) val += " ";
            if (!tags.includes(tag) && !tags.includes(quoteTag)) {
                if (dlg.matchAny) {
                    val += tag;
                    tags.push(tag);
                }
                else {
                    val += quoteTag;
                    tags.push(quoteTag);
                }
            }
        });
        this.searchTextState.setValue(SearchContentDlg.defaultSearchText = val);
    }

    graph = () => {
        // until we have better validation
        const node = S.nodeUtil.getHighlightedNode(getAppState());
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchContentDlg.defaultSearchText = this.searchTextState.getValue();
        this.close();
        S.render.showGraph(null, SearchContentDlg.defaultSearchText, getAppState());
    }

    search = () => {
        // until we have better validation
        const node = S.nodeUtil.getHighlightedNode(getAppState());
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchContentDlg.defaultSearchText = this.searchTextState.getValue();
        const desc = SearchContentDlg.defaultSearchText ? ("Content: " + SearchContentDlg.defaultSearchText) : "";
        const state = this.getState<LS>();

        let requirePriority = state.requirePriority;
        if (state.sortField !== J.NodeProp.PRIORITY_FULL) {
            requirePriority = false;
        }

        S.srch.search(node, null, SearchContentDlg.defaultSearchText, null, desc,
            state.searchRoot,
            state.fuzzy,
            state.caseSensitive, 0,
            state.recursive,
            state.sortField,
            state.sortDir,
            requirePriority,
            this.close);
    }
}
