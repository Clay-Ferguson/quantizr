**[Quanta](/index.md) / [Quanta User Guide](/user-guide/index.md)**

* [Tree Editing](#tree-editing)
    * [Search and Replace](#search-and-replace)
    * [Cut - Paste - Delete](#cut---paste---delete)
        * [Delete](#delete)
        * [Cut and Paste](#cut-and-paste)
    * [Moving Nodes](#moving-nodes)
        * [Move To Top](#move-to-top)
        * [Move To Bottom](#move-to-bottom)
    * [Drag and Drop](#drag-and-drop)
        * [Drop to Link Nodes](#drop-to-link-nodes)
        * [Drag to Upload Files](#drag-to-upload-files)
        * [Drag To and From History](#drag-to-and-from-history)
    * [Splitting and Joining](#splitting-and-joining)
        * [Split Node](#split-node)
        * [Join Nodes](#join-nodes)
        * [Append To Parent](#append-to-parent)
    * [Set Headings](#set-headings)
    * [Node Signatures](#node-signatures)
        * [Purpose of Signatures](#purpose-of-signatures)
    * [Node Types](#node-types)
    * [Transfers](#transfers)
        * [About Admin Transfers](#about-admin-transfers)
    * [Tips](#tips)

# Tree Editing

Features for editing structured documents

# Search and Replace

Under `Menu -> Edit -> Search and Replace` you'll find the same kind of "Search and Replace" feature that exists in most text editors. You can replace text under all nodes in the subgraph of the selected node.



![file-p](attachments/63eda70f32831373361c49fe-file-p)


# Cut - Paste - Delete

You can Cut, Paste, and Delete nodes in a hierarchical way similar to how you do it in your computer's file system.

When `Edit Mode` is enabled you'll see a checkbox to the left of each node that you can use to select to Cut-and-Paste or Delete.

If you want to rapidly un-check all checkbox selections, use `Menu -> Edit -> Clear Selections`

## Delete

To delete nodes use the `Trash Can Icon` on the node, and that will delete all the nodes you've selected, or if you haven't selected multiple nodes it will just delete the node where you clicked the icon.

## Cut and Paste

To move nodes to some other location (on the Tree), select the nodes to move, and click the `Scissors Icon` on one of the nodes. Then use the "Paste Here" buttons that start appearing on the page to paste the nodes elsewhere.

If you decide you don't want to paste the nodes, click `Menu -> Edit -> Undo Cut` before you paste anywhere. Nothing actually changes in the database until you actually Paste the nodes.

# Moving Nodes

Use the up and down arrow icons on each node to move nodes up or down one position. Child nodes are ordered and maintain their position, unless you move them.

## Move To Top

`Menu -> Edit -> Move to Top` moves the selected node to the top position (above all other nodes) in its parent.

## Move To Bottom

`Menu -> Edit -> Move to Bottom` moves the selected node to the bottom position below all other nodes at its level under the parent.

# Drag and Drop

When `Edit Mode` is enabled, you can generally drag any node to any other location on the tree, by using the mouse to click the dragable icon that looks like this vertical bar of dots: 
![drag-icon](attachments/6226813b990f3a11b5c54d1d-drag-icon)



After you drag and drop a node you'll be prompted about what to do as your "Drop Action" with a dialog like the following:

![file-p](attachments/6226813b990f3a11b5c54d1d-file-p)


In the dialog above you can choose to Paste the node `Inside` (meaning as a child) the node you dragged it over or as another sibling under its same parent which is the `Inline` option.

## Drop to Link Nodes

You can also use the `Drag Gesture` to make the node you dragged have a "Link To" the node you dropped it on, and to do that you enter a "Link Name" of your choice, then click "Link". 

After you've done this nothing will have moved in the database but your "Source Node" (the one dragged) will always have a link on it that you can click to jump to the "Target Node".

## Drag to Upload Files

Files or URLs can be dragged over the app to immediately upload directly into Quanta's DB or onto IPFS.

* Upload a file by dragging it over the editor dialog.
* Upload a file into a new node by dragging it over any of the '+' (Plus Buttons) that you see on the page when you have "Edit Mode" turned on.

## Drag To and From History

You can also drag nodes to and from the History Panel (right-hand-side of page, at the bottom). Each History item displayed there is the chronological display of what nodes you've visited. This is the quickest way to move nodes from one part of the tree too some other perhaps distant part of the tree without using Cut-and-Paste.

# Splitting and Joining

The split and join functions are located at `Menu -> Edit -> ...` and below you can see how to use these features.

![file-p](attachments/64f64d24f8127d7dc133a38a-file-p)


## Split Node

When editing a node it's common to end up with multiple paragraphs of text on a single node that you end up deciding you want saved as multiple *individual* nodes instead. This is easy to fix using the 'Split Node' feature.

Here's the dialog you'll see pop up when you save some text that has double spaced content, which does this for you:

![file-p](attachments/63edbb714975b001996fac99-file-p)


Nodes can be automatically split apart, in two ways:

### Split Inline

Splits up the selected node into multiple nodes at the same level (under same parent) by using places where text is double-spaced as the delimiter (or divider) where things should be broken apart. 

### Split into Children

Performs the same kind of transformation as 'Split Inline' except it leaves the first chunk of text where it is, and then makes all the other chunks become children under that.

To split a node, first select the node (by clicking on it) and then choose `Menu -> Edit -> Split Node`. You'll see a dialog like in the image below. 

In the dialog you specify what the delimiter to split on is, as well is whether you want to keep all the nodes at the same level of the tree (inline) or whether you want the nodes split up and appended as **children** of the node you're splitting.

![file-p](attachments/64e57b8a0d3d9d7b99ea2f55-file-p)


## Join Nodes

This does the reverse of `Split Node`. This function combines multiple nodes into one node, by merging the content of all selected nodes into one block of text in one node. 

To join nodes first select (via check boxes) all the nodes you want to join, and then click `Menu -> Edit -> Join Nodes`. This will append to the first node the content from all the other nodes, and then delete those other nodes. So this means all the selected nodes get merged into the first selected node.

NOTE: If any of the nodes being joined have attachments those attachments will also end up being added to the 'joined' node.

## Append To Parent

This is similar to the `Join Nodes` function but instead of joining a set of nodes to the first one in the set, this function will append all the content of the selected nodes to their parent node.

One nice way to use this feature is when authoring documents using ChatGPT to help you write content, and GPT has answered your questions by inserting subnodes, and then you need to take the GPT-generated content and move it into the parent node.

For example if you've asked GPT something like "Rewrite this content to make it better." and you want to accept the content, this gives you a way to append it's reply content up to the parent node where you probably are wanting it inserted. So this `Append to Parent` feature saves you a bit of "Cut-and-Paste" effort in this case.

# Set Headings

Using `Menu -> Edit -> Set Headings` you can automatically update the markdown heading levels in all content under the selected node.

For example, if your selected node starts with `## My Heading` that would be a markdown heading level of "2" (two hash marks), so running `Set Headings` (when you have that node selected) would update the entire content tree heading levels below that, so direct children's headings would be level 3 (###), and below them level 4 (####) etc. for all contained hierarchical levels of content.

# Node Signatures

How to add digital signatures to nodes.

*Note: This is currently an admin-only function. Only the admin can sign nodes.*

To add a digital signature to a node (signed using your browser's signature keys), click the "Sign" checkbox that's available in the 'advanced' section of the editor dialog.

![file-p](attachments/6362b0a70aeca527dc83c3e4-file-p)


To sign all the nodes (that you own) under an entire branch of the tree, first select the node by clicking it, and then click `Menu -> Tools -> Sign`.

## Purpose of Signatures

There are many different uses for signed nodes (to prove authenticity of nodes), but the following is how it's currently used in Quanta:

Whenever the server is generating a page of content it checks to see if the node has a signature, and if there is a signature on any given node, the server will also cryptographically verify that signature. Only if the signature is valid (meaning the content text on the node is provably guaranteed to come from the user), will the yellow certification icon show up on the node.

Also for admin-owned content, if a signature fails, that node won't be displayed to the user at all, as an additional safety against database hacks. In other words, if a hacker gets all the way inside the Quanta database where they can alter data at will, they still will not be able to cause any of their hacked content to appear on the actual web page, because the only person in possession of the signature key is the admin's actual browser itself, and the admin signature key is not even stored on the server.

You can (as the admin) also request a verification of all signatures on an entire branch of the tree, by selecting that branch of the tree, and then `Menu -> Tools -> Verify Signatures`

*todo: Add more info and/or link to page discussing uploading public keys*

# Node Types

Every node has a 'type', which allows the system to customize the editing and visual presentation. Normally you can just ignore node types, because the 'Markdown Type' is used automatically by default.

The most common exception to this is that the 'reply button' does automatically create a "Reply Type" node, that behaves like a markdown node but that the system can use to filter out or include "reply content" as desired by the user, and to be able to distinguish "main content" from "commentary" on large documents.

[See Also - Semantic Web](/user-guide/semantic-web/index.md)

# Transfers

You can transfer nodes you own to a different user, so they can edit them directly, and then potentially transfer them back to you, or to someone else. A node Transfer doesn't change the location of the nodes, or alter their content in any way other than to change the node's owner.

*Note: Node Transfers is currently an 'admin-only' function*

Every node is by default 'owned' by the person who created it. The Transfer feature allows you to transfer one or more nodes from one user to another. In the Transfer Dialog you're prompted to enter (optionally) a "From" user name, and required to enter the "To" user name.

The transfer will (optionally) scan all the subnodes in the entire subgraph under the selected node and all nodes owned by the "From" user will be transferred to the new "To" user. 

If you leave the "From" field blank, then *all* nodes in the subgraph regardless of current owner, will be transferred to the "To" user.

Quanta uses a collaboration model where content is encouraged to be broken down into small sized chunks like single sentences or paragraphs. So there's  almost never a need for anyone to directly edit any actual content that was authored by someone else.

The way users normally comment on (or suggest changes to) other people's content is by doing a "Reply" directly under the node being commented on. However, you can transfer one or more nodes (that you own) to some other user of your choice, in the event that it is required for them to edit the content directly.

To initiate a transfer, select a node that you own (by clicking it in the Tree View) and then select `Menu -> Transfer -> Transfer`.

This will open a dialog like the one below, where you'll enter the usernames of the two persons involved in the transfer.

![file-p](attachments/635de23c68a8d0147326ad4e-file-p)


In the dialog above you can select `Include Subnodes` if you'd like to transfer *all* subnodes that you own under the subgraph to the other person. If there are also subnodes under that branch of the tree that you don't own, then of course none of those nodes will be transferred. Only nodes owned by the "From" user will get transferred.

## About Admin Transfers

If you're the admin and you open the Transfer dialog you'll have the option of specifying the "Transfer From" user name as well as the "Transfer To" user name. This means the admin can initiate a transfer from any arbitrary person to any other arbitrary person.

However even if the admin initiates the transfer in this way, the person on the receiving end of the transfer can still reject the transfer, and the nodes will revert back to being owned by previous owner.

# Tips

* Use the post-it note icon (at the upper right of the page) to rapidly insert a node into your "Notes" folder. You can always jump to your Notes folder using 'Menu -> Folders -> Notes'. This is the quickest way to take arbitrary notes, without having to waste time deciding where you want that info initially stored.

* You can also Drag-n-Drop a file onto the post-it icon to save the file onto a Notes node automatically.


----
**[Next:  Uploading](/user-guide/uploading/index.md)**
