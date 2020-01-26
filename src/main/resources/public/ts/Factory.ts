/* 
This is a 'Factory', but the main thing it does is manage the singletons, somewhat analoglous to a SpringContext
but actually existing for mostly different reasons having to do with our need to support circular 
references.

WARNING: Singletons (just like in Spring) are not allowed to do any logic that requires other modules
inside their constructors becasue there is no guarantee that all (or any) of the other Singletons have
been constructed yet.

NOTE: This Factory is allowed to import anything it wants and the way we allow Circular Dependencies to exist without
being a problem is by having the rule that no other modules are allowed to import this Factory module, 
but only the interface of it.
*/
import { PubSub } from "./PubSub";
import { Meta64 } from "./Meta64";
import { Attachment } from "./Attachment";
import { Edit } from "./Edit";
import { Encryption } from "./Encryption";
import { Constants } from "./Constants";
import { Nav } from "./Nav";
import { Podcast } from "./Podcast";
import { Props } from "./Props";
import { Render } from "./Render";
import { RSSReader } from "./RSSReader";
import { Search } from "./Search";
import { Graph } from "./Graph";
import { Share } from "./Share";
import { User } from "./User";
import { Util } from "./Util";
import { View } from "./View";
import { RssPlugin } from "./plugins/RssPlugin";
import { CoreTypesPlugin } from "./plugins/CoreTypesPlugin";
import { BashPlugin } from "./plugins/BashPlugin";
import { PasswordPlugin } from "./plugins/PasswordPlugin";
import { Singletons } from "./Singletons";
import { ActivityPub } from "./ActivityPub";
import * as React from "react";
import { LuceneIndexPlugin } from "./plugins/LuceneIndexPlugin";
import { ServerPush } from "./ServerPush";
import { LocalDB } from "./LocalDB";

export class Factory {
    /* 
    We could have implemented the
    singleton pattern in every one of these modules, but I like this better, where we centralize the
    control (sort of Inversion of Control, IoC) and make it where the objects themselves don't even 
    know they are being used as singletons (instantated only once).
    */
    singletons: Singletons;

    /*
     * Just like in a SpringContext, we init all singletons up front and this allows circular references 
     * to exist with no problems. 
     */
    constructAll = (): void => {
        this.singletons = {
            meta64: new Meta64(),
            util: new Util(),
            push: new ServerPush(),
            edit: new Edit(),
            attachment: new Attachment(),
            encryption: new Encryption(),
            nav: new Nav(),
            activityPub: new ActivityPub(),
            props: new Props(),
            render: new Render(),
            graph: new Graph(),
            srch: new Search(),
            share: new Share(),
            user: new User(),
            view: new View(),
            podcast: new Podcast(),
            rssPlugin: new RssPlugin(),
            coreTypesPlugin: new CoreTypesPlugin(),
            bashPlugin: new BashPlugin(),
            luceneIndexPlugin: new LuceneIndexPlugin(),
            passwordPlugin: new PasswordPlugin(),
            rssReader: new RSSReader(),
            localDB: new LocalDB(),

            //Use this version of the render method to help troubleshoot missing 'key' props
            //todo-1: move this function into some other static location that is safe to import
            //with zero risk of any circular references.
            // e: (func: any, props: any, ...children: any): any => {
            //     if (props && !props.key) {
            //         throw new Error("PROPS missing key on createElement: "+props);
            //     }
            //     return React.createElement(func, props, ...children);
            // }
            e: React.createElement
        };

        PubSub.pub(Constants.PUBSUB_SingletonsReady, this.singletons);
        console.log("Factory.constructAll complete.");
    }
}
