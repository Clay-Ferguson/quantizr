**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

* [Content Layout](#content-layout)
    * [Image Layout](#image-layout)
        * [Example Layout 1 ](#example-layout-1-)
        * [Example Layout 2](#example-layout-2)
        * [Positioning Images](#positioning-images)
    * [Node Layout](#node-layout)
    * [Tips](#tips)

# Content Layout

How to organize how images and subnodes are displayed.

# Image Layout

When you upload multiple images onto a node, the images will, by default, be arranged and displayed from left to right, and top to bottom according to the widths of each image.

## Example Layout 1 

Below you can see we've uploaded 4 images to a node, and set their widths to 100%, 33%, 33%, 33%.

![file-p](attachments/63674119e5ff8517e39ebde7-file-p)


The above width settings display on the page as shown below. The first image is 100% width, and the rest are 33%. They're displayed in the order you have them arranged on the node.

If you wanted a 2 column tabular layout you could set all images to 50%, 3 column label would be 33%, 4 column layout 25%, etc.

<img src='attachments/63674133e5ff8517e39ebe04-file-p' style='width:100%'/>


## Example Layout 2

Next we'll edit the Node Attachments and set them all to 50% width.

![Screenshot from 2023-02-19 16-48-41.png](attachments/63f2a20f55770e1b97ddfcef-Screenshot_from_2023-02-19_16-48-41.png)


Here's how the above settings will display the images (below). As expected, we see images displayed from left to right, top to bottom, with each one consuming 50% of the available width before wrapping to the next row.

<img src='attachments/63f2a78e55770e1b97ddff53-Screenshot_from_2023-02-19_16-50-22.png' style='width:100%'/>


## Positioning Images

If you want one or more images to appear at arbitrary locations in the content text of the node you can specify the "Position" option as "File Tag". Here's an example of that on a node with one single image, which we've chosen to insert in the middle of some content text.

![Screenshot from 2023-02-19 16-57-41.png](attachments/63f2a96c55770e1b97de0007-Screenshot_from_2023-02-19_16-57-41.png)


This is how that renders (below), with the image being inserted wherever you put it's tag (`{{file-p}}` in this case). Each File will have a unique name when you upload multiple files, so you can insert multiple images wherever you want them to go in your content.

![Screenshot from 2023-02-19 17-05-14.png](attachments/63f2a9cc55770e1b97de0032-Screenshot_from_2023-02-19_17-05-14.png)


Other positioning options are as shown in the screenshot below (`Center, Top Left, and Top Right`) and they all position images as you would expect.

![Screenshot from 2023-02-19 17-08-25.png](attachments/63f2abd255770e1b97de0086-Screenshot_from_2023-02-19_17-08-25.png)


# Node Layout

You can also configure how subnodes are displayed under any given node, if you want something other than the normal top-to-bottom view of content. 

In the screenshot below you can see the 'admin' user editing the "Platform Features" node on the "Quanta.wiki" website, and you can see that the `Subnode Layout` is set to `2 columns`

![Screenshot from 2023-02-19 18-29-58.png](attachments/63f2ad4455770e1b97de00cd-Screenshot_from_2023-02-19_18-29-58.png)


That `2 columns` layout then ends up looking like the following image (below), where the subnodes under the "Platform Features" are displayed on 2 columns per row.

<img src='attachments/63f2bffe55770e1b97de0732-Screenshot_from_2023-02-19_18-34-01.png' style='width:100%'/>


You can also click the option for `Inline Subnodes` which is the double down arror in this control bar:


![file-p](attachments/63f2c06255770e1b97de0788-file-p)



which will expand the subnodes on the page with their parent so that the user can see them without expanding the tree.

# Tips

1) Click on any uploaded image to view it full-screen, or navigate around between all images under the same parent node. 


2) CTRL-Click any image to zoom in/out on the location of the image where you clicked


----
**[Next Page -> Document View](/docs/user-guide/document-view/index.md)**
