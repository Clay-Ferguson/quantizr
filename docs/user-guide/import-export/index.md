**[Quanta](/index.md) / [Quanta User Guide](/user-guide/index.md)**

* [Export and Import](#export-and-import)
    * [Export ](#export-)
    * [ZIP and TAR](#zip-and-tar)
    * [PDF](#pdf)
    * [JSON](#json)
    * [HTML](#html)
    * [Markdown](#markdown)
        * [Special Markdown Options](#special-markdown-options)
    * [Exporting to IPFS](#exporting-to-ipfs)
    * [Import](#import)

# Export and Import

# Export 

Select `Menu -> Tools -> Export` to export any node (and all its subnodes) into a downloadable archive file, or PDF.

![file-p](attachments/5fa1926c6b842575d0e9261c-file-p)


# ZIP and TAR

These options control what type of file you'll be packaging the exported files into.

# PDF

Generates a PDF file containing the entire content of the sub-branch of the tree.

If you choose PDF as the export format you'll notice a checkbox you can use that will cause a table of contents to be included at the top of the document, which is generated based on your Markdown headings (#, ##, ### etc). 

Similar to how conventional Word Processors (Document editors) can use headings and heading levels to generate indexes (Tables of Contents), Quanta does the same thing but based on the Markdown headings.

Note: As mentioned above, the `Set Headings` option will ensure the heading levels in your content match the tree structure of the content. This can be used to ensure a consistent Table of Contents in all your exported PDFs.

Here's an example of a PDF file created by exporting the User Guide node:

[PDF of User Guide](https://drive.google.com/file/d/1_tBSiFr-004zR7u7V8wCMXVDy9kAZpcE/view)

# JSON

If you want to export content as a way of doing a backup (that can later be restored/imported) select the JSON format. A JSON format will contain all the actual raw data content from the nodes. The other file export types (Markdown and HTML) are primarily for creating browsable offline copies of the data.

# HTML

Creates a single HTML file containing the content of the subgraph of the exported node. This HTML file along with all the image files and other attachments are packaged into the archive file so that when you expand the archive file you can then view the HTML file offline in your browser.

# Markdown

Exporting to Markdown exports the content pretty much verbatim as it's stored in the cloud database, because the app uses Markdown as it's primary editing format. Your exported content will be merged into a single markdown file in the exported archive unless you use the 'file' and 'folder' properties of nodes to build up a virtual folder structure which will then determine the actual delineation between files and folders.

## Special Markdown Options

When exporting to markdown there's away to control which files and folders get created to hold the content being exported. You can use the `Node Property Editing` in the editor to set a `file` property and/or the `folder` property on any node. 

When you set the `file` property on a node to something like `myfile.md` (you should always use 'md' extension) that will cause the entire content of that node and it's subgraph to end up going into that file. You can give a full path for that file as well (like: `/my/path/myfile.md`), and the exported archive file will create directories as needed and store the file in that subfolder.

However using the `file` and `folder` properties is not necessary and if omitted you'll just get a single file named `index.md` that contains all the exported data.

todo: add link to Github Pages here as an example of the output.

# Exporting to IPFS

By default, exports will be downloadable to your local machine as a TAR/ZIP (or other file) but you can also export directly to IPFS by clicking the "Save to IPFS" checkbox on the export dialog. 

When you do this, instead of getting a file you can download, you get the IPFS CID to the exported file. That is, the node content is saved to IPFS and you're given its root CID.

The IPFS option works for PDF export only.

*Note: IPFS features on this site are currently disabled*

# Import

Select `Menu -> Tools -> Import` to import a file that was previously exported. The only export formats that are supported for re-importing are the ZIP and TAR formats with the JSON content option. 

To import a file, click an empty node (i.e. a node with no subnodes) you want to import under, and then click `Menu -> Tools -> Import`. You're then prompted with a file upload dialog where you can select a file from your computer to upload.

The uploaded file will recreate a copy of the data that was exported, including its content text and attachments.


----
**[Next:  Bookmarks](/user-guide/bookmarks/index.md)**
