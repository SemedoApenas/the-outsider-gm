/*
 * THE OUTSIDER CAMPAIGN DATA
 *
 * Edit the lists below to add, rename, or remove campaign content.
 * Keep ids unique. Image and audio paths are relative to index.html.
 */

const handouts = [
  { id: "oakhaven-square", name: "Oakhaven Town Square", image: "assets/handouts/oakhaven-square.svg", category: "Locations" },
  { id: "mission-board", name: "Mission Board", image: "assets/handouts/mission-board.svg", category: "Locations" },
  { id: "marthas-farm", name: "Martha's Farm", image: "assets/handouts/marthas-farm.svg", category: "Locations" },
  { id: "chicken-coop", name: "Empty Chicken Coop", image: "assets/handouts/chicken-coop.svg", category: "Locations" },
  { id: "captain-alden", name: "Captain Alden's Guard Post", image: "assets/handouts/captain-alden.svg", category: "Locations" },
  { id: "town-archives", name: "Oakhaven's Town Archives", image: "assets/handouts/town-archives.svg", category: "Locations" },
  { id: "whispering-forest", name: "Whispering Forest", image: "assets/handouts/whispering-forest.svg", category: "Wilderness" },
  { id: "great-tree", name: "Great Tree", image: "assets/handouts/great-tree.svg", category: "Wilderness" },
  { id: "gribble", name: "Gribble", image: "assets/handouts/gribble.svg", category: "Characters" },
  { id: "lupi-gray", name: "Lupi & Gray", image: "assets/handouts/lupi-gray.svg", category: "Characters" },
  { id: "fate-coin", name: "Fate Coin", image: "assets/handouts/fate-coin.svg", category: "Artifacts" }
];

/*
 * Put your audio files in assets/audio/ and update the file names here.
 * Short WAV ambience cues are included so the player works immediately.
 * Replace them with your own MP3, OGG, or WAV files whenever you are ready.
 */
const tracks = [
  { id: "oakhaven", name: "Oakhaven", file: "assets/audio/oakhaven.wav" },
  { id: "tavern", name: "Tavern", file: "assets/audio/tavern.wav" },
  { id: "forest", name: "Whispering Forest", file: "assets/audio/forest.wav" },
  { id: "mystery", name: "Mystery", file: "assets/audio/mystery.wav" },
  { id: "combat", name: "Combat", file: "assets/audio/combat.wav" }
];
