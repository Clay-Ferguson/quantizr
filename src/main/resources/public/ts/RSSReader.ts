import { RSSReaderIntf } from "./intf/RSSReaderIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import axios from 'axios';

/*
WARNING: This code was experimental and never worked fully becasue the feed i was testing it on refused to send
anything but HTML back, which is NOT RSS, and i ended up trying to add '?format=xml' to the request and that
worked. I need some way to detect this is happening, but for now i'll just go back to showing an error when
the preferred rss processor is failing for any reason.
*/

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class RSSReader implements RSSReaderIntf {

    FAKE_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)Chrome/53.0.2785.143Safari/537.36";

    readFeed = (feedSrc: string, callback: Function): void => {

        // accepts:{
        //     xml:"application/rss+xml"
        // },
        // dataType:"xml",     

        axios.get(feedSrc, {
            //responseType: "document",
            headers: {
                //"Accept": "application/rss+xml",
                "user-agent" : this.FAKE_USER_AGENT 
            },
        })
            .then((response) => {
                if (response.status == 200) {
                    this.processData(response.data, callback);
                }
            })
            .catch((error) => {
                console.log(error);
            });
    }

    //NOTE: I'm commenting this whole function becasue I've gotten rid of JQuery, but actually now that i have a single-node-per-feed plugin for RSS feeds
    //that does the Feed rendering differently i think this whole RSSReader clas can be deleted now ?
    processData = (data: string, callback: Function): void => {
        //onsole.log("RSS: " + data);
        // try {
        //     let xmlDoc = $.parseXML(data); 
        //     let $xml = $(xmlDoc);
        //     let $title = $xml.find("title");
        //
        //     $(xmlDoc).find("item").each(function () { // or "item" or whatever suits your feed
        //         let el = $(this);
        //         console.log("------------------------");
        //         console.log("title      : " + el.find("title").text());
        //         console.log("link       : " + el.find("link").text());
        //         console.log("description: " + el.find("description").text());
        //     });
        // }
        // catch (error) {
        // }
    }
}
