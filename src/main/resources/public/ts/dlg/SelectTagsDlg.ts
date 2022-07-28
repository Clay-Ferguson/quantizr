import { getAppState } from "../AppRedux";
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
import { EditTagsDlg } from "./EditTagsDlg";

interface LS { // Local State
    tags: Tag[];
    suggestedTags: Tag[];

    // holds the set of all tags selected by the user (via. checkboxes)
    selectedTags?: Set<string>;
    suggestTags: boolean;
}

interface Tag {
    // Note: A Tag with only a description (no 'tag') is considered to be a heading/section
    tag?: string;
    description: string;
}

// need to disable this for anonymous
export class SelectTagsDlg extends DialogBase {
    matchAny = false;
    matchAll = false;
    indenting = false;

    /* modeOption = search | edit */
    constructor(private modeOption: string, private curTags: string) {
        super("Select Hashtags", "app-modal-content-medium-width");

        let tags = this.parseTags();
        this.mergeState({ selectedTags: this.makeDefaultSelectedTags(), tags, suggestedTags: [], suggestTags: false });
    }

    makeDefaultSelectedTags = (): Set<string> => {
        let tagSet = new Set<string>();

        if (this.curTags) {
            let tags = this.curTags.split(/ /);
            tags.forEach(t => {
                tagSet.add(t);
            });
        }

        return tagSet;
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
                        }, null, "btn-primary"),
                        new Button("Clear", () => {
                            this.clear();
                        })
                    ];
                    break;
            }
        }

        return [
            new Form(null, [
                new Checkbox("Suggest Tags", { className: "float-end" }, {
                    setValue: (checked: boolean) => {
                        this.mergeState({ suggestTags: checked });
                        if (checked && this.getState().suggestedTags.length === 0) {
                            setTimeout(this.updateSuggestTags, 250);
                        }
                    },
                    getValue: (): boolean => this.getState().suggestTags
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
        const node = getAppState().node;

        let res = await S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending: false,
            feed: false,
            getWords: false,
            getTags: true,
            getMentions: false
        });

        if (res.topTags?.length > 0) {
            let suggestedTags = [];
            res.topTags.forEach(tag => {
                suggestedTags.push({ tag, description: null });
            });
            this.mergeState({ suggestedTags });
        }
    }

    /* returns an array of objects like {tag, description} */
    parseTags = (): Tag[] => {
        if (!getAppState().userProfile?.userTags) return null;
        let tags: Tag[] = [];
        let lines: string[] = getAppState().userProfile.userTags.split(/\r?\n/);
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

            state.tags.forEach(tagObj => {
                this.processAddCheckboxOrHeading(div, tagObj);
            });

            if (state.suggestTags && state.suggestedTags.length > 0) {
                div.addChild(new Heading(4, "Suggestions", { className: "marginTop" }));

                state.suggestedTags.forEach(tagObj => {
                    // don't duplicate any we've already added above
                    if (state.tags.find(o => o.tag === tagObj.tag)) {
                        return;
                    }

                    this.processAddCheckboxOrHeading(div, tagObj);
                });
            }
        }

        if (!div || !div.hasChildren()) {
            div = new Div("You haven't added any tags yet. Use the `Edit Tags` button to add some.");
        }

        return div;
    }

    processAddCheckboxOrHeading = (div: Div, tagObj: Tag) => {
        let attribs: any = null;
        if (tagObj.description && tagObj.tag) {
            attribs = { title: tagObj.tag };
        }

        if (!tagObj.tag) {
            div.addChild(new Heading(4, tagObj.description, { className: "marginTop" }));
            this.indenting = true;
        }
        else {
            let checkbox: Checkbox = new Checkbox(tagObj.description || tagObj.tag, attribs, {
                setValue: (checked: boolean) => {
                    let state = this.getState<LS>();
                    if (checked) {
                        state.selectedTags.add(tagObj.tag);
                    }
                    else {
                        state.selectedTags.delete(tagObj.tag);
                    }
                    this.mergeState(state);
                },
                getValue: (): boolean => this.getState<LS>().selectedTags.has(tagObj.tag)
            });
            div.addChild(new Div(null, { className: this.indenting ? "tagIndent" : "" }, [checkbox]));
        }
    }

    select = () => {
        this.close();
    }

    clear = () => {
        this.mergeState({ selectedTags: new Set<string>() });
        this.close();
    }

    edit = async () => {
        let dlg = new EditTagsDlg();
        await dlg.open();
        let tags = this.parseTags();
        this.mergeState({ tags });
    }
}
