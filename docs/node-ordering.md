# Ordering

The ordering of each node on the page under its parent (i.e. on the tree structure that makes up the Quanta content tree), is by 'ordinal' position and each node remains at the same position in that order, when displayed.

There is only one type of non-ordinal ordering that's currently supported and that is to sort on property 'priority'.

All that's required to enable a node to sort it's children by priority is to add the following property to the node (the parent of the ones to sort)

    orderBy=priority asc

Any node can have this orderBy property to control the sort of it's children. This value is sorting by what's shown in the 'priority' Selection control that exists on each node.