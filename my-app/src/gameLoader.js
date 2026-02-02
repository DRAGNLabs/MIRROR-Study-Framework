const gameFiles = import.meta.glob("../../games/*.json", { eager: true });

const games = Object.values(gameFiles).map((module) => module.default);

games.sort((a, b) => a.title.localeCompare(b.title));

export default games;