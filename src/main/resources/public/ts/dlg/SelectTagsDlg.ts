import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { Heading } from "../comp/core/Heading";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { EditTagsDlg } from "./EditTagsDlg";

interface LS { // Local State
    tags: Tag[];
    selectedTags?: Set<string>;
}

interface Tag {
    // Note: A Tag with only a description (no 'tag') is considered to be a heading/section
    tag?: string;
    description: string;
}

// need to disable this for anonymous
export class SelectTagsDlg extends DialogBase {
    tagsState: ValidatedState<any> = new ValidatedState<any>();
    matchAny = false;
    matchAll = false;

    /* modeOption = search | edit */
    constructor(private modeOption: string, state: AppState) {
        super("Select Hashtags", "app-modal-content-medium-width", false, state);

        let tags = this.parseTags();
        this.mergeState({ selectedTags: new Set<string>(), tags, suggestTags: false });
    }

    reload = () => {
        if (this.getState().suggestTags) {
            this.updateSuggestTags();
        }
        else {
            let tags = this.parseTags();
            this.mergeState({ selectedTags: new Set<string>(), tags });
        }
    }

    renderDlg(): CompIntf[] {
        let buttons: Button[] = [];
        let state = this.getState();

        if (state.tags?.length > 0) {
            switch (this.modeOption) {
                case "search":
                    buttons = [
                        // todo-1: Match Any is currently broken for tag searches because MongoDb will treat
                        // a search for "#tag1 #tag2" as just "tag1 tag2" and find anything containing the words.
                        // This appears to be a MongoDb with no viable workaround, so doing "any" matches will
                        // consider NON-tags as well as TAGS in the results.
                        // update: I think this note may be obsolete, and it works ok now?

                        new Button("Match All", () => {
                            this.matchAll = true;
                            this.select();
                        }, null, "btn-primary"),
                        new Button("Match Any", () => {
                            this.matchAny = true;
                            this.select();
                        })
                    ];
                    break;
                case "edit":
                    buttons = [
                        new Button("Select", () => {
                            this.select();
                        })
                    ];
                    break;
            }
        }

        return [
            new Form(null, [
                new Checkbox("Suggest Tags", { className: "float-end" }, {
                    setValue: (checked: boolean): void => {
                        this.mergeState({ suggestTags: checked });
                        setTimeout(this.reload, 250);
                    },
                    getValue: (): boolean => {
                        let state = this.getState();
                        return state.suggestTags;
                    }
                }, "form-switch form-check-inline"),
                this.createTagsPickerList(),
                new ButtonBar([
                    ...buttons,
                    new Button("Edit Tags", this.edit),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    updateSuggestTags = async () => {
        const node = this.appState.node;

        let res: J.GetNodeStatsResponse = await S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending: false,
            feed: false,
            getWords: false,
            getTags: true,
            getMentions: false
        });

        if (res.topTags?.length > 0) {
            let tags = [];
            res.topTags.forEach(tag => {
                tags.push({ tag, description: null });
            });
            this.mergeState({ selectedTags: new Set<string>(), tags });
        }
    }

    /* returns an array of objects like {tag, description} */
    parseTags = (): Tag[] => {
        if (!this.appState.userProfile?.userTags) return null;
        let tags: Tag[] = [];
        let lines: string[] = this.appState.userProfile.userTags.split(/\r?\n/);
        lines.forEach(line => {
            if (line?.startsWith("#")) {
                let tag = null;
                let description = null;

                let delimIdx = line.indexOf(":");
                if (delimIdx !== -1) {
                    tag = line.substring(0, delimIdx);
                    description = line.substring(delimIdx + 1).trim();
                }
                else {
                    tag = line;
                }
                tags.push({ tag, description });
            }
            else if (line?.startsWith("//")) {
                // ignore comments
            }
            else {
                // additional lines below a heading to describe the heading can be done as long as they are indented by
                // at least one space on lines below the heading
                if (line && !line.startsWith(" ")) {
                    tags.push({ description: line });
                }
            }
        });
        return tags;
    }

    createTagsPickerList = (): Div => {
        let state = this.getState();

        let div: Div = null;
        if (state.tags?.length > 0) {
            div = new Div();
            let indenting = false;
            state.tags.forEach(tagObj => {
                let attribs: any = null;
                if (tagObj.description && tagObj.tag) {
                    attribs = { title: tagObj.tag };
                }

                if (!tagObj.tag) {
                    div.addChild(new Heading(4, tagObj.description, { className: "marginTop" }));
                    indenting = true;
                }
                else {
                    let checkbox: Checkbox = new Checkbox(tagObj.description || tagObj.tag, attribs, {
                        setValue: (checked: boolean): void => {
                            let state = this.getState<LS>();
                            if (checked) {
                                state.selectedTags.add(tagObj.tag);
                            }
                            else {
                                state.selectedTags.delete(tagObj.tag);
                            }
                            this.mergeState(state);
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().selectedTags.has(tagObj.tag);
                        }
                    });
                    div.addChild(new Div(null, { className: indenting ? "tagIndent" : "" }, [checkbox]));
                }
            });
        }

        if (!div || !div.hasChildren()) {
            div = new Div("You haven't added any tags yet. Use the `Edit Tags` button to add some.");
        }

        return div;
    }

    select = () => {
        this.close();
    }

    edit = async () => {
        let dlg = new EditTagsDlg(this.appState);
        await dlg.open();
        let tags = this.parseTags();
        this.mergeState({ tags });
    }
}
