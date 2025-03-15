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

const form = document.getElementById('form');
const result = document.getElementById('result');

form.addEventListener('submit', function(e) {
  e.preventDefault();
  const formData = new FormData(form);
  const object = Object.fromEntries(formData);
  const json = JSON.stringify(object);
  result.innerHTML = "Please wait...";

  fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: json
  })
  .then(async (response) => {
    let json = await response.json();
    if (response.status == 200) {
      result.innerHTML = "Form submitted successfully";

      // Redirect to index.html after a short delay
      setTimeout(() => {
        window.location.href = './index.html';
      }, 2000); // Adjust the delay if needed
    } else {
      console.log(response);
      result.innerHTML = json.message;
    }
  })
  .catch(error => {
    console.log(error);
    result.innerHTML = "Something went wrong!";
  })
  .then(function() {
    form.reset();
    setTimeout(() => {
      result.style.display = "none";
    }, 3000);
  });
});