typedef struct
{
    const char *title;
    const char *text;
    int value;
} Card;

static Card g_cards[64] =
{
    // Row 1
    { "The Illuminati",        "Control one rival's action. +2 Power if you control Mainstream Media.", 2 },
    { "Area 51",               "Draw 2 cards. Opponent discards 1 card.", 2 },
    { "The Men in Black",      "Cancel an opponent's special ability. Draw 1 card.", 3 },
    { "Roswell Incident",      "Reveal the top 3 cards of your deck. Add 1 to your hand, discard the rest.", 2 },
    { "Chemtrails",            "All players lose 1 Health. You gain 1 Power for each Plot in play.", 2 },
    { "MK-Ultra",              "Look at an opponent's hand. Discard 1 card from it.", 3 },
    { "New World Order",       "If you control 3 or more Groups, you win the game.", 10 },
    { "Reptilians",            "Play this card as if it were any Group. +1 Power each turn.", 3 },

    // Row 2
    { "Bilderberg",            "Draw 2 cards. Opponent reveals a card from their hand.", 2 },
    { "Bohemian Grove",        "All players discard down to 4 cards in hand.", 2 },
    { "False Flag",            "Play before an attack. Prevent all damage. Draw 1 card.", 2 },
    { "Zionist Control",       "Look at the top card of your deck at any time.", 1 },
    { "Fluoride",              "All players lose 1 Health. Draw 1 card.", 1 },
    { "HAARP",                 "Target player discards 2 random cards.", 3 },
    { "GMO",                   "All players lose 1 Power. You gain 1 Power.", 1 },
    { "Vatican Secrets",       "Draw 1 card. Search your deck for any card.", 3 },

    // Row 3
    { "Moon Landing Hoax",     "All players discard any Space cards in play.", 2 },
    { "Operation Northwoods",  "Create a False Flag token.", 2 },
    { "Sandy Hook Hoax",       "Opponent reveals hand. Choose and discard 1 non-Group card.", 3 },
    { "Big Pharma",            "All players lose 1 Health. Draw 1 card.", 2 },
    { "9/11 Inside Job",       "All players discard 1 card at random.", 4 },
    { "FEMA Camps",            "Opponent discards 2 cards. You gain 2 Power.", 3 },
    { "Satanic Ritual Abuse",  "Draw 2 cards. Then discard 2 cards.", 2 },
    { "Project Blue Beam",     "All players reveal their hands. Discard 1 card from each.", 4 },

    // Row 4
    { "The Freemasons",        "You may play an extra card this turn.", 2 },
    { "Atlantis",              "Draw 1 card. You may play it immediately.", 2 },
    { "Hollow Earth",          "Ignore all Location card effects this turn.", 3 },
    { "Thule Society",         "Add +1 to any roll or comparison.", 1 },
    { "Time Travel Program",   "Take an extra turn after this one.", 5 },
    { "Crop Circles",          "Draw 1 card. Opponent discards 1 card.", 2 },
    { "Angels Among Us",       "Prevent all damage this turn.", 3 },
    { "Draco Reptilian Empire","If you control Reptilians, draw 2 cards.", 4 },

    // Row 5
    { "D.U.M.B.S.",            "Move the top card of an opponent's deck to the bottom.", 2 },
    { "Face Recognition",      "Look at target player's hand. Discard 1 card.", 3 },
    { "Deep State",            "Return 1 card from your discard pile to your hand.", 3 },
    { "The Boiling Frog",      "All players lose 1 Power. Draw 1 card.", 2 },
    { "Opium Wars",            "Opponent discards 2 cards.", 3 },
    { "Elite Bloodlines",      "Start the game with +1 Power.", 1 },
    { "Mind Control",          "Choose a player. They skip their next turn.", 5 },
    { "Solar Manipulation",    "All players discard 1 card.", 2 },

    // Row 6
    { "Ancient Aliens",        "Draw 1 card. You may play it immediately.", 2 },
    { "Underground Tunnels",   "Move any card in play to another player.", 2 },
    { "Eugenics",              "Target player discards a card for each Group they control.", 4 },
    { "Tesla Technology",      "Draw 2 cards. Opponent discards 1 card.", 3 },
    { "The Watchers",          "At the start of your turn, draw 1 card.", 2 },
    { "Random Terror Attack",  "All players lose 2 Health. You gain 1 Power.", 4 },
    { "Decoding the Past",     "Look at the top 3 cards of your deck. Reorder them.", 2 },
    { "VRIL Society",          "Add +2 to any roll or comparison.", 2 },

    // Row 7
    { "Galactic Federation",   "Play an extra Group this turn.", 3 },
    { "Ghost Government",      "Opponent reveals hand. Choose and discard 1 card.", 3 },
    { "Space Force",           "Draw 1 card. Play a Space card from your hand.", 2 },
    { "Suppressed Technology", "Search your deck for a Technology card.", 3 },
    { "The Giants",            "All players discard a card.", 2 },
    { "Black Budget Projects", "Gain 3 Power. Discard 1 card.", 3 },
    { "Simulation Theory",     "Prevent all Event card effects this turn.", 4 },
    { "False Gods",            "All players discard 1 card.", 2 },

    // Row 8
    { "Arctic Bases",          "Search your deck for a Location card.", 3 },
    { "Stargate",              "Teleport one Group between Locations.", 4 },
    { "Nephilim",              "Gain +2 Power while this card is in play.", 4 },
    { "Remote Viewing",        "Look at the top 5 cards of any deck.", 3 },
    { "The Greys",             "Steal 1 random card from an opponent.", 4 },
    { "EMP Radiation",         "Disable all Technology cards until your next turn.", 4 },
    { "Luciferian Agenda",     "All opponents lose 1 Power.", 3 },
    { "The Truth Is Out There","If you reveal this card, draw 3 cards.", 5 },
};