import { dispatch, getAs } from "../AppContext";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { Validator } from "../Validator";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Markdown } from "../comp/core/Markdown";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { Selection } from "../comp/core/Selection";
import { Span } from "../comp/core/Span";
import { TextField } from "../comp/core/TextField";
import { ConfirmDlg } from "./ConfirmDlg";
import { SelectTagsDlg, LS as SelectTagsDlgLS } from "./SelectTagsDlg";

interface LS { // Local State
    searchRoot?: string;
    sortField?: string;
    caseSensitive?: boolean;
    fuzzy?: boolean;
    blockedWords?: boolean;
    recursive?: boolean;
    sortDir?: string;
    requirePriority?: boolean;
    requireAttachment?: boolean;
    requireDate?: boolean;
    displayLayout?: string; // doc, list, graph
    searchType?: string; // node.content, node.name, node.id
}

export class SearchDlg extends DialogBase {
    static defaultSearchText: string = "";
    static dlgState: any = {
        displayLayout: "list",
        fuzzy: false,
        blockedWords: false,
        caseSensitive: false,
        recursive: true,
        sortField: "mtm",
        sortDir: "desc",
        requirePriority: false,
        requireAttachment: false,
        requireDate: false,
        searchType: "node.content"
    };

    searchTextField: TextField;
    searchTextState: Validator = new Validator();
    searchNameState: Validator = new Validator();

    constructor(private searchRoot: NodeInfo = null, searchDef: J.SearchDefinition = null) {
        super("Search");
        this.onMount(() => {
            this.searchTextField?.focus();
        });

        if (searchDef) {
            this.initFromSearchDef(searchDef);
        }
        else {
            this.mergeState<LS>(SearchDlg.dlgState);
            this.searchTextState.setValue(SearchDlg.defaultSearchText);
        }
    }

    initFromSearchDef(searchDef: J.SearchDefinition) {
        this.mergeState<LS>({
            ...SearchDlg.dlgState,
            sortField: searchDef.sortField,
            caseSensitive: searchDef.caseSensitive,
            fuzzy: searchDef.fuzzy,
            recursive: searchDef.recursive,
            sortDir: searchDef.sortDir,
            requirePriority: searchDef.requirePriority,
            requireAttachment: searchDef.requireAttachment,
            requireDate: searchDef.requireDate,
        });
        this.searchTextState.setValue(searchDef.searchText);
        this.searchNameState.setValue(searchDef.name);
    }

    renderDlg(): Comp[] {
        let mainDiv = null;
        const state = this.getState<LS>();
        const savableSearch = state.displayLayout === "list";
        switch (state.searchType) {
            case "node.content":
                mainDiv = this.buildContentSearch(savableSearch);
                break;
            case "node.name":
                mainDiv = this.buildNameSearch();
                break;
            case "node.id":
                mainDiv = this.buildIdSearch();
                break;
            default:
                break;
        }
        return [
            new RadioButtonGroup([
                this.searchTypeRadioButton("All Content", "node.content"),
                this.searchTypeRadioButton("Node Name", "node.name"),
                this.searchTypeRadioButton("Node ID", "node.id"),
            ], "radioButtonsBar mt-3"),
            mainDiv,
            new ButtonBar([
                new Button("Search", () => this.search(false), null, "-primary"),
                // todo-2: this is currently not implemented on the server.
                // ast.isAdminUser ? new Button("Delete Matches", this.deleteMatches, null, "-danger") : null,
                new Button("Cancel", this._close, null, "float-right")
            ], "mt-3")
        ];
    }

    buildNameSearch(): Comp {
        this.searchTextField = new TextField({
            label: "Node Name",
            enter: () => this.searchByNodeName(),
            val: this.searchTextState
        })
        return this.searchTextField;
    }

    buildIdSearch(): Comp {
        this.searchTextField = new TextField({
            label: "Node ID",
            enter: () => this.searchByNodeId(),
            val: this.searchTextState
        })
        return this.searchTextField;
    }

    buildContentSearch(savableSearch: boolean): Comp {
        const ast = getAs();
        const state = this.getState<LS>();
        let requirePriorityCheckbox = null;
        if (this.getState<LS>().sortField === J.NodeProp.PRIORITY_FULL) {
            requirePriorityCheckbox = new Checkbox("Require Priority", null, {
                setValue: (checked: boolean) => {
                    SearchDlg.dlgState.requirePriority = checked;
                    this.mergeState<LS>({ requirePriority: checked });
                },
                getValue: (): boolean => this.getState<LS>().requirePriority
            }, "ml-3");
        }

        return new Div(null, null, [
            new Div(null, null, [
                this.searchTextField = new TextField({
                    label: "Enter Search Text",
                    enter: () => this.search(false),
                    val: this.searchTextState
                })
            ]),
            this.createSearchFieldIconButtons(),
            new Clearfix(),
            new FlexRowLayout([
                ast.userProfile?.blockedWords ? new Checkbox("Blocked Words", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.blockedWords = checked;
                        this.mergeState<LS>({ blockedWords: checked });
                        if (checked) {
                            let words = ast.userProfile.blockedWords;
                            words = words.replaceAll("\n", " ");
                            words = words.replaceAll("\r", " ");
                            words = words.replaceAll("\t", " ");
                            this.searchTextState.setValue(words);
                        }
                        else {
                            this.searchTextState.setValue("");
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().blockedWords
                }, "mt-3") : null,
                new Checkbox("Regex", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.fuzzy = checked;
                        this.mergeState<LS>({ fuzzy: checked });
                    },
                    getValue: (): boolean => this.getState<LS>().fuzzy
                }, "mt-3"),
                new Checkbox("Case Sensitive", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.caseSensitive = checked;
                        this.mergeState<LS>({ caseSensitive: checked });
                    },
                    getValue: (): boolean => this.getState<LS>().caseSensitive
                }, "mt-3"),
                new Checkbox("Recursive", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.recursive = checked;
                        this.mergeState<LS>({ recursive: checked });
                    },
                    getValue: (): boolean => this.getState<LS>().recursive
                }, "mt-3"),
                new Checkbox("Has Attachment", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.requireAttachment = checked;
                        this.mergeState<LS>({ requireAttachment: checked });
                    },
                    getValue: (): boolean => this.getState<LS>().requireAttachment
                }, "mt-3"),
                new Checkbox("Has Date", null, {
                    setValue: (checked: boolean) => {
                        SearchDlg.dlgState.requireDate = checked;
                        this.mergeState<LS>({ requireDate: checked });
                    },
                    getValue: (): boolean => this.getState<LS>().requireDate
                }, "mt-3")
            ], "mb-3"),

            new FlexRowLayout([
                new Selection(null, "Search in", [
                    { key: J.Constant.SEARCH_CUR_NODE, val: "Current Node" },
                    { key: J.Constant.SEARCH_ALL_NODES, val: "My Account" }
                ], "searchDlgSearchRoot", {
                    setValue: (val: string) => {
                        SearchDlg.dlgState.searchRoot = val;
                        this.mergeState<LS>({
                            searchRoot: val
                        });
                    },
                    getValue: (): string => this.getState<LS>().searchRoot
                }),
                new Selection(null, "Display Layout", [
                    { key: "list", val: "List" },
                    { key: "doc", val: "Document" },
                    { key: "graph", val: "Graph" }
                ], "searchDlgDisplayLayout", {
                    setValue: (val: string) => {
                        this.mergeState<LS>({
                            displayLayout: val
                        });
                    },
                    getValue: (): string => this.getState<LS>().displayLayout
                }),
                state.displayLayout == "list" ? new Selection(null, "Sort by", [
                    { key: "none", val: "n/a" },
                    { key: "mtm", val: "Modify Time" },
                    { key: "ctm", val: "Create Time" },
                    { key: "contentLength", val: "Text Length" },
                    { key: "treeDepth", val: "Tree Depth" },
                    { key: J.NodeProp.PRIORITY_FULL, val: "Priority" }
                ], "searchDlgOrderBy", {
                    setValue: (val: string) => {
                        let sortDir = "DESC";
                        if (val === J.NodeProp.PRIORITY_FULL) {
                            sortDir = "asc";
                        }
                        SearchDlg.dlgState.sortField = val;
                        SearchDlg.dlgState.sortDir = sortDir;

                        const newState: LS = {
                            sortField: val,
                            sortDir
                        }
                        if (val === J.NodeProp.PRIORITY_FULL) {
                            newState.requirePriority = true;
                        }
                        this.mergeState<LS>(newState);
                    },
                    getValue: (): string => this.getState<LS>().sortField
                }) : null,
                new Div(null, null, [
                    requirePriorityCheckbox
                ])
            ], "mb-6 mt-6"),
            savableSearch ? new TextField({
                label: "Search Name (optional)",
                val: this.searchNameState
            }) : null,
            new CollapsiblePanel("Show Tips", "Hide Tips", null, [
                new Markdown(`
* Use quotes to search for exact phrases or hashtags. 
- Example: \`"hello world" "#hashtag"\`
* \`and\` and \`or\` can be used between quoted phrases. ANDing is the default if you don't put and/or between terms.`, {
                    className: "expandedPanel"
                })
            ], true, (exp: boolean) => {
                dispatch("ExpandAttachment", s => s.searchTipsExpanded = exp);
            }, getAs().searchTipsExpanded, null, "mt-3", "mt-3")
        ])
    }

    async searchByNodeName() {
        if (!this.validate()) {
            return;
        }

        SearchDlg.defaultSearchText = this.searchTextState.getValue();
        const desc = "Node Name: " + SearchDlg.defaultSearchText;
        const success = await S.srch.search(null, null, "node.name", SearchDlg.defaultSearchText, null, desc, null, false,
            false, 0, true, "mtm", "DESC", false, false, false, false, false);
        if (success) {
            this.close();
        }
    }

    async searchByNodeId() {
        if (!this.validate()) {
            return;
        }
        SearchDlg.defaultSearchText = this.searchTextState.getValue();
        const desc = "Node ID: " + SearchDlg.defaultSearchText;
        const success = await S.srch.search(null, null, "node.id", SearchDlg.defaultSearchText, null, desc, null, false,
            false, 0, true, null, null, false, false, false, false, false);
        if (success) {
            this.close();
        }
    }

    searchTypeRadioButton(name: string, searchType: string) {
        return new Span(null, null, [
            new RadioButton(name, false, "searchTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        this.mergeState<LS>({ searchType });
                    }
                },
                getValue: (): boolean => this.getState<LS>().searchType === searchType
            }, "mr-3 inlineBlock")
        ]);
    }

    // We override so we can make adjustments 
    mergeState<T extends LS>(moreState: T): void {
        const state: LS = this.getState<LS>();
        if (state.displayLayout === "graph" || state.displayLayout === "doc") {
            SearchDlg.dlgState.sortField = "";
            SearchDlg.dlgState.sortDir = "none";
            moreState.sortField = "";
            moreState.sortDir = "none";
        }
        super.mergeState(moreState);
    }

    createSearchFieldIconButtons(): Comp {
        return new ButtonBar([
            new Button("Clear", () => {
                this.searchTextState.setValue("");
                dispatch("clearSearch", s => {
                    s.highlightText = null;
                })
            }),
            !getAs().isAnonUser ? new Button("Hashtags", async () => {
                const dlg = new SelectTagsDlg("search", this.searchTextState.getValue(), true);
                await dlg.open();
                this.addTagsToSearchField(dlg);
            }, {
                title: "Select Hashtags to Search"
            }, "-primary", "fa-tag fa-lg") : null
        ], "float-right mt-2");
    }

    addTagsToSearchField(dlg: SelectTagsDlg) {
        let val = this.searchTextState.getValue();
        val = val.trim();

        dlg.getState<SelectTagsDlgLS>().selectedTags.forEach(mtag => {
            const amtags: string[] = mtag.split(" ");
            amtags.forEach(tag => {
                if (!tag) return;
                tag = tag.trim();
                if (!tag) return;

                // if tag is alread in quotes remove the quotes
                if (tag.startsWith("\"") && tag.endsWith("\"")) {
                    tag = tag.substring(1, tag.length - 1);
                }

                const quoteTag = "\"" + tag + "\"";
                if (val.indexOf(quoteTag) == -1) {
                    if (val) val += " ";
                    val += quoteTag;
                }
            });
        });

        this.searchTextState.setValue(SearchDlg.defaultSearchText = val);
    }

    _searchGraphLayout = () => {
        const node = this.searchRoot || S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchDlg.defaultSearchText = this.searchTextState.getValue();
        this.close();
        S.render.showGraph(null, SearchDlg.defaultSearchText);
    }

    // currently not used.
    _deleteMatches = async () => {
        const dlg = new ConfirmDlg("Permanently delete ALL MATCHING Nodes", "WARNING",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (dlg.yes) {
            this.search(true);
        }
    }

    async search(deleteMatches: boolean) {
        switch (this.getState<LS>().searchType) {
            case "node.content":
                switch (this.getState<LS>().displayLayout) {
                    case "list":
                        await this.searchListLayout(deleteMatches);
                        break;
                    case "doc":
                        await this.searchDocLayout();
                        break;
                    case "graph":
                        this._searchGraphLayout();
                        break;
                    default:
                        break;
                }
                break;
            case "node.name":
                await this.searchByNodeName();
                break;
            case "node.id":
                await this.searchByNodeId();
                break;
            default:
                break;
        }
    }

    async searchDocLayout() {
        const node = this.searchRoot || S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }
        SearchDlg.defaultSearchText = this.searchTextState.getValue();
        const state = this.getState<LS>();

        let requirePriority = state.requirePriority;
        if (state.sortField !== J.NodeProp.PRIORITY_FULL) {
            requirePriority = false;
        }

        await S.srch.showDocument(node.id, true, {
            name: null,
            searchText: this.searchTextState.getValue(),
            fuzzy: state.fuzzy,
            caseSensitive: state.caseSensitive,
            recursive: state.recursive,
            sortField: state.sortField,
            sortDir: state.sortDir,
            requirePriority: requirePriority,
            requireAttachment: state.requireAttachment,
            requireDate: state.requireDate,
            searchProp: null
        });

        this.close();
    }

    async searchListLayout(deleteMatches: boolean) {
        const node = this.searchRoot || S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchDlg.defaultSearchText = this.searchTextState.getValue();
        const desc = SearchDlg.defaultSearchText ? ("Content: " + SearchDlg.defaultSearchText) : "";
        const state = this.getState<LS>();

        let requirePriority = state.requirePriority;
        if (state.sortField !== J.NodeProp.PRIORITY_FULL) {
            requirePriority = false;
        }

        // If we're deleting matches
        if (SearchDlg.defaultSearchText?.trim().length < 5 && deleteMatches) {
            return;
        }

        const success = await S.srch.search(this.searchNameState.getValue(),
            node.id, null, SearchDlg.defaultSearchText, null, desc,
            state.searchRoot,
            state.fuzzy,
            state.caseSensitive, 0,
            state.recursive,
            state.sortField,
            state.sortDir,
            requirePriority,
            state.requireAttachment,
            deleteMatches,
            false,
            state.requireDate);
        if (success) {
            this.close();
            S.util._loadSearchDefs();
        }
    }
}
