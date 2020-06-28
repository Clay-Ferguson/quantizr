# Custom Node Types

Quanta supports a very rudimentary Node Typing system, where a node can have a specific type, and render a specific way, with a custom icon, etc.

Another word for the 'Type' system in Quanta, is 'plugins'. A Node type is a specific kind of plugin, or configurable type of node. 

See also: 'podcast-plugin.md'

# Steps to add a new Type

1) Add a new Java class for the type under package 'org.subnode.mongo.model.types'

2) Add type to CoreTypesPlugin.ts (self explanatory in that file)

3) Add new TypeScript type under folder '/src/main/resources/public/ts/plugins'

# Using a Type in the App

To use types in the app the approach is that you create a node, and then with the node editor you choose 'Set Type' button, and when prompted choose the new type for the node. This means that the node will then start behaving as the new type, and normally this means the node can render itself a specific way, and may expect to have specific properties for specific purposes depending on that the type is.