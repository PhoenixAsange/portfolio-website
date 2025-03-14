let input;

function navigationRedirect(input) {
  let formattedInput = "./" + input + ".html";
  fetch(formattedInput, { method: "HEAD" }).then((response) => {
    if (response.ok) {
      window.location.replace(formattedInput);
    }
  });
}

document
  .getElementById("pageInputHome")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      input = document.getElementById("pageInputHome").value;
      input.toLowerCase();
      navigationRedirect(input);
    }
  });

document
  .getElementById("pageInputProjects")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      input = document.getElementById("pageInputProjects").value;
      input.toLowerCase();
      if (input === "home")
        input = "index";
      navigationRedirect(input);
    }
  });
