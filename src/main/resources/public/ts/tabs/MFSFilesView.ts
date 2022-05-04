import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { IconButton } from "../comp/core/IconButton";
import { Span } from "../comp/core/Span";
import { Spinner } from "../comp/core/Spinner";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { MFSFilesViewProps } from "./MFSFilesViewProps";

export class MFSFilesView extends AppTab<MFSFilesViewProps> {

    constructor(data: TabIntf<MFSFilesViewProps>) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);

        let children = [];

        if (this.data.props.loading) {
            children.push(new Div(null, null, [
                new Heading(4, "Loading Web3 Files..."),
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]));
        }
        else {
            children.push(new Heading(4, "Web3 Files"));
            children.push(new Div(this.data.props.mfsFolder || "", { className: "marginButtom" }));

            children.push(new ButtonBar([
                new Button("Root Folder", this.goToRoot, {
                    title: "Go to root folder."
                }),
                new Button("Parent Folder", this.goToParent, {
                    title: "Parent Folder}"
                }),
                new IconButton("fa-refresh", "Refresh", {
                    onClick: () => this.refreshFiles(),
                    title: "Refresh"
                })
            ]));

            if (this.data.props.mfsFiles) {
                this.data.props.mfsFiles.forEach((file: J.MFSDirEntry) => {
                    let type = (file.Type === 0 || file.Size > 0) ? "file" : "folder";
                    let fullName = this.data.props.mfsFolder + "/" + file.Name;

                    children.push(new Div(null, { className: "marginTop" }, [
                        new Span(file.Name + " (" + type + ")", {
                            onClick: () => { this.openItem(fullName); },
                            className: "clickable"
                        }),
                        new Span(" [delete]", {
                            onClick: () => { this.deleteItem(fullName); },
                            className: "clickable"
                        })
                    ]));

                });
            }
        }

        this.setChildren([new Div(null, { className: "mfsFileView" }, children)]);
    }

    deleteItem = (item: string) => {
        dispatch("Action_deleteMFSFile", (s: AppState): AppState => {
            this.data.props.loading = true;
            return s;
        });

        setTimeout(async () => {
            let res: J.DeleteMFSFileResponse = await S.util.ajax<J.DeleteMFSFileRequest, J.DeleteMFSFileResponse>("deleteMFSFile", {
                item
            });

            this.refreshFiles();
        }, 100);
    }

    openItem = (folder: string) => {
        dispatch("Action_RefreshMFSFiles", (s: AppState): AppState => {
            this.data.props.loading = true;
            return s;
        });

        setTimeout(async () => {
            let res: J.GetMFSFilesResponse = await S.util.ajax<J.GetMFSFilesRequest, J.GetMFSFilesResponse>("getMFSFiles", {
                folder
            });

            dispatch("Action_GotMFSFiles", (s: AppState): AppState => {
                this.data.props.loading = false;
                this.data.props.mfsFiles = res.files;
                this.data.props.mfsFolder = res.folder;
                return s;
            });
        }, 100);
    }

    goToParent = () => {
        let parent = S.util.chopAtLastChar(this.data.props.mfsFolder, "/");
        console.log("parent = " + parent);
        if (parent) {
            this.openItem(parent);
        }
    }

    refreshFiles = () => {
        setTimeout(async () => {
            this.openItem(this.data.props.mfsFolder);
        }, 100);
    }

    goToRoot = () => {
        setTimeout(async () => {
            this.openItem(null);
        }, 100);
    }
}
