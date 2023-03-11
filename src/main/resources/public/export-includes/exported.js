console.log("loaded process page.");

if (marked && marked.parse) {
    var elements = document.getElementsByClassName("markdown");
    for (var i = 0; i < elements.length; i++) {
        elements[i].innerHTML = marked.parse(elements[i].innerHTML);
    }
}
else {
    console.error("marked failed to load.");
}

window.onload = function () {
    if (location.hash) {
        var elId = location.hash.replace('#', '');
        var scrollToEl = document.getElementById(elId);
        if (scrollToEl) {
            // scrollToEl.scrollIntoView(true);
            scrollToEl.style.borderLeft = "10px solid green";
        }
    }
}
