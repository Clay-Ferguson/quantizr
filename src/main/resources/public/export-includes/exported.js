console.log("loaded process page.");

var elements = document.getElementsByClassName("markdown");
for (var i = 0; i < elements.length; i++) {
    elements[i].innerHTML = marked(elements[i].innerHTML);
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