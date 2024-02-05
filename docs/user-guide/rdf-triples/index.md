**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

* [RDF Triples](#rdf-triples)
    * [Node Linking](#node-linking)
    * [How to Link two Nodes](#how-to-link-two-nodes)
        * [Create Triple ](#create-triple-)
    * [Find Subjects](#find-subjects)
    * [Link Nodes by Drag and Drop](#link-nodes-by-drag-and-drop)
    * [RDF Links on Node Graphs](#rdf-links-on-node-graphs)

# RDF Triples

How to link two nodes together. (i.e. make clickable links from one node to another)

# Node Linking

The term `RDF Triple` is the technical name for a very simple concept, which in the context of Quanta means you're linking two nodes together with a `Predicate`. The simplest (and the default) predicate can just be the word `link` itself, to indicate the relationship between two nodes is that one links to the other. Indeed the way nodes can be `linked` is to use an `RDF Triple`.

The images below show the basic concept of an RDF Tripe. It's called a `triple` because you have a Subject, Predicate, and Object. However in Quanta you can think of these as a `Source Node`, verb, and `Object Node`.

<img src='attachments/65bbdbeecf425c5fe6f2ddcf-file-img1' style='width:75%'/>


<img src='attachments/65bbdbeecf425c5fe6f2ddcf-file-p' style='width:75%'/>


# How to Link two Nodes

![file-p](attachments/65bbdd3bcf425c5fe6f2ddd4-file-p)


Under `Menu -> RDF Triple` menu item is where you will find the RDF Triple options. To link two nodes together, use the following four step process:

1) Click on the node you want to be the `Subject`
2) Click `Menu -> RDF Triple -> Set Subject`
3) Click on the node you want to be the `Object`
4) Click `Menu -> RDF Triple -> Create Triple`

The `Create Triple` function will ask you to enter the `Predicate` but you can just enter `link` for that, if you're just making an arbitrary link between the two nodes, with no particular predate relationship.

That's it! Once you've linked the nodes then the `Subject` node will always display the links (predicates) on the page, that you can click on to jump to the `Object` node.

## Create Triple 

The `Create Triple` function mentioned above leads to the following dialog where you can enter the Triple Information. The default Predicate is always simply `link` so that your association is simply a link from one node to another, but as stated above you can change that to some other word/relationship.

The `Embed Content` option can be selected if you want to actually also **display** the linked node content right inline on the page just below the node that links to it. You can access `RDF Link` dialog from the Node Editor dialog as well to change the predicate configuration any time, or delete it.

![file-p](attachments/65be7c46cf425c5fe6f2de07-file-p)


# Find Subjects

In the menu above you saw `Menu -> RDF Triple -> Find Subjects`. This menu can be used to do the reverse of jumping from a Subject to an Object node. When you click a node to highlight it, and it's the Object of one ore more `RDF Triples` you can use the `Find Subjects` function to find all the places that link to that Object node (i.e. all the nodes that are participating in an RDF Triple using the selected node as the subject)

# Link Nodes by Drag and Drop

You can also link nodes using the Drag and Drop feature. Whenever you drag a node over another node, and do the mouse Drop gesture, you will be presented with the `RDF Link` dialog shown above, and in this way you can link two nodes simply by dragging one node over the other.

*Tip: The `History Panel` (lower right section of page) can be used both as a drag gesture source, and drag gesture target, for node linking or any other Drag and Drop initiated function.*

# RDF Links on Node Graphs

You can optionally display `RDF Links` on node graphs using the controls at the top right of the Graph Display window. You have the option to either display the links as an information-only link (green dashed line) or you can choose to have the link apply a gravitational field force like the rest of the nodes in the Graph View.


----
**[Next: Addendum](/docs/user-guide/addendum/index.md)**
