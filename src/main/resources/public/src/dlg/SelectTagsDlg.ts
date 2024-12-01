import { getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";

export interface LS { // Local State
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

export class SelectTagsDlg extends DialogBase {
    indenting = false;
    // editFieldState: Validator = new Validator();

    /* modeOption = search | edit */
    constructor(private modeOption: string, private curTags: string, private allowSuggestTags: boolean, private rootNodeId: string) {
        super("Add Hashtags", "appModalContMediumWidth");

        this.mergeState<LS>({
            selectedTags: this.makeDefaultSelectedTags(),
            tags: this.parseTags(),
            suggestedTags: [],
            suggestTags: false
        });
    }

    makeDefaultSelectedTags(): Set<string> {
        const tagSet = new Set<string>();

        if (this.curTags) {
            const tags = this.curTags.split(" ");
            tags?.forEach(t => {
                if (!t) return;
                t = t.trim();
                if (!t) return;
                if (t.startsWith("\"#") && t.endsWith("\"")) {
                    tagSet.add(t);
                }
            });
        }
        return tagSet;
    }

    renderDlg(): Comp[] {
        let buttons: Button[] = [];
        switch (this.modeOption) {
            case "search":
                buttons = [
                    new Button("Ok", this._select, null, "-primary"),
                ];
                break;
            case "edit":
                buttons = [
                    new Button("Ok", this._select, null, "-primary"),
                    new Button("Clear", this._clear)
                ];
                break;
        }

        return [
            new Div(null, null, [
                // Leaving this for now, but I'm pretty sure it's not needed.
                // new TextField({
                //     label: "Tag",
                //     outterClass: "noPaddingRight mb-3",
                //     val: this.editFieldState,
                //     labelClass: "txtFieldLabelShort"
                // }),
                this.allowSuggestTags && this.rootNodeId ? new Checkbox("Suggest Tags", { className: "float-right" }, {
                    setValue: (checked: boolean) => {
                        this.mergeState({ suggestTags: checked });
                        if (checked && this.getState<LS>().suggestedTags.length === 0) {
                            setTimeout(this._updateSuggestTags, 250);
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().suggestTags
                }, "inlineBlock") : null,
                this.createTagsPickerList(),
                new ButtonBar([
                    ...buttons,
                    new Button("Edit Tags", this._edit),
                    new Button("Cancel", () => {
                        this._clear();
                        this.close();
                    }, null, "float-right")
                ], "mt-3")
            ])
        ];
    }

    _updateSuggestTags = async () => {
        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: this.rootNodeId,
            getWords: false,
            getTags: true,
            signatureVerify: false
        });

        if (res.topTags?.length > 0) {
            const suggestedTags: Tag[] = [];
            res.topTags.forEach(tag => suggestedTags.push({ tag, description: null }));
            this.mergeState({ suggestedTags });
        }
    }

    /* returns an array of objects like {tag, description}
    Example format:
    <pre>
    My Heading
      Hidden from gui text
    #tag1
    #tag2:Tag Two Description
    // also hidden from GUI text
    </pre>
    */
    parseTags(): Tag[] {
        if (!getAs().userProfile?.userTags) return null;
        const tags: Tag[] = [];
        // todo-2: in the TTS engine we have something like this done differently. Research which is best
        const lines: string[] = getAs().userProfile.userTags.split(/\r?\n/);
        lines.forEach(line => {
            if (line?.startsWith("#")) {
                let tag = null;
                let description = null;
                const delimIdx = line.indexOf(":");

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
                // additional lines below a heading to describe the heading can be done as long as
                // they are indented by at least one space on lines below the heading
                if (line && !line.startsWith(" ")) {
                    tags.push({ description: line });
                }
            }
        });
        return tags;
    }

    createTagsPickerList(): Div {
        const state = this.getState<LS>();
        let div: Div = null;

        if (state.tags?.length > 0) {
            div = new Div(null, { className: "mb-3" });
            state.tags.forEach(tagObj => this.processAddCheckboxOrHeading(div, tagObj));

            if (state.suggestTags && state.suggestedTags.length > 0) {
                div.addChild(new Heading(4, "Suggestions", { className: "mt-3" }));

                state.suggestedTags.forEach(tagObj => {
                    // NOTE: We choose to NOT do this so that the suggestions are complete and represent what's available.
                    // if (state.tags.find(o => o.tag === tagObj.tag)) {
                    //     return;
                    // }
                    this.processAddCheckboxOrHeading(div, tagObj);
                });
            }
        }

        if (!div || !div.hasChildren()) {
            div = new Div("You haven't added any tags yet. Use the `Edit Tags` button to add some.");
        }
        return div;
    }

    processAddCheckboxOrHeading(div: Div, tagObj: Tag) {
        let attribs: any = null;
        if (tagObj.description && tagObj.tag) {
            // we only prefix with Tag: to move it over so the mouse doesn't cover it up.
            attribs = { title: "Tag: " + tagObj.tag };
        }

        if (!tagObj.tag) {
            div.addChild(new Heading(6, tagObj.description, { className: "mt-3" }));
            this.indenting = true;
        }
        else {
            const checkbox = new Checkbox(tagObj.description || tagObj.tag, attribs, {
                setValue: (checked: boolean) => {
                    const state = this.getState<LS>();
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

    _select = () => {
        const state = this.getState<LS>();
        // const editVal = this.editFieldState.getValue();
        // if (editVal) {
        //     state.selectedTags.add(editVal);
        // }
        this.mergeState(state);
        this.close();
    }

    _clear = () => {
        this.mergeState({ selectedTags: new Set<string>() });
    }

    _edit = async () => {
        await S.edit._editHashtags();
        const tags = this.parseTags();
        this.mergeState({ tags });
    }

    // Adds the selected tags to a pre-existing string of tags, without duplicating any.
    addTagsToString(val: string) {
        val = val.trim();

        this.getState<LS>().selectedTags.forEach(mtag => {
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

        return val;
    }
}
