let correctCup = 0;
let username = "";

function startGame() {
  username = document.getElementById("username").value;

  if (!username) {
    alert("Enter your name");
    return;
  }

  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");

  shuffle();
  sendToGoogleForm(username);
}

function shuffle() {
  correctCup = Math.floor(Math.random() * 3);
  document.getElementById("question").innerText = "Where is the coin?";
  document.getElementById("result").innerText = "";
}

function guess(index) {
  if (index === correctCup) {
    document.getElementById("result").innerText = "🎉 Correct!";
  } else {
    document.getElementById("result").innerText = "💀 Wrong!";
  }
}

function restart() {
  shuffle();
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