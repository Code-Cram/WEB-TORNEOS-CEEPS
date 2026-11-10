import type { TorneoId } from "./config";

/*
 * Textos por defecto de cada torneo en inglés (los de config.ts, traducidos). Se usan en la web en inglés mientras el
 * texto en español siga siendo el de por defecto; si el Consejo lo cambia, sale su versión en inglés del panel o, si no
 * la ha escrito, el texto en español.
 */
export const TORNEOS_EN: Record<TorneoId, { nombre: string; lema: string; lugar: string; calendario: string; formato: string; premios: string; reglas: string }> = {
  futbol: {
    nombre: "2nd Futsal Tournament",
    lema: "Single-match knockout · 2 × 30 min",
    lugar: "UAM sports facilities",
    calendario: "",
    formato:
      "Single-elimination knockout, one match of 2 × 30 min.\nIf it's a draw, it goes to penalties.\nIf there aren't enough teams to fill the bracket, the draw gives byes to the second round.",
    premios:
      "1st €300 for the winning team, which chooses how to receive it:\n- Option A: €300 for the team as a whole.\n- Option B: a gift card for each player, splitting the €300 equally.\n- Example: a team of 10 players chooses between €300 for the team or 10 gift cards of €30 (with 12 players, 12 cards of €25).",
    reglas: [
      "The match:",
      "- 2 halves of 30 minutes.",
      "- 5 on the pitch per team (4 plus the goalkeeper). Unlimited rolling substitutions.",
      "- No offside. Throw-ins and corners are taken with the foot.",
      "Refereeing: the players referee themselves. The fouled player calls the foul and, if in doubt, the two captains decide. Fair play above all.",
      "Draw: 3 penalties per team. If still level, one each until one scores and the other misses.",
      "No-show: if a team hasn't arrived 10 minutes after kick-off, the opponent goes through.",
      "Ball: each team brings one.",
      "Captains: add each player's email in «Manage my team» so they can log in to the website.",
      "Note: anything not covered here is decided by the organisers.",
    ].join("\n"),
  },
  mus: {
    nombre: "1st Mus Tournament",
    lema: "In pairs · best of 3 games to 40 points",
    lugar: "EPS cafeteria (microwave area)",
    calendario:
      "Tuesday 17 Nov, 16:00 · left half of the bracket, up to its semi-final\nWednesday 18 Nov, 16:00 · right half of the bracket, up to its semi-final\nFriday 20 Nov, 16:00 · final and 3rd/4th place match",
    formato:
      "In pairs, single elimination until the champion pair.\nEach match is best of 3 games to 40 points. The final is best of 5.\nEach half of the bracket is played on a different day, so not all pairs have to come at once.\nThe two pairs that lose in the semi-finals play for 3rd and 4th place.",
    premios:
      "1st 2 €50 gift cards and 2 decks of cards\n2nd 2 €20 gift cards and 2 decks of cards\n3rd 2 €10 gift cards and 2 decks of cards\n4th 2 decks of cards\nOne card and one deck for each member of the pair (8 decks in total among the top four pairs).",
    reglas: [
      "Each hand is played in four **lances** (rounds), in this order:",
      "1. Grande (high): the highest hand wins (kings first).",
      "2. Chica (low): the lowest hand wins (aces first).",
      "3. Pares (pairs): a pair (1), medias – three of a kind (2) or duples – two pairs (3 points).",
      "4. Juego / Punto: 31 or more; if nobody has juego, punto is played (closest to 30).",
      "Juego ranking: 31 · 32 · 40 · 37 · 36 · 35 · 34 · 33. 31 is worth 3 points; the other juegos, 2; punto, 1.",
      "Values: jack (sota), knight (caballo) and king are worth 10; the ace, 1; the rest, their number.",
      "Bets: «envido» (2 points), «quiero» (accept), «no quiero» (decline) and the **órdago**, which plays the whole game at once. Points are counted with amarracos (5) and stones (1).",
      "Note: the variant (4 or 8 kings) and whether signals are allowed will be confirmed by the organisers before starting.",
    ].join("\n"),
  },
  poker: {
    nombre: "1st Poker Tournament",
    lema: "8 qualifying tables · final table of 8",
    lugar: "EPS cafeteria (microwave area)",
    calendario: "Tuesday 10 Nov, 16:00 · qualifying round, 1st session\nThursday 12 Nov, 16:00 · qualifying round, 2nd session\nFriday 13 Nov, 16:00 · final table",
    formato:
      "8 qualifying tables of 8 players, spread between Tuesday 10 and Thursday 12 according to each player's availability.\nThe winner of each table goes through to the final table on Friday 13.\nNo dealer at the qualifying tables (players take turns dealing); the final table has a dealer from the Council.\n64 places in order of sign-up; the rest go on a waiting list to cover drop-outs.",
    premios: "1st €100 gift card\n2nd €50 gift card\n3rd €20 gift card\nThe 8 players at the final table get a deck of cards as a gift.",
    reglas: [
      "No-limit Texas Hold'em: each player gets 2 private cards and 5 community cards are dealt face up on the table (3 on the flop, 1 on the turn and 1 on the river). The best 5-card hand out of the 7 wins.",
      "Hands, from best to worst:",
      "1. Royal flush: A K Q J 10 of the same suit.",
      "2. Straight flush: 5 consecutive cards of the same suit.",
      "3. Four of a kind: 4 cards of the same rank.",
      "4. Full house: three of a kind plus a pair.",
      "5. Flush: 5 cards of the same suit.",
      "6. Straight: 5 consecutive cards.",
      "7. Three of a kind: 3 cards of the same rank.",
      "8. Two pair: two pairs.",
      "9. Pair: 2 cards of the same rank.",
      "10. High card: if nobody has anything, the highest card wins.",
      "Betting: there's one round before the flop and another after each community card. On your turn you can check, bet, call, raise or fold; going **all-in** means betting all your chips.",
      "Blinds: the two players to the left of the button post the small and big blind before the deal. The button moves to the next player each hand.",
      "Your table: there's no dealer, whoever has the button deals. The table is won by whoever ends up with all the chips, and they go through to the final table on Friday 13.",
      "Note: the starting chips and how often the blinds go up will be explained by the organisers at the start. If you can, bring chips.",
    ].join("\n"),
  },
};
