// seeding db with some random test books
const db = require("../config/connection");

// returns a random entry from array
function randomChoice(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

// generates isbn10 or 13. does isbn13 by default.
function randomISBN(place) {
  const places = place === 10 ? 10_000_000_000 : 10_000_000_000_000;
  return Math.floor(Math.random() * places);
}

const testbooks = 30;

const dates = ["2012", "2023", "2005", "2001", "1994", "2000", "2015"];
const randomAuthors = [
  "Jared Leto",
  "Jimmy Fallon",
  "Jamie Foxx",
  "SZA",
  "Kendrick Lamar",
  "The Tooth Fairy",
  "Conan O'Brien",
  "God The Father",
  "God The Son",
  "God The Holy Spirit",
  "Obama",
  "Ludacris",
  "Mom",
];
const qtys = [1, 2, 3, 4, 5];

for (let i = 0; i < testbooks; i++) {
  db.execute(
    `
    INSERT INTO books (isbn13, isbn10, title, author, quantity, published_year)
    VALUES
    (?, ?, ?, ?, ?)`,
    [
      randomISBN(),
      randomISBN(10),
      `testbook${i}`,
      `${randomChoice(randomAuthors)}`,
      `${randomChoice(qtys)}`,
      `${randomChoice(dates)}`,
    ]
  );
}
