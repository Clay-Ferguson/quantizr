// Function to handle click event for images (to expand/unexpand them)
function imgClick(event) {
    const img = event.target;

    // Check if original width has been saved
    if (!img.hasAttribute("data-original-width")) {
        // Save the original width
        img.setAttribute("data-original-width", img.style.width || img.width + "px");
        // Set the width to 100%
        img.style.width = "100%";
    } else {
        // Toggle between 100% and original width
        if (img.style.width === "100%") {
            img.style.width = img.getAttribute("data-original-width");
        } else {
            img.style.width = "100%";
        }
    }
}

// Attach the imgClick function to all <img> tags after the page loads
window.addEventListener("load", () => {
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
        img.addEventListener("click", imgClick);
    });
});

