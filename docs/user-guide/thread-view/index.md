**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

# Thread View

Viewing all ancestors (parent) of a node.

Since the platform data (nodes) is a tree structure, and since replies to content (regardless of whether you're talking to an AI or an actual person) are always created as subnodes under the node being replied to, it can sometimes be easier to interact with the content by switching to a more linear, top-to-bottom, chronological view of a specific conversation thread.

This is what the Thread View is designed for. You can switch to the Thread View of any node by clicking the dropdown menu item `Thread History` on the node. This will display the Thread View which always contains a top-down chronological list of all the ancestor nodes.

Here's what the menu looks like, after you click the `"..."` icon:

![file-p](attachments/65f73a78cb4027493226dd11-file-p)


Since each node has only one parent node, you can envision the process of walking up the tree node by node, always taking the parent and then the parent above that, etc, repeatedly. This process builds up the 'reply chain' above the node (if the node is part of a conversation), going back to the beginning of the conversation. Then the Thread View displays the entire conversation, from top to bottom.

# AI Chat - Use Case for Thread View

One scenario where the Thread View is very useful is when chatting with AI (Large Language Models). For this reason, any time you ask a question to an AI, the app will automatically switch you over to the Thread View so you can see the entire back and forth conversation thread between you and the AI. You can then ask followup questions by clicking a button at the bottom, similar to how most other AI chat interfaces work.

When doing AI chats in this way, it's also important to know that whatever you see in the Thread View will also be the actual and entire "Conversation Context" that's known to the AI. It knows what you've said previously only based on the specific conversation itself.

As mentioned in the AI Section of this User Guide, you can always jump back over to your Content Tree (Folders Tab), and branch off at any prior location in the past conversation, by asking a different question than you had originally asked. When you branch off like this, the entire tree is persisted of course, but the actual "Context" for the AI Conversation will still be just the sum total of all parents above the node where you ask the question at any time.


----
**[Next: Searching](/docs/user-guide/searching/index.md)**
