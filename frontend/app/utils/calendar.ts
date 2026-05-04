export const generateCalendarDays = (year: number, month: number) => {
    //月の初日の曜日(0:日、1:月...)
    const firstDayOfMonth = new Date(year, month-1, 1).getDay();

    //月の末日
    const lastDate = new Date(year, month, 0).getDate() + 1;

    //月の初日より前の空白を埋める
    const days = Array(firstDayOfMonth).fill(" ");

    for(let d=1; d < lastDate; d++) days.push(d);

    return days;
};