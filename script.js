let username = "";
let correctIndex = 0;
let cupElements = [];

function startGame() {
  username = document.getElementById("username").value;

  if (!username) {
    alert("Enter your name");
    return;
  }

  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("menuScreen").classList.remove("hidden");

  sendToGoogleForm(username);
}

function openCupGame() {
  document.getElementById("menuScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");
}

function backToMenu() {
  document.getElementById("gameScreen").classList.add("hidden");
  document.getElementById("menuScreen").classList.remove("hidden");
}

function setupGame() {
  const count = parseInt(document.getElementById("cupCount").value);
  const container = document.getElementById("cupsContainer");

  container.innerHTML = "";
  cupElements = [];

  correctIndex = Math.floor(Math.random() * count);

  for (let i = 0; i < count; i++) {
    let cup = document.createElement("div");
    cup.className = "cup";
    cup.onclick = () => guess(i);

    if (i === correctIndex) {
      let ball = document.createElement("div");
      ball.className = "ball";
      cup.appendChild(ball);
    }

    container.appendChild(cup);
    cupElements.push(cup);
  }

  shuffleAnimation();
}

function shuffleAnimation() {
  const speed = parseInt(document.getElementById("speed").value);

  let moves = 10;

  let interval = setInterval(() => {
    let i = Math.floor(Math.random() * cupElements.length);
    let j = Math.floor(Math.random() * cupElements.length);

    // swap positions visually
    let temp = cupElements[i].style.order;
    cupElements[i].style.order = cupElements[j].style.order;
    cupElements[j].style.order = temp;

    moves--;

    if (moves <= 0) {
      clearInterval(interval);
    }

  }, speed);
}

function guess(index) {
  if (index === correctIndex) {
    document.getElementById("result").innerText = "🎉 Correct!";
  } else {
    document.getElementById("result").innerText = "💀 Wrong!";
  }
}

function sendToGoogleForm(name) {
  fetch("https://docs.google.com/forms/d/e/1FAIpQLSeDmuyrMLvlbYN_hFrcTvwISmRWOsi9oH0PdIiRq-H6YGKh7A/formResponse", {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `entry.1512615533=${encodeURIComponent(name)}`
  });
}
