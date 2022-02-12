import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { DialogBase } from "../DialogBase";
import { ValidatedState } from "../ValidatedState";
import { EditTagsDlg } from "./EditTagsDlg";

interface LS { // Local State
    selectedTags?: Set<string>;
    forceRefresh: number;
}

// need to disable this for anonymous
export class SelectTagsDlg extends DialogBase {
    tagsState: ValidatedState<any> = new ValidatedState<any>();
    matchAny = false;
    matchAll = false;

    /* modeOption = search | edit */
    constructor(private modeOption: string, state: AppState) {
        super("Select Hashtags", "app-modal-content-medium-width", false, state);
        this.mergeState({ selectedTags: new Set<string>() });
    }

    renderDlg(): CompIntf[] {
        let buttons: Button[] = null;
        switch (this.modeOption) {
            case "search":
                buttons = [
                    new Button("Match Any", () => {
                        this.matchAny = true;
                        this.select();
                    }, null, "btn-primary"),
                    new Button("Match All", () => {
                        this.matchAll = true;
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

        return [
            new Form(null, [
                this.createTagsPickerList(),
                new ButtonBar([
                    ...buttons,
                    new Button("Edit Tags", this.edit),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    /* returns an array of objects like {tag, description} */
    parseTags = (state: AppState) => {
        if (!state.userProfile?.userTags) return null;
        let tags: any[] = [];
        let lines: string[] = state.userProfile.userTags.split(/\r?\n/);
        lines.forEach(line => {
            let tag = null;
            let description = null;
            if (line) {
                let spaceIdx = line.indexOf(" ");
                if (spaceIdx !== -1) {
                    tag = line.substring(0, spaceIdx);
                    description = line.substring(spaceIdx);
                }
                else {
                    tag = line;
                }
                tags.push({ tag, description });
            }
        });
        return tags;
    }

    createTagsPickerList = (): Div => {
        let tags = this.parseTags(this.appState);
        let div: Div = null;
        if (tags) {
            div = new Div();
            tags.forEach(tagObj => {
                let checkbox: Checkbox = new Checkbox(tagObj.tag, null, {
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
                div.addChild(new Div(null, null, [checkbox]));
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
        this.forceRender();
    }
}
