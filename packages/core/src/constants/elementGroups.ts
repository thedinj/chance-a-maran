// To add a group: add a member to ElementGroupId, add a row to SYSTEM_ELEMENT_GROUPS,
// then write a migration that runs INSERT OR IGNORE for each entry.

export enum ElementGroupId {
    Drinks = "1",
    VideoGames = "2",
    BoardAndCardGames = "3",
    Props = "4",
}

export interface SystemElementGroup {
    id: ElementGroupId;
    name: string;
    sortOrder: number;
}

export const SYSTEM_ELEMENT_GROUPS: SystemElementGroup[] = [
    { id: ElementGroupId.Drinks,            name: "Drinks",             sortOrder: 10 },
    { id: ElementGroupId.VideoGames,        name: "Video Games",        sortOrder: 20 },
    { id: ElementGroupId.BoardAndCardGames, name: "Board & Card Games", sortOrder: 30 },
    { id: ElementGroupId.Props,             name: "Props",              sortOrder: 40 },
];
