export const getNowTime = (): [number, number, number, string[]] => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    const today = now.getDate();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    return [thisYear, thisMonth, today, dayNames];
};